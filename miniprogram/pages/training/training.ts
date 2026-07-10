import {
  fetchCourseDetail,
  recordUserProgress,
  updateUserProgress,
  type CourseDetailResponse,
  type SubtitleEntry,
} from '../../utils/api'
import { API_BASE_URL } from '../../config/env'
import { getState as getStoreState, setProgress as updateProgressInStore } from '../../store/index'
import {
  buildCoachScenePlan,
  type CoachChallenge,
  type CoachSceneMode,
  type CoachScenePlan,
} from '../../utils/coach-model'
import {
  getReviewItems,
  persistCoachRecording,
  readCoachProgress,
  removeCoachRecording,
  updateCoachSceneSession,
  updateCoachSentence,
  type CoachSentenceStatus,
  type CoachStage,
} from '../../utils/coach-progress'
import { buildAppMessageShare, buildTimelineShare, enablePageShareMenu } from '../../utils/share'

type DialogueCue = SubtitleEntry & {
  cueIndex: number
  isLearner: boolean
  speakerLabel: string
  toneClass: string
}

type PracticeCue = SubtitleEntry & {
  cueIndex: number
}

type TrainingPageData = {
  loading: boolean
  error: string
  course: CourseDetailResponse | null
  title: string
  chapterLabel: string
  sceneMode: CoachSceneMode
  stage: CoachStage
  stageNumber: number
  stageTitle: string
  stageDescription: string
  businessGoal: string
  learnerSpeaker: string
  customerSpeaker: string
  estimatedMinutes: number
  keyExpressions: string[]
  dialogue: DialogueCue[]
  challengeCount: number
  currentChallengeIndex: number
  currentChallenge: CoachChallenge | null
  practiceCount: number
  currentPracticeIndex: number
  currentPracticeCue: PracticeCue | null
  cueProgressPercent: number
  answerRevealed: boolean
  recording: boolean
  recordingPath: string
  hasRecording: boolean
  playingSource: '' | 'scene' | 'original' | 'recording'
  audioProgress: number
  audioCurrentLabel: string
  audioDurationLabel: string
  currentSubtitleId: string
  playbackRate: number
  currentAssessment: CoachSentenceStatus | ''
  masteredCount: number
  reviewCount: number
  summaryReviewItems: Array<{ key: string; text: string; translation: string }>
  showTranslation: boolean
  microphoneError: string
}

const STAGE_META: Record<CoachStage, { number: number; title: string; description: string }> = {
  overview: { number: 1, title: '场景任务', description: '先明确这次沟通要推动什么结果' },
  listen: { number: 2, title: '听懂场景', description: '先听完整对话，观察双方怎样推进' },
  respond: { number: 3, title: '思考回应', description: '先组织自己的表达，再看参考说法' },
  practice: { number: 4, title: '逐句表达', description: '用原声和录音对比语气与节奏' },
  shadow: { number: 5, title: '连续跟读', description: '跟上整段对话，不停下来逐字翻译' },
  summary: { number: 5, title: '训练完成', description: '留下待巩固表达，下一次直接复习' },
}

const PHRASE_STAGE_META: Record<CoachStage, { number: number; title: string; description: string }> = {
  overview: { number: 1, title: '表达任务', description: '先明确这组表达会用在哪些工作情境' },
  listen: { number: 2, title: '听懂表达', description: '完整听一遍，熟悉每句话的语气和节奏' },
  respond: { number: 3, title: '尝试表达', description: '先根据中文说英文，再看参考说法' },
  practice: { number: 4, title: '逐句表达', description: '用原声和录音对比语气与节奏' },
  shadow: { number: 5, title: '整组跟读', description: '按顺序跟完本组表达，练习快速调取' },
  summary: { number: 5, title: '训练完成', description: '留下待巩固表达，下一次直接复习' },
}

Page<TrainingPageData, WechatMiniprogram.IAnyObject>({
  courseId: '',
  reviewCueId: '',
  scenePlan: null as CoachScenePlan | null,
  sourceAudio: null as WechatMiniprogram.InnerAudioContext | null,
  recordingAudio: null as WechatMiniprogram.InnerAudioContext | null,
  recorderManager: null as WechatMiniprogram.RecorderManager | null,
  activeRangeStart: 0,
  activeRangeEnd: 0,
  activeAudioMode: '' as '' | 'scene' | 'original',
  playStartTimer: null as ReturnType<typeof setTimeout> | null,
  pageAlive: true,
  data: {
    loading: true,
    error: '',
    course: null,
    title: '场景训练',
    chapterLabel: '',
    sceneMode: 'dialogue',
    stage: 'overview',
    stageNumber: 1,
    stageTitle: STAGE_META.overview.title,
    stageDescription: STAGE_META.overview.description,
    businessGoal: '',
    learnerSpeaker: '',
    customerSpeaker: '',
    estimatedMinutes: 8,
    keyExpressions: [],
    dialogue: [],
    challengeCount: 0,
    currentChallengeIndex: 0,
    currentChallenge: null,
    practiceCount: 0,
    currentPracticeIndex: 0,
    currentPracticeCue: null,
    cueProgressPercent: 0,
    answerRevealed: false,
    recording: false,
    recordingPath: '',
    hasRecording: false,
    playingSource: '',
    audioProgress: 0,
    audioCurrentLabel: '0:00',
    audioDurationLabel: '0:00',
    currentSubtitleId: '',
    playbackRate: 1,
    currentAssessment: '',
    masteredCount: 0,
    reviewCount: 0,
    summaryReviewItems: [],
    showTranslation: true,
    microphoneError: '',
  },
  async onLoad(options: { id?: string; reviewCue?: string; restart?: string }) {
    enablePageShareMenu()
    ;(this as any).courseId = options.id || ''
    ;(this as any).reviewCueId = options.reviewCue || ''
    ;(this as any).pageAlive = true
    this.initializeAudio()
    this.initializeRecorder()
    if (!(this as any).courseId) {
      this.setData({ loading: false, error: '缺少场景编号' })
      return
    }
    await this.loadCourse(options.restart === '1')
  },
  onUnload() {
    ;(this as any).pageAlive = false
    if (this.data.recording) {
      ;(this as any).recorderManager?.stop()
    }
    this.releaseAudioContexts()
  },
  onHide() {
    this.stopAllAudio()
  },
  onShareAppMessage() {
    return buildAppMessageShare({
      title: this.data.course ? `外贸场景训练：${this.data.course.title}` : '外贸口语实战训练',
      path: `/pages/training/training?id=${encodeURIComponent((this as any).courseId)}`,
    })
  },
  onShareTimeline() {
    return buildTimelineShare({ title: this.data.course?.title || '外贸口语实战训练' })
  },
  async loadCourse(forceRefresh = false) {
    this.setData({ loading: true, error: '' })
    try {
      const course = await fetchCourseDetail((this as any).courseId, forceRefresh)
      if (!(this as any).pageAlive) return
      const scenePlan = buildCoachScenePlan(course)
      ;(this as any).scenePlan = scenePlan
      const learner = normalizeSpeaker(scenePlan.learnerSpeaker)
      const dialogue: DialogueCue[] = course.subtitles.map((cue, cueIndex) => {
        const isLearner = scenePlan.mode === 'phrase-drill' || normalizeSpeaker(cue.speaker) === learner
        return {
          ...cue,
          cueIndex,
          isLearner,
          speakerLabel: scenePlan.mode === 'phrase-drill'
            ? `表达 ${cueIndex + 1}`
            : `${isLearner ? '你 · ' : ''}${cue.speaker || scenePlan.customerSpeaker}`,
          toneClass: isLearner ? 'dialogue-cue--self' : 'dialogue-cue--customer',
        }
      })
      const range = resolveSceneRange(course)
      const savedSession = readCoachProgress().sessions.find(item => item.sceneId === course.id)
      const reviewCueId = (this as any).reviewCueId as string
      const initialStage: CoachStage = reviewCueId
        ? 'practice'
        : savedSession && savedSession.stage !== 'summary'
          ? savedSession.stage
          : 'overview'
      this.setData({
        loading: false,
        course,
        title: course.title,
        chapterLabel: course.chapterLabel || '',
        sceneMode: scenePlan.mode,
        businessGoal: scenePlan.businessGoal,
        learnerSpeaker: scenePlan.learnerSpeaker,
        customerSpeaker: scenePlan.customerSpeaker,
        estimatedMinutes: scenePlan.estimatedMinutes,
        keyExpressions: scenePlan.keyExpressions,
        dialogue,
        challengeCount: scenePlan.challenges.length,
        practiceCount: scenePlan.practiceCues.length,
        audioDurationLabel: formatTime(range.end - range.start),
      })
      const initialIndex = reviewCueId
        ? Math.max(0, scenePlan.practiceCues.findIndex(item => item.id === reviewCueId))
        : savedSession?.cueIndex ?? 0
      this.applyStage(initialStage, initialIndex, false)
      this.refreshSceneCounts()
    } catch (error) {
      if (!(this as any).pageAlive) return
      this.setData({
        loading: false,
        error: error instanceof Error ? error.message : '场景加载失败，请稍后重试',
      })
    }
  },
  handleRetry() {
    void this.loadCourse(true)
  },
  initializeAudio() {
    const sourceAudio = wx.createInnerAudioContext()
    sourceAudio.obeyMuteSwitch = false
    sourceAudio.onTimeUpdate(() => this.handleSourceTimeUpdate())
    sourceAudio.onEnded(() => this.handleSourceEnded())
    sourceAudio.onPause(() => {
      if ((this as any).pageAlive && this.data.playingSource !== 'recording') {
        this.setData({ playingSource: '' })
      }
    })
    sourceAudio.onError(error => {
      console.warn('[Coach] Source audio failed', error)
      if ((this as any).pageAlive) {
        this.setData({ playingSource: '' })
        wx.showToast({ title: '原声播放失败，请重试', icon: 'none' })
      }
    })
    ;(this as any).sourceAudio = sourceAudio

    const recordingAudio = wx.createInnerAudioContext()
    recordingAudio.obeyMuteSwitch = false
    recordingAudio.onEnded(() => {
      if ((this as any).pageAlive) this.setData({ playingSource: '' })
    })
    recordingAudio.onError(error => {
      console.warn('[Coach] Recording playback failed', error)
      if ((this as any).pageAlive) wx.showToast({ title: '录音播放失败', icon: 'none' })
    })
    ;(this as any).recordingAudio = recordingAudio
  },
  initializeRecorder() {
    const recorder = wx.getRecorderManager()
    recorder.onStart(() => {
      if ((this as any).pageAlive) {
        this.setData({ recording: true, playingSource: '', microphoneError: '' })
      }
    })
    recorder.onStop(async result => {
      if (!(this as any).pageAlive) return
      const previousRecordingPath = this.data.recordingPath
      const savedPath = await persistCoachRecording(result.tempFilePath)
      if (!(this as any).pageAlive) return
      if (previousRecordingPath && savedPath && previousRecordingPath !== savedPath) {
        removeCoachRecording(previousRecordingPath)
      }
      this.setData({
        recording: false,
        recordingPath: savedPath,
        hasRecording: Boolean(savedPath),
      })
      const activeCue = this.getActiveCue()
      const existing = activeCue
        ? findSentenceRecord((this as any).courseId, activeCue.id)
        : null
      this.persistActiveSentence(existing?.status || 'learning', savedPath, false)
    })
    recorder.onError(error => {
      console.warn('[Coach] Recording failed', error)
      if (!(this as any).pageAlive) return
      this.setData({
        recording: false,
        microphoneError: '无法使用麦克风，请在小程序设置中允许录音权限。',
      })
      wx.showModal({
        title: '需要麦克风权限',
        content: '允许录音后，才能对比自己的表达和原声。',
        confirmText: '打开设置',
        success(result) {
          if (result.confirm) wx.openSetting({})
        },
      })
    })
    ;(this as any).recorderManager = recorder
  },
  handleRecordToggle() {
    if (this.data.recording) {
      ;(this as any).recorderManager?.stop()
      return
    }
    this.stopAllAudio()
    this.setData({ microphoneError: '' })
    ;(this as any).recorderManager?.start({
      duration: 60_000,
      sampleRate: 16_000,
      numberOfChannels: 1,
      encodeBitRate: 96_000,
      format: 'mp3',
    })
  },
  handleScenePlay() {
    if (this.data.playingSource === 'scene') {
      ;(this as any).sourceAudio?.pause()
      this.setData({ playingSource: '' })
      return
    }
    if (!this.data.course) return
    const range = resolveSceneRange(this.data.course)
    this.playSourceRange(range.start, range.end, 'scene')
  },
  handleOriginalPlay() {
    if (this.data.playingSource === 'original') {
      ;(this as any).sourceAudio?.pause()
      this.setData({ playingSource: '' })
      return
    }
    const cue = this.getActiveCue()
    if (!cue) return
    this.playSourceRange(cue.start, cue.end, 'original')
  },
  handleRecordingPlay() {
    if (!this.data.recordingPath) {
      wx.showToast({ title: '先录下你的表达', icon: 'none' })
      return
    }
    if (this.data.playingSource === 'recording') {
      ;(this as any).recordingAudio?.pause()
      this.setData({ playingSource: '' })
      return
    }
    ;(this as any).sourceAudio?.pause()
    const audio = (this as any).recordingAudio as WechatMiniprogram.InnerAudioContext
    audio.stop()
    audio.src = this.data.recordingPath
    audio.play()
    this.setData({ playingSource: 'recording' })
  },
  playSourceRange(start: number, end: number, mode: 'scene' | 'original') {
    if (!this.data.course) return
    const audio = (this as any).sourceAudio as WechatMiniprogram.InnerAudioContext
    if (!audio || !(this as any).pageAlive) return
    ;(this as any).recordingAudio?.pause()
    ;(this as any).activeRangeStart = start
    ;(this as any).activeRangeEnd = Math.max(start + 0.1, end)
    ;(this as any).activeAudioMode = mode
    audio.pause()
    audio.playbackRate = this.data.playbackRate
    const src = resolveAudioUrl(this.data.course.audio)
    if (audio.src !== src) audio.src = src
    this.clearPlayStartTimer()
    ;(this as any).playStartTimer = setTimeout(() => {
      ;(this as any).playStartTimer = null
      if (!(this as any).pageAlive) return
      audio.seek(start)
      audio.play()
      this.setData({ playingSource: mode })
    }, 160)
  },
  handleSourceTimeUpdate() {
    if (!this.data.course || !(this as any).sourceAudio) return
    const audio = (this as any).sourceAudio as WechatMiniprogram.InnerAudioContext
    const start = Number((this as any).activeRangeStart || 0)
    const end = Number((this as any).activeRangeEnd || start + 0.1)
    const current = audio.currentTime
    const progress = Math.max(0, Math.min(100, ((current - start) / (end - start)) * 100))
    const activeCue = this.data.course.subtitles.find(cue => current >= cue.start && current < cue.end)
    this.setData({
      audioProgress: Math.round(progress),
      audioCurrentLabel: formatTime(Math.max(0, current - start)),
      currentSubtitleId: activeCue?.id || this.data.currentSubtitleId,
    })
    if (current >= end - 0.04) {
      audio.pause()
      audio.seek(start)
      this.setData({ playingSource: '', audioProgress: 100 })
    }
  },
  handleSourceEnded() {
    if (!(this as any).pageAlive) return
    this.setData({ playingSource: '', audioProgress: 100 })
  },
  stopAllAudio() {
    this.clearPlayStartTimer()
    ;(this as any).sourceAudio?.pause()
    ;(this as any).recordingAudio?.pause()
    if ((this as any).pageAlive) this.setData({ playingSource: '' })
  },
  clearPlayStartTimer() {
    const timer = (this as any).playStartTimer as ReturnType<typeof setTimeout> | null
    if (timer) clearTimeout(timer)
    ;(this as any).playStartTimer = null
  },
  releaseAudioContexts() {
    this.clearPlayStartTimer()
    const sourceAudio = (this as any).sourceAudio as WechatMiniprogram.InnerAudioContext | null
    const recordingAudio = (this as any).recordingAudio as WechatMiniprogram.InnerAudioContext | null
    sourceAudio?.stop()
    recordingAudio?.stop()
    ;(this as any).sourceAudio = null
    ;(this as any).recordingAudio = null
  },
  startListen() {
    this.applyStage('listen', 0)
    this.clearPlayStartTimer()
    ;(this as any).playStartTimer = setTimeout(() => {
      ;(this as any).playStartTimer = null
      if ((this as any).pageAlive) this.handleScenePlay()
    }, 120)
  },
  startRespond() {
    const plan = (this as any).scenePlan as CoachScenePlan | null
    if (!plan?.challenges.length) {
      this.startPractice()
      return
    }
    this.applyStage('respond', 0)
  },
  startPractice() {
    const plan = (this as any).scenePlan as CoachScenePlan | null
    if (!plan?.practiceCues.length) {
      this.startShadow()
      return
    }
    this.applyStage('practice', 0)
  },
  startShadow() {
    this.applyStage('shadow', 0)
  },
  revealAnswer() {
    this.setData({ answerRevealed: true })
  },
  handleAssessment(event: WechatMiniprogram.BaseEvent) {
    const { status } = event.currentTarget.dataset as { status?: CoachSentenceStatus }
    if (status !== 'review' && status !== 'mastered') return
    this.persistActiveSentence(status, this.data.recordingPath)
    this.setData({ currentAssessment: status })
    this.refreshSceneCounts()
  },
  nextChallenge() {
    const nextIndex = this.data.currentChallengeIndex + 1
    if (nextIndex >= this.data.challengeCount) {
      this.startPractice()
      return
    }
    this.setChallenge(nextIndex)
    this.saveCurrentSession('respond', nextIndex)
  },
  nextPracticeCue() {
    const nextIndex = this.data.currentPracticeIndex + 1
    if (nextIndex >= this.data.practiceCount) {
      this.startShadow()
      return
    }
    this.setPracticeCue(nextIndex)
    this.saveCurrentSession('practice', nextIndex)
  },
  handlePlaybackRate(event: WechatMiniprogram.BaseEvent) {
    const { rate } = event.currentTarget.dataset as { rate?: number | string }
    const playbackRate = Number(rate)
    if (![0.8, 1, 1.2].includes(playbackRate)) return
    this.setData({ playbackRate })
    if ((this as any).sourceAudio) {
      ;((this as any).sourceAudio as WechatMiniprogram.InnerAudioContext).playbackRate = playbackRate
    }
  },
  toggleTranslation() {
    this.setData({ showTranslation: !this.data.showTranslation })
  },
  async completeTraining() {
    this.stopAllAudio()
    this.applyStage('summary', Math.max(0, this.data.practiceCount - 1), false)
    const now = Date.now()
    updateCoachSceneSession({
      sceneId: (this as any).courseId,
      sceneTitle: this.data.title,
      stage: 'summary',
      cueIndex: Math.max(0, this.data.practiceCount - 1),
      completedAt: now,
    }, now)
    this.refreshSceneCounts()
    if (getStoreState().token && this.data.course) {
      try {
        const totalCues = this.data.course.subtitles.length
        const response = await updateUserProgress(this.data.course.id, 'completed', {
          cueIndex: Math.max(0, totalCues - 1),
          totalCues,
          completedCueIndexes: Array.from({ length: totalCues }, (_, index) => index),
        })
        if (response.progress) updateProgressInStore(response.progress)
      } catch (error) {
        console.warn('[Coach] Failed to sync completed scene', error)
      }
    }
  },
  restartTraining() {
    this.stopAllAudio()
    this.applyStage('overview', 0)
  },
  returnHome() {
    wx.reLaunch({ url: '/pages/coach/coach' })
  },
  openKnowledge() {
    if (!this.data.course) return
    wx.navigateTo({
      url: `/pages/knowledge/knowledge?id=${encodeURIComponent(this.data.course.id)}&title=${encodeURIComponent(this.data.course.title)}`,
    })
  },
  openClassicCourse() {
    wx.navigateTo({ url: `/pages/course/course?id=${encodeURIComponent((this as any).courseId)}` })
  },
  applyStage(stage: CoachStage, cueIndex = 0, persist = true) {
    const meta = this.data.sceneMode === 'phrase-drill' ? PHRASE_STAGE_META[stage] : STAGE_META[stage]
    this.stopAllAudio()
    this.setData({
      stage,
      stageNumber: meta.number,
      stageTitle: meta.title,
      stageDescription: meta.description,
      answerRevealed: false,
      currentAssessment: '',
      recordingPath: '',
      hasRecording: false,
      audioProgress: 0,
      audioCurrentLabel: '0:00',
    })
    if (stage === 'respond') this.setChallenge(cueIndex)
    if (stage === 'practice') this.setPracticeCue(cueIndex)
    if (stage === 'summary') this.refreshSceneCounts()
    if (persist && stage !== 'summary') this.saveCurrentSession(stage, cueIndex)
  },
  setChallenge(index: number) {
    const plan = (this as any).scenePlan as CoachScenePlan | null
    const safeIndex = Math.max(0, Math.min(index, Math.max(0, (plan?.challenges.length ?? 1) - 1)))
    const challenge = plan?.challenges[safeIndex] ?? null
    const record = challenge ? findSentenceRecord((this as any).courseId, this.data.course?.subtitles[challenge.cueIndex]?.id) : null
    this.setData({
      currentChallengeIndex: safeIndex,
      currentChallenge: challenge,
      cueProgressPercent: challenge && plan?.challenges.length
        ? Math.round(((safeIndex + 1) / plan.challenges.length) * 100)
        : 0,
      answerRevealed: false,
      recordingPath: record?.recordingPath || '',
      hasRecording: Boolean(record?.recordingPath),
      currentAssessment: record?.status || '',
    })
  },
  setPracticeCue(index: number) {
    const plan = (this as any).scenePlan as CoachScenePlan | null
    const safeIndex = Math.max(0, Math.min(index, Math.max(0, (plan?.practiceCues.length ?? 1) - 1)))
    const cue = plan?.practiceCues[safeIndex] ?? null
    const record = cue ? findSentenceRecord((this as any).courseId, cue.id) : null
    this.setData({
      currentPracticeIndex: safeIndex,
      currentPracticeCue: cue,
      cueProgressPercent: cue && plan?.practiceCues.length
        ? Math.round(((safeIndex + 1) / plan.practiceCues.length) * 100)
        : 0,
      answerRevealed: true,
      recordingPath: record?.recordingPath || '',
      hasRecording: Boolean(record?.recordingPath),
      currentAssessment: record?.status || '',
    })
  },
  getActiveCue(): SubtitleEntry | null {
    if (this.data.stage === 'respond' && this.data.currentChallenge && this.data.course) {
      return this.data.course.subtitles[this.data.currentChallenge.cueIndex] ?? null
    }
    if (this.data.stage === 'practice') return this.data.currentPracticeCue
    return null
  },
  persistActiveSentence(status: CoachSentenceStatus, recordingPath: string, countAttempt = true) {
    const cue = this.getActiveCue()
    if (!cue || !this.data.course) return
    updateCoachSentence({
      sceneId: this.data.course.id,
      sentenceId: cue.id,
      cueIndex: this.data.course.subtitles.findIndex(item => item.id === cue.id),
      sceneTitle: this.data.course.title,
      chapterLabel: this.data.course.chapterLabel || '',
      text: cue.text,
      translation: cue.translation || '',
      status,
      recordingPath,
      countAttempt,
    })
    if (getStoreState().token) {
      void recordUserProgress(this.data.course.id, {
        cueIndex: this.data.course.subtitles.findIndex(item => item.id === cue.id),
        totalCues: this.data.course.subtitles.length,
      }).catch(error => console.warn('[Coach] Failed to sync cue progress', error))
    }
  },
  saveCurrentSession(stage: CoachStage, cueIndex: number) {
    if (!this.data.course) return
    updateCoachSceneSession({
      sceneId: this.data.course.id,
      sceneTitle: this.data.course.title,
      stage,
      cueIndex,
      completedAt: null,
    })
  },
  refreshSceneCounts() {
    const courseId = (this as any).courseId as string
    const state = readCoachProgress()
    const sceneRecords = state.sentences.filter(item => item.sceneId === courseId)
    const summaryReviewItems = getReviewItems(state)
      .filter(item => item.sceneId === courseId)
      .map(item => ({ key: item.key, text: item.text, translation: item.translation }))
    this.setData({
      masteredCount: sceneRecords.filter(item => item.status === 'mastered').length,
      reviewCount: sceneRecords.filter(item => item.status === 'review').length,
      summaryReviewItems,
    })
  },
})

function resolveAudioUrl(value: string) {
  if (/^https?:\/\//.test(value)) return value
  return `${API_BASE_URL}${value.startsWith('/') ? value : `/${value}`}`
}

function resolveSceneRange(course: CourseDetailResponse) {
  const first = course.subtitles[0]
  const last = course.subtitles[course.subtitles.length - 1]
  const start = Number(course.range?.start ?? first?.start ?? 0)
  const end = Number(course.range?.end ?? last?.end ?? start + 1)
  return { start, end: Math.max(start + 0.1, end) }
}

function normalizeSpeaker(value?: string) {
  return String(value || '').trim().toLowerCase()
}

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0))
  const minutes = Math.floor(safe / 60)
  const rest = safe % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

function findSentenceRecord(sceneId: string, sentenceId?: string) {
  if (!sentenceId) return null
  return readCoachProgress().sentences.find(item => item.sceneId === sceneId && item.sentenceId === sentenceId) ?? null
}
