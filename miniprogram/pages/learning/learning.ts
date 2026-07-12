import { fetchLearningRecords } from '../../utils/api'
import { buildRecentCalendar, formatStudyDuration, CalendarDay } from '../../utils/learning-records'
import { normalizeReviewLibrary, REVIEW_LIBRARY_STORAGE_KEY } from '../../utils/review-library'
import { getState as getStoreState } from '../../store/index'

type LearningPageData = {
  nickname: string
  avatarUrl: string
  avatarInitial: string
  streakCount: number
  totalCompleted: number
  studyDurationLabel: string
  totalPracticeCount: number
  activeDays: number
  wordCount: number
  cueCount: number
  calendar: CalendarDay[]
  loading: boolean
  error: string
}

Page<LearningPageData, WechatMiniprogram.IAnyObject>({
  data: {
    nickname: '', avatarUrl: '', avatarInitial: 'L', streakCount: 0, totalCompleted: 0,
    studyDurationLabel: '0 分钟', totalPracticeCount: 0, activeDays: 0,
    wordCount: 0, cueCount: 0, calendar: [], loading: true, error: '',
  },
  onShow() {
    const state = getStoreState()
    if (!state.token || !state.user) {
      wx.showToast({ title: '登录后查看学习记录', icon: 'none' })
      setTimeout(() => wx.redirectTo({ url: '/pages/index/index' }), 500)
      return
    }
    const library = normalizeReviewLibrary(wx.getStorageSync(REVIEW_LIBRARY_STORAGE_KEY))
    const nickname = state.user.nickname || 'Learner'
    this.setData({
      nickname,
      avatarUrl: state.user.avatarUrl || '',
      avatarInitial: nickname.charAt(0).toUpperCase() || 'L',
      streakCount: state.progress?.streakCount ?? state.user.streakCount ?? 0,
      totalCompleted: state.progress?.totalCompleted ?? state.user.totalCompleted ?? 0,
      studyDurationLabel: formatStudyDuration(state.user.studySeconds ?? 0),
      wordCount: library.words.length,
      cueCount: library.cues.length,
    })
    void this.loadRecords()
  },
  async loadRecords() {
    this.setData({ loading: true, error: '' })
    try {
      const response = await fetchLearningRecords(28)
      this.setData({
        streakCount: response.summary.streakCount,
        totalCompleted: response.summary.totalCompleted,
        studyDurationLabel: formatStudyDuration(response.summary.studySeconds),
        totalPracticeCount: response.summary.totalPracticeCount,
        activeDays: response.summary.activeDays,
        calendar: buildRecentCalendar(response.days, { totalDays: 28 }),
        loading: false,
      })
    } catch (_error) {
      this.setData({
        loading: false,
        error: '学习记录暂时不可用，请稍后重试',
        calendar: buildRecentCalendar([], { totalDays: 28 }),
      })
    }
  },
  goToReview() {
    wx.navigateTo({ url: '/pages/review/review' })
  },
  handleRetry() {
    void this.loadRecords()
  },
})
