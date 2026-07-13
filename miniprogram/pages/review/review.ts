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
export type WordAudioStatus = 'idle' | 'loading' | 'playing' | 'paused'
type WordAudioTapAction = 'start' | 'pause' | 'resume' | 'cancel'

export function resolveWordAudioTapAction(
  current: { id: string; status: WordAudioStatus },
  targetId: string,
): WordAudioTapAction {
  if (current.id !== targetId) return 'start'
  if (current.status === 'playing') return 'pause'
  if (current.status === 'paused') return 'resume'
  if (current.status === 'loading') return 'cancel'
  return 'start'
}

type ReviewPageData = {
  tab: ReviewTab
  words: ReviewWord[]
  cues: ReviewCue[]
  wordCount: number
  cueCount: number
  loading: boolean
  activeWordAudioId: string
  wordAudioStatus: WordAudioStatus
}

Page<ReviewPageData, WechatMiniprogram.IAnyObject>({
  wordAudioContext: null as WechatMiniprogram.InnerAudioContext | null,
  data: {
    tab: 'words',
    words: [],
    cues: [],
    wordCount: 0,
    cueCount: 0,
    loading: false,
    activeWordAudioId: '',
    wordAudioStatus: 'idle',
  },
  onShow() {
    this.loadLibrary()
    void this.hydrateLegacyCueDetails()
  },
  onHide() {
    this.resetWordAudio()
  },
  onUnload() {
    this.wordAudioContext?.destroy()
    this.wordAudioContext = null
  },
  loadLibrary() {
    const library = this.readLibrary()
    this.setData({
      words: library.words,
      cues: library.cues,
      wordCount: library.words.length,
      cueCount: library.cues.length,
    })
  },
  handleTabChange(event: WechatMiniprogram.BaseEvent) {
    const tab = (event.currentTarget.dataset as { tab?: ReviewTab }).tab
    if (tab && tab !== this.data.tab) {
      this.resetWordAudio()
      this.setData({ tab })
    }
  },
  handleOpenWordSource(event: WechatMiniprogram.BaseEvent) {
    const normalized = String((event.currentTarget.dataset as { id?: string }).id ?? '')
    const item = this.data.words.find(word => word.normalized === normalized)
    this.openSource(item)
  },
  handleOpenCueSource(event: WechatMiniprogram.BaseEvent) {
    const { courseId, cueId } = event.currentTarget.dataset as { courseId?: string; cueId?: string }
    const item = this.data.cues.find(cue => cue.courseId === courseId && cue.cueId === cueId)
    this.openSource(item, true)
  },
  openSource(item: ReviewWord | ReviewCue | undefined, reviewOnly = false) {
    if (!item?.courseId || !item.cueId) {
      wx.showToast({ title: '这条记录暂无来源句', icon: 'none' })
      return
    }
    const query = [
      `id=${encodeURIComponent(item.courseId)}`,
      `cueId=${encodeURIComponent(item.cueId)}`,
      'stage=practice',
      reviewOnly ? 'review=1' : '',
    ].filter(Boolean).join('&')
    wx.navigateTo({ url: `/pages/course/course?${query}` })
  },
  handleDeleteWord(event: WechatMiniprogram.BaseEvent) {
    const normalized = String((event.currentTarget.dataset as { id?: string }).id ?? '')
    if (this.data.activeWordAudioId === normalized) this.resetWordAudio()
    this.writeLibrary(removeReviewWord(this.readLibrary(), normalized))
    this.loadLibrary()
  },
  handleDeleteCue(event: WechatMiniprogram.BaseEvent) {
    const { courseId, cueId } = event.currentTarget.dataset as { courseId?: string; cueId?: string }
    if (!courseId || !cueId) return
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

    const action = resolveWordAudioTapAction({
      id: this.data.activeWordAudioId,
      status: this.data.wordAudioStatus,
    }, audioId)
    if (action === 'pause') {
      this.setData({ wordAudioStatus: 'paused' })
      this.wordAudioContext?.pause()
      return
    }
    if (action === 'resume') {
      if (!this.wordAudioContext) {
        this.resetWordAudio()
        return
      }
      this.setData({ wordAudioStatus: 'loading' })
      this.wordAudioContext.play()
      return
    }
    if (action === 'cancel') {
      this.resetWordAudio()
      return
    }

    const context = this.ensureWordAudioContext()
    context.stop()
    this.setData({ activeWordAudioId: audioId, wordAudioStatus: 'loading' })
    context.src = audioUrl
    context.play()
  },
  ensureWordAudioContext() {
    if (this.wordAudioContext) return this.wordAudioContext
    const context = wx.createInnerAudioContext()
    context.autoplay = false
    context.obeyMuteSwitch = true
    context.onPlay(() => {
      if (this.data.activeWordAudioId) this.setData({ wordAudioStatus: 'playing' })
    })
    context.onPause(() => {
      if (this.data.activeWordAudioId && this.data.wordAudioStatus === 'playing') {
        this.setData({ wordAudioStatus: 'paused' })
      }
    })
    context.onWaiting(() => {
      if (this.data.activeWordAudioId && this.data.wordAudioStatus !== 'paused') {
        this.setData({ wordAudioStatus: 'loading' })
      }
    })
    context.onCanplay(() => {
      if (this.data.activeWordAudioId && this.data.wordAudioStatus === 'loading' && !context.paused) {
        this.setData({ wordAudioStatus: 'playing' })
      }
    })
    context.onEnded(() => this.resetWordAudio())
    context.onError(() => {
      if (!this.data.activeWordAudioId) return
      this.resetWordAudio()
      wx.showToast({ title: '发音播放失败', icon: 'none' })
    })
    this.wordAudioContext = context
    return context
  },
  resetWordAudio() {
    this.setData({ activeWordAudioId: '', wordAudioStatus: 'idle' })
    this.wordAudioContext?.stop()
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
