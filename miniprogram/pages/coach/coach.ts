import {
  fetchCourseList,
  type ChapterListItem,
  type ChapterSceneItem,
  type CourseListResponse,
  type UserProgress,
} from '../../utils/api'
import { API_BASE_URL } from '../../config/env'
import type { StoreState } from '../../store/index'
import {
  getState as getStoreState,
  setAppConfig as updateAppConfigInStore,
  setEntitlement as updateEntitlementInStore,
  setProgress as updateProgressInStore,
  subscribe,
} from '../../store/index'
import { enablePageShareMenu, buildAppMessageShare, buildTimelineShare } from '../../utils/share'
import { resolveBusinessGoal } from '../../utils/coach-model'
import {
  selectCoachLearningScene,
  type CoachLearningSelection,
} from '../../utils/coach-dashboard'
import {
  getCoachSummary,
  getReviewItems,
  readCoachProgress,
  updateCoachPlannedScene,
  type CoachSentenceRecord,
  type CoachStage,
} from '../../utils/coach-progress'
import { formatEntitlementExpiry } from '../../utils/util'

type CoachTab = 'learn' | 'scenes' | 'review' | 'me'

type CoachSceneView = ChapterSceneItem & {
  inPlan: boolean
}

type CoachChapterView = Omit<ChapterListItem, 'scenes'> & {
  scenes: CoachSceneView[]
}

type LearningScene = {
  id: string
  chapterLabel: string
  title: string
  goal: string
  estimatedMinutes: number
  actionText: string
  sourceLabel: string
  stageLabel: string
  progressPercent: number
  hasProgress: boolean
}

type PlannedScene = {
  id: string
  chapterLabel: string
  title: string
  locked: boolean
  statusLabel: string
  statusTone: 'active' | 'completed' | 'pending' | 'locked'
}

type CoachSummaryView = {
  reviewCount: number
  masteredCount: number
  completedSceneCount: number
  weeklySessionCount: number
}

type CoachPageData = {
  activeTab: CoachTab
  greeting: string
  userNickname: string
  avatarInitial: string
  avatarUrl: string
  isAuthenticated: boolean
  authLoading: boolean
  fullAccess: boolean
  membershipText: string
  chapters: CoachChapterView[]
  expandedChapterId: string
  learningScene: LearningScene | null
  plannedScenes: PlannedScene[]
  plannedSceneCount: number
  reviewItems: CoachSentenceRecord[]
  coachSummary: CoachSummaryView
  loading: boolean
  error: string
  showUnlockPrompt: boolean
  showLoginModal: boolean
  loginNickname: string
  loginAvatarUrl: string
  canLogin: boolean
  loginModalTitle: string
  loginModalDescription: string
  loginError: string
}

const DEFAULT_NICKNAME = 'Learner'
const STAGE_LABELS: Record<CoachStage, string> = {
  overview: '了解任务',
  listen: '听懂场景',
  respond: '思考回应',
  practice: '逐句表达',
  shadow: '连续跟读',
  summary: '训练完成',
}
const STAGE_PROGRESS: Record<CoachStage, number> = {
  overview: 0,
  listen: 20,
  respond: 40,
  practice: 60,
  shadow: 80,
  summary: 100,
}
Page<CoachPageData, WechatMiniprogram.IAnyObject>({
  storeUnsubscribe: undefined as (() => void) | undefined,
  pendingUnlockAfterLogin: false,
  data: {
    activeTab: 'learn',
    greeting: buildGreeting(),
    userNickname: '',
    avatarInitial: '你',
    avatarUrl: '',
    isAuthenticated: false,
    authLoading: false,
    fullAccess: false,
    membershipText: '可学习第一章，其余 6 章需解锁',
    chapters: [],
    expandedChapterId: 'chapter-01',
    learningScene: null,
    plannedScenes: [],
    plannedSceneCount: 0,
    reviewItems: [],
    coachSummary: {
      reviewCount: 0,
      masteredCount: 0,
      completedSceneCount: 0,
      weeklySessionCount: 0,
    },
    loading: true,
    error: '',
    showUnlockPrompt: true,
    showLoginModal: false,
    loginNickname: '',
    loginAvatarUrl: '',
    canLogin: false,
    loginModalTitle: '登录后保存训练记录',
    loginModalDescription: '同步课程进度与会员权益',
    loginError: '',
  },
  async onLoad(options: { tab?: CoachTab | 'today' } = {}) {
    enablePageShareMenu()
    if (options.tab === 'today') {
      this.setData({ activeTab: 'learn' })
    } else if (options.tab && ['learn', 'scenes', 'review', 'me'].includes(options.tab)) {
      this.setData({ activeTab: options.tab })
    }
    ;(this as any).storeUnsubscribe = subscribe(state => this.handleStoreUpdate(state))
    const app = getApp<IAppOption>()
    if (app.globalData.readyPromise) {
      try {
        await app.globalData.readyPromise
      } catch (error) {
        console.warn('[Coach] App initialization failed', error)
      }
    }
    this.handleStoreUpdate(getStoreState())
    await this.loadCourses(true)
  },
  async onShow() {
    this.refreshCoachData()
    if (this.data.chapters.length && !this.data.loading) {
      await this.loadCourses(true)
    }
  },
  onUnload() {
    ;(this as any).storeUnsubscribe?.()
  },
  async onPullDownRefresh() {
    try {
      await this.loadCourses(true)
    } finally {
      wx.stopPullDownRefresh()
    }
  },
  onShareAppMessage() {
    return buildAppMessageShare({
      title: '按你的节奏练外贸真实场景',
      path: '/pages/coach/coach',
    })
  },
  onShareTimeline() {
    return buildTimelineShare({ title: '外贸口语实战训练' })
  },
  async loadCourses(forceRefresh = false) {
    if (this.data.loading && this.data.chapters.length) return
    this.setData({ loading: true, error: '' })
    try {
      const state = getStoreState()
      const response: CourseListResponse = await fetchCourseList(1, 50, {
        withProgress: Boolean(state.token),
        forceRefresh,
      })
      if (response.progress) {
        updateProgressInStore(normalizeProgress(response.progress))
      }
      if (response.entitlement) {
        updateEntitlementInStore(response.entitlement)
      }
      if (response.appConfig) {
        updateAppConfigInStore(response.appConfig)
      }
      const chapters = applyProgressToChapters(
        response.data,
        getStoreState().progress,
        getStoreState().fullAccess,
        readCoachProgress().plannedSceneIds,
      )
      this.setData({ chapters, loading: false })
      this.handleStoreUpdate(getStoreState(), chapters)
      this.refreshCoachData(chapters)
    } catch (error) {
      this.setData({
        loading: false,
        error: error instanceof Error ? error.message : '场景加载失败，请稍后重试',
      })
    }
  },
  handleStoreUpdate(state: StoreState, chaptersOverride?: ChapterListItem[]) {
    const chapters = applyProgressToChapters(
      chaptersOverride ?? this.data.chapters,
      state.progress,
      state.fullAccess,
      readCoachProgress().plannedSceneIds,
    )
    const rawNickname = state.user?.nickname?.trim() || ''
    const isAuthenticated = Boolean(state.token && state.user)
    const displayNickname = rawNickname && rawNickname !== DEFAULT_NICKNAME ? rawNickname : ''
    const avatarInitial = displayNickname ? displayNickname.charAt(0).toUpperCase() : '你'
    this.setData({
      chapters,
      userNickname: displayNickname,
      avatarInitial,
      avatarUrl: isAuthenticated ? state.user?.avatarUrl?.trim() || '' : '',
      isAuthenticated,
      fullAccess: state.fullAccess,
      membershipText: state.fullAccess
        ? formatEntitlementExpiry(state.entitlement?.expiresAt)
        : '可学习第一章，其余 6 章需解锁',
      showUnlockPrompt: Boolean(state.appConfig.home.unlockPromptEnabled) && !state.fullAccess,
    })
    this.refreshCoachData(chapters)
  },
  refreshCoachData(chaptersOverride?: ChapterListItem[]) {
    const chapters = chaptersOverride ?? this.data.chapters
    const progress = readCoachProgress()
    const coachSummary = getCoachSummary(progress)
    const reviewItems = getReviewItems(progress).slice(0, 30)
    const learningSelection = selectCoachLearningScene({
      chapters,
      progress: getStoreState().progress,
      sessions: progress.sessions,
      plannedSceneIds: progress.plannedSceneIds,
    })
    const learningScene = learningSelection ? buildLearningScene(learningSelection) : null
    const plannedScenes = buildPlannedScenes(chapters, progress.plannedSceneIds, progress.sessions)
    const chaptersWithPlan = applyPlanToChapters(chapters, progress.plannedSceneIds)
    this.setData({
      chapters: chaptersWithPlan,
      learningScene,
      plannedScenes,
      plannedSceneCount: plannedScenes.length,
      reviewItems,
      coachSummary,
    })
  },
  handleTabChange(event: WechatMiniprogram.BaseEvent) {
    const { tab } = event.currentTarget.dataset as { tab?: CoachTab }
    if (!tab || tab === this.data.activeTab) return
    this.setData({ activeTab: tab })
    if (tab === 'review') {
      this.refreshCoachData()
    }
  },
  openScenesTab() {
    this.setData({ activeTab: 'scenes' })
  },
  openLearnTab() {
    this.setData({ activeTab: 'learn' })
  },
  openReviewTab() {
    this.setData({ activeTab: 'review' })
  },
  toggleChapter(event: WechatMiniprogram.BaseEvent) {
    const { id } = event.currentTarget.dataset as { id?: string }
    if (!id) return
    this.setData({ expandedChapterId: this.data.expandedChapterId === id ? '' : id })
  },
  goToTraining(event: WechatMiniprogram.BaseEvent) {
    const dataset = event.currentTarget.dataset as { id?: string; sceneId?: string; cueId?: string }
    const id = dataset.id || dataset.sceneId
    if (!id) return
    const scene = findScene(this.data.chapters, id)
    if (scene?.locked) {
      this.goToUnlock()
      return
    }
    const cueQuery = dataset.cueId ? `&reviewCue=${encodeURIComponent(dataset.cueId)}` : ''
    wx.navigateTo({ url: `/pages/training/training?id=${encodeURIComponent(id)}${cueQuery}` })
  },
  toggleScenePlan(event: WechatMiniprogram.BaseEvent) {
    const { id } = event.currentTarget.dataset as { id?: string }
    if (!id) return
    const scene = findScene(this.data.chapters, id)
    if (!scene) return
    if (scene.locked) {
      void this.goToUnlock()
      return
    }
    const selected = !scene.inPlan
    updateCoachPlannedScene(id, selected)
    this.refreshCoachData()
    wx.showToast({ title: selected ? '已加入训练清单' : '已移出训练清单', icon: 'none' })
  },
  removeSceneFromPlan(event: WechatMiniprogram.BaseEvent) {
    const { id } = event.currentTarget.dataset as { id?: string }
    if (!id) return
    updateCoachPlannedScene(id, false)
    this.refreshCoachData()
  },
  handleRetry() {
    void this.loadCourses(true)
  },
  async goToUnlock() {
    const state = getStoreState()
    const nickname = state.user?.nickname?.trim()
    if (!this.data.isAuthenticated || !nickname || nickname === DEFAULT_NICKNAME) {
      ;(this as any).pendingUnlockAfterLogin = true
      this.showLoginDialog(true)
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
  goToClassic() {
    wx.navigateTo({ url: '/pages/index/index' })
  },
  handleLoginTap() {
    this.showLoginDialog()
  },
  showLoginDialog(force = false) {
    if (this.data.isAuthenticated && force !== true) return
    const unlocking = Boolean((this as any).pendingUnlockAfterLogin)
    this.setData({
      showLoginModal: true,
      loginNickname: '',
      loginAvatarUrl: '',
      canLogin: false,
      loginModalTitle: unlocking ? '登录后解锁全部场景' : '登录后保存训练记录',
      loginModalDescription: unlocking
        ? '完成登录后，继续填写会员邀请码'
        : '同步课程进度与会员权益',
      loginError: '',
    })
  },
  hideLoginDialog() {
    ;(this as any).pendingUnlockAfterLogin = false
    this.setData({
      showLoginModal: false,
      loginNickname: '',
      loginAvatarUrl: '',
      canLogin: false,
      loginError: '',
    })
  },
  onChooseAvatar(event: WechatMiniprogram.CustomEvent<{ avatarUrl: string }>) {
    const avatarUrl = event.detail.avatarUrl
    this.setData({
      loginAvatarUrl: avatarUrl,
      canLogin: Boolean(avatarUrl && this.data.loginNickname),
      loginError: '',
    })
  },
  onNicknameInput(event: WechatMiniprogram.Input) {
    const nickname = event.detail.value.trim()
    this.setData({
      loginNickname: nickname,
      canLogin: Boolean(nickname && this.data.loginAvatarUrl),
      loginError: '',
    })
  },
  onNicknameBlur(event: WechatMiniprogram.InputBlur) {
    const nickname = event.detail.value.trim()
    this.setData({
      loginNickname: nickname,
      canLogin: Boolean(nickname && this.data.loginAvatarUrl),
      loginError: '',
    })
  },
  async handleLoginConfirm() {
    if (!this.data.canLogin || this.data.authLoading) return
    const shouldOpenUnlock = Boolean((this as any).pendingUnlockAfterLogin)
    this.setData({ authLoading: true, loginError: '' })
    try {
      const app = getApp<IAppOption>()
      await app.ensureAuth?.({ nickname: this.data.loginNickname, avatarUrl: '' })
      const uploadedAvatarUrl = await this.uploadAvatarIfNeeded(this.data.loginAvatarUrl)
      if (uploadedAvatarUrl) {
        await app.ensureAuth?.({ nickname: this.data.loginNickname, avatarUrl: uploadedAvatarUrl })
      }
      this.setData({
        showLoginModal: false,
        loginNickname: '',
        loginAvatarUrl: '',
        canLogin: false,
      })
      ;(this as any).pendingUnlockAfterLogin = false
      await this.loadCourses(true)
      if (shouldOpenUnlock) {
        wx.navigateTo({ url: '/pages/unlock/unlock' })
      } else {
        wx.showToast({ title: '登录成功', icon: 'success' })
      }
    } catch (error) {
      this.setData({ loginError: error instanceof Error ? error.message : '登录失败，请稍后重试' })
    } finally {
      this.setData({ authLoading: false })
    }
  },
  uploadAvatarIfNeeded(tempFilePath: string): Promise<string> {
    const isTempFile = tempFilePath && (
      tempFilePath.startsWith('http://tmp/') ||
      tempFilePath.startsWith('wxfile://') ||
      tempFilePath.includes('/tmp/')
    )
    if (!isTempFile) return Promise.resolve('')
    return new Promise((resolve, reject) => {
      const token = getApp<IAppOption>().globalData.token
      if (!token) {
        resolve('')
        return
      }
      wx.getFileSystemManager().readFile({
        filePath: tempFilePath,
        encoding: 'base64',
        success: result => {
          wx.request({
            url: `${API_BASE_URL}/api/waimao-mini/users/me/avatar`,
            method: 'POST',
            header: {
              'content-type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            data: { avatar: `data:image/png;base64,${result.data as string}` },
            success: uploadResult => {
              if (uploadResult.statusCode === 200) {
                const data = uploadResult.data as { avatarUrl: string }
                resolve(`${API_BASE_URL}${data.avatarUrl}`)
              } else {
                reject(new Error('头像上传失败'))
              }
            },
            fail: reject,
          })
        },
        fail: reject,
      })
    })
  },
})

function normalizeProgress(progress: UserProgress): UserProgress {
  const completedSceneIds = progress.completedSceneIds ?? progress.completedCourseIds ?? []
  return { ...progress, completedSceneIds, completedCourseIds: completedSceneIds }
}

function applyProgressToChapters(
  chapters: ChapterListItem[],
  progress: UserProgress | null,
  fullAccess: boolean,
  plannedSceneIds: string[],
): CoachChapterView[] {
  const planned = new Set(plannedSceneIds)
  const sceneProgress = new Map((progress?.scenes ?? []).map(item => [item.sceneId, item]))
  const completed = new Set(progress?.completedSceneIds ?? progress?.completedCourseIds ?? [])
  const currentSceneId = progress?.currentSceneId ?? null
  return (Array.isArray(chapters) ? chapters : []).map(chapter => {
    const locked = !chapter.free && !fullAccess
    return {
      ...chapter,
      locked,
      scenes: (Array.isArray(chapter.scenes) ? chapter.scenes : []).map(scene => {
        const progressItem = sceneProgress.get(scene.id) ?? scene.progress ?? null
        const done = completed.has(scene.id) || Boolean(progressItem?.sceneCompleted)
        return {
          ...scene,
          locked,
          inPlan: planned.has(scene.id),
          isCurrent: currentSceneId === scene.id,
          status: done ? 'completed' as const : 'pending' as const,
          progress: progressItem,
        }
      }),
    }
  })
}

function buildLearningScene(selected: CoachLearningSelection): LearningScene {
  const stage = selected.session?.stage ?? 'overview'
  const isPhraseDrill = selected.scene.id.startsWith('chapter-07-')
  const batchStart = isPhraseDrill ? selected.session?.batchStart ?? 0 : 0
  const batchNumber = Math.floor(batchStart / 8) + 1
  return {
    id: selected.scene.id,
    chapterLabel: isPhraseDrill ? `${selected.chapter.label} · 第 ${batchNumber} 组` : selected.chapter.label,
    title: selected.scene.title,
    goal: resolveBusinessGoal({ title: selected.scene.title }),
    estimatedMinutes: isPhraseDrill
      ? 10
      : Math.max(6, Math.min(15, Math.ceil(4 + selected.scene.cueCount * 0.45))),
    actionText: selected.source === 'resume'
      ? '继续训练'
      : selected.scene.status === 'completed' || stage === 'summary'
        ? '再练一次'
        : '开始训练',
    sourceLabel: LEARNING_SOURCE_LABELS[selected.source],
    stageLabel: STAGE_LABELS[stage],
    progressPercent: STAGE_PROGRESS[stage],
    hasProgress: selected.source === 'resume' && stage !== 'overview',
  }
}

const LEARNING_SOURCE_LABELS: Record<CoachLearningSelection['source'], string> = {
  resume: '继续上次',
  plan: '训练清单',
  current: '接着当前进度',
  recommended: '建议下一步',
  repeat: '再练一个场景',
}

function buildPlannedScenes(
  chapters: ChapterListItem[],
  plannedSceneIds: string[],
  sessions: ReturnType<typeof readCoachProgress>['sessions'],
): PlannedScene[] {
  return plannedSceneIds.reduce<PlannedScene[]>((result, sceneId) => {
    const found = findSceneWithChapter(chapters, sceneId)
    if (!found) return result
    const session = sessions.find(item => item.sceneId === sceneId)
    const statusTone: PlannedScene['statusTone'] = found.scene.locked
      ? 'locked'
      : session && session.stage !== 'summary'
        ? 'active'
        : found.scene.status === 'completed'
          ? 'completed'
          : 'pending'
    const statusLabel = statusTone === 'locked'
      ? '需要解锁'
      : statusTone === 'active'
        ? `上次到：${STAGE_LABELS[session?.stage ?? 'overview']}`
        : statusTone === 'completed'
          ? '已完成，可再练'
          : '待训练'
    result.push({
      id: sceneId,
      chapterLabel: found.chapter.label,
      title: found.scene.title,
      locked: Boolean(found.scene.locked),
      statusLabel,
      statusTone,
    })
    return result
  }, [])
}

function applyPlanToChapters(chapters: ChapterListItem[], plannedSceneIds: string[]): CoachChapterView[] {
  const planned = new Set(plannedSceneIds)
  return chapters.map(chapter => ({
    ...chapter,
    scenes: chapter.scenes.map(scene => ({ ...scene, inPlan: planned.has(scene.id) })),
  }))
}

function findScene(chapters: CoachChapterView[], id: string): CoachSceneView | null {
  for (const chapter of chapters) {
    const scene = chapter.scenes.find(item => item.id === id)
    if (scene) return scene
  }
  return null
}

function findSceneWithChapter(chapters: ChapterListItem[], id: string) {
  for (const chapter of chapters) {
    const scene = chapter.scenes.find(item => item.id === id)
    if (scene) return { chapter, scene }
  }
  return null
}

function buildGreeting() {
  const hour = new Date().getHours()
  if (hour < 6) return '夜深了'
  if (hour < 11) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}
