import {
  fetchCourseDetail,
  fetchCourseList,
  CourseDetailResponse,
  SubtitleEntry,
  updateUserProgress,
  recordUserProgress,
  reportStudyTime,
  fetchWordLookup,
} from '../../utils/api'
import { API_BASE_URL } from '../../config/env'
import {
  FEATURE_FLAGS,
  resolveInteractiveFeaturesEnabled,
} from '../../config/feature-flags'
import { reportMetric } from '../../utils/metrics'
import {
  STARRED_CUES_STORAGE_KEY,
  StarredCueMap,
  getStarredCueIds,
  isCueStarred,
  normalizeStarredCueMap,
  toggleStarredCue,
} from '../../utils/practice-marks'
import {
  REVIEW_LIBRARY_STORAGE_KEY,
  ReviewLibrary,
  ReviewWord,
  normalizeReviewLibrary,
  removeReviewCue,
  upsertReviewCue,
  upsertReviewWord,
} from '../../utils/review-library'
import { NextSceneCandidate, resolveNextScene } from '../../utils/next-scene'
import { decideRecordAuthAction } from './record-auth'
import { debounce, throttle } from '../../utils/storage'
import {
  subscribe,
  getState as getStoreState,
  setProgress as updateProgressInStore,
  setUser as updateUserInStore,
} from '../../store/index'
import type { StoreState } from '../../store/index'
import {
  buildAppMessageShare,
  buildTimelineShare,
  enablePageShareMenu,
} from '../../utils/share'
import {
  renderSharePoster,
} from '../../utils/share-poster'
import * as playerCore from './player-core'
import {
  BackgroundAudioResumeState,
  BackgroundResumeStore,
  buildBackgroundPlaybackMeta,
  createBackgroundResumeStore,
  findSubtitleByCourseTime,
  resolveEchoToShadowSwitchState,
  resolveCourseTimeFromForeground,
  resolveForegroundResumeState,
  resolveObservedShadowCourseTime,
  resolveShadowPlaybackStartTime,
  resolveShadowModeSwitchState,
  shouldApplyShadowSeekCorrection,
} from './shadow-background-handoff'
import {
  AudioSourceOption,
  AudioSourceProvider,
  buildAudioSourceOptions,
  getNextAudioSourceOption,
  normalizeAudioSourceConfig,
} from './audio-source-fallback'
import { buildCourseShareCardModel } from './course-share-card'
import { resolveStagePresentation } from './course-mode-config'
import { renderCourseCompletionPoster } from './course-completion-poster'
import { tokenizeSubtitle, type SubtitleToken } from './subtitle-tokenizer'
import {
  buildTimedDialogueSentences,
  resolveSpeakerToneClass,
} from '../../utils/dialogue-format'

const BACKGROUND_AUDIO_COVER_URL = `${API_BASE_URL}/static/waimao-mini/icon.png`
const COURSE_SHARE_CANVAS_ID = 'course-share-canvas'
// 主题主色（business 藏青），供 wxml 内联属性使用（slider activeColor 等吃不到 less 变量）
const THEME_ACCENT_COLOR = '#1e40af'
const COURSE_DEBUG_STORAGE_KEY = 'waimao_mini_debug_logs'
const COURSE_STAGE_GUIDE_SEEN_KEY = 'waimao_course_stage_guide_seen_v1'

type CourseWindowInfo = {
  windowWidth: number
  windowHeight: number
  safeArea?: {
    top?: number
    bottom?: number
  }
}

function getCourseWindowInfo(): CourseWindowInfo {
  const wxCompat = wx as typeof wx & {
    getWindowInfo?: () => CourseWindowInfo
  }
  return wxCompat.getWindowInfo?.() ?? wx.getSystemInfoSync()
}

function isCourseDebugEnabled() {
  try {
    return Boolean(wx.getStorageSync(COURSE_DEBUG_STORAGE_KEY))
  } catch (_error) {
    return false
  }
}

const nativeConsole = globalThis.console
const console = {
  log: (...args: unknown[]) => {
    if (isCourseDebugEnabled()) {
      nativeConsole.log(...args)
    }
  },
  warn: (...args: unknown[]) => {
    if (isCourseDebugEnabled()) {
      nativeConsole.warn(...args)
    }
  },
  error: (...args: unknown[]) => {
    if (isCourseDebugEnabled()) {
      nativeConsole.error(...args)
    }
  },
}

const audioRequestLogger = typeof nativeConsole.info === 'function'
  ? nativeConsole.info.bind(nativeConsole)
  : nativeConsole.log.bind(nativeConsole)

function getAudioRequestSource(url: string) {
  const value = String(url || '')
  if (/^https:\/\/(?:waimao-)?audio\.englishecho\.site\/audio\//.test(value)) {
    return '七牛 CDN 整段'
  }
  if (/^https:\/\/englishecho\.site\/static\/audio-segments\//.test(value)) {
    return '服务器切片'
  }
  if (/^https:\/\/englishecho\.site\/static\/audio\//.test(value)) {
    return '服务器整段'
  }
  if (/^https:\/\/cdn\.jsdmirror\.com\//.test(value)) {
    return 'jsdmirror 整段'
  }
  if (/^https:\/\/audio\.qclawhub\.com\//.test(value)) {
    return 'Cloudflare R2 整段'
  }
  return '其他'
}

function logAudioRequest(event: string, url: string, extra: Record<string, unknown> = {}) {
  audioRequestLogger('[AudioRequest]', {
    event,
    source: getAudioRequestSource(url),
    url,
    ...extra,
  })
}

type ViewSubtitle = SubtitleEntry & {
  timeLabel: string
  durationLabel: string
  tokens: SubtitleToken[]
  toneClass: string
  sourceSubtitleId: string
  sourceIndex: number
  segmentIndex: number
  segmentCount: number
  starred?: boolean
}

type CourseSummary = {
  id: string
  title: string
  tag?: string
  audio: string
}

type CourseRange = {
  start: number
  end: number
}

type CoursePageData = {
  course: CourseSummary | null
  subtitles: ViewSubtitle[]
  loading: boolean
  error: string | null
  currentSubtitleId: string | null
  playing: boolean
  scrollIntoView: string
  scrollTop: number
  leadText: string
  playMode: 'shadow' | 'echo'
  stage: playerCore.LearningStage
  gapEnabled: boolean
  gapWaiting: boolean
  playbackRate: number
  showSpeedModal: boolean
  speedPresets: number[]
  isRepeating: boolean
  repeatCount: number
  repeatTarget: number
  transcriptMode: 'all' | 'en' | 'zh'
  showAiPopup: boolean
  aiText: string
  aiContext: string
  audioLoading: boolean  // 音频加载中状态
  wordPopupVisible: boolean
  wordPopupWord: string
  wordPopupDefinition: string
  wordPopupPhoneticUk: string
  wordPopupPhoneticUs: string
  wordPopupAudioUk: string
  wordPopupAudioUs: string
  wordPopupLeft: number
  wordPopupTop: number
  wordPopupPlacement: 'top' | 'bottom'
  wordPopupLoading: boolean
  wordPopupError: string
  wordPopupReady: boolean
  shareImageUrl: string
  showModeSelector: boolean
  showShadowMode: boolean
  showPracticeControls: boolean
  showStageGuide: boolean
  themeAccent: string
  recording: boolean
  recordReady: boolean
  comparing: boolean
  showCompletionPanel: boolean
  completionStats: { totalCues: number; practicedCount: number }
  nextScene: NextSceneCandidate | null
  reviewOnlyMode: boolean
  starredCueCount: number
  audioPlaybackEnabled: boolean
}

type SubtitleLike = Pick<SubtitleEntry, 'id' | 'start' | 'end'>

type ShadowBackgroundHandoffState = {
  active: boolean
  wasPlaying: boolean
  courseId: string
  subtitleId: string | null
  handoffAt: number
}

const formatSeconds = (seconds: number) => {
  const value = Math.max(0, seconds)
  const h = Math.floor(value / 3600)
  const m = Math.floor((value % 3600) / 60)
  const s = Math.floor(value % 60)

  if (h > 0) {
    return `${padZero(h)}:${padZero(m)}:${padZero(s)}`
  }
  return `${padZero(m)}:${padZero(s)}`
}

const padZero = (value: number) => value.toString().padStart(2, '0')

Page<CoursePageData, WechatMiniprogram.IAnyObject>({
  data: {
    course: null,
    subtitles: [],
    loading: false,
    error: null,
    currentSubtitleId: null,
    playing: false,
    scrollIntoView: '',
    scrollTop: 0,
    leadText: '',
    playMode: 'shadow',
    stage: 'listen',
    gapEnabled: false,
    gapWaiting: false,
    playbackRate: 1,
    showSpeedModal: false,
    speedPresets: [0.5, 0.75, 1, 1.25, 1.5, 2],
    isRepeating: false,
    repeatCount: 0,
    repeatTarget: 10,
    transcriptMode: 'all',
    showAiPopup: false,
    aiText: '',
    aiContext: '',
    audioLoading: true,  // 默认音频加载中
    wordPopupVisible: false,
    wordPopupWord: '',
    wordPopupDefinition: '',
    wordPopupPhoneticUk: '',
    wordPopupPhoneticUs: '',
    wordPopupAudioUk: '',
    wordPopupAudioUs: '',
    wordPopupLeft: 0,
    wordPopupTop: 0,
    wordPopupPlacement: 'top',
    wordPopupLoading: false,
    wordPopupError: '',
    wordPopupReady: false,
    shareImageUrl: '',
    showModeSelector: true,
    showShadowMode: true,
    showPracticeControls: false,
    showStageGuide: false,
    themeAccent: THEME_ACCENT_COLOR,
    recording: false,
    recordReady: false,
    comparing: false,
    showCompletionPanel: false,
    completionStats: { totalCues: 0, practicedCount: 0 },
    nextScene: null,
    reviewOnlyMode: false,
    starredCueCount: 0,
    audioPlaybackEnabled: FEATURE_FLAGS.audioPlayback,
  },
  courseId: '' as string,
  // InnerAudioContext (用于 Shadow 模式)
  audioContext: null as WechatMiniprogram.InnerAudioContext | null,
  audioSource: '',
  wordAudioContext: null as WechatMiniprogram.InnerAudioContext | null,
  pendingWordLookup: '' as string,
  wordTapLockUntil: 0 as number,
  activeSubtitle: null as SubtitleLike | null,
  audioReady: false,
  pendingSubtitle: null as SubtitleLike | null,
  stopTimer: null as number | null,
  gapTimer: null as number | null,
  recorderManager: null as WechatMiniprogram.RecorderManager | null,
  recordingAudioContext: null as WechatMiniprogram.InnerAudioContext | null,
  recordedTempPath: '' as string,
  recordedCueId: '' as string,
  compareStep: '' as '' | 'original' | 'mine',
  practiceCounts: {} as Record<string, number>,
  // Shadow模式音频降级：服务器备用地址
  serverAudioUrl: '' as string,
  usingFallbackAudio: false,
  audioSourceOptions: [] as AudioSourceOption[],
  activeAudioSourceProvider: '' as AudioSourceProvider | '',
  // 其他
  storeUnsubscribe: undefined as (() => void) | undefined,
  studySessionStart: null as number | null,
  studySessionPracticeStart: 0,
  pendingFocusCueId: '',
  focusPracticeRequested: false,
  focusAutoplayRequested: false,
  reviewOnlyRequested: false,
  currentSubtitleIndex: 0,
  trackingTimer: null as number | null,
  backgroundAudioManager: null as any,
  shadowHandoffState: null as ShadowBackgroundHandoffState | null,
  backgroundPlaybackActive: false,
  isRecoveringFromBackground: false,
  pendingBackgroundAudioRestore: false,
  pendingShadowResume: null as { courseTime: number; shouldAutoplay: boolean } | null,
  pendingShadowSeek: null as { targetTime: number; shouldAutoplay: boolean; src: string } | null,
  lastEchoCompletion: null as { subtitleId: string; courseTime: number } | null,
  lastKnownCourseTime: 0,
  audioLoadTimeoutController: null as playerCore.AudioLoadTimeoutController | null,
  backgroundAudioLoadTimeoutController: null as playerCore.AudioLoadTimeoutController | null,
  backgroundResumeStore: null as BackgroundResumeStore | null,
  audioRequestStartedAt: 0,
  backgroundAudioRequestStartedAt: 0,
  backgroundAudioReady: false,
  backgroundAudioFallbackPending: false,
  audioLoadingMaskVisible: false,
  suppressMainAudioContextEvents: false,
  swipeStartX: null as number | null,
  swipeStartY: null as number | null,
  swipeTriggered: false,
  wordPopupBounds: null as
    | { left: number; right: number; top: number; bottom: number }
    | null,
  courseRange: null as CourseRange | null,
  knowledgeContext: '',
  completionSyncing: false,

  debugShadowBackground(stage: string, extra?: Record<string, unknown>) {
    const manager = this.backgroundAudioManager as any
    console.log('[ShadowBG]', stage, {
      courseId: this.courseId,
      playMode: this.data.playMode,
      playing: this.data.playing,
      currentSubtitleId: this.data.currentSubtitleId,
      activeSubtitleId: this.activeSubtitle?.id ?? null,
      audioCurrentTime: this.audioContext?.currentTime,
      audioSource: this.audioSource,
      backgroundCurrentTime: manager?.currentTime,
      backgroundPaused: manager?.paused,
      backgroundSrc: manager?.src,
      backgroundPlaybackActive: this.backgroundPlaybackActive,
      hasHandoffState: !!this.shadowHandoffState,
      handoffState: this.shadowHandoffState,
      lastKnownCourseTime: this.lastKnownCourseTime,
      isRecoveringFromBackground: this.isRecoveringFromBackground,
      pendingShadowResume: this.pendingShadowResume,
      ...extra,
    })
  },

  shouldIgnoreMainAudioContextEvent() {
    return this.suppressMainAudioContextEvents || this.data.playMode === 'shadow'
  },

  clampCourseTimeToScene(courseTime: number, options: { restartWhenPastEnd?: boolean } = {}) {
    return playerCore.clampCourseTimeToScene(courseTime, this.courseRange, options)
  },

  hasReachedSceneEnd(courseTime: number) {
    return playerCore.hasReachedSceneEnd(courseTime, this.courseRange)
  },

  finishScenePlayback(showToast = false) {
    this.pauseShadowPlayback()
    this.stopTracking()
    this.setData({
      playing: false,
      isRepeating: false,
      repeatCount: 0,
      audioLoading: false,
    })
    this.lastKnownCourseTime = this.courseRange?.end ?? this.lastKnownCourseTime
    // 完成判定收敛到跟读阶段：跟读播完整节才算完成；通听到末尾只提示进入下一阶段
    if (this.data.stage === 'follow') {
      void this.markSceneCompleted('scene-end')
      if (showToast) {
        void this.openCompletionPanel()
      }
    } else if (showToast) {
      wx.showToast({
        title: '通听完成，试试精练和跟读',
        icon: 'none',
        duration: 2200,
      })
    }
  },

  getProgressCueIndex() {
    return playerCore.resolveProgressCueIndex({
      subtitles: this.data.subtitles,
      preferredSubtitleId:
        this.lastEchoCompletion?.subtitleId ||
        this.activeSubtitle?.id ||
        this.data.currentSubtitleId,
      fallbackIndex: this.currentSubtitleIndex,
    })
  },

  buildCompletionProgressPayload() {
    return playerCore.buildCompletionCuePayload(
      this.data.subtitles.length,
      this.getProgressCueIndex(),
    )
  },

  scheduleCourseShareImage: debounce(function (this: any) {
    void this.generateCourseShareImage()
  }, 280) as () => void,
  scheduleSceneProgressSync: debounce(function (this: any) {
    void this.syncCurrentSceneProgress('debounced')
  }, 1200) as () => void,

  getCourseShareSnippetText() {
    const currentSubtitleId = this.data.currentSubtitleId
    if (currentSubtitleId) {
      const currentSubtitle = this.data.subtitles.find(subtitle => subtitle.id === currentSubtitleId)
      if (currentSubtitle?.text) {
        return currentSubtitle.text
      }
    }
    return this.data.leadText || ''
  },

  async generateCourseShareImage() {
    if (!this.data.course || this.data.loading || this.data.error) {
      return
    }

    const card = buildCourseShareCardModel({
      title: this.data.course.title,
      tag: this.data.course.tag,
      stage: this.data.stage,
      currentText: this.getCourseShareSnippetText(),
      leadText: this.data.leadText,
    })

    try {
      const shareImageUrl = await renderSharePoster(
        this,
        COURSE_SHARE_CANVAS_ID,
        {
          title: card.title,
          badge: card.tagLabel,
          highlight: '当前课程内容',
          snippet: card.snippet,
        },
        card.modeLabel,
        {
          tagline: '打开小程序，继续当前课程',
          highlightMuted: true,
        },
      )
      this.setData({
        shareImageUrl,
      })
    } catch (error) {
      console.warn('[Share] generate course share image failed', error)
    }
  },

  updateShadowCourseTimeFromManager(observedTime?: number) {
    this.lastKnownCourseTime = this.clampCourseTimeToScene(resolveObservedShadowCourseTime({
      observedTime,
      lastKnownCourseTime: this.lastKnownCourseTime,
      pendingTargetTime: this.pendingShadowSeek?.targetTime,
    }))
    return this.lastKnownCourseTime
  },

  markEchoCompletionProgress(reason: string) {
    if (this.data.playMode !== 'echo' || !this.activeSubtitle) {
      return this.lastKnownCourseTime
    }

    const completionTime = Math.max(this.lastKnownCourseTime, this.activeSubtitle.end)
    this.lastKnownCourseTime = completionTime
    this.lastEchoCompletion = {
      subtitleId: this.activeSubtitle.id,
      courseTime: completionTime,
    }
    const subtitleIndex = this.data.subtitles.findIndex(subtitle => subtitle.id === this.activeSubtitle?.id)
    if (this.data.subtitles.length > 0 && subtitleIndex === this.data.subtitles.length - 1) {
      // 完成判定收敛到跟读阶段（留白跟读练完最后一句）
      if (this.data.stage === 'follow') {
        void this.markSceneCompleted('follow-last-subtitle')
        if (!this.data.isRepeating && !this.data.comparing) {
          void this.openCompletionPanel()
        }
      }
    }
    console.log('[Audio] 记录 Echo 完成进度', {
      reason,
      subtitleId: this.activeSubtitle.id,
      completionTime,
    })
    return completionTime
  },

  showAudioLoadingMask() {
    if (this.audioLoadingMaskVisible) {
      return
    }
    this.audioLoadingMaskVisible = true
    wx.showLoading({
      title: '音频加载中...',
      mask: true,
    })
  },

  hideAudioLoadingMask() {
    if (!this.audioLoadingMaskVisible) {
      return
    }
    this.audioLoadingMaskVisible = false
    wx.hideLoading()
  },

  setAudioLoading(isLoading: boolean) {
    if (this.data.audioLoading !== isLoading) {
      this.setData({ audioLoading: isLoading })
    }

    if (isLoading) {
      this.showAudioLoadingMask()
    } else {
      this.hideAudioLoadingMask()
    }
  },

  syncPendingShadowSeek(reason: string) {
    const pending = this.pendingShadowSeek
    if (!pending) {
      return true
    }

    const manager = this.ensureBackgroundAudioManager()
    const observedTime = typeof manager.currentTime === 'number' ? manager.currentTime : 0
    const stableTime = this.updateShadowCourseTimeFromManager(observedTime)
    const currentSrc = String(manager.src || '')
    const shouldCorrect = shouldApplyShadowSeekCorrection({
      currentTime: observedTime,
      targetTime: pending.targetTime,
      tolerance: 0.35,
    })

    this.debugShadowBackground('sync pending shadow seek', {
      reason,
      observedTime,
      stableTime,
      pendingTargetTime: pending.targetTime,
      pendingShouldAutoplay: pending.shouldAutoplay,
      pendingSrc: pending.src,
      currentSrc,
      shouldCorrect,
    })

    if (pending.src && currentSrc && currentSrc !== pending.src) {
      return false
    }

    if (shouldCorrect) {
      try {
        manager.seek(pending.targetTime)
      } catch (error) {
        this.debugShadowBackground('shadow seek correction failed', {
          reason,
          error,
          targetTime: pending.targetTime,
        })
      }
      if (!pending.shouldAutoplay && typeof manager.pause === 'function') {
        try {
          manager.pause()
        } catch (_error) {
          // ignore
        }
      }
      return false
    }

    if (pending.shouldAutoplay && typeof manager.play === 'function' && manager.paused) {
      try {
        manager.play()
      } catch (_error) {
        // ignore
      }
    } else if (!pending.shouldAutoplay && typeof manager.pause === 'function' && !manager.paused) {
      try {
        manager.pause()
      } catch (_error) {
        // ignore
      }
    }

    this.pendingShadowSeek = null
    if (this.data.audioLoading) {
      this.setAudioLoading(false)
    }
    return true
  },

  onLoad(query) {
    enablePageShareMenu();
    const interactiveFeaturesEnabled = resolveInteractiveFeaturesEnabled(getStoreState().appConfig)
    const id = query?.id
    if (!id) {
      this.setData({
        error: 'Course id not found',
      })
      return
    }
    this.courseId = id
    this.pendingFocusCueId = String(query?.cueId ?? '').trim()
    this.focusPracticeRequested = query?.stage === 'practice' || Boolean(this.pendingFocusCueId)
    this.focusAutoplayRequested =
      interactiveFeaturesEnabled &&
      query?.autoplay === '1' &&
      Boolean(this.pendingFocusCueId)
    this.reviewOnlyRequested = query?.review === '1'
    this.pendingBackgroundAudioRestore =
      interactiveFeaturesEnabled && query?.fromBackgroundAudio === '1'
    this.audioLoadTimeoutController = playerCore.createAudioLoadTimeoutController({
      getSourceOptions: () => this.audioSourceOptions,
      getCurrentSource: () => this.audioSource || this.audioContext?.src || '',
      getAudioReady: () => this.audioReady,
      onTimeout: timedOutSource => {
        const provider = this.audioSourceOptions.find((option: AudioSourceOption) => option.url === timedOutSource)?.provider ?? 'unknown'
        reportMetric('audio_load_timeout', {
          courseId: this.courseId,
          provider,
          timeoutMs: playerCore.AUDIO_LOAD_TIMEOUT_MS,
        })
      },
      onTimeoutFallback: timedOutSource => {
        this.fallbackToNextAudioSource('timeout', timedOutSource)
      },
      log: (message, payload) => console.log(message, payload),
      warn: (message, payload) => console.warn(message, payload),
    })
    this.backgroundAudioLoadTimeoutController = playerCore.createAudioLoadTimeoutController({
      getSourceOptions: () => this.audioSourceOptions,
      getCurrentSource: () => String(this.backgroundAudioManager?.src || ''),
      getAudioReady: () => this.backgroundAudioReady,
      onTimeout: timedOutSource => {
        const provider = this.audioSourceOptions.find((option: AudioSourceOption) => option.url === timedOutSource)?.provider ?? 'unknown'
        reportMetric('audio_load_timeout', {
          courseId: this.courseId,
          provider,
          timeoutMs: playerCore.AUDIO_LOAD_TIMEOUT_MS,
        })
      },
      onTimeoutFallback: timedOutSource => {
        this.fallbackBackgroundAudioSource('timeout', timedOutSource)
      },
      log: (message, payload) => console.log(message, { ...payload, channel: 'background' }),
      warn: (message, payload) => console.warn(message, { ...payload, channel: 'background' }),
    })
    this.backgroundResumeStore = createBackgroundResumeStore({
      storage: {
        get: key => wx.getStorageSync(key),
        set: (key, value) => wx.setStorageSync(key, value),
        remove: key => wx.removeStorageSync(key),
      },
      onError: (stage, error) => {
        this.debugShadowBackground(`${stage} background audio resume state failed`, { error })
      },
    })

    this.storeUnsubscribe = subscribe(state => this.handleStoreUpdate(state))
    this.handleStoreUpdate(getStoreState())
    this.loadCourse(id)
  },

  // 清除 AI 讲解缓存
  clearAiExplainCache() {
    try {
      const keys = wx.getStorageInfoSync().keys
      const aiKeys = keys.filter(k => k.startsWith('ai_explain_'))
      aiKeys.forEach(key => {
        wx.removeStorageSync(key)
      })
      if (aiKeys.length > 0) {
        console.log(`已清除 ${aiKeys.length} 条 AI 讲解缓存`)
      }
    } catch (e) {
      console.warn('清除 AI 缓存失败', e)
    }
  },

  onShow() {
    this.beginStudySession()
    this.debugShadowBackground('onShow')
    this.handleForegroundReturn()
  },

  onHide() {
    void this.syncCurrentSceneProgress('hide')
    void this.finalizeStudySession(false) // 使用防抖
    this.debugShadowBackground('onHide')
    this.handleBackgroundHandoff()
  },

  onUnload() {
    this.debugShadowBackground('onUnload')
    void this.syncCurrentSceneProgress('unload')
    void this.finalizeStudySession(true) // 立即上报，不防抖
    this.stopBackgroundPlayback(true)
    this.discardRecording()
    this.destroyAudioContext()
    this.destroyWordAudioContext()
    this.recordingAudioContext?.destroy()
    this.recordingAudioContext = null
    this.hideAudioLoadingMask()
    this.storeUnsubscribe?.()
    this.stopTracking()
    // 退出页面时清除 AI 讲解缓存
    this.clearAiExplainCache()
  },

  onShareAppMessage() {
    // 完成面板打开时分享成就（封面为成就海报，openCompletionPanel 已生成）
    const title = this.data.showCompletionPanel && this.data.course?.title
      ? `我练完了「${this.data.course.title}」，一起来练外贸英语口语`
      : this.data.course?.title
        ? `${this.data.course.title} | 外贸英语影子跟读`
        : '外贸英语影子跟读'
    const path = this.courseId
      ? `/pages/course/course?id=${this.courseId}`
      : '/pages/index/index'

    return buildAppMessageShare({
      title,
      path,
      imageUrl: this.data.shareImageUrl || undefined,
    })
  },

  onShareTimeline() {
    const title = this.data.course?.title
      ? `${this.data.course.title} | 外贸英语影子跟读`
      : '外贸英语影子跟读'
    const query = this.courseId ? `id=${this.courseId}` : ''

    return buildTimelineShare({
      title,
      query,
      imageUrl: this.data.shareImageUrl || undefined,
    })
  },

  async loadCourse(id: string) {
    this.courseRange = null
    this.knowledgeContext = ''
    this.setData({
      loading: true,
      error: null,
    })
    try {
      const detail = await fetchCourseDetail(id)
      const appConfig = getStoreState().appConfig
      const interactiveFeaturesEnabled = resolveInteractiveFeaturesEnabled(appConfig)
      const modePresentation = resolveStagePresentation({
        currentStage: this.focusPracticeRequested ? 'practice' : this.data.stage,
        gapEnabled: this.data.gapEnabled,
        shadowModeEnabled:
          interactiveFeaturesEnabled && appConfig.courseDetail.shadowModeEnabled,
      })

      // 音频策略：新版接口提供七牛和服务器地址，旧接口仍只提供服务器地址。
      const availableAudioSources = (detail.audioSources ?? []).map(source => ({
        provider: source.provider,
        url: normalizeAudioUrl(source.url),
      }))
      const serverAudio = availableAudioSources.find(source => source.provider === 'server')?.url
        ?? normalizeAudioUrl(detail.audio)
      const audioSourceConfig = normalizeAudioSourceConfig(appConfig.courseDetail.audioSource)
      const audioSources = buildAudioSourceOptions(
        serverAudio,
        audioSourceConfig,
        availableAudioSources,
      )
      const selectedAudioSource = audioSources[0] ?? {
        provider: 'server' as const,
        url: serverAudio,
      }
      
      // 存储服务器地址作为备用
      this.serverAudioUrl = serverAudio
      this.usingFallbackAudio = false
      this.audioSourceOptions = audioSources
      this.activeAudioSourceProvider = selectedAudioSource.provider
      
      const audio = selectedAudioSource.url
      logAudioRequest('course:audio-source-selected', audio, {
        courseId: id,
        provider: selectedAudioSource.provider,
        priority: audioSourceConfig.priority,
      })

      const subtitles = mapSubtitles(detail.subtitles)
      const starredIds = new Set(getStarredCueIds(this.readStarredCueMap(), detail.id))
      const markedSubtitles = subtitles.map(subtitle => ({
        ...subtitle,
        starred: starredIds.has(subtitle.id),
      }))
      const starredCueCount = markedSubtitles.filter(subtitle => subtitle.starred).length
      const courseRange = normalizeCourseRange(detail, subtitles)
      const leadText = subtitles[0]?.text ?? ''
      this.courseRange = courseRange
      this.knowledgeContext = buildKnowledgeContext(detail)
      this.practiceCounts = {}

      this.setData({
        course: {
          id: detail.id,
          title: detail.title,
          tag: detail.tag,
          audio,
        },
        subtitles: markedSubtitles,
        loading: false,
        leadText,
        scrollIntoView: '',
        scrollTop: 0,
        shareImageUrl: '',
        showCompletionPanel: false,
        nextScene: null,
        reviewOnlyMode: this.reviewOnlyRequested && starredCueCount > 0,
        starredCueCount,
        audioPlaybackEnabled: interactiveFeaturesEnabled,
        showModeSelector: modePresentation.showModeSelector,
        showShadowMode: modePresentation.showShadowMode,
        showPracticeControls: modePresentation.showPracticeControls,
        showStageGuide:
          modePresentation.showPracticeControls &&
          !this.focusAutoplayRequested &&
          !hasSeenStageGuide(),
        stage: modePresentation.effectiveStage,
        playMode: modePresentation.effectivePlayMode,
      })

      // 只读模式不初始化课程音频；通听走后台通道不预热前台音频，避免加载遮罩挡页面；
      // 首次引导展示期间也推迟预热，引导关闭后再初始化。
      const shouldPreheatEchoAudio =
        modePresentation.showPracticeControls &&
        modePresentation.effectivePlayMode === 'echo' &&
        !this.data.showStageGuide
      if (shouldPreheatEchoAudio) {
        this.ensureAudioContext(audio)
      } else {
        this.destroyAudioContext()
        this.setAudioLoading(false)
      }
      this.handleStoreUpdate(getStoreState())
      void this.syncCurrentSceneProgress('load')
      this.scheduleCourseShareImage()
      if (this.pendingFocusCueId) {
        const cueId = this.pendingFocusCueId
        const autoplay = this.focusAutoplayRequested
        this.pendingFocusCueId = ''
        this.focusAutoplayRequested = false
        setTimeout(() => this.focusCueFromSource(cueId, autoplay), 80)
      }
      const restoredFromBackgroundAudio = modePresentation.showPracticeControls && this.pendingBackgroundAudioRestore
        ? this.restoreBackgroundAudioFromStorage()
        : false
      if (!modePresentation.showPracticeControls) {
        this.pendingBackgroundAudioRestore = false
      }

      // 通听阶段自动开始连续播放；首次引导展示时先不自动播，等引导关闭后再启动
      if (
        !restoredFromBackgroundAudio &&
        !this.focusPracticeRequested &&
        modePresentation.effectivePlayMode === 'shadow' &&
        subtitles.length > 0 &&
        !this.data.showStageGuide
      ) {
        setTimeout(() => {
          this.startShadowMode()
        }, 500)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '课程加载失败，请重试'
      this.setData({
        loading: false,
        error: message,
      })
      this.setAudioLoading(false)
    }
  },

  async markSceneCompleted(_reason: string) {
    const state = getStoreState()
    if (!state.token || !this.courseId || !this.data.course || this.completionSyncing) {
      return
    }
    this.completionSyncing = true
    try {
      const response = await updateUserProgress(
        this.courseId,
        'completed',
        this.buildCompletionProgressPayload(),
      )
      updateUserInStore(response.user)
      updateProgressInStore(response.progress)
    } catch (error) {
      console.warn('[Progress] auto complete scene failed', error)
    } finally {
      this.completionSyncing = false
    }
  },

  async syncCurrentSceneProgress(_reason: string) {
    const state = getStoreState()
    if (!state.token || !this.courseId || !this.data.course || this.data.loading) {
      return
    }
    try {
      const response = await recordUserProgress(this.courseId, {
        totalCues: this.data.subtitles.length,
        cueIndex: this.getProgressCueIndex(),
      })
      updateUserInStore(response.user)
      updateProgressInStore(response.progress)
    } catch (error) {
      console.warn('[Progress] sync current scene failed', error)
    }
  },

  ensureAudioContext(src: string) {
    if (!src) {
      this.destroyAudioContext()
      return
    }
    if (!this.audioContext) {
      console.log('[Audio] 创建新的音频上下文')
      const audioContext = wx.createInnerAudioContext()
      audioContext.autoplay = false
      audioContext.obeyMuteSwitch = false
      audioContext.playbackRate = this.data.playbackRate

      audioContext.onPlay(() => {
        if (this.shouldIgnoreMainAudioContextEvent()) {
          console.log('[Audio] 忽略 InnerAudio onPlay（shadow 模式）')
          return
        }
        console.log(`[Audio] 开始播放，currentTime=${audioContext.currentTime.toFixed(2)}`)
        this.lastKnownCourseTime = audioContext.currentTime
        this.setData({ playing: true })

        // Shadow 模式：设置停止定时器（作为备用）
        // Echo 模式使用 M4A 片段会自然结束，不需要 stopTimer
        if (this.data.playMode === 'shadow' && this.data.isRepeating && this.activeSubtitle) {
          // 清除旧的定时器
          if (this.stopTimer) {
            clearTimeout(this.stopTimer)
          }

          // 使用 activeSubtitle 的范围，而不是 currentTime
          // 因为 seek 可能还没完全更新 currentTime
          const subtitleStart = this.activeSubtitle.start
          const subtitleEnd = this.activeSubtitle.end
          const stopWindow = playerCore.computeRepeatStopWindow(
            { start: subtitleStart, end: subtitleEnd },
            this.data.playbackRate,
          )

          console.log(`[Audio] onPlay设置备用定时器: 段落${subtitleStart.toFixed(3)}-${subtitleEnd.toFixed(3)}s`)
          console.log(`[Audio] 总时长${stopWindow.totalDuration.toFixed(3)}s, 播放${stopWindow.playDuration.toFixed(3)}s, 补偿后${stopWindow.adjustedDuration.toFixed(3)}s`)

          this.stopTimer = setTimeout(() => {
            if (this.audioContext) {
              const finalTime = this.audioContext.currentTime
              console.log(`[Audio] 备用定时器触发`)
              console.log(`[Audio] 当前currentTime: ${finalTime.toFixed(3)}s, 预期结束: ${subtitleEnd.toFixed(3)}s`)
              this.audioContext.pause()
              this.handleAudioPause()
            }
            this.stopTimer = null

            // 重复模式：检查是否继续重复
            if (this.data.isRepeating && this.activeSubtitle) {
              this.handleRepeatNext(this.activeSubtitle)
            }
          }, stopWindow.adjustedDuration * 1000)
        }

        // 影子跟读模式下启动定时器（包括重复模式）
        if (this.data.playMode === 'shadow') {
          this.startTracking()
        }
      })

      audioContext.onPause(() => {
        if (this.shouldIgnoreMainAudioContextEvent()) {
          console.log('[Audio] 忽略 InnerAudio onPause（shadow 模式）')
          return
        }
        console.log(`[Audio] 暂停播放，currentTime=${audioContext.currentTime.toFixed(2)}`)
        this.lastKnownCourseTime =
          this.data.playMode === 'echo'
            ? resolveCourseTimeFromForeground({
                audioCurrentTime: audioContext.currentTime,
                activeSubtitle: this.activeSubtitle,
                lastKnownCourseTime: this.lastKnownCourseTime,
              })
            : audioContext.currentTime
        this.handleAudioPause()
        // 暂停时也停止跟踪，但会在下次播放时重新启动
        // seekAndPlay 会调用 pause() 然后立即 play()，play() 会重新启动定时器
        this.stopTracking()
      })

      audioContext.onStop(() => {
        if (this.shouldIgnoreMainAudioContextEvent()) {
          console.log('[Audio] 忽略 InnerAudio onStop（shadow 模式）')
          return
        }
        console.log('[Audio] 停止播放')
        this.lastKnownCourseTime =
          this.data.playMode === 'echo'
            ? resolveCourseTimeFromForeground({
                audioCurrentTime: audioContext.currentTime,
                activeSubtitle: this.activeSubtitle,
                lastKnownCourseTime: this.lastKnownCourseTime,
              })
            : audioContext.currentTime
        this.handleAudioPause()
        this.stopTracking()
      })

      audioContext.onEnded(() => {
        if (this.shouldIgnoreMainAudioContextEvent()) {
          console.log('[Audio] 忽略 InnerAudio onEnded（shadow 模式）')
          return
        }
        console.log('[Audio] 播放结束')
        this.setData({ playing: false })

        // Echo 模式：M4A 片段播放完成
        if (this.data.playMode === 'echo') {
          const endedSubtitle = this.activeSubtitle
          this.markEchoCompletionProgress('onEnded')

          // 重复模式优先，其次执行阶段句末策略
          if (this.data.isRepeating && endedSubtitle) {
            this.handleRepeatNext(endedSubtitle)
          } else if (endedSubtitle) {
            this.handleCueEnded(endedSubtitle)
          }
          return
        }

        // Shadow 模式：onEnded 只在整个音频文件播放完才触发
        // 重复模式由 stopTimer 处理，所以这里只处理正常的音频结束

        // 如果是重复模式，不应该到这里，因为 stopTimer 会在段落结束时暂停
        // 如果到了这里，说明可能是用户手动操作或异常情况
        if (this.data.isRepeating) {
          this.setData({
            isRepeating: false,
            repeatCount: 0,
          })
        }

        // 影子跟读模式：音频播放完整结束
        if (this.data.playMode === 'shadow') {
          this.handleAudioPause()
          this.stopTracking()
          wx.showToast({
            title: '全部播放完成',
            icon: 'success',
          })
          this.setData({
            currentSubtitleId: null,
          })
        } else {
          this.handleAudioPause()
        }
      })

      audioContext.onCanplay(() => {
        if (this.shouldIgnoreMainAudioContextEvent()) {
          console.log('[Audio] 忽略 InnerAudio onCanplay（shadow 模式）')
          return
        }
        const elapsedMs = this.audioRequestStartedAt
          ? Date.now() - this.audioRequestStartedAt
          : null
        logAudioRequest('inneraudio:onCanplay', this.audioSource || audioContext.src || '', {
          courseId: this.courseId,
          playMode: this.data.playMode,
          elapsedMs,
          duration: audioContext.duration,
        })
        console.log('[Audio] 可以播放，duration=' + audioContext.duration)
        this.audioReady = true
        this.clearAudioLoadTimeout()
        
        // 清除音频加载中状态
        if (this.data.audioLoading) {
          this.setAudioLoading(false)
        }

        // 重新设置播放速度，防止切换音频源后速度被重置
        audioContext.playbackRate = this.data.playbackRate

        // ✅ 关键修复：访问 paused 属性以重新激活 onTimeUpdate
        void audioContext.paused

        if (this.pendingShadowResume) {
          const pendingShadowResume = this.pendingShadowResume
          this.pendingShadowResume = null
          this.resumeForegroundShadowPlayback(pendingShadowResume.courseTime, pendingShadowResume.shouldAutoplay)
          return
        }

        if (this.pendingSubtitle) {
          console.log('[Audio] 执行pending的字幕播放')
          const pending = this.pendingSubtitle
          this.pendingSubtitle = null
          // Echo 通道走 playSubtitle，保证句末停止定时器被正确设置
          if (this.data.playMode === 'echo') {
            const pendingView = this.data.subtitles.find(item => item.id === pending.id)
            if (pendingView) {
              this.playSubtitle(pendingView)
              return
            }
          }
          this.seekAndPlay(pending)
        }
      })

      // onTimeUpdate 用于精确的段落结束检测（仅 Shadow 模式需要）
      audioContext.onTimeUpdate(() => {
        if (this.shouldIgnoreMainAudioContextEvent()) {
          return
        }
        this.lastKnownCourseTime = audioContext.currentTime
        // Shadow 模式且开启重复：实时检测是否到达段落结束位置
        // Echo 模式的 M4A 片段会自然结束，不需要检测
        if (this.data.playMode === 'shadow' && this.data.isRepeating && this.activeSubtitle) {
          const currentTime = audioContext.currentTime
          const subtitleEnd = this.activeSubtitle.end

          // 到达或超过结束位置，立即停止
          if (currentTime >= subtitleEnd) {
            console.log(`[onTimeUpdate] ✅ 到达段落结束: currentTime=${currentTime.toFixed(3)}s >= end=${subtitleEnd.toFixed(3)}s`)
            audioContext.pause()
            this.handleAudioPause()

            // 清除定时器（如果还在）
            if (this.stopTimer) {
              clearTimeout(this.stopTimer)
              this.stopTimer = null
            }

            // 重复模式：检查是否继续重复
            if (this.data.isRepeating && this.activeSubtitle) {
              this.handleRepeatNext(this.activeSubtitle)
            }
          }
        }
      })

      audioContext.onError(err => {
        if (this.shouldIgnoreMainAudioContextEvent()) {
          console.log('[Audio] 忽略 InnerAudio onError（shadow 模式）', err)
          return
        }
        logAudioRequest('inneraudio:onError', this.audioSource || audioContext.src || '', {
          courseId: this.courseId,
          playMode: this.data.playMode,
          errCode: err.errCode,
          errMsg: err.errMsg,
        })
        console.error('[Audio] 播放错误代码:', err.errCode)
        console.error('[Audio] 播放错误消息:', err.errMsg)
        this.clearAudioLoadTimeout()

        // 🚀 CDN加载失败时降级处理
        const currentSource = this.audioSource || audioContext.src || ''
        if (this.fallbackToNextAudioSource('error', currentSource)) {
          return
        }

        if (!this.usingFallbackAudio && this.data.playMode === 'echo' && this.activeSubtitle && this.data.course) {
            // Echo模式：切换到服务器切片音频
            console.log('[Audio] Echo模式：切换到服务器切片')
            const segmentUrl = playerCore.buildEchoSegmentUrl(API_BASE_URL, this.data.course.id, this.activeSubtitle.id)
            console.log('[Audio] Echo切片地址:', segmentUrl)
            logAudioRequest('echo:error-fallback-segment:set-src', segmentUrl, {
              courseId: this.data.course.id,
              subtitleId: this.activeSubtitle.id,
              playMode: this.data.playMode,
            })
            
            if (this.audioContext) {
              this.audioContext.stop()
              this.audioContext.src = segmentUrl
              this.audioRequestStartedAt = Date.now()
              this.audioContext.startTime = 0
              this.audioSource = segmentUrl
              this.audioContext.play()
            }
        }

        const tip = playerCore.resolveAudioErrorTip(err.errCode, err.errMsg)
        if (this.data.audioLoading) {
          this.setAudioLoading(false)
        }

        wx.showToast({
          title: tip,
          icon: 'none',
        })
      })

      this.audioContext = audioContext
    }

    if (this.audioSource !== src && this.audioContext) {
      console.log(`[Audio] 加载新音频: ${src}`)
      logAudioRequest('inneraudio:set-src', src, {
        courseId: this.courseId,
        playMode: this.data.playMode,
      })
      this.audioReady = false
      this.pendingSubtitle = null
      this.clearAudioLoadTimeout()
      this.setAudioLoading(true)
      this.audioContext.stop()
      this.audioContext.src = src
      this.audioRequestStartedAt = Date.now()
      this.audioSource = src
      this.scheduleAudioLoadTimeout(src)
    }
  },

  destroyAudioContext() {
    this.clearAudioLoadTimeout()
    this.clearGapTimer()
    if (this.audioContext) {
      this.audioContext.stop()
      this.audioContext.destroy()
      this.audioContext = null
    }
    this.audioSource = ''
    this.audioReady = false
    this.pendingSubtitle = null
    this.activeSubtitle = null
    if (this.stopTimer) {
      clearTimeout(this.stopTimer)
      this.stopTimer = null
    }
    this.stopTracking()
  },

  destroyWordAudioContext() {
    if (this.wordAudioContext) {
      this.wordAudioContext.stop()
      this.wordAudioContext.destroy()
      this.wordAudioContext = null
    }
  },

  clearAudioLoadTimeout() {
    this.audioLoadTimeoutController?.clear()
  },

  scheduleAudioLoadTimeout(src: string) {
    this.audioLoadTimeoutController?.schedule(src)
  },

  clearBackgroundAudioLoadTimeout() {
    this.backgroundAudioLoadTimeoutController?.clear()
  },

  scheduleBackgroundAudioLoadTimeout(src: string) {
    this.backgroundAudioLoadTimeoutController?.schedule(src)
  },

  fallbackToNextAudioSource(reason: 'error' | 'timeout', source: string) {
    const currentSource = this.audioSource || this.audioContext?.src || ''
    const fromProvider = this.audioSourceOptions.find((option: AudioSourceOption) => option.url === source)?.provider ?? 'unknown'
    const nextAudioSource = getNextAudioSourceOption({
      timedOutSource: source,
      currentSource,
      audioSources: this.audioSourceOptions,
    })

    console.warn('[Audio] 尝试切换到下一个音频源', {
      reason,
      source,
      currentSource,
      nextProvider: nextAudioSource?.provider ?? null,
      nextSource: nextAudioSource?.url ?? null,
    })

    if (!nextAudioSource) {
      return false
    }

    reportMetric('audio_fallback', {
      courseId: this.courseId,
      reason,
      fromProvider,
      toProvider: nextAudioSource.provider,
    })

    const activeSubtitle = this.activeSubtitle ? { ...this.activeSubtitle } : null
    const pendingSubtitle = this.pendingSubtitle ? { ...this.pendingSubtitle } : null
    const wasPlaying = this.data.playing

    this.activeAudioSourceProvider = nextAudioSource.provider
    this.usingFallbackAudio = nextAudioSource.provider === 'server'
    this.clearAudioLoadTimeout()

    if (this.data.course) {
      this.setData({
        course: {
          ...this.data.course,
          audio: nextAudioSource.url
        }
      })
    }
    this.setAudioLoading(true)

    this.destroyAudioContext()
    logAudioRequest(`fallback:${nextAudioSource.provider}:set-src`, nextAudioSource.url, {
      courseId: this.courseId,
      reason,
      fromSource: source,
    })
    this.ensureAudioContext(nextAudioSource.url)

    const resumeSubtitle = activeSubtitle || pendingSubtitle
    if (resumeSubtitle && this.audioContext) {
      this.pendingSubtitle = resumeSubtitle
      if (wasPlaying) {
        console.log('[Audio] 服务器音频准备接管后续播放', {
          subtitleId: resumeSubtitle.id,
          reason,
        })
        this.audioContext.play()
      }
    }

    return true
  },

  fallbackBackgroundAudioSource(reason: 'error' | 'timeout', source: string) {
    if (this.backgroundAudioFallbackPending) {
      return true
    }
    const manager = this.backgroundAudioManager as any
    const course = this.data.course
    if (!manager || !course) {
      return false
    }

    const currentSource = String(manager.src || '')
    const fromProvider = this.audioSourceOptions.find((option: AudioSourceOption) => option.url === source)?.provider ?? 'unknown'
    const nextAudioSource = getNextAudioSourceOption({
      timedOutSource: source,
      currentSource,
      audioSources: this.audioSourceOptions,
    })
    if (!nextAudioSource) {
      return false
    }

    const resume = playerCore.resolveAudioFallbackPlaybackState({
      pendingTargetTime: this.pendingShadowSeek?.targetTime,
      currentTime: typeof manager.currentTime === 'number' ? manager.currentTime : null,
      lastKnownCourseTime: this.lastKnownCourseTime,
      pendingShouldAutoplay: this.pendingShadowSeek?.shouldAutoplay,
      playing: this.data.playing,
      backgroundPlaybackActive: this.backgroundPlaybackActive,
      managerPaused: typeof manager.paused === 'boolean' ? manager.paused : undefined,
    })

    reportMetric('audio_fallback', {
      courseId: this.courseId,
      reason,
      fromProvider,
      toProvider: nextAudioSource.provider,
    })
    this.activeAudioSourceProvider = nextAudioSource.provider
    this.usingFallbackAudio = nextAudioSource.provider === 'server'
    this.clearBackgroundAudioLoadTimeout()
    this.backgroundAudioFallbackPending = true
    this.setAudioLoading(true)

    this.setData({
      course: {
        ...course,
        audio: nextAudioSource.url,
      },
    }, () => {
      if (!this.backgroundAudioFallbackPending) {
        return
      }
      this.backgroundAudioFallbackPending = false
      this.playShadowCourseAt(resume.courseTime, resume.shouldAutoplay, { showLoading: true })
    })
    return true
  },

  ensureBackgroundAudioManager() {
    if (this.backgroundAudioManager) {
      this.debugShadowBackground('reuse background manager')
      return this.backgroundAudioManager
    }

    const manager = wx.getBackgroundAudioManager() as any
    this.debugShadowBackground('create background manager')
    manager.onPlay(() => {
      this.backgroundAudioReady = true
      this.clearBackgroundAudioLoadTimeout()
      this.debugShadowBackground('background onPlay')
      this.updateShadowCourseTimeFromManager(typeof manager.currentTime === 'number' ? manager.currentTime : undefined)
      this.syncPendingShadowSeek('onPlay')
      if (this.data.playMode === 'shadow') {
        this.setData({ playing: true })
        this.startTracking()
      }
      if (this.shadowHandoffState?.active) {
        this.backgroundPlaybackActive = true
        this.shadowHandoffState = {
          ...this.shadowHandoffState,
          wasPlaying: true,
        }
      }
    })
    manager.onPause(() => {
      this.debugShadowBackground('background onPause')
      this.updateShadowCourseTimeFromManager(typeof manager.currentTime === 'number' ? manager.currentTime : undefined)
      if (this.data.playMode === 'shadow') {
        this.handleAudioPause()
        this.stopTracking()
      }
      if (this.shadowHandoffState?.active) {
        this.shadowHandoffState = {
          ...this.shadowHandoffState,
          wasPlaying: false,
        }
      }
    })
    manager.onStop(() => {
      this.debugShadowBackground('background onStop')
      this.updateShadowCourseTimeFromManager(typeof manager.currentTime === 'number' ? manager.currentTime : undefined)
      this.backgroundPlaybackActive = false
      if (this.data.playMode === 'shadow') {
        this.handleAudioPause()
        this.stopTracking()
      }
      if (!this.isRecoveringFromBackground) {
        this.shadowHandoffState = null
      }
    })
    if (typeof manager.onEnded === 'function') {
      manager.onEnded(() => {
        this.debugShadowBackground('background onEnded')
      })
    }
    if (typeof manager.onWaiting === 'function') {
      manager.onWaiting(() => {
        this.debugShadowBackground('background onWaiting')
      })
    }
    if (typeof manager.onCanplay === 'function') {
      manager.onCanplay(() => {
        this.backgroundAudioReady = true
        this.clearBackgroundAudioLoadTimeout()
        const elapsedMs = this.backgroundAudioRequestStartedAt
          ? Date.now() - this.backgroundAudioRequestStartedAt
          : null
        logAudioRequest('background:onCanplay', String(manager.src || ''), {
          courseId: this.courseId,
          playMode: this.data.playMode,
          elapsedMs,
          currentTime: typeof manager.currentTime === 'number' ? manager.currentTime : null,
        })
        this.debugShadowBackground('background onCanplay')
        this.syncPendingShadowSeek('onCanplay')
        if (this.data.playMode === 'shadow' && this.data.audioLoading) {
          this.setAudioLoading(false)
        }
      })
    }
    if (typeof manager.onTimeUpdate === 'function') {
      manager.onTimeUpdate(() => {
        this.updateShadowCourseTimeFromManager(typeof manager.currentTime === 'number' ? manager.currentTime : undefined)
        this.syncPendingShadowSeek('onTimeUpdate')
      })
    }
    if (typeof manager.onNext === 'function') {
      manager.onNext(() => {
        this.debugShadowBackground('background onNext')
      })
    }
    if (typeof manager.onPrev === 'function') {
      manager.onPrev(() => {
        this.debugShadowBackground('background onPrev')
      })
    }
    if (typeof manager.onError === 'function') {
      manager.onError((error: unknown) => {
        const failedSource = String(manager.src || '')
        logAudioRequest('background:onError', failedSource, {
          courseId: this.courseId,
          playMode: this.data.playMode,
          error,
        })
        this.debugShadowBackground('background onError', { error })
        this.backgroundAudioReady = false
        this.clearBackgroundAudioLoadTimeout()
        if (!this.fallbackBackgroundAudioSource('error', failedSource)) {
          this.setAudioLoading(false)
        }
      })
    }

    this.backgroundAudioManager = manager
    return manager
  },

  getShadowCurrentTime() {
    const manager = this.ensureBackgroundAudioManager()
    return this.clampCourseTimeToScene(resolveObservedShadowCourseTime({
      observedTime: typeof manager.currentTime === 'number' ? manager.currentTime : 0,
      lastKnownCourseTime: resolveShadowPlaybackStartTime({
        backgroundCurrentTime: typeof manager.currentTime === 'number' ? manager.currentTime : 0,
        lastKnownCourseTime: this.lastKnownCourseTime,
      }),
      pendingTargetTime: this.pendingShadowSeek?.targetTime,
    }))
  },

  playShadowCourseAt(
    courseTime: number,
    shouldAutoplay = true,
    options: { showLoading?: boolean } = {},
  ) {
    if (!this.data.course) {
      return false
    }

    const targetCourseTime = this.clampCourseTimeToScene(courseTime, {
      restartWhenPastEnd: true,
    })
    const manager = this.ensureBackgroundAudioManager()
    const meta = buildBackgroundPlaybackMeta(this.data.course, targetCourseTime)
    const currentSrc = String(manager.src || '')
    const shouldSwitchSrc = currentSrc !== meta.src
    const shouldShowLoading = shouldSwitchSrc && options.showLoading !== false

    this.debugShadowBackground('play shadow course at', {
      courseTime: targetCourseTime,
      requestedCourseTime: courseTime,
      shouldAutoplay,
      shouldSwitchSrc,
      shouldShowLoading,
      currentSrc,
      targetSrc: meta.src,
    })

    manager.title = meta.title
    manager.epname = meta.epname
    manager.singer = meta.singer
    manager.coverImgUrl = meta.coverImgUrl || BACKGROUND_AUDIO_COVER_URL
    if ('playbackRate' in manager) {
      try {
        manager.playbackRate = this.data.playbackRate
      } catch (_error) {
        // ignore
      }
    }

    this.backgroundPlaybackActive = true
    this.lastKnownCourseTime = targetCourseTime
    this.pendingShadowSeek = {
      targetTime: meta.startTime,
      shouldAutoplay,
      src: meta.src,
    }
    this.setAudioLoading(shouldShowLoading)

    if (shouldSwitchSrc) {
      try {
        manager.startTime = meta.startTime
      } catch (_error) {
        // ignore
      }
      logAudioRequest('background:set-src', meta.src, {
        courseId: this.courseId,
        courseTime: meta.startTime,
        shouldAutoplay,
      })
      this.backgroundAudioReady = false
      this.clearBackgroundAudioLoadTimeout()
      manager.src = meta.src
      this.backgroundAudioRequestStartedAt = Date.now()
      this.scheduleBackgroundAudioLoadTimeout(meta.src)
      setTimeout(() => {
        this.syncPendingShadowSeek('post-src-assign')
        try {
          manager.seek(meta.startTime)
        } catch (_error) {
          // ignore
        }
        if (shouldAutoplay && typeof manager.play === 'function') {
          manager.play()
        } else if (!shouldAutoplay && typeof manager.pause === 'function') {
          manager.pause()
        }
      }, 80)
      return true
    }

    try {
      manager.seek(meta.startTime)
    } catch (_error) {
      // ignore
    }
    if (shouldAutoplay && typeof manager.play === 'function') {
      manager.play()
    } else if (!shouldAutoplay && typeof manager.pause === 'function') {
      manager.pause()
    }
    setTimeout(() => {
      this.syncPendingShadowSeek('post-direct-seek')
    }, 0)
    return true
  },

  pauseShadowPlayback() {
    const manager = this.ensureBackgroundAudioManager()
    this.debugShadowBackground('pause shadow playback')
    if (typeof manager.pause === 'function') {
      manager.pause()
    }
    this.backgroundPlaybackActive = false
  },

  getCurrentCourseTime() {
    const audioCurrentTime =
      this.data.playMode === 'shadow'
        ? this.getShadowCurrentTime()
        : this.audioContext?.currentTime
    return this.clampCourseTimeToScene(resolveCourseTimeFromForeground({
      audioCurrentTime,
      activeSubtitle: this.activeSubtitle,
      lastKnownCourseTime: this.lastKnownCourseTime,
    }))
  },

  readBackgroundAudioResumeState() {
    return this.backgroundResumeStore?.read() ?? null
  },

  saveBackgroundAudioResumeState(courseTime: number, manager: any) {
    if (!this.data.course) {
      return
    }

    const state: BackgroundAudioResumeState = {
      courseId: this.courseId,
      courseTime,
      subtitleId: this.data.currentSubtitleId,
      audioSrc: String(manager?.src || this.data.course.audio || ''),
      wasPlaying: this.data.playing,
      savedAt: Date.now(),
    }

    const saved = this.backgroundResumeStore?.save(state) ?? false
    if (saved) {
      this.debugShadowBackground('saved background audio resume state', state as unknown as Record<string, unknown>)
    }
  },

  clearBackgroundAudioResumeState() {
    this.backgroundResumeStore?.clear()
  },

  restoreBackgroundAudioFromStorage() {
    if (!this.data.showPracticeControls) {
      this.pendingBackgroundAudioRestore = false
      this.stopBackgroundPlayback(true)
      return false
    }

    const state = this.readBackgroundAudioResumeState()
    if (!state || state.courseId !== this.courseId || !this.data.course) {
      this.pendingBackgroundAudioRestore = false
      return false
    }

    const manager = this.ensureBackgroundAudioManager()
    const managerSrc = String(manager.src || '')
    const courseAudio = this.data.course.audio
    const audioMatches =
      !managerSrc ||
      managerSrc === courseAudio ||
      (!!state.audioSrc && managerSrc === state.audioSrc)

    if (!audioMatches && !this.pendingBackgroundAudioRestore) {
      this.pendingBackgroundAudioRestore = false
      return false
    }

    const managerTime = typeof manager.currentTime === 'number' && manager.currentTime > 0
      ? manager.currentTime
      : 0
    const courseTime = this.clampCourseTimeToScene(managerTime > 0 ? managerTime : state.courseTime, {
      restartWhenPastEnd: true,
    })
    const shouldAutoplay = typeof manager.paused === 'boolean'
      ? !manager.paused
      : state.wasPlaying
    const resume = resolveForegroundResumeState({
      subtitles: this.data.subtitles,
      courseTime,
      tolerance: 0.3,
      wasPlayingInBackground: shouldAutoplay,
    })

    this.debugShadowBackground('restore background audio from storage', {
      state,
      managerSrc,
      courseAudio,
      managerTime,
      courseTime,
      shouldAutoplay,
      resume,
    })

    this.pendingBackgroundAudioRestore = false

    if (!resume) {
      return false
    }

    this.lastKnownCourseTime = resume.resumeTime
    this.currentSubtitleIndex = resume.index
    this.activeSubtitle = resume.subtitle
    this.backgroundPlaybackActive = shouldAutoplay
    this.shadowHandoffState = null
    // 后台恢复只发生在连续通道；若当前阶段走前台逐句通道则回到通听阶段
    const stageForShadow: playerCore.LearningStage =
      playerCore.resolveStagePlan(this.data.stage, this.data.gapEnabled).channel === 'shadow'
        ? this.data.stage
        : 'listen'
    this.setData({
      stage: stageForShadow,
      playMode: 'shadow',
      currentSubtitleId: resume.subtitle.id,
      scrollIntoView: '',
      playing: resume.shouldAutoplay,
      audioLoading: false,
    })
    this.hideAudioLoadingMask()
    this.centerSubtitle(resume.subtitle.id)

    if (resume.shouldAutoplay) {
      this.startTracking()
    } else {
      this.stopTracking()
    }

    if (!managerSrc) {
      this.playShadowCourseAt(resume.resumeTime, resume.shouldAutoplay, {
        showLoading: false,
      })
    }

    return true
  },

  syncShadowSubtitleByCourseTime(courseTime: number) {
    const matched = findSubtitleByCourseTime(this.data.subtitles, courseTime, 0.3)
    if (!matched) {
      return null
    }

    this.currentSubtitleIndex = matched.index
    this.activeSubtitle = matched.subtitle
    this.setData({
      currentSubtitleId: matched.subtitle.id,
      scrollIntoView: '',
    })
    this.centerSubtitle(matched.subtitle.id)
    return matched
  },

  handleBackgroundHandoff() {
    if (
      this.data.playMode !== 'shadow' ||
      !this.data.course
    ) {
      this.debugShadowBackground('skip background handoff', {
        reason: {
          playMode: this.data.playMode,
          playing: this.data.playing,
          hasCourse: !!this.data.course,
        },
      })
      return
    }

    const courseTime = this.getCurrentCourseTime()
    const manager = this.ensureBackgroundAudioManager()
    this.debugShadowBackground('start background handoff', { courseTime })

    if (this.stopTimer) {
      clearTimeout(this.stopTimer)
      this.stopTimer = null
    }
    if (this.data.isRepeating) {
      this.setData({
        isRepeating: false,
        repeatCount: 0,
      })
    }

    this.lastKnownCourseTime = courseTime
    this.backgroundPlaybackActive = true
    this.shadowHandoffState = {
      active: true,
      wasPlaying: this.data.playing,
      courseId: this.courseId,
      subtitleId: this.data.currentSubtitleId,
      handoffAt: Date.now(),
    }
    this.saveBackgroundAudioResumeState(courseTime, manager)
    this.lastKnownCourseTime = typeof manager.currentTime === 'number' ? manager.currentTime : courseTime
  },

  handleForegroundReturn() {
    if (
      this.data.playMode !== 'shadow' ||
      !this.data.course ||
      !this.shadowHandoffState?.active ||
      this.shadowHandoffState.courseId !== this.courseId
    ) {
      this.debugShadowBackground('skip foreground return', {
        reason: {
          playMode: this.data.playMode,
          hasCourse: !!this.data.course,
          handoffActive: this.shadowHandoffState?.active ?? false,
          handoffCourseId: this.shadowHandoffState?.courseId ?? null,
        },
      })
      return
    }

    const manager = this.ensureBackgroundAudioManager()
    const resume = resolveForegroundResumeState({
      subtitles: this.data.subtitles,
      courseTime: typeof manager.currentTime === 'number' ? manager.currentTime : this.lastKnownCourseTime,
      tolerance: 0.3,
      wasPlayingInBackground: this.shadowHandoffState.wasPlaying,
    })
    this.debugShadowBackground('foreground return resolved', { resume })

    if (!resume) {
      this.debugShadowBackground('foreground return aborted', { reason: 'resume state not resolved' })
      return
    }

    this.isRecoveringFromBackground = true
    this.lastKnownCourseTime = resume.resumeTime
    this.currentSubtitleIndex = resume.index
    this.activeSubtitle = resume.subtitle
    this.setData({
      currentSubtitleId: resume.subtitle.id,
      scrollIntoView: '',
      playing: resume.shouldAutoplay,
    })
    this.centerSubtitle(resume.subtitle.id)
    if (resume.shouldAutoplay) {
      this.startTracking()
    } else {
      this.stopTracking()
    }
    this.shadowHandoffState = null
    this.isRecoveringFromBackground = false
  },

  resumeForegroundShadowPlayback(courseTime: number, shouldAutoplay: boolean) {
    const manager = this.ensureBackgroundAudioManager()
    this.lastKnownCourseTime = courseTime
    this.debugShadowBackground('resume foreground playback start', { courseTime, shouldAutoplay })
    if (this.stopTimer) {
      clearTimeout(this.stopTimer)
      this.stopTimer = null
    }

    try {
      manager.seek(courseTime)
    } catch (_error) {
      // ignore
    }
    if (shouldAutoplay && typeof manager.play === 'function') {
      this.debugShadowBackground('resume foreground autoplay')
      manager.play()
      this.startTracking()
      this.setData({ playing: true })
    } else if (!shouldAutoplay && typeof manager.pause === 'function') {
      this.debugShadowBackground('resume foreground without autoplay')
      manager.pause()
      this.setData({ playing: false })
      this.stopTracking()
    }
    this.backgroundPlaybackActive = shouldAutoplay
    this.shadowHandoffState = null
    this.isRecoveringFromBackground = false
  },

  stopBackgroundPlayback(stopPlayback: boolean) {
    this.debugShadowBackground('stop background playback', { stopPlayback })
    this.clearBackgroundAudioLoadTimeout()
    this.backgroundAudioReady = false
    this.backgroundAudioFallbackPending = false
    this.pendingShadowResume = null
    this.pendingShadowSeek = null
    this.backgroundPlaybackActive = false
    this.isRecoveringFromBackground = false
    this.shadowHandoffState = null
    if (stopPlayback) {
      this.clearBackgroundAudioResumeState()
    }
    if (!this.backgroundAudioManager) {
      return
    }

    try {
      if (stopPlayback) {
        this.backgroundAudioManager.stop()
      } else {
        this.backgroundAudioManager.pause()
      }
    } catch (_error) {
      this.debugShadowBackground('stop background playback failed', { error: _error, stopPlayback })
      // ignore
    }
  },

  handleStoreUpdate(state: StoreState) {
    const interactiveFeaturesEnabled = resolveInteractiveFeaturesEnabled(state.appConfig)
    const modePresentation = resolveStagePresentation({
      currentStage: this.data.stage,
      gapEnabled: this.data.gapEnabled,
      shadowModeEnabled:
        interactiveFeaturesEnabled && state.appConfig.courseDetail.shadowModeEnabled,
    })

    if (this.data.playMode === 'shadow' && modePresentation.effectivePlayMode === 'echo') {
      this.stopBackgroundPlayback(true)
      this.pauseShadowPlayback()
    }

    if (
      !this.data.showPracticeControls &&
      modePresentation.showPracticeControls &&
      modePresentation.effectivePlayMode === 'echo' &&
      this.data.course?.audio
    ) {
      this.ensureAudioContext(this.data.course.audio)
    }

    if (this.data.showPracticeControls && !modePresentation.showPracticeControls) {
      this.stopTracking()
      this.stopBackgroundPlayback(true)
      this.destroyAudioContext()
      if (this.stopTimer) {
        clearTimeout(this.stopTimer)
        this.stopTimer = null
      }
      this.activeSubtitle = null
      this.pendingSubtitle = null
      this.setAudioLoading(false)
    }

    this.setData({
      showModeSelector: modePresentation.showModeSelector,
      audioPlaybackEnabled: interactiveFeaturesEnabled,
      showShadowMode: modePresentation.showShadowMode,
      showPracticeControls: modePresentation.showPracticeControls,
      showStageGuide: modePresentation.showPracticeControls
        ? this.data.showStageGuide || !hasSeenStageGuide()
        : false,
      stage: modePresentation.effectiveStage,
      playMode: modePresentation.effectivePlayMode,
      playing: modePresentation.showPracticeControls ? this.data.playing : false,
      isRepeating: modePresentation.showPracticeControls ? this.data.isRepeating : false,
      repeatCount: modePresentation.showPracticeControls ? this.data.repeatCount : 0,
      showSpeedModal: modePresentation.showPracticeControls ? this.data.showSpeedModal : false,
      currentSubtitleId:
        this.data.showPracticeControls && !modePresentation.showPracticeControls
          ? null
          : this.data.currentSubtitleId,
    })
  },

  handleRetry() {
    if (this.courseId) {
      this.loadCourse(this.courseId)
    }
  },

  beginStudySession() {
    this.studySessionStart = Date.now()
    this.studySessionPracticeStart = sumPracticeCounts(this.practiceCounts)
  },

  // 使用防抖的学习时长上报函数（5秒防抖）- 用于页面在显示时
  debouncedReportStudyTime: debounce(async function (this: any, seconds: number, practiceCount: number) {
    const state = getStoreState()
    if (!state.token || !state.user) {
      return
    }
    try {
      const response = await reportStudyTime(seconds, practiceCount)
      updateUserInStore(response.user)
    } catch (error) {
      console.warn('Failed to report study time', error)
    }
  }, 5000) as (seconds: number, practiceCount: number) => void,

  // 立即上报学习时长（不防抖）- 用于页面卸载时
  async immediateReportStudyTime(seconds: number, practiceCount: number) {
    const state = getStoreState()
    if (!state.token || !state.user) {
      return
    }
    try {
      const response = await reportStudyTime(seconds, practiceCount)
      updateUserInStore(response.user)
    } catch (error) {
      console.warn('Failed to immediately report study time', error)
    }
  },

  async finalizeStudySession(immediate = false) {
    const start = this.studySessionStart
    if (start === null) {
      return
    }
    this.studySessionStart = null
    const elapsedMs = Date.now() - start
    if (elapsedMs <= 0) {
      return
    }
    const seconds = Math.floor(elapsedMs / 1000)
    if (seconds <= 0) {
      return
    }
    const cappedSeconds = Math.min(seconds, 3600)
    const practiceCount = Math.max(0, sumPracticeCounts(this.practiceCounts) - this.studySessionPracticeStart)

    if (immediate) {
      // 页面卸载时立即上报，不使用防抖
      await this.immediateReportStudyTime(cappedSeconds, practiceCount)
    } else {
      // 页面隐藏时使用防抖函数
      ; (this as any).debouncedReportStudyTime(cappedSeconds, practiceCount)
    }
  },

  handleSubtitleTap(event: WechatMiniprogram.BaseEvent) {
    if (this.wordTapLockUntil && Date.now() < this.wordTapLockUntil) {
      return
    }
    const index = (event.currentTarget.dataset as { index?: number }).index
    if (index === undefined) {
      return
    }
    const target = this.data.subtitles[index]
    if (!target) {
      return
    }

    console.log(`\n============== 用户点击段落 ==============`)
    console.log(`索引: ${index}`)
    console.log(`ID: ${target.id}`)
    console.log(`文本: "${target.text}"`)
    console.log(`时间: ${target.start.toFixed(3)}s - ${target.end.toFixed(3)}s`)
    console.log(`==========================================\n`)

    if (!this.data.showPracticeControls) {
      this.setData({
        currentSubtitleId: target.id,
      })
      return
    }

      // 使用节流版本的播放函数（避免快速点击）
      ; (this as any).throttledPlaySubtitle(target)
  },

  handleWordLongPress(event: WechatMiniprogram.BaseEvent) {
    const dataset = event.currentTarget.dataset as { word?: string; raw?: string; wordId?: string; cueId?: string }
    const word = dataset.word?.trim() ?? ''
    console.log('[Word] longpress', {
      word,
      raw: dataset.raw,
      wordId: dataset.wordId,
      time: Date.now(),
      target: (event as any).target?.dataset,
    })
    if (!word) {
      return
    }

    this.wordTapLockUntil = Date.now() + 600

    this.setData({
      wordPopupVisible: true,
      wordPopupWord: dataset.raw?.trim() || word,
      wordPopupDefinition: '',
      wordPopupPhoneticUk: '',
      wordPopupPhoneticUs: '',
      wordPopupAudioUk: '',
      wordPopupAudioUs: '',
      wordPopupLeft: -9999,
      wordPopupTop: -9999,
      wordPopupLoading: true,
      wordPopupError: '',
      wordPopupReady: false,
    })
    this.wordPopupBounds = null

    this.updateWordPopupPosition(dataset.wordId)

    const lookupKey = word
    this.pendingWordLookup = lookupKey
    this.saveWordToReview({
      word: dataset.raw?.trim() || word,
      normalized: lookupKey,
      cueId: dataset.cueId ?? '',
    })

    fetchWordLookup(lookupKey)
      .then(result => {
        if (this.pendingWordLookup !== lookupKey) {
          return
        }
        this.setData({
          wordPopupWord: result.word || dataset.raw || word,
          wordPopupDefinition: result.translation || '暂无释义',
          wordPopupPhoneticUk: result.phoneticUk ?? '',
          wordPopupPhoneticUs: result.phoneticUs ?? '',
          wordPopupAudioUk: result.audioUk ?? '',
          wordPopupAudioUs: result.audioUs ?? '',
          wordPopupLoading: false,
          wordPopupError: '',
        })
        this.saveWordToReview({
          word: result.word || dataset.raw || word,
          normalized: lookupKey,
          definition: result.translation ?? '',
          phoneticUk: result.phoneticUk ?? '',
          phoneticUs: result.phoneticUs ?? '',
          audioUk: result.audioUk ?? '',
          audioUs: result.audioUs ?? '',
          cueId: dataset.cueId ?? '',
        })
        this.updateWordPopupPosition(dataset.wordId)
      })
      .catch(error => {
        console.warn('[WordLookup] Course dictionary failed:', error)
        if (this.pendingWordLookup !== lookupKey) return
        this.setData({
          wordPopupLoading: false,
          wordPopupError: '暂未找到词义',
        })
      })
  },

  handleHideWordPopup() {
    if (!this.data.wordPopupVisible) {
      return
    }
    this.pendingWordLookup = ''
    this.wordPopupBounds = null
    this.setData({
      wordPopupVisible: false,
      wordPopupLoading: false,
      wordPopupError: '',
      wordPopupReady: false,
    })
  },

  updateWordPopupPosition(wordId?: string) {
    if (!wordId) {
      console.log('[Word] popup position skipped: no wordId')
      return
    }
    wx.nextTick(() => {
      const query = wx.createSelectorQuery().in(this)
      query.select(`#${wordId}`).boundingClientRect()
      query.select('#word-popup').boundingClientRect()
      query.select('.course-navbar').boundingClientRect()
      query.select('.playback-controls').boundingClientRect()
      query.exec(result => {
        if (!this.data.wordPopupVisible) {
          return
        }
        const rect = result?.[0] as WechatMiniprogram.BoundingClientRectCallbackResult | undefined
        const popupRect = result?.[1] as WechatMiniprogram.BoundingClientRectCallbackResult | undefined
        const navRect = result?.[2] as WechatMiniprogram.BoundingClientRectCallbackResult | undefined
        const controlsRect = result?.[3] as WechatMiniprogram.BoundingClientRectCallbackResult | undefined
        if (!rect || !popupRect) {
          console.log('[Word] popup position failed: no rect', { wordId })
          return
        }

        const info = getCourseWindowInfo()
        const safeTop = info.safeArea?.top ?? 0
        const safeBottom = info.safeArea?.bottom ?? info.windowHeight
        const navHeight = navRect?.height ?? 0
        const controlsHeight = controlsRect?.height ?? 0
        const topLimit = safeTop + navHeight
        const bottomLimit = safeBottom - controlsHeight
        const margin = 8

        let left = rect.left + rect.width / 2
        const halfWidth = popupRect.width / 2
        const minLeft = margin + halfWidth
        const maxLeft = info.windowWidth - margin - halfWidth
        left = Math.min(Math.max(left, minLeft), Math.max(minLeft, maxLeft))

        let placement: 'top' | 'bottom' = 'top'
        let top = rect.top - margin
        const minTopForTop = topLimit + margin + popupRect.height
        if (top < minTopForTop) {
          placement = 'bottom'
          top = rect.bottom + margin
        }
        if (placement === 'bottom') {
          const maxTop = bottomLimit - margin - popupRect.height
          if (top > maxTop) {
            placement = 'top'
            top = Math.max(minTopForTop, rect.top - margin)
          }
        }

        this.setData({
          wordPopupLeft: left,
          wordPopupTop: top,
          wordPopupPlacement: placement,
          wordPopupReady: true,
        })

        const popupLeft = left - popupRect.width / 2
        const popupTop = placement === 'top' ? top - popupRect.height : top
        this.wordPopupBounds = {
          left: popupLeft,
          right: popupLeft + popupRect.width,
          top: popupTop,
          bottom: popupTop + popupRect.height,
        }
      })
    })
  },

  handlePlayWordAudio(event: WechatMiniprogram.BaseEvent) {
    if (!this.data.audioPlaybackEnabled) return

    const variant = (event.currentTarget.dataset as { variant?: string }).variant
    const url = variant === 'uk' ? this.data.wordPopupAudioUk : this.data.wordPopupAudioUs
    console.log('[WordAudio] play', { variant, url })
    if (!url) {
      wx.showToast({
        title: '暂无发音',
        icon: 'none',
      })
      return
    }

    this.ensureWordAudioContext()
    if (this.wordAudioContext) {
      this.wordAudioContext.stop()
      this.wordAudioContext.src = url
      this.wordAudioContext.play()
    }
  },

  ensureWordAudioContext() {
    if (this.wordAudioContext) {
      return
    }
    const audioContext = wx.createInnerAudioContext()
    audioContext.autoplay = false
    audioContext.obeyMuteSwitch = true
    audioContext.onError(err => {
      console.warn('[WordAudio] 播放失败', err)
      wx.showToast({
        title: '发音播放失败',
        icon: 'none',
      })
    })
    this.wordAudioContext = audioContext
  },

  // 节流版本的播放字幕（500ms内最多执行一次）
  throttledPlaySubtitle: throttle(function (this: any, subtitle: ViewSubtitle) {
    this.playSubtitle(subtitle)
  }, 500) as (subtitle: ViewSubtitle) => void,

  playSubtitle(subtitle: ViewSubtitle) {
    if (!this.data.showPracticeControls) {
      return
    }
    if (!this.data.course) {
      wx.showToast({
        title: '音频未就绪',
        icon: 'none',
      })
      return
    }

    // 音频加载中时提示用户稍等
    if (this.data.playMode === 'echo' && this.data.audioLoading) {
      logAudioRequest('echo:click-blocked-audio-loading', this.audioSource || this.data.course.audio || '', {
        courseId: this.data.course.id,
        subtitleId: subtitle.id,
        audioReady: this.audioReady,
      })
      this.setAudioLoading(true)
      return
    }

    console.log(`[播放] 模式=${this.data.playMode}, 段落=${subtitle.id}`)

    // Echo 模式：优先使用完整音频 + seek，失败时回退到切片
    if (this.data.playMode === 'echo') {
      if (!this.audioContext) {
        wx.showToast({
          title: '音频未就绪',
          icon: 'none',
        })
        return
      }

      const context = this.audioContext
      this.lastEchoCompletion = null
      this.clearGapTimer()
      // 换句时丢弃上一句的录音（听完即弃）
      if (this.recordedCueId && subtitle.id !== this.recordedCueId) {
        this.discardRecording()
      }
      // 每句练习次数（对比听回放不计入）
      if (this.compareStep !== 'original') {
        this.practiceCounts[subtitle.id] = (this.practiceCounts[subtitle.id] ?? 0) + 1
      }
      // 更新状态
      this.activeSubtitle = subtitle
      const index = this.data.subtitles.findIndex(s => s.id === subtitle.id)
      if (index >= 0) {
        this.currentSubtitleIndex = index
      }

      if (this.data.currentSubtitleId !== subtitle.id && this.data.isRepeating) {
        this.setData({ repeatCount: 0 })
      }

      this.setData({
        currentSubtitleId: subtitle.id,
        scrollIntoView: '',
      })
      this.scheduleSceneProgressSync()

      this.centerSubtitle(subtitle.id)

      // Echo模式优先使用完整音频 + seek
      if (!this.usingFallbackAudio && this.data.course.audio) {
        console.log(`[Echo] 使用完整音频 + seek 方式播放`)
        const audioSrc = this.data.course.audio
        const needSwitchSrc = context.src !== audioSrc || this.audioSource !== audioSrc
        logAudioRequest('echo:click-full-audio', audioSrc, {
          courseId: this.data.course.id,
          subtitleId: subtitle.id,
          needSwitchSrc,
          audioReady: this.audioReady,
          usingFallbackAudio: this.usingFallbackAudio,
          start: subtitle.start,
          end: subtitle.end,
        })
        
        if (needSwitchSrc) {
          console.log(`[Echo] 切换到完整音频: ${audioSrc}`)
          logAudioRequest('echo:full-audio:set-src', audioSrc, {
            courseId: this.data.course.id,
            subtitleId: subtitle.id,
            usingFallbackAudio: this.usingFallbackAudio,
          })
          context.stop()
          this.audioReady = false
          this.pendingSubtitle = subtitle
          context.src = audioSrc
          this.audioRequestStartedAt = Date.now()
          this.audioSource = audioSrc
          return
        }

        // 音频源相同，直接 seek 播放
        if (this.audioReady) {
          const startPosition = Math.max(subtitle.start, 0)
          context.pause()
          
          // 设置停止定时器
          if (this.stopTimer) {
            clearTimeout(this.stopTimer)
          }
          
          const duration = (subtitle.end - subtitle.start) / this.data.playbackRate
          this.stopTimer = setTimeout(() => {
            this.lastKnownCourseTime = Math.max(this.lastKnownCourseTime, subtitle.end)
            console.log('[Audio] Echo 定时暂停，记录句末进度', {
              subtitleId: subtitle.id,
              completionTime: this.lastKnownCourseTime,
            })
            if (this.audioContext) {
              this.audioContext.pause()
              this.handleAudioPause()
            }
            this.stopTimer = null
            this.markEchoCompletionProgress('stop-timer')

            // 重复模式优先，其次执行阶段句末策略
            if (this.data.isRepeating && this.activeSubtitle) {
              this.handleRepeatNext(this.activeSubtitle)
            } else {
              this.handleCueEnded(subtitle)
            }
          }, duration * 1000 + 200) as unknown as number
          
          context.seek(startPosition)
          context.play()
        } else {
          this.pendingSubtitle = subtitle
          context.play()
        }
        return
      }

      // 降级：使用服务器切片音频
      const segmentUrl = `${API_BASE_URL}/static/audio-segments/${this.data.course.id}/segment_${subtitle.id}.m4a`
      console.log(`[Echo] 降级使用切片: ${segmentUrl}`)
      logAudioRequest('echo:segment:set-src', segmentUrl, {
        courseId: this.data.course.id,
        subtitleId: subtitle.id,
      })

      context.stop()
      context.src = segmentUrl
      this.audioRequestStartedAt = Date.now()
      context.startTime = 0
      this.audioSource = segmentUrl
      context.play()

      return
    }

    // Shadow 模式：播放完整 MP3
    this.activeSubtitle = subtitle

    // 更新当前索引
    const index = this.data.subtitles.findIndex(s => s.id === subtitle.id)
    if (index >= 0) {
      this.currentSubtitleIndex = index
    }

    this.setData({
      currentSubtitleId: subtitle.id,
      scrollIntoView: '',
    })
    this.scheduleSceneProgressSync()

    this.centerSubtitle(subtitle.id)
    if (this.stopTimer) {
      clearTimeout(this.stopTimer)
      this.stopTimer = null
    }
    this.playShadowCourseAt(Math.max(subtitle.start, 0), true)
  },

  seekAndPlay(subtitle: SubtitleLike) {
    const startPosition = subtitle.start

    console.log(`[seekAndPlay] ==========================================`)
    console.log(`[seekAndPlay] 点击段落: ID=${subtitle.id}, 文本="${this.data.subtitles.find(s => s.id === subtitle.id)?.text || ''}"`)
    console.log(`[seekAndPlay] 时间范围: ${startPosition.toFixed(3)}s - ${subtitle.end.toFixed(3)}s (时长${(subtitle.end - startPosition).toFixed(3)}s)`)
    console.log(`[seekAndPlay] seek前currentTime: ${this.getCurrentCourseTime().toFixed(3)}s`)

    // 清除旧的定时器
    if (this.stopTimer) {
      clearTimeout(this.stopTimer)
      this.stopTimer = null
    }

    if (this.data.playMode === 'shadow') {
      this.playShadowCourseAt(startPosition, true)
      return
    }

    if (!this.audioContext) {
      return
    }
    const context = this.audioContext

    context.pause()
    context.stop()
    console.log(`[seekAndPlay] 执行 play() + seek(${startPosition})`)
    if (context.src === this.audioSource && this.audioReady) {
      context.seek(startPosition)
      context.play()
      return
    }

    context.startTime = startPosition
    context.play()
  },

  // 处理重复播放的下一次
  handleRepeatNext(subtitle: SubtitleLike) {
    const currentCount = this.data.repeatCount + 1

    console.log(`[Repeat] 当前次数: ${currentCount}/${this.data.repeatTarget}`)

    if (currentCount < this.data.repeatTarget) {
      // 还没达到目标次数，继续重复
      this.setData({ repeatCount: currentCount })

      setTimeout(() => {
        if (!this.data.isRepeating) {
          console.log(`[Repeat] 重复已取消，停止`)
          return
        }

        // Echo 模式：使用 playSubtitle 播放 M4A 片段
        if (this.data.playMode === 'echo') {
          const subtitleView = this.data.subtitles.find(s => s.id === subtitle.id)
          if (subtitleView) {
            console.log(`[Repeat] Echo 模式重复播放`)
            this.playSubtitle(subtitleView)
          }
          return
        }

        // Shadow 模式：使用 seekAndPlay
        console.log(`[Repeat] Shadow 模式重复播放`)
        this.seekAndPlay(subtitle)
      }, 100)
    } else {
      // 达到目标次数，停止重复
      console.log(`[Repeat] 完成 ${this.data.repeatTarget} 次重复`)
      wx.showToast({
        title: `已重复${this.data.repeatTarget}次`,
        icon: 'success',
        duration: 2000,
      })
      this.setData({
        isRepeating: false,
        repeatCount: 0,
      })

      // 影子跟读模式：重复完成后继续播放下一个段落
      if (this.data.playMode === 'shadow') {
        setTimeout(() => {
          this.playNextInShadowMode()
        }, 200)
      }
      // Echo模式：重复完成后停止，等待用户操作
    }
  },

  handleAudioPause() {
    this.setData({ playing: false })
  },

  handleToggleLanguage() {
    const modes: ('all' | 'en' | 'zh')[] = ['all', 'en', 'zh']
    const currentMode = this.data.transcriptMode
    const nextIndex = (modes.indexOf(currentMode) + 1) % modes.length
    const nextMode = modes[nextIndex]

    this.setData({
      transcriptMode: nextMode
    })

    const toastMap = {
      'all': '中英双语',
      'en': '仅英文',
      'zh': '仅中文'
    }

    wx.showToast({
      title: toastMap[nextMode],
      icon: 'none',
      duration: 1000
    })
  },

  handleOpenPDFPage() {
    if (!this.data.course) return
    
    wx.navigateTo({
      url: `/pages/knowledge/knowledge?id=${this.data.course.id}&title=${encodeURIComponent(this.data.course.title)}`
    })
  },
  handleOpenPDF() {
    this.handleOpenPDFPage()
  },

  handleExplain() {
    if (!this.data.showPracticeControls) {
      return
    }
    const currentId = this.data.currentSubtitleId
    if (!currentId) {
      wx.showToast({
        title: '请先选择一个句子',
        icon: 'none'
      })
      return
    }

    const subtitle = this.data.subtitles.find(s => s.id === currentId)
    if (!subtitle) return

    // 获取上下文（前后各一句）
    const index = this.data.subtitles.findIndex(s => s.id === currentId)
    let context = ''
    if (index >= 0) {
      const prev = this.data.subtitles[index - 1]?.text || ''
      const next = this.data.subtitles[index + 1]?.text || ''
      context = `Preceding: "${prev}"\nTarget: "${subtitle.text}"\nFollowing: "${next}"`
    }
    if (this.knowledgeContext) {
      context = `${context}\n\n${this.knowledgeContext}`.trim()
    }

    this.setData({
      showAiPopup: true,
      aiText: subtitle.text,
      aiContext: context,
      // 暂停播放
      playing: false
    })
    
    if (this.data.playMode === 'shadow') {
      this.pauseShadowPlayback()
    } else if (this.audioContext) {
      this.audioContext.pause()
    }
  },

  handleAiPopupClose() {
    this.setData({
      showAiPopup: false
    })
  },


  // 播放通道切换（原顶层"模式切换"，现由学习阶段驱动）
  // options.skipResume：不做断点续播解析（调用方随后自行决定起播位置，如跟读从头播）
  applyPlayModeChange(mode: playerCore.PlaybackChannel, options: { skipResume?: boolean } = {}) {
    if (mode === 'shadow' && !this.data.showShadowMode) {
      return
    }
    if (mode === this.data.playMode) {
      return
    }

    this.clearGapTimer()
    this.discardRecording()
    const previousMode = this.data.playMode
    const wasPlaying = this.data.playing
    const modeSwitchCourseTime = this.getCurrentCourseTime()
    this.lastKnownCourseTime = modeSwitchCourseTime
    this.debugShadowBackground('mode change requested', {
      fromMode: previousMode,
      toMode: mode,
      wasPlaying,
      modeSwitchCourseTime,
    })
    const currentSubtitleId = this.data.currentSubtitleId
    const targetSubtitleView =
      currentSubtitleId
        ? this.data.subtitles.find(subtitle => subtitle.id === currentSubtitleId) ?? null
        : this.data.subtitles[0] ?? null
    const targetSubtitle =
      targetSubtitleView
        ? {
          id: targetSubtitleView.id,
          start: targetSubtitleView.start,
          end: targetSubtitleView.end,
        }
        : null

    // 停止当前播放和跟踪
    this.stopTracking()
    if (this.stopTimer) {
      clearTimeout(this.stopTimer)
      this.stopTimer = null
    }

    if (previousMode === 'shadow' && mode === 'echo') {
      this.stopBackgroundPlayback(true)
    }

    if (previousMode === 'echo' && this.audioContext) {
      this.suppressMainAudioContextEvents = true
      try {
        this.audioContext.pause()
      } catch (error) {
        console.warn('[Audio] echo->shadow pause failed during mode switch', error)
      }
    }

    // 更新通道，关闭重复模式
    this.setData({
      playMode: mode,
      playing: false,
      isRepeating: false,  // 切换通道时关闭重复
      repeatCount: 0,      // 重置计数器
      gapWaiting: false,
    })
    this.suppressMainAudioContextEvents = false

    if (!targetSubtitle || !targetSubtitleView) {
      return
    }

    const index = this.data.subtitles.findIndex(subtitle => subtitle.id === targetSubtitleView.id)
    if (index >= 0) {
      this.currentSubtitleIndex = index
    }

    this.setData({
      currentSubtitleId: targetSubtitleView.id,
    })
    this.scheduleSceneProgressSync()
    this.activeSubtitle = targetSubtitle
    this.centerSubtitle(targetSubtitleView.id)

    if (mode === 'shadow') {
      if (options.skipResume) {
        return
      }
      const nextShadowState =
        previousMode === 'echo'
          ? resolveEchoToShadowSwitchState({
              subtitles: this.data.subtitles,
              audioCurrentTime: this.audioContext?.currentTime,
              activeSubtitle: targetSubtitle,
              lastKnownCourseTime: this.lastKnownCourseTime,
              fallbackSubtitleId: targetSubtitleView.id,
              echoCompletedCourseTime: this.lastEchoCompletion?.courseTime ?? null,
              echoCompletedSubtitleId: this.lastEchoCompletion?.subtitleId ?? null,
              tolerance: 0.3,
            })
          : resolveShadowModeSwitchState({
              subtitles: this.data.subtitles,
              courseTime: modeSwitchCourseTime,
              fallbackSubtitleId: targetSubtitleView.id,
              shouldAutoplay: wasPlaying,
              tolerance: 0.3,
            })

      if (!nextShadowState) {
        return
      }

      this.debugShadowBackground('mode change resolved shadow resume', {
        resumeTime: nextShadowState.resumeTime,
        shouldAutoplay: nextShadowState.shouldAutoplay,
        subtitleId: nextShadowState.subtitle.id,
        subtitleIndex: nextShadowState.index,
      })
      this.currentSubtitleIndex = nextShadowState.index
      this.activeSubtitle = nextShadowState.subtitle
      this.setData({
        currentSubtitleId: nextShadowState.subtitle.id,
        playing: nextShadowState.shouldAutoplay,
      })
      this.centerSubtitle(nextShadowState.subtitle.id)
      const targetCourseAudio = this.data.course?.audio || ''
      const canSkipShadowLoadingMask =
        previousMode === 'echo' &&
        this.audioReady &&
        !!targetCourseAudio &&
        this.audioSource === targetCourseAudio &&
        this.audioContext?.src === targetCourseAudio

      if (canSkipShadowLoadingMask) {
        this.debugShadowBackground('skip shadow loading mask: foreground audio ready', {
          audioSource: this.audioSource,
          targetSrc: targetCourseAudio,
        })
      }

      this.playShadowCourseAt(nextShadowState.resumeTime, nextShadowState.shouldAutoplay, {
        showLoading: !canSkipShadowLoadingMask,
      })
      if (nextShadowState.shouldAutoplay) {
        this.startTracking()
      } else {
        this.stopTracking()
      }
      this.lastEchoCompletion = null
      return
    }

    // Echo 通道：懒加载前台音频（通听默认不再预热，进入精练/留白跟读时才初始化）
    this.lastEchoCompletion = null
    if (this.data.course?.audio) {
      this.ensureAudioContext(this.data.course.audio)
    }
    console.log(`[ModeChange] 切换到 Echo 通道，等待用户点击段落`)
  },

  // 学习阶段切换：阶段只是播放行为预设（通道 + 句末策略）
  handleStageChange(event: WechatMiniprogram.BaseEvent) {
    const stage = (event.currentTarget.dataset as { stage?: playerCore.LearningStage }).stage
    if (!stage || stage === this.data.stage) {
      return
    }
    if (!this.data.showShadowMode && stage !== 'practice') {
      return
    }

    this.clearGapTimer()
    this.discardRecording()
    this.setData({ stage, reviewOnlyMode: stage === 'practice' ? this.data.reviewOnlyMode : false })
    const plan = playerCore.resolveStagePlan(stage, this.data.gapEnabled)
    // 任一阶段切换都不做断点续播，统一定位到对话第一句
    this.applyPlayModeChange(plan.channel, { skipResume: true })
    this.startStageFromBeginning(stage)
    this.scheduleCourseShareImage()
  },

  // 留白跟读开关（仅跟读阶段可用）：开=前台逐句通道句末留白，关=后台连续通道
  handleGapToggle() {
    if (this.data.stage !== 'follow') {
      return
    }
    const gapEnabled = !this.data.gapEnabled
    this.clearGapTimer()
    this.setData({ gapEnabled })
    const plan = playerCore.resolveStagePlan(this.data.stage, gapEnabled)
    // 切换留白开关等于重设跟读方式：回到开头重新开始
    this.applyPlayModeChange(plan.channel, { skipResume: true })
    this.startStageFromBeginning('follow')
  },

  dismissStageGuide() {
    if (!this.data.showStageGuide) {
      return
    }
    markStageGuideSeen()
    this.setData({ showStageGuide: false })
    // 引导关闭后接上被推迟的初始化：通听自动连播，echo 通道预热前台音频
    if (
      this.data.stage === 'listen' &&
      this.data.playMode === 'shadow' &&
      !this.data.playing &&
      !this.data.currentSubtitleId &&
      this.data.subtitles.length > 0
    ) {
      this.startShadowMode()
    } else if (this.data.playMode === 'echo' && this.data.course?.audio && !this.audioContext) {
      this.ensureAudioContext(this.data.course.audio)
    }
  },

  clearGapTimer() {
    if (this.gapTimer) {
      clearTimeout(this.gapTimer)
      this.gapTimer = null
    }
    if (this.data.gapWaiting) {
      this.setData({ gapWaiting: false })
    }
  },

  // 句末策略执行（仅前台逐句通道；重复模式优先于句末策略，在调用方先行处理）
  handleCueEnded(subtitle: SubtitleLike) {
    if (this.data.playMode !== 'echo') {
      return
    }

    // 对比听：原句播完接自己的录音，跳过句末策略
    if (this.compareStep === 'original') {
      this.compareStep = 'mine'
      this.playRecordedTake()
      return
    }

    const policy = playerCore.resolveStagePlan(this.data.stage, this.data.gapEnabled).cueEndPolicy
    if (policy !== 'gap-advance') {
      return
    }

    const next = playerCore.findNextCue(this.data.subtitles, subtitle.id)
    if (!next) {
      // 最后一句：完成判定由 markEchoCompletionProgress（跟读阶段）处理
      return
    }

    // gap-advance：句末静音留白（约等于句长）后自动播放下一句
    const gapMs = playerCore.computeGapMs(subtitle, this.data.playbackRate)
    console.log('[Stage] 留白跟读等待', { subtitleId: subtitle.id, nextId: next.id, gapMs })
    this.setData({ gapWaiting: true })
    this.gapTimer = setTimeout(() => {
      this.gapTimer = null
      this.setData({ gapWaiting: false })
      if (
        this.data.playMode !== 'echo' ||
        this.data.stage !== 'follow' ||
        !this.data.gapEnabled ||
        this.data.playing
      ) {
        return
      }
      const nextView = this.data.subtitles.find(item => item.id === next.id)
      if (nextView) {
        this.playSubtitle(nextView)
      }
    }, gapMs) as unknown as number
  },

  // 高亮并居中指定句（不播放）
  selectCue(cueId: string) {
    const index = this.data.subtitles.findIndex(item => item.id === cueId)
    if (index < 0) {
      return
    }
    const view = this.data.subtitles[index]
    this.currentSubtitleIndex = index
    this.activeSubtitle = view
    this.setData({
      currentSubtitleId: view.id,
      scrollIntoView: '',
    })
    this.scheduleSceneProgressSync()
    this.centerSubtitle(view.id)
  },

  // 处理带 cueId 的来源回跳。复习页会显式传 autoplay=1；普通深链仍只定位，不自动播放。
  focusCueFromSource(cueId: string, autoplay: boolean) {
    const view = this.data.subtitles.find(item => item.id === cueId)
    if (!view) {
      return
    }

    this.selectCue(cueId)
    // 来源回跳是一次明确定位，绕过日常播放跟随的滚动节流。
    this._centerSubtitleImpl(view.id)

    if (
      !autoplay ||
      !this.data.showPracticeControls ||
      this.data.playMode !== 'echo' ||
      !this.data.course?.audio
    ) {
      return
    }

    this.ensureAudioContext(this.data.course.audio)
    if (this.audioReady && !this.data.audioLoading) {
      this.playSubtitle(view)
      return
    }

    // 音频仍在加载时保留目标句，onCanplay 会通过 playSubtitle 自动起播并设置句末停止。
    this.pendingSubtitle = view
  },

  // 阶段切换/重听统一从对话开头开始：通听与跟读（连续）自动起播，
  // 留白跟读选中首句起播，精练只定位到第一句等用户操作
  startStageFromBeginning(stage: playerCore.LearningStage) {
    const first = this.data.subtitles[0]
    if (!first) {
      return
    }
    if (this.data.playMode === 'shadow') {
      this.startShadowMode()
      // 阶段切换是用户主动定位，不能被播放过程的 300ms 滚动节流吞掉。
      this._centerSubtitleImpl(first.id)
      return
    }
    this.selectCue(first.id)
    // 精练/留白跟读同样强制定位；selectCue 内的节流滚动只负责日常播放跟随。
    this._centerSubtitleImpl(first.id)
    if (stage === 'practice') {
      return
    }
    // 留白跟读：自动起播
    if (this.audioReady && !this.data.audioLoading) {
      this.playSubtitle(first)
    } else {
      // 音频尚未就绪：挂起首句，onCanplay 后自动开始
      this.pendingSubtitle = first
    }
  },

  // ==================== 录音对比（听完即弃） ====================

  ensureRecorderManager() {
    if (this.recorderManager) {
      return this.recorderManager
    }
    const manager = wx.getRecorderManager()
    manager.onStart(() => {
      this.setData({ recording: true })
    })
    manager.onStop(res => {
      const tempFilePath = res?.tempFilePath || ''
      const forCurrentCue = Boolean(
        tempFilePath &&
        this.recordedCueId &&
        this.recordedCueId === this.data.currentSubtitleId,
      )
      this.recordedTempPath = forCurrentCue ? tempFilePath : ''
      this.setData({
        recording: false,
        recordReady: forCurrentCue,
      })
    })
    manager.onError(err => {
      console.warn('[Record] 录音失败', err)
      this.recordedTempPath = ''
      this.setData({ recording: false, recordReady: false })
      wx.showToast({
        title: '录音失败，请检查麦克风权限',
        icon: 'none',
      })
    })
    this.recorderManager = manager
    return manager
  },

  handleToggleRecording() {
    const currentId = this.data.currentSubtitleId
    if (!currentId) {
      wx.showToast({ title: '先选择一个句子', icon: 'none' })
      return
    }
    if (this.data.recording) {
      this.ensureRecorderManager().stop()
      return
    }
    // 录音属敏感权限：先确认系统授权（隐私协议由微信在首次 authorize 时统一拦截）
    wx.getSetting({
      success: res => {
        const decision = decideRecordAuthAction({ recordAuth: res.authSetting['scope.record'] })
        if (decision.action === 'start') {
          this.beginRecording(currentId)
        } else if (decision.action === 'request') {
          wx.authorize({
            scope: 'scope.record',
            success: () => this.beginRecording(currentId),
            fail: () => this.promptRecordSetting(),
          })
        } else {
          this.promptRecordSetting()
        }
      },
      fail: () => this.beginRecording(currentId),
    })
  },

  promptRecordSetting() {
    wx.showModal({
      title: '需要麦克风权限',
      content: '开启麦克风后可录音跟读、对比自己的发音。是否前往设置开启？',
      confirmText: '去设置',
      success: res => {
        if (res.confirm) {
          wx.openSetting()
        }
      },
    })
  },

  beginRecording(currentId: string) {
    const manager = this.ensureRecorderManager()
    // 录音前停下播放和留白，避免录进原声
    if (this.data.playing && this.audioContext) {
      this.audioContext.pause()
    }
    this.clearGapTimer()
    this.compareStep = ''
    this.recordedTempPath = ''
    this.recordedCueId = currentId
    this.setData({ recordReady: false, comparing: false })
    manager.start({
      duration: 60000,
      format: 'aac',
      sampleRate: 44100,
      encodeBitRate: 96000,
      numberOfChannels: 1,
    })
  },

  // 对比听：先播原句，句末接自己的录音
  handleCompareRecording() {
    if (!this.recordedTempPath || this.data.recording || this.data.comparing) {
      return
    }
    const currentId = this.data.currentSubtitleId
    if (!currentId || currentId !== this.recordedCueId) {
      return
    }
    const currentView = this.data.subtitles.find(item => item.id === currentId)
    if (!currentView) {
      return
    }
    this.compareStep = 'original'
    this.setData({ comparing: true })
    this.playSubtitle(currentView)
  },

  playRecordedTake() {
    if (!this.recordedTempPath) {
      this.finishCompare()
      return
    }
    if (!this.recordingAudioContext) {
      const context = wx.createInnerAudioContext()
      context.obeyMuteSwitch = false
      context.onEnded(() => this.finishCompare())
      context.onError(() => this.finishCompare())
      this.recordingAudioContext = context
    }
    this.recordingAudioContext.src = this.recordedTempPath
    this.recordingAudioContext.play()
  },

  finishCompare() {
    this.compareStep = ''
    if (this.data.comparing) {
      this.setData({ comparing: false })
    }
  },

  // 听完即弃：换句、切阶段、退出页面时丢掉录音
  discardRecording() {
    if (this.data.recording) {
      this.recorderManager?.stop()
    }
    this.recordingAudioContext?.stop()
    this.recordedTempPath = ''
    this.recordedCueId = ''
    this.compareStep = ''
    if (this.data.recordReady || this.data.comparing) {
      this.setData({ recordReady: false, comparing: false })
    }
  },

  // ==================== 难句星标 ====================

  readStarredCueMap(): StarredCueMap {
    try {
      return normalizeStarredCueMap(wx.getStorageSync(STARRED_CUES_STORAGE_KEY))
    } catch (_error) {
      return {}
    }
  },

  readReviewLibrary(): ReviewLibrary {
    try {
      return normalizeReviewLibrary(wx.getStorageSync(REVIEW_LIBRARY_STORAGE_KEY))
    } catch (_error) {
      return { words: [], cues: [] }
    }
  },

  writeReviewLibrary(library: ReviewLibrary) {
    try {
      wx.setStorageSync(REVIEW_LIBRARY_STORAGE_KEY, library)
    } catch (_error) {
      // 复习资料写入失败不阻断课程练习
    }
  },

  saveWordToReview(input: Partial<ReviewWord> & Pick<ReviewWord, 'word' | 'normalized'>) {
    const sourceCueId = input.cueId || this.data.currentSubtitleId
    const cue = this.data.subtitles.find(item => item.id === sourceCueId)
    const library = upsertReviewWord(this.readReviewLibrary(), {
      ...input,
      courseId: this.courseId,
      courseTitle: this.data.course?.title ?? '',
      cueId: cue?.id ?? sourceCueId ?? '',
      cueText: cue?.text ?? '',
      cueTranslation: cue?.translation ?? '',
    })
    this.writeReviewLibrary(library)
  },

  handleReviewOnlyToggle() {
    if (!this.data.starredCueCount) {
      wx.showToast({ title: '先标记几句难句', icon: 'none' })
      return
    }
    const reviewOnlyMode = !this.data.reviewOnlyMode
    this.setData({ reviewOnlyMode })
    if (reviewOnlyMode) {
      const first = this.data.subtitles.find(item => item.starred)
      if (first) this.selectCue(first.id)
    }
  },

  handleToggleStar(event: WechatMiniprogram.BaseEvent) {
    const cueId = (event.currentTarget.dataset as { id?: string }).id
    if (!cueId || !this.courseId) {
      return
    }
    const nextMap = toggleStarredCue(this.readStarredCueMap(), this.courseId, cueId)
    try {
      wx.setStorageSync(STARRED_CUES_STORAGE_KEY, nextMap)
    } catch (_error) {
      // 存储失败不阻断练习
    }
    const index = this.data.subtitles.findIndex(item => item.id === cueId)
    if (index >= 0) {
      const starred = isCueStarred(nextMap, this.courseId, cueId)
      const cue = this.data.subtitles[index]
      const library = starred
        ? upsertReviewCue(this.readReviewLibrary(), {
          courseId: this.courseId,
          courseTitle: this.data.course?.title ?? '',
          cueId,
          cueText: cue.text,
          cueTranslation: cue.translation ?? '',
        })
        : removeReviewCue(this.readReviewLibrary(), this.courseId, cueId)
      this.writeReviewLibrary(library)
      const starredCueCount = nextMap[this.courseId]?.length ?? 0
      this.setData({
        [`subtitles[${index}].starred`]: starred,
        starredCueCount,
        reviewOnlyMode: starredCueCount > 0 ? this.data.reviewOnlyMode : false,
      } as unknown as Partial<CoursePageData>)
    }
  },

  // ==================== 小节完成面板 ====================

  async openCompletionPanel() {
    if (this.data.showCompletionPanel) {
      return
    }
    const totalCues = this.data.subtitles.length
    const practicedCount = Math.min(totalCues, Object.keys(this.practiceCounts).length)

    let nextScene: NextSceneCandidate | null = null
    try {
      const response = await fetchCourseList(1, 50)
      nextScene = resolveNextScene(response.data, this.courseId)
    } catch (error) {
      console.warn('[Completion] resolve next scene failed', error)
    }

    this.setData({
      showCompletionPanel: true,
      completionStats: { totalCues, practicedCount },
      nextScene,
    })
    // 分享封面切换为成就海报
    void this.generateCompletionShareImage()
  },

  // 成就分享海报：微信分享卡封面为 5:4，在共享 canvas 顶部按 600x480 绘制并区域导出。
  // 底图（生成插画）存在时全幅铺底，缺失时渐变+金色庆祝元素兜底。
  async generateCompletionShareImage() {
    if (!this.data.course) {
      return
    }
    try {
      const tempFilePath = await renderCourseCompletionPoster(
        this,
        COURSE_SHARE_CANVAS_ID,
        this.data.course.title,
        this.data.completionStats,
      )
      this.setData({ shareImageUrl: tempFilePath })
    } catch (error) {
      console.warn('[Share] generate completion share image failed', error)
    }
  },

  handleCompletionClose() {
    this.setData({ showCompletionPanel: false })
    // 分享封面恢复为常规课程卡片
    this.scheduleCourseShareImage()
  },

  handleCompletionReplay() {
    // 留在跟读阶段，从头再听一遍
    this.setData({ showCompletionPanel: false, stage: 'follow' })
    const plan = playerCore.resolveStagePlan('follow', this.data.gapEnabled)
    this.applyPlayModeChange(plan.channel, { skipResume: true })
    this.startStageFromBeginning('follow')
  },

  handleCompletionNext() {
    const nextScene = this.data.nextScene
    if (!nextScene) {
      return
    }
    wx.redirectTo({
      url: `/pages/course/course?id=${nextScene.id}`,
    })
  },

  // 开始影子跟读模式
  startShadowMode() {
    this.currentSubtitleIndex = 0
    const firstSubtitle = this.data.subtitles[0]
    if (firstSubtitle) {
      this.playShadowCourseAt(firstSubtitle.start, true)
      // 设置初始字幕
      this.activeSubtitle = firstSubtitle
      this.setData({
        currentSubtitleId: firstSubtitle.id,
        scrollIntoView: '',
      })
      this.scheduleSceneProgressSync()
      this.centerSubtitle(firstSubtitle.id)
    }
  },

  // 影子跟读模式播放下一个
  playNextInShadowMode() {
    if (this.data.playMode !== 'shadow') {
      return
    }

    // 如果开启了重复模式，不自动播放下一个
    if (this.data.isRepeating) {
      return
    }

    const nextIndex = this.currentSubtitleIndex + 1
    if (nextIndex < this.data.subtitles.length) {
      this.currentSubtitleIndex = nextIndex
      const nextSubtitle = this.data.subtitles[nextIndex]
      if (nextSubtitle) {
        // 不需要延迟，直接播放下一个
        this.playSubtitle(nextSubtitle)
      }
    } else {
      // 播放完所有段落
      this.finishScenePlayback(true)
    }
  },

  // 实时跟踪字幕位置（优化版 + 真机适配）
  trackSubtitlePosition() {
    if (this.data.playMode !== 'shadow') {
      return
    }
    const currentTime = this.getShadowCurrentTime()
    if (this.hasReachedSceneEnd(currentTime) && !this.data.isRepeating) {
      this.finishScenePlayback(true)
      return
    }

    if (this.data.isRepeating && this.activeSubtitle) {
      if (currentTime >= this.activeSubtitle.end) {
        this.pauseShadowPlayback()
        this.handleRepeatNext(this.activeSubtitle)
      }
      return
    }

    // 真机适配：增加容错范围（从0.1秒增加到0.3秒）
    const tolerance = 0.3

    let found = false

    // 优先检查当前字幕索引
    if (this.currentSubtitleIndex < this.data.subtitles.length) {
      const currentSubtitle = this.data.subtitles[this.currentSubtitleIndex]
      if (currentSubtitle && currentTime >= currentSubtitle.start - tolerance && currentTime <= currentSubtitle.end + tolerance) {
        found = true
        if (this.data.currentSubtitleId !== currentSubtitle.id) {
          this.activeSubtitle = currentSubtitle
          this.setData({
            currentSubtitleId: currentSubtitle.id,
            scrollIntoView: '',
          })
          this.scheduleSceneProgressSync()
          this.centerSubtitle(currentSubtitle.id)
        }
      }
    }

    // 检查下一个字幕
    if (!found && this.currentSubtitleIndex + 1 < this.data.subtitles.length) {
      const nextSubtitle = this.data.subtitles[this.currentSubtitleIndex + 1]
      if (nextSubtitle && currentTime >= nextSubtitle.start - tolerance) {
        this.currentSubtitleIndex++
        this.activeSubtitle = nextSubtitle
        this.setData({
          currentSubtitleId: nextSubtitle.id,
          scrollIntoView: '',
        })
        this.centerSubtitle(nextSubtitle.id)
        found = true
      }
    }

    // 如果还没找到，遍历查找（处理跳转等情况）
    if (!found) {
      for (let i = 0; i < this.data.subtitles.length; i++) {
        const subtitle = this.data.subtitles[i]
        if (currentTime >= subtitle.start - tolerance && currentTime <= subtitle.end + tolerance) {
          this.currentSubtitleIndex = i
          this.activeSubtitle = subtitle
          this.setData({
            currentSubtitleId: subtitle.id,
            scrollIntoView: '',
          })
          this.centerSubtitle(subtitle.id)
          break
        }
      }
    }
  },

  // 开始跟踪（使用定时器 + 真机优化）
  startTracking() {
    // 如果定时器已经在运行，不需要重新创建
    if (this.trackingTimer) {
      return
    }

    // 真机优化：降低检查频率从100ms到150ms，减少性能压力
    this.trackingTimer = setInterval(() => {
      // 只在影子跟读模式下工作
      if (this.data.playMode !== 'shadow') {
        this.stopTracking()
        return
      }

      // 只在播放时执行跟踪
      if (!this.data.playing) {
        return // 暂停时不跟踪，但不停止定时器
      }

      this.trackSubtitlePosition()
    }, 150) as unknown as number
  },

  // 停止跟踪
  stopTracking() {
    if (this.trackingTimer) {
      clearInterval(this.trackingTimer)
      this.trackingTimer = null
    }
  },

  // 播放/暂停控制
  handlePlayPause() {
    if (!this.data.showPracticeControls) {
      return
    }
    // Echo 模式：使用 InnerAudioContext
    if (this.data.playMode === 'echo') {
      if (!this.audioContext) {
        wx.showToast({
          title: '音频未准备好',
          icon: 'none',
        })
        return
      }

      if (this.data.playing) {
        // 暂停当前播放
        this.audioContext.pause()
      } else {
        // 继续播放或重新播放当前段落
        if (!this.data.currentSubtitleId) {
          const firstSubtitle = this.data.subtitles[0]
          if (firstSubtitle) {
            this.playSubtitle(firstSubtitle)
          }
        } else {
          const currentSubtitle = this.data.subtitles.find(
            s => s.id === this.data.currentSubtitleId
          )
          if (currentSubtitle) {
            this.playSubtitle(currentSubtitle)
          }
        }
      }
      return
    }

    // Shadow 模式：使用 BackgroundAudioManager
    if (!this.data.course) {
      wx.showToast({
        title: '音频未准备好',
        icon: 'none',
      })
      return
    }

    if (this.data.playing) {
      this.pauseShadowPlayback()
    } else {
      if (!this.data.currentSubtitleId) {
        this.startShadowMode()
      } else {
        const resumeTime = this.clampCourseTimeToScene(this.getShadowCurrentTime(), {
          restartWhenPastEnd: true,
        })
        this.debugShadowBackground('handle play pause resume shadow', {
          resumeTime,
        })
        this.playShadowCourseAt(resumeTime, true)
      }
    }
  },

  handleTouchStart(event: WechatMiniprogram.TouchEvent) {
    if (this.data.wordPopupVisible && this.wordPopupBounds) {
      const touch = event.touches?.[0]
      if (touch) {
        const { left, right, top, bottom } = this.wordPopupBounds
        if (touch.pageX >= left && touch.pageX <= right && touch.pageY >= top && touch.pageY <= bottom) {
          return
        }
      }
      this.handleHideWordPopup()
    }
    const touch = event.touches?.[0]
    if (!touch) {
      return
    }
    this.swipeStartX = touch.pageX
    this.swipeStartY = touch.pageY
    this.swipeTriggered = false
  },

  handleTouchMove(event: WechatMiniprogram.TouchEvent) {
    if (this.swipeStartX === null || this.swipeTriggered) {
      return
    }
    const touch = event.touches?.[0]
    if (!touch) {
      return
    }

    const startX = this.swipeStartX
    const startY = this.swipeStartY ?? touch.pageY

    if (startX > 60) {
      return
    }

    const deltaX = touch.pageX - startX
    const deltaY = Math.abs(touch.pageY - startY)

    if (deltaX > 80 && deltaY < 60) {
      this.swipeTriggered = true
      this.handleSwipeBack()
    }
  },

  handleTouchEnd() {
    this.swipeStartX = null
    this.swipeStartY = null
    this.swipeTriggered = false
  },

  handleSwipeBack() {
    const stack = getCurrentPages()
    if (stack.length > 1) {
      wx.navigateBack({ delta: 1 })
    }
  },

  handleRepeat() {
    if (!this.data.showPracticeControls) {
      return
    }
    const newRepeating = !this.data.isRepeating
    let subtitleToRepeat: SubtitleLike | null = null

    if (newRepeating) {
      subtitleToRepeat = this.getCurrentSubtitleForRepeat()
      if (!subtitleToRepeat) {
        wx.showToast({
          title: '请先选择段落',
          icon: 'none',
        })
        return
      }
    }

    const repeatUpdates: Partial<CoursePageData> = {
      isRepeating: newRepeating,
      repeatCount: 0, // 重置计数器
    }

    if (newRepeating && this.data.playMode === 'shadow') {
      repeatUpdates.repeatTarget = 10
    }

    this.setData(repeatUpdates)

    if (newRepeating) {
      const targetTimes = repeatUpdates.repeatTarget ?? this.data.repeatTarget

      this.activeSubtitle = subtitleToRepeat!

      wx.showToast({
        title: `重复播放${targetTimes}次`,
        icon: 'success',
        duration: 1500,
      })

      // Echo 模式：直接调用 playSubtitle
      if (this.data.playMode === 'echo') {
        if (!this.audioContext) {
          return
        }
        const subtitle = this.data.subtitles.find(s => s.id === subtitleToRepeat!.id)
        if (subtitle) {
          this.playSubtitle(subtitle)
        }
        return
      }

      // Shadow 模式：使用 seekAndPlay
      this.seekAndPlay(subtitleToRepeat!)
    } else {
      wx.showToast({
        title: '重复播放已关闭',
        icon: 'none',
        duration: 1500,
      })

      // 关闭重复时，如果是影子跟读模式
      if (this.data.playMode === 'shadow') {
        if (this.stopTimer) {
          clearTimeout(this.stopTimer)
          this.stopTimer = null
        }

        if (!this.data.playing) {
          // 恢复顺序播放，让跟读流程继续向下推进
          this.playShadowCourseAt(this.getCurrentCourseTime(), true)
        }
      }
    }
  },

  getCurrentSubtitleForRepeat(): SubtitleLike | null {
    const { currentSubtitleId } = this.data
    if (!currentSubtitleId) {
      return null
    }

    if (this.activeSubtitle && this.activeSubtitle.id === currentSubtitleId) {
      return this.activeSubtitle
    }

    const match = this.data.subtitles.find(subtitle => subtitle.id === currentSubtitleId)
    if (!match) {
      return null
    }

    return {
      id: match.id,
      start: match.start,
      end: match.end,
    }
  },

  // 字幕滚动的核心实现（不直接调用，通过节流函数调用）
  _centerSubtitleImpl(subtitleId: string | null) {
    if (!subtitleId) {
      return
    }

    wx.nextTick(() => {
      const query = wx.createSelectorQuery().in(this)
      query
        .select('.subtitle-scroll')
        .fields({ size: true, rect: true, scrollOffset: true })
      query.select(`#subtitle-${subtitleId}`).boundingClientRect()
      query.exec(results => {
        if (!Array.isArray(results) || results.length < 2) {
          return
        }
        const container = results[0] as
          | (WechatMiniprogram.BoundingClientRectCallbackResult & { scrollTop?: number; height?: number; top?: number })
          | undefined
        const itemRect = results[1] as WechatMiniprogram.BoundingClientRectCallbackResult | undefined

        if (!container || !itemRect) {
          return
        }

        const containerHeight = container.height ?? 0
        if (containerHeight <= 0) {
          return
        }
        const containerTop = container.top ?? 0
        const currentScrollTop = container.scrollTop ?? 0
        const itemCenterOffset = itemRect.top - containerTop + itemRect.height / 2

        // 让item显示在屏幕上方约1/3的位置，而不是正中间
        // 这样可以看到更多下面的内容
        const targetScrollTop = currentScrollTop + itemCenterOffset - containerHeight * 0.35

        this.setData({
          scrollTop: Math.max(targetScrollTop, 0),
        })
      })
    })
  },

  // 节流版本的字幕滚动（300ms内最多执行一次）
  centerSubtitle: throttle(function (this: any, subtitleId: string | null) {
    this._centerSubtitleImpl(subtitleId)
    this.scheduleCourseShareImage()
  }, 300) as (subtitleId: string | null) => void,

  // 调节播放速度
  handleShowSpeedModal() {
    if (!this.data.showPracticeControls) {
      return
    }
    this.setData({
      showSpeedModal: true,
    })
  },

  handleHideSpeedModal() {
    this.setData({
      showSpeedModal: false,
    })
  },

  handleStopPropagation() {
    // 阻止事件冒泡
  },

  handleSpeedSliderChange(event: WechatMiniprogram.SliderChange) {
    const speed = event.detail.value / 100 // slider returns 50-200, convert to 0.5-2.0
    console.log(`[Speed] 滑块调整速度至: ${speed}x`)
    this.applyPlaybackRate(speed)
  },

  // 兼容 WXML 中的函数名
  handleSpeedChange(event: WechatMiniprogram.SliderChange) {
    this.handleSpeedSliderChange(event)
  },

  handleSpeedSliderChanging(event: WechatMiniprogram.SliderChange) {
    const speed = event.detail.value / 100
    this.setData({
      playbackRate: speed,
    })
    // 拖动过程中不立即应用，只更新显示
  },

  handleSpeedPreset(event: WechatMiniprogram.BaseEvent) {
    const speed = (event.currentTarget.dataset as { speed?: number }).speed
    if (speed === undefined) {
      return
    }
    console.log(`[Speed] 预设速度按钮: ${speed}x`)
    this.applyPlaybackRate(speed)
  },

  // 应用播放速度（强制生效）
  applyPlaybackRate(speed: number) {
    this.setData({
      playbackRate: speed,
    })

    if (this.data.playMode === 'shadow') {
      const manager = this.ensureBackgroundAudioManager()
      if ('playbackRate' in manager) {
        try {
          manager.playbackRate = speed
          this.debugShadowBackground('apply shadow playbackRate', { speed })
        } catch (_error) {
          this.debugShadowBackground('apply shadow playbackRate failed', { speed, error: _error })
        }
      }
      return
    }

    if (!this.audioContext) {
      return
    }

    const context = this.audioContext
    const wasPlaying = this.data.playing

    // 微信小程序的 playbackRate 在播放中可能不会立即生效
    // 需要通过暂停-设置-恢复的方式强制应用
    if (wasPlaying) {
      const currentTime = context.currentTime
      context.pause()
      context.playbackRate = speed
      // 短暂延迟后恢复播放
      setTimeout(() => {
        context.seek(currentTime)
        context.play()
        console.log(`[Speed] 已应用速度 ${speed}x，恢复播放位置 ${currentTime.toFixed(2)}s`)
      }, 50)
    } else {
      context.playbackRate = speed
      console.log(`[Speed] 已设置 playbackRate = ${speed}`)
    }
  },

})

function normalizeCourseRange(detail: CourseDetailResponse, subtitles: ViewSubtitle[]): CourseRange | null {
  const start = Number(detail.range?.start)
  const end = Number(detail.range?.end)
  if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
    return {
      start: Math.max(0, start),
      end,
    }
  }

  const first = subtitles[0]
  const last = subtitles[subtitles.length - 1]
  if (first && last && last.end > first.start) {
    return {
      start: Math.max(0, first.start),
      end: last.end,
    }
  }

  return null
}

function buildKnowledgeContext(detail: CourseDetailResponse) {
  const knowledge = detail.knowledge
  if (!knowledge) {
    return ''
  }

  const parts = [
    '【外贸英语影子跟读场景】',
    detail.chapterTitle ? `章节：${detail.chapterLabel || ''} ${detail.chapterTitle}`.trim() : '',
    detail.title ? `小节：${detail.title}` : '',
    knowledge.background ? `背景：${knowledge.background}` : '',
    knowledge.phrases ? `重点表达：${knowledge.phrases}` : '',
    knowledge.correction ? `纠错提醒：${knowledge.correction}` : '',
    knowledge.notes ? `讲解备注：${knowledge.notes}` : '',
  ].filter(Boolean)

  return parts.join('\n')
}

function hasSeenStageGuide() {
  try {
    return Boolean(wx.getStorageSync(COURSE_STAGE_GUIDE_SEEN_KEY))
  } catch (_error) {
    return false
  }
}

function markStageGuideSeen() {
  try {
    wx.setStorageSync(COURSE_STAGE_GUIDE_SEEN_KEY, true)
  } catch (_error) {
    // A storage failure should not block practice.
  }
}

function normalizeAudioUrl(audio: string): string {
  console.log(`[normalizeAudioUrl] 输入: "${audio}"`)

  if (!audio) {
    console.log(`[normalizeAudioUrl] 输出: "" (空)`)
    return ''
  }

  // 临时修复：强制替换 .ogg 为 .mp3
  let processedAudio = audio.replace(/\.ogg$/, '.mp3')
  console.log(`[normalizeAudioUrl] 替换后: "${processedAudio}"`)

  if (/^https?:\/\//.test(processedAudio)) {
    console.log(`[normalizeAudioUrl] 输出: "${processedAudio}" (已是完整URL)`)
    return processedAudio
  }

  const result = `${API_BASE_URL}${processedAudio}`
  console.log(`[normalizeAudioUrl] 输出: "${result}" (拼接后)`)
  return result
}

function mapSubtitles(entries: SubtitleEntry[]): ViewSubtitle[] {
  const speakerToneIndexes = new Map<string, number>()
  const subtitles: ViewSubtitle[] = []

  entries.forEach((entry, entryIndex) => {
    const speaker = entry.speaker || `speaker-${entryIndex}`
    const toneClass = resolveSpeakerToneClass(speaker, speakerToneIndexes)
    const hasBackendSentenceTiming = entry.segmentCount !== undefined || Boolean(entry.timingSource)
    const segments = hasBackendSentenceTiming
      ? [{
        text: entry.text,
        translation: entry.translation ?? '',
        start: entry.start,
        end: entry.end,
      }]
      : buildTimedDialogueSentences({
        text: entry.text,
        translation: entry.translation,
        start: entry.start,
        end: entry.end,
      })
    const safeSegments = segments.length
      ? segments
      : [{
        text: entry.text,
        translation: entry.translation ?? '',
        start: entry.start,
        end: entry.end,
      }]

    safeSegments.forEach((segment, segmentIndex) => {
      const id = hasBackendSentenceTiming || safeSegments.length === 1
        ? entry.id
        : `${entry.id}-s${segmentIndex + 1}`
      const start = segment.start
      const end = segment.end

      subtitles.push({
        ...entry,
        id,
        index: subtitles.length,
        text: segment.text,
        translation: segment.translation || undefined,
        start,
        end,
        rawStart: entry.rawStart ?? start,
        rawEnd: entry.rawEnd ?? end,
        timeLabel: formatSeconds(start),
        durationLabel: formatSeconds(end - start),
        tokens: tokenizeSubtitle(segment.text),
        toneClass,
        sourceSubtitleId: entry.sourceSubtitleId ?? entry.id,
        sourceIndex: entry.sourceIndex ?? entry.index ?? entryIndex,
        segmentIndex: entry.segmentIndex ?? segmentIndex,
        segmentCount: entry.segmentCount ?? safeSegments.length,
      })
    })
  })

  return subtitles
}

function sumPracticeCounts(counts: Record<string, number>) {
  return Object.values(counts).reduce((sum, count) => sum + Math.max(0, Number(count) || 0), 0)
}
