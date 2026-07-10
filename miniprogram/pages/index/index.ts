import {
  fetchCourseList,
  ChapterListItem,
  ChapterSceneItem,
  CourseListResponse,
  UserProgress,
} from '../../utils/api'
import { debounce } from '../../utils/storage'
import type { StoreState } from '../../store/index'
import {
  subscribe,
  getState as getStoreState,
  setAppConfig as updateAppConfigInStore,
  setProgress as updateProgressInStore,
  setEntitlement as updateEntitlementInStore,
} from '../../store/index'
import { API_BASE_URL } from '../../config/env'
import {
  buildAppMessageShare,
  buildTimelineShare,
  enablePageShareMenu,
} from '../../utils/share'
import { buildIndexShareCardModel } from '../../utils/share-card'
import { renderSharePoster } from '../../utils/share-poster'

const DEFAULT_NICKNAME = 'Learner'
const DEFAULT_AVATAR_INITIAL = 'L'
type ContinueScene = {
  id: string
  chapterLabel: string
  title: string
  statusText: string
}

type IndexPageData = {
  userNickname: string
  avatarInitial: string
  avatarUrl: string
  streakCount: number
  completedCount: number
  courseCount: number
  chapters: ChapterListItem[]
  continueScene: ContinueScene | null
  loading: boolean
  error: string | null
  scrollTop: number
  isAuthenticated: boolean
  authLoading: boolean
  showLoginModal: boolean
  loginNickname: string
  loginAvatarUrl: string
  canLogin: boolean
  loginModalTitle: string
  loginModalDescription: string
  loginConfirmText: string
  loginError: string
  shareImageUrl: string
  fullAccess: boolean
  expandedChapterId: string
  showUnlockPrompt: boolean
  unlockPromptTitle: string
  unlockPromptDescription: string
  unlockPromptCta: string
  showPracticeHelp: boolean
  scrollWithAnimation: boolean
}

Page<IndexPageData, WechatMiniprogram.IAnyObject>({
  storeUnsubscribe: undefined as (() => void) | undefined,
  courseScrollLastTop: null as number | null,
  pendingUnlockAfterLogin: false,
  data: {
    userNickname: DEFAULT_NICKNAME,
    avatarInitial: DEFAULT_AVATAR_INITIAL,
    avatarUrl: '',
    streakCount: 0,
    completedCount: 0,
    courseCount: 0,
    chapters: [],
    continueScene: null,
    loading: false,
    error: null,
    scrollTop: 0,
    isAuthenticated: false,
    authLoading: false,
    showLoginModal: false,
    loginNickname: '',
    loginAvatarUrl: '',
    canLogin: false,
    loginModalTitle: '登录后保存学习进度',
    loginModalDescription: '换设备也能从上次的位置继续',
    loginConfirmText: '登录并继续',
    loginError: '',
    shareImageUrl: '',
    fullAccess: false,
    expandedChapterId: 'chapter-01',
    showUnlockPrompt: true,
    unlockPromptTitle: '解锁全部课程',
    unlockPromptDescription: '后 6 章开放，1 年内不限次学习',
    unlockPromptCta: '去解锁',
    showPracticeHelp: false,
    scrollWithAnimation: true,
  },
  scheduleShareImage: debounce(function (this: any) {
    void this.generateShareImage()
  }, 240) as () => void,
  async onLoad() {
    enablePageShareMenu()
    ;(this as any).storeUnsubscribe = subscribe(state => this.handleStoreUpdate(state))
    await this.initializePage()
  },
  async onShow() {
    if (!this.data.chapters.length || this.data.loading) return
    await this.loadCourses(true)
  },
  onShareAppMessage() {
    return buildAppMessageShare({
      title: '外贸英语影子跟读',
      path: '/pages/index/index',
      imageUrl: this.data.shareImageUrl || undefined,
    })
  },
  onShareTimeline() {
    return buildTimelineShare({
      title: '外贸英语影子跟读',
      imageUrl: this.data.shareImageUrl || undefined,
    })
  },
  async onPullDownRefresh() {
    try {
      await this.loadCourses(true)
    } finally {
      wx.stopPullDownRefresh()
    }
  },
  onUnload() {
    ;(this as any).storeUnsubscribe?.()
  },
  async initializePage() {
    const app = getApp<IAppOption>()

    if (app.globalData.readyPromise) {
      try {
        await app.globalData.readyPromise
      } catch (error) {
        console.warn('readyPromise rejected', error)
      }
    }

    this.handleStoreUpdate(getStoreState())
    await this.loadCourses(true)
    this.scheduleShareImage()
  },
  async loadCourses(forceRefresh = false) {
    if (this.data.loading) return

    this.setData({
      loading: true,
      error: null,
    })

    try {
      const state = getStoreState()
      const response: CourseListResponse = await fetchCourseList(
        1,
        50,
        { withProgress: Boolean(state.token), forceRefresh }
      )

      if (response.progress) {
        updateProgressInStore(normalizeProgress(response.progress))
      }
      if (response.appConfig) {
        updateAppConfigInStore(response.appConfig)
      }
      if (response.entitlement) {
        updateEntitlementInStore(response.entitlement)
      }

      const chapters = normalizeChapters(response.data)
      const sceneCount = countScenes(chapters)

      this.setData({
        chapters,
        courseCount: sceneCount,
        loading: false,
      })

      this.handleStoreUpdate(getStoreState(), sceneCount, chapters)
      this.scheduleShareImage()
    } catch (error) {
      const message = error instanceof Error ? error.message : '课程加载失败，请重试'
      this.setData({
        error: message,
        loading: false,
      })
    }
  },
  handleStoreUpdate(state: StoreState, courseCountOverride?: number, chaptersOverride?: ChapterListItem[]) {
    const isAuthenticated = Boolean(state.token && state.user)
    const rawNickname = state.user?.nickname?.trim()
    const nickname = rawNickname || DEFAULT_NICKNAME
    const initialSource = rawNickname || DEFAULT_AVATAR_INITIAL
    const avatarInitial = (initialSource.charAt(0) || DEFAULT_AVATAR_INITIAL).toUpperCase()
    const avatarUrl = isAuthenticated ? (state.user?.avatarUrl?.trim() ?? '') : ''
    const chapters = applyProgressToChapters(chaptersOverride ?? this.data.chapters, state.progress, state.fullAccess)
    const sceneCount = courseCountOverride ?? countScenes(chapters)
    const continueScene = isAuthenticated
      ? findContinueScene(chapters, state.progress?.currentSceneId ?? null)
      : null
    const completedCount = isAuthenticated ? state.progress?.totalCompleted ?? 0 : 0
    const streakCount = isAuthenticated ? state.progress?.streakCount ?? 0 : 0
    const home = state.appConfig.home

    this.setData({
      userNickname: nickname,
      avatarInitial,
      avatarUrl,
      streakCount,
      completedCount,
      courseCount: sceneCount,
      chapters,
      continueScene,
      isAuthenticated,
      fullAccess: state.fullAccess,
      showUnlockPrompt: Boolean(home.unlockPromptEnabled) && !state.fullAccess,
      unlockPromptTitle: home.unlockPromptTitle || this.data.unlockPromptTitle,
      unlockPromptDescription: home.unlockPromptDescription || this.data.unlockPromptDescription,
      unlockPromptCta: home.unlockPromptCta || this.data.unlockPromptCta,
      showPracticeHelp: Boolean(home.practiceHelpEnabled),
      shareImageUrl: this.data.shareImageUrl,
    })
    this.scheduleShareImage()
  },
  handleRetry() {
    void this.loadCourses(true)
  },
  handleCourseScroll(event: WechatMiniprogram.ScrollViewScroll) {
    this.courseScrollLastTop = event.detail.scrollTop ?? 0
  },
  toggleChapter(event: WechatMiniprogram.BaseEvent) {
    const { id } = event.currentTarget.dataset as { id?: string }
    if (!id) return
    this.setData({
      expandedChapterId: this.data.expandedChapterId === id ? '' : id,
    })
  },
  goToDetail(event: WechatMiniprogram.BaseEvent) {
    const { id } = event.currentTarget.dataset as { id?: string }
    if (!id) return

    const scene = findScene(this.data.chapters, id)
    if (scene?.locked) {
      this.goToUnlock()
      return
    }

    wx.navigateTo({
      url: `/pages/course/course?id=${id}`,
    })
  },
  async goToUnlock() {
    const state = getStoreState()
    const nickname = state.user?.nickname?.trim()
    const needsProfile = !nickname || nickname === DEFAULT_NICKNAME
    if (!this.data.isAuthenticated || needsProfile) {
      ;(this as any).pendingUnlockAfterLogin = true
      this.showLoginDialog(true)
      return
    }

    wx.navigateTo({
      url: '/pages/unlock/unlock',
    })
  },
  goToContact() {
    wx.navigateTo({
      url: '/pages/contact/contact',
    })
  },
  goToPracticeHelp() {
    wx.navigateTo({
      url: '/pages/practice-help/practice-help',
    })
  },
  handleLoginTap() {
    this.showLoginDialog()
  },
  showLoginDialog(force = false) {
    const forceOpen = force === true
    if (this.data.isAuthenticated && !forceOpen) return
    const unlocking = Boolean((this as any).pendingUnlockAfterLogin)
    this.setData({
      showLoginModal: true,
      loginNickname: '',
      loginAvatarUrl: '',
      canLogin: false,
      loginModalTitle: unlocking ? '登录后解锁全部课程' : '登录后保存学习进度',
      loginModalDescription: unlocking
        ? '完成登录后，继续填写会员邀请码'
        : '换设备也能从上次的位置继续',
      loginConfirmText: '登录并继续',
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
  onChooseAvatar(e: WechatMiniprogram.CustomEvent<{ avatarUrl: string }>) {
    const { avatarUrl } = e.detail
    this.setData({
      loginAvatarUrl: avatarUrl,
      canLogin: Boolean(avatarUrl && this.data.loginNickname),
      loginError: '',
    })
  },
  onNicknameInput(e: WechatMiniprogram.Input) {
    const nickname = e.detail.value.trim()
    this.setData({
      loginNickname: nickname,
      canLogin: Boolean(nickname && this.data.loginAvatarUrl),
      loginError: '',
    })
  },
  onNicknameBlur(e: WechatMiniprogram.InputBlur) {
    const nickname = e.detail.value.trim()
    this.setData({
      loginNickname: nickname,
      canLogin: Boolean(nickname && this.data.loginAvatarUrl),
      loginError: '',
    })
  },
  async handleLoginConfirm() {
    if (!this.data.canLogin || this.data.authLoading) return

    const { loginNickname, loginAvatarUrl } = this.data
    const shouldOpenUnlock = Boolean((this as any).pendingUnlockAfterLogin)
    this.setData({ authLoading: true })

    try {
      const app = getApp<IAppOption>()
      if (app && typeof app.ensureAuth === 'function') {
        await app.ensureAuth({
          nickname: loginNickname,
          avatarUrl: '',
        })
      } else if (app && typeof app.initializeAuth === 'function') {
        await app.initializeAuth(true, {
          nickname: loginNickname,
          avatarUrl: '',
        })
      } else {
        throw new Error('登录功能未初始化')
      }

      const isTempFile = loginAvatarUrl && (
        loginAvatarUrl.startsWith('http://tmp/') ||
        loginAvatarUrl.startsWith('wxfile://') ||
        loginAvatarUrl.includes('/tmp/')
      )
      if (isTempFile) {
        try {
          const uploadedAvatarUrl = await this.uploadAvatar(loginAvatarUrl)
          if (app && typeof app.ensureAuth === 'function') {
            await app.ensureAuth({
              nickname: loginNickname,
              avatarUrl: uploadedAvatarUrl,
            })
          }
        } catch (uploadError) {
          console.warn('[Login] avatar upload failed', uploadError)
        }
      }

      this.setData({
        showLoginModal: false,
        loginNickname: '',
        loginAvatarUrl: '',
        canLogin: false,
        loginError: '',
      })
      ;(this as any).pendingUnlockAfterLogin = false
      await this.loadCourses(true)
      if (shouldOpenUnlock) {
        wx.navigateTo({
          url: '/pages/unlock/unlock',
        })
      } else {
        wx.showToast({
          title: '登录成功',
          icon: 'success',
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '登录失败，请稍后重试'
      this.setData({
        loginError: message || '登录失败，请稍后重试',
      })
    } finally {
      this.setData({ authLoading: false })
    }
  },
  uploadAvatar(tempFilePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const app = getApp<IAppOption>()
      const token = app.globalData.token

      if (!token) {
        resolve(tempFilePath)
        return
      }

      wx.getFileSystemManager().readFile({
        filePath: tempFilePath,
        encoding: 'base64',
        success: (res) => {
          const avatar = `data:image/png;base64,${res.data as string}`
          wx.request({
            url: `${API_BASE_URL}/api/waimao-mini/users/me/avatar`,
            method: 'POST',
            header: {
              'content-type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            data: { avatar },
            success: (uploadRes) => {
              if (uploadRes.statusCode === 200) {
                const data = uploadRes.data as { avatarUrl: string }
                resolve(`${API_BASE_URL}${data.avatarUrl}`)
              } else {
                reject(new Error('上传失败'))
              }
            },
            fail: reject,
          })
        },
        fail: reject,
      })
    })
  },
  async generateShareImage() {
    const firstChapter = this.data.chapters[0]
    const firstScene = firstChapter?.scenes?.[0]
    const card = buildIndexShareCardModel({
      isAuthenticated: this.data.isAuthenticated,
      userNickname: this.data.userNickname,
      completedCount: this.data.completedCount,
      courseCount: this.data.courseCount,
      streakCount: this.data.streakCount,
      featuredCourseTitle: firstScene ? `${firstChapter.label} ${firstScene.title}` : '外贸英语影子跟读',
    })

    try {
      const shareImageUrl = await renderSharePoster(this, 'index-share-canvas', card, '学习主页')
      this.setData({ shareImageUrl })
    } catch (error) {
      console.warn('[Share] generate index share image failed', error)
    }
  },
})

function normalizeChapters(chapters: ChapterListItem[]) {
  return chapters.map(chapter => ({
    ...chapter,
    scenes: Array.isArray(chapter.scenes) ? chapter.scenes : [],
  }))
}

function normalizeProgress(progress: UserProgress): UserProgress {
  const completedSceneIds = progress.completedSceneIds ?? progress.completedCourseIds ?? []
  return {
    ...progress,
    completedSceneIds,
    completedCourseIds: completedSceneIds,
  }
}

function applyProgressToChapters(
  chapters: ChapterListItem[],
  progress: UserProgress | null,
  fullAccess: boolean,
) {
  const sceneProgress = new Map((progress?.scenes ?? []).map(item => [item.sceneId, item]))
  const completed = new Set(progress?.completedSceneIds ?? progress?.completedCourseIds ?? [])
  const currentSceneId = progress?.currentSceneId ?? null

  return chapters.map(chapter => {
    const locked = !chapter.free && !fullAccess
    const scenes = chapter.scenes.map(scene => {
      const progressItem = sceneProgress.get(scene.id) ?? scene.progress ?? null
      const done = completed.has(scene.id) || Boolean(progressItem?.sceneCompleted)
      return {
        ...scene,
        locked,
        isCurrent: currentSceneId === scene.id,
        status: done ? 'completed' as const : 'pending' as const,
        progress: progressItem,
      }
    })
    return {
      ...chapter,
      locked,
      scenes,
    }
  })
}

function findContinueScene(chapters: ChapterListItem[], sceneId: string | null): ContinueScene | null {
  if (!sceneId) return null
  for (const chapter of chapters) {
    const scene = chapter.scenes.find(item => item.id === sceneId) as (ChapterSceneItem | undefined)
    if (!scene || scene.locked) {
      continue
    }
    return {
      id: scene.id,
      chapterLabel: chapter.label,
      title: scene.title,
      statusText: buildContinueStatusText(scene),
    }
  }
  return null
}

function buildContinueStatusText(scene: ChapterSceneItem) {
  if (scene.status === 'completed') {
    return '已完成，可再次练习'
  }
  const progress = scene.progress
  if (progress && progress.completedCueCount > 0) {
    return `上次学到第 ${Math.max(1, progress.cueIndex + 1)} 句`
  }
  return '上次学到这里'
}

function countScenes(chapters: ChapterListItem[]) {
  return chapters.reduce((sum, chapter) => sum + chapter.scenes.length, 0)
}

function findScene(chapters: ChapterListItem[], id: string) {
  for (const chapter of chapters) {
    const scene = chapter.scenes.find(item => item.id === id)
    if (scene) return scene
  }
  return null
}
