import { fetchLearningRecords } from '../../utils/api'
import { formatStudyDuration } from '../../utils/learning-records'
import { getState as getStoreState } from '../../store/index'
import {
  FEATURE_FLAGS,
  resolveInteractiveFeaturesEnabled,
} from '../../config/feature-flags'

type LearningPageData = {
  isAuthenticated: boolean
  nickname: string
  avatarUrl: string
  avatarInitial: string
  fullAccess: boolean
  membershipLabel: string
  streakCount: number
  totalCompleted: number
  studyDurationLabel: string
  loading: boolean
  error: string
  membershipUnlockEnabled: boolean
  audioPlaybackEnabled: boolean
}

Page<LearningPageData, WechatMiniprogram.IAnyObject>({
  data: {
    isAuthenticated: false, nickname: '', avatarUrl: '', avatarInitial: 'L',
    fullAccess: false, membershipLabel: '登录后查看会员权益', streakCount: 0, totalCompleted: 0,
    studyDurationLabel: '0 分钟', loading: false, error: '',
    membershipUnlockEnabled: FEATURE_FLAGS.membershipUnlock,
    audioPlaybackEnabled: FEATURE_FLAGS.audioPlayback,
  },
  onShow() {
    const state = getStoreState()
    const interactiveFeaturesEnabled = resolveInteractiveFeaturesEnabled(state.appConfig)
    if (!state.token || !state.user) {
      this.setData({
        isAuthenticated: false,
        nickname: '',
        avatarUrl: '',
        avatarInitial: 'L',
        fullAccess: false,
        membershipLabel: '登录后查看会员权益',
        streakCount: 0,
        totalCompleted: 0,
        studyDurationLabel: '0 分钟',
        loading: false,
        error: '',
        membershipUnlockEnabled: interactiveFeaturesEnabled,
        audioPlaybackEnabled: interactiveFeaturesEnabled,
      })
      return
    }
    const nickname = state.user.nickname || 'Learner'
    this.setData({
      isAuthenticated: true,
      nickname,
      avatarUrl: state.user.avatarUrl || '',
      avatarInitial: nickname.charAt(0).toUpperCase() || 'L',
      fullAccess: state.fullAccess,
      membershipLabel: state.fullAccess ? '全部课程已解锁' : '第一章免费，后 6 章待解锁',
      streakCount: state.progress?.streakCount ?? state.user.streakCount ?? 0,
      totalCompleted: state.progress?.totalCompleted ?? state.user.totalCompleted ?? 0,
      studyDurationLabel: formatStudyDuration(state.user.studySeconds ?? 0),
      membershipUnlockEnabled: interactiveFeaturesEnabled,
      audioPlaybackEnabled: interactiveFeaturesEnabled,
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
        loading: false,
      })
    } catch (_error) {
      this.setData({
        loading: false,
        error: '学习记录暂时不可用，请稍后重试',
      })
    }
  },
  goToLogin() {
    const app = getApp<IAppOption>()
    app.globalData.requestIndexAction = 'login'
    wx.switchTab({ url: '/pages/index/index' })
  },
  goToUnlock() {
    if (!this.data.membershipUnlockEnabled) return

    const state = getStoreState()
    const nickname = state.user?.nickname?.trim()
    if (!this.data.isAuthenticated || !nickname || nickname === 'Learner') {
      const app = getApp<IAppOption>()
      app.globalData.requestIndexAction = 'unlock'
      wx.switchTab({ url: '/pages/index/index' })
      return
    }
    wx.navigateTo({ url: '/pages/unlock/unlock' })
  },
  goToPracticeHelp() {
    wx.navigateTo({ url: '/pages/practice-help/practice-help' })
  },
  goToContact() {
    wx.navigateTo({ url: '/pages/contact/contact' })
  },
  handleRetry() {
    void this.loadRecords()
  },
})
