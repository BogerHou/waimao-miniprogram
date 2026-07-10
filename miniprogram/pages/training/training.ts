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
  resolveCoachSceneRange,
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
  reviewMode: boolean
  stage: CoachStage
  stageNumber: number
  stageTitle: string
  stageDescription: string
  businessGoal: string
  learnerSpeaker: string
  customerSpeaker: string
  estimatedMinutes: number
  keyExpressions: string[]
  batchLabel: string
  hasNextBatch: boolean
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
  assessmentMadeThisRun: boolean
  listenTranscriptVisible: boolean
  listenCompleted: boolean
  shadowCompleted: boolean
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
  requestedBatchStart: null as number | null,
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
    reviewMode: false,
    stage: 'overview',
    stageNumber: 1,
    stageTitle: STAGE_META.overview.title,
    stageDescription: STAGE_META.overview.description,
    businessGoal: '',
    learnerSpeaker: '',
    customerSpeaker: '',
    estimatedMinutes: 8,
    keyExpressions: [],
    batchLabel: '',
    hasNextBatch: false,
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
    assessmentMadeThisRun: false,
    listenTranscriptVisible: false,
    listenCompleted: false,
    shadowCompleted: false,
    masteredCount: 0,
    reviewCount: 0,
    summaryReviewItems: [],
    showTranslation: true,
    microphoneError: '',
  },
  async onLoad(options: { id?: string; reviewCue?: string; restart?: string; batchStart?: string }) {
    enablePageShareMenu()
    ;(this as any).courseId = options.id || ''
    ;(this as any).reviewCueId = options.reviewCue || ''
    ;(this as any).requestedBatchStart = parseBatchStart(options.batchStart)
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
      const savedSession = readCoachProgress().sessions.find(item => item.sceneId === course.id)
      const requestedBatchStart = (this as any).requestedBatchStart as number | null
      const reviewCueId = (this as any).reviewCueId as string
      const baseScenePlan = buildCoachScenePlan(course, {
        phraseBatchStart: requestedBatchStart ?? savedSession?.batchStart ?? 0,
      })
      const scenePlan = reviewCueId
        ? scopePlanToReviewCue(baseScenePlan, course, reviewCueId)
        : baseScenePlan
      ;(this as any).scenePlan = scenePlan
      const learner = normalizeSpeaker(scenePlan.learnerSpeaker)
      const dialogueSource: Array<SubtitleEntry & { cueIndex: number }> = reviewCueId || scenePlan.mode === 'phrase-drill'
        ? scenePlan.practiceCues
        : course.subtitles.map((cue, cueIndex) => ({ ...cue, cueIndex }))
      const dialogue: DialogueCue[] = dialogueSource.map(cue => {
        const isLearner = scenePlan.mode === 'phrase-drill' || normalizeSpeaker(cue.speaker) === learner
        return {
          ...cue,
          isLearner,
          speakerLabel: scenePlan.mode === 'phrase-drill'
            ? `表达 ${cue.cueIndex + 1}`
            : `${isLearner ? '你 · ' : ''}${cue.speaker || scenePlan.customerSpeaker}`,
          toneClass: isLearner ? 'dialogue-cue--self' : 'dialogue-cue--customer',
        }
      })
      const range = resolveCoachSceneRange(course, scenePlan)
      const initialStage: CoachStage = reviewCueId
        ? 'practice'
        : requestedBatchStart !== null
          ? 'overview'
          : savedSession && savedSession.stage !== 'summary'
            ? savedSession.stage
            : 'overview'
      this.setData({
        loading: false,
        course,
        title: course.title,
        chapterLabel: course.chapterLabel || '',
        sceneMode: scenePlan.mode,
        reviewMode: Boolean(reviewCueId),
        businessGoal: scenePlan.businessGoal,
        learnerSpeaker: scenePlan.learnerSpeaker,
        customerSpeaker: scenePlan.customerSpeaker,
        estimatedMinutes: scenePlan.estimatedMinutes,
        keyExpressions: scenePlan.keyExpressions,
        batchLabel: buildBatchLabel(scenePlan),
        hasNextBatch: scenePlan.hasNextBatch,
        dialogue,
        challengeCount: scenePlan.challenges.length,
        practiceCount: scenePlan.practiceCues.length,
        audioDurationLabel: formatTime(range.end - range.start),
      })
      const initialIndex = reviewCueId
        ? Math.max(0, scenePlan.practiceCues.findIndex(item => item.id === reviewCueId))
        : (savedSession?.batchStart ?? 0) === scenePlan.batchStart
          ? savedSession?.cueIndex ?? 0
          : 0
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
      ;(this as any).activeAudioMode = ''
      this.setData({ playingSource: '' })
      return
    }
    if (!this.data.course) return
    const range = resolveCoachSceneRange(this.data.course, (this as any).scenePlan)
    this.playSourceRange(range.start, range.end, 'scene')
  },
  handleOriginalPlay() {
    if (this.data.playingSource === 'original') {
      ;(this as any).sourceAudio?.pause()
      ;(this as any).activeAudioMode = ''
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
      this.completeActiveSourcePlayback()
    }
  },
  handleSourceEnded() {
    if (!(this as any).pageAlive) return
    this.completeActiveSourcePlayback()
  },
  completeActiveSourcePlayback() {
    const activeAudioMode = (this as any).activeAudioMode as '' | 'scene' | 'original'
    ;(this as any).activeAudioMode = ''
    const updates: Partial<TrainingPageData> = {
      playingSource: '',
      audioProgress: 100,
    }
    if (activeAudioMode === 'scene' && this.data.stage === 'listen') {
      updates.listenCompleted = true
      updates.listenTranscriptVisible = true
    }
    if (activeAudioMode === 'scene' && this.data.stage === 'shadow') {
      updates.shadowCompleted = true
    }
    this.setData(updates)
  },
  stopAllAudio() {
    this.clearPlayStartTimer()
    ;(this as any).sourceAudio?.pause()
    ;(this as any).recordingAudio?.pause()
    ;(this as any).activeAudioMode = ''
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
  toggleListenTranscript() {
    this.setData({ listenTranscriptVisible: !this.data.listenTranscriptVisible })
  },
  handleAssessment(event: WechatMiniprogram.BaseEvent) {
    const { status } = event.currentTarget.dataset as { status?: CoachSentenceStatus }
    if (status !== 'review' && status !== 'mastered') return
    this.persistActiveSentence(status, this.data.recordingPath)
    this.setData({ currentAssessment: status, assessmentMadeThisRun: true })
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
      if (this.data.reviewMode) {
        this.completeReview()
        return
      }
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
    if (!this.data.shadowCompleted) {
      wx.showToast({ title: '请先完整跟读一遍', icon: 'none' })
      return
    }
    this.stopAllAudio()
    this.applyStage('summary', Math.max(0, this.data.practiceCount - 1), false)
    const now = Date.now()
    const plan = (this as any).scenePlan as CoachScenePlan | null
    const continuesWithNextBatch = Boolean(plan?.mode === 'phrase-drill' && plan.hasNextBatch)
    updateCoachSceneSession({
      sceneId: (this as any).courseId,
      sceneTitle: this.data.title,
      stage: continuesWithNextBatch ? 'overview' : 'summary',
      cueIndex: continuesWithNextBatch ? 0 : Math.max(0, this.data.practiceCount - 1),
      batchStart: continuesWithNextBatch ? plan?.batchEnd ?? 0 : plan?.batchStart ?? 0,
      completedAt: continuesWithNextBatch ? null : now,
    }, now)
    this.refreshSceneCounts()
    if (!continuesWithNextBatch && getStoreState().token && this.data.course) {
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
  completeReview() {
    this.stopAllAudio()
    const assessment = this.data.currentAssessment
    this.applyStage('summary', this.data.currentPracticeIndex, false)
    this.setData({ currentAssessment: assessment })
    this.refreshSceneCounts()
  },
  restartTraining() {
    this.stopAllAudio()
    this.applyStage(this.data.reviewMode ? 'practice' : 'overview', 0, !this.data.reviewMode)
  },
  returnHome() {
    wx.reLaunch({ url: '/pages/coach/coach' })
  },
  handleSummaryPrimary() {
    if (this.data.reviewMode) {
      wx.reLaunch({ url: '/pages/coach/coach?tab=review' })
      return
    }
    const plan = (this as any).scenePlan as CoachScenePlan | null
    if (plan?.mode === 'phrase-drill' && plan.hasNextBatch) {
      wx.redirectTo({
        url: `/pages/training/training?id=${encodeURIComponent((this as any).courseId)}&batchStart=${plan.batchEnd}&restart=1`,
      })
      return
    }
    this.returnHome()
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
      assessmentMadeThisRun: false,
      listenTranscriptVisible: false,
      listenCompleted: false,
      shadowCompleted: false,
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
      currentAssessment: '',
      assessmentMadeThisRun: false,
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
      currentAssessment: '',
      assessmentMadeThisRun: false,
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
      batchStart: ((this as any).scenePlan as CoachScenePlan | null)?.batchStart ?? 0,
      completedAt: null,
    })
  },
  refreshSceneCounts() {
    const courseId = (this as any).courseId as string
    const state = readCoachProgress()
    const plan = (this as any).scenePlan as CoachScenePlan | null
    const focusCueIds = new Set(plan?.practiceCues.map(item => item.id) ?? [])
    const isActiveCue = (sentenceId: string) => !focusCueIds.size || focusCueIds.has(sentenceId)
    const sceneRecords = state.sentences.filter(item => item.sceneId === courseId && isActiveCue(item.sentenceId))
    const summaryReviewItems = getReviewItems(state)
      .filter(item => item.sceneId === courseId && isActiveCue(item.sentenceId))
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

function parseBatchStart(value?: string) {
  if (value === undefined || value === '') return null
  const parsed = Math.floor(Number(value))
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function buildBatchLabel(plan: CoachScenePlan) {
  if (plan.mode !== 'phrase-drill') return ''
  const groupNumber = Math.floor(plan.batchStart / 8) + 1
  return `第 ${groupNumber} 组 · ${plan.batchStart + 1}-${plan.batchEnd} / ${plan.totalPracticeCueCount}`
}

function scopePlanToReviewCue(
  plan: CoachScenePlan,
  course: CourseDetailResponse,
  reviewCueId: string,
): CoachScenePlan {
  const cueIndex = course.subtitles.findIndex(item => item.id === reviewCueId)
  const cue = course.subtitles[cueIndex]
  if (!cue) return plan
  const practiceCue = { ...cue, cueIndex }
  return {
    ...plan,
    estimatedMinutes: 3,
    keyExpressions: [cue.text],
    challenges: [],
    practiceCues: [practiceCue],
    batchStart: 0,
    batchEnd: 1,
    totalPracticeCueCount: 1,
    hasNextBatch: false,
  }
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
