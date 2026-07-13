import { fetchCourseDetail } from '../../utils/api'
import {
  REVIEW_LIBRARY_STORAGE_KEY,
  ReviewCue,
  ReviewLibrary,
  ReviewWord,
  normalizeReviewLibrary,
  removeReviewCue,
  removeReviewWord,
  upsertReviewCue,
} from '../../utils/review-library'
import {
  STARRED_CUES_STORAGE_KEY,
  isCueStarred,
  normalizeStarredCueMap,
  toggleStarredCue,
} from '../../utils/practice-marks'

type ReviewTab = 'words' | 'cues'
export type ReviewAudioType = '' | 'word' | 'cue'
export type ReviewAudioStatus = 'idle' | 'loading' | 'playing' | 'paused'
type ReviewAudioTapAction = 'start' | 'pause' | 'resume' | 'cancel'

type ReviewAudioTarget = {
  type: Exclude<ReviewAudioType, ''>
  id: string
  url: string
  courseId?: string
  cueId?: string
  start?: number
  end?: number
}

export type ReviewCueView = ReviewCue & { audioId: string }

export function buildReviewCueViews(cues: ReviewCue[]): ReviewCueView[] {
  return cues.map(cue => ({ ...cue, audioId: `${cue.courseId}:${cue.cueId}` }))
}

export function resolveReviewAudioTapAction(
  current: { type: ReviewAudioType; id: string; status: ReviewAudioStatus },
  target: { type: Exclude<ReviewAudioType, ''>; id: string },
): ReviewAudioTapAction {
  if (current.type !== target.type || current.id !== target.id) return 'start'
  if (current.status === 'playing') return 'pause'
  if (current.status === 'paused') return 'resume'
  if (current.status === 'loading') return 'cancel'
  return 'start'
}

type ReviewPageData = {
  tab: ReviewTab
  words: ReviewWord[]
  cues: ReviewCueView[]
  wordCount: number
  cueCount: number
  loading: boolean
  activeAudioType: ReviewAudioType
  activeAudioId: string
  audioStatus: ReviewAudioStatus
}

Page<ReviewPageData, WechatMiniprogram.IAnyObject>({
  reviewAudioContext: null as WechatMiniprogram.InnerAudioContext | null,
  activeAudioTarget: null as ReviewAudioTarget | null,
  audioStopTimer: null as number | null,
  data: {
    tab: 'words',
    words: [],
    cues: [],
    wordCount: 0,
    cueCount: 0,
    loading: false,
    activeAudioType: '',
    activeAudioId: '',
    audioStatus: 'idle',
  },
  onShow() {
    this.loadLibrary()
    void this.hydrateLegacyCueDetails()
  },
  onHide() {
    this.resetReviewAudio()
  },
  onUnload() {
    this.clearReviewAudioTimer()
    this.activeAudioTarget = null
    this.reviewAudioContext?.destroy()
    this.reviewAudioContext = null
  },
  loadLibrary() {
    const library = this.readLibrary()
    this.setData({
      words: library.words,
      cues: buildReviewCueViews(library.cues),
      wordCount: library.words.length,
      cueCount: library.cues.length,
    })
  },
  handleTabChange(event: WechatMiniprogram.BaseEvent) {
    const tab = (event.currentTarget.dataset as { tab?: ReviewTab }).tab
    if (tab && tab !== this.data.tab) {
      this.resetReviewAudio()
      this.setData({ tab })
    }
  },
  handleDeleteWord(event: WechatMiniprogram.BaseEvent) {
    const normalized = String((event.currentTarget.dataset as { id?: string }).id ?? '')
    if (this.data.activeAudioType === 'word' && this.data.activeAudioId === normalized) {
      this.resetReviewAudio()
    }
    this.writeLibrary(removeReviewWord(this.readLibrary(), normalized))
    this.loadLibrary()
  },
  handleDeleteCue(event: WechatMiniprogram.BaseEvent) {
    const { courseId, cueId } = event.currentTarget.dataset as { courseId?: string; cueId?: string }
    if (!courseId || !cueId) return
    if (
      this.data.activeAudioType === 'cue' &&
      this.data.activeAudioId === `${courseId}:${cueId}` &&
      this.activeAudioTarget?.courseId === courseId
    ) {
      this.resetReviewAudio()
    }
    const map = normalizeStarredCueMap(wx.getStorageSync(STARRED_CUES_STORAGE_KEY))
    const nextMap = isCueStarred(map, courseId, cueId)
      ? toggleStarredCue(map, courseId, cueId)
      : map
    wx.setStorageSync(STARRED_CUES_STORAGE_KEY, nextMap)
    this.writeLibrary(removeReviewCue(this.readLibrary(), courseId, cueId))
    this.loadLibrary()
  },
  handlePlayWordAudio(event: WechatMiniprogram.BaseEvent) {
    const { id, url } = event.currentTarget.dataset as { id?: string; url?: string }
    const audioId = String(id ?? '')
    const audioUrl = String(url ?? '')
    if (!audioId || !audioUrl) return
    const action = resolveReviewAudioTapAction({
      type: this.data.activeAudioType,
      id: this.data.activeAudioId,
      status: this.data.audioStatus,
    }, { type: 'word', id: audioId })
    if (this.applyExistingAudioAction(action)) return
    this.startReviewAudio({ type: 'word', id: audioId, url: audioUrl })
  },
  async handlePlayCueAudio(event: WechatMiniprogram.BaseEvent) {
    const { audioId, courseId, cueId } = event.currentTarget.dataset as {
      audioId?: string
      courseId?: string
      cueId?: string
    }
    if (!audioId || !courseId || !cueId) return
    const action = resolveReviewAudioTapAction({
      type: this.data.activeAudioType,
      id: this.data.activeAudioId,
      status: this.data.audioStatus,
    }, { type: 'cue', id: audioId })
    if (this.applyExistingAudioAction(action)) return

    this.clearReviewAudioTimer()
    this.reviewAudioContext?.stop()
    this.activeAudioTarget = { type: 'cue', id: audioId, courseId, cueId, url: '' }
    this.setData({ activeAudioType: 'cue', activeAudioId: audioId, audioStatus: 'loading' })

    try {
      const detail = await fetchCourseDetail(courseId)
      if (
        this.data.activeAudioType !== 'cue' ||
        this.data.activeAudioId !== audioId ||
        this.data.audioStatus !== 'loading'
      ) {
        return
      }
      const cue = detail.subtitles.find(item => item.id === cueId)
      if (!cue || !detail.audio) throw new Error('cue audio unavailable')
      this.startReviewAudio({
        type: 'cue',
        id: audioId,
        courseId,
        cueId,
        url: detail.audio,
        start: cue.start,
        end: cue.end,
      })
    } catch (_error) {
      if (this.data.activeAudioType === 'cue' && this.data.activeAudioId === audioId) {
        this.resetReviewAudio()
        wx.showToast({ title: '原声暂时无法播放', icon: 'none' })
      }
    }
  },
  applyExistingAudioAction(action: ReviewAudioTapAction) {
    if (action === 'start') return false
    if (action === 'pause') {
      this.clearReviewAudioTimer()
      this.setData({ audioStatus: 'paused' })
      this.reviewAudioContext?.pause()
    } else if (action === 'resume') {
      if (!this.reviewAudioContext || !this.activeAudioTarget?.url) {
        this.resetReviewAudio()
        return true
      }
      this.setData({ audioStatus: 'loading' })
      this.reviewAudioContext.play()
    } else {
      this.resetReviewAudio()
    }
    return true
  },
  ensureReviewAudioContext() {
    if (this.reviewAudioContext) return this.reviewAudioContext
    const context = wx.createInnerAudioContext()
    context.autoplay = false
    context.obeyMuteSwitch = true
    context.onPlay(() => {
      if (!this.activeAudioTarget) return
      this.setData({ audioStatus: 'playing' })
      this.scheduleReviewAudioStop()
    })
    context.onPause(() => {
      this.clearReviewAudioTimer()
      if (this.activeAudioTarget && this.data.audioStatus === 'playing') {
        this.setData({ audioStatus: 'paused' })
      }
    })
    context.onWaiting(() => {
      if (!this.activeAudioTarget || this.data.audioStatus === 'paused') return
      this.clearReviewAudioTimer()
      this.setData({ audioStatus: 'loading' })
    })
    context.onCanplay(() => {
      if (!this.activeAudioTarget || this.data.audioStatus !== 'loading' || context.paused) return
      this.setData({ audioStatus: 'playing' })
      this.scheduleReviewAudioStop()
    })
    context.onTimeUpdate(() => {
      const end = this.activeAudioTarget?.end
      if (typeof end === 'number' && context.currentTime >= end - 0.05) {
        this.resetReviewAudio()
      }
    })
    context.onEnded(() => this.resetReviewAudio())
    context.onError(() => {
      if (!this.activeAudioTarget) return
      this.resetReviewAudio()
      wx.showToast({ title: '音频播放失败', icon: 'none' })
    })
    this.reviewAudioContext = context
    return context
  },
  startReviewAudio(target: ReviewAudioTarget) {
    const context = this.ensureReviewAudioContext()
    this.clearReviewAudioTimer()
    context.stop()
    this.activeAudioTarget = target
    this.setData({
      activeAudioType: target.type,
      activeAudioId: target.id,
      audioStatus: 'loading',
    })
    context.src = target.url
    context.startTime = Math.max(0, target.start ?? 0)
    context.play()
  },
  scheduleReviewAudioStop() {
    this.clearReviewAudioTimer()
    const target = this.activeAudioTarget
    const context = this.reviewAudioContext
    if (!target || !context || typeof target.end !== 'number') return
    const currentTime = Math.max(context.currentTime || 0, target.start ?? 0)
    const remainingMs = Math.max(0, target.end - currentTime) * 1000 + 250
    this.audioStopTimer = setTimeout(() => this.resetReviewAudio(), remainingMs) as unknown as number
  },
  clearReviewAudioTimer() {
    if (this.audioStopTimer !== null) {
      clearTimeout(this.audioStopTimer)
      this.audioStopTimer = null
    }
  },
  resetReviewAudio() {
    this.clearReviewAudioTimer()
    this.activeAudioTarget = null
    this.setData({ activeAudioType: '', activeAudioId: '', audioStatus: 'idle' })
    this.reviewAudioContext?.stop()
  },
  async hydrateLegacyCueDetails() {
    const map = normalizeStarredCueMap(wx.getStorageSync(STARRED_CUES_STORAGE_KEY))
    let library = this.readLibrary() as ReviewLibrary
    const known = new Set(library.cues.map(item => `${item.courseId}:${item.cueId}`))
    const pendingCourses = Object.entries(map).filter(([courseId, cueIds]) =>
      cueIds.some(cueId => !known.has(`${courseId}:${cueId}`)),
    )
    if (!pendingCourses.length) return

    this.setData({ loading: true })
    for (const [courseId, cueIds] of pendingCourses) {
      try {
        const detail = await fetchCourseDetail(courseId)
        for (const cueId of cueIds) {
          const cue = detail.subtitles.find(item => item.id === cueId)
          if (!cue) continue
          library = upsertReviewCue(library, {
            courseId,
            courseTitle: detail.title,
            cueId,
            cueText: cue.text,
            cueTranslation: cue.translation ?? '',
          })
        }
      } catch (error) {
        console.warn('[Review] hydrate legacy cue failed', { courseId, error })
      }
    }
    this.writeLibrary(library)
    this.setData({ loading: false })
    this.loadLibrary()
  },
  readLibrary(): ReviewLibrary {
    return normalizeReviewLibrary(wx.getStorageSync(REVIEW_LIBRARY_STORAGE_KEY))
  },
  writeLibrary(library: ReviewLibrary) {
    wx.setStorageSync(REVIEW_LIBRARY_STORAGE_KEY, library)
  },
})
