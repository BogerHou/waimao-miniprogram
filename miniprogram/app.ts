import {
  fetchAppConfig,
  loginWithCode,
  fetchCurrentUser,
  fetchUserProgress,
  UserProfile,
  UserProgress,
} from './utils/api'
import {
  getToken,
  getCachedUser,
  getCachedProgress,
  clearToken,
  clearUserCache,
} from './utils/storage'
import {
  initializeStore,
  subscribe,
  setAppConfig as updateAppConfigInStore,
  setProgress as updateProgressInStore,
  setToken as updateTokenInStore,
  setUser as updateUserInStore,
  setFullAccess as updateFullAccessInStore,
  getState as getStoreState,
} from './store/index'
import { refreshAppConfig as syncAppConfig } from './utils/app-config-sync'
import {
  BACKGROUND_AUDIO_RESUME_KEY,
  buildCourseNavigationUrl,
  normalizeBackgroundAudioResumeState,
  shouldRestoreBackgroundAudioRoute,
} from './pages/course/shadow-background-handoff'

type Unsubscribe = () => void

type LoginProfilePayload = {
  nickname?: string
  avatarUrl?: string
}

function isDevtoolsUnsupportedAudioOptionError(error: WechatMiniprogram.GeneralCallbackResult) {
  return String(error.errMsg ?? '').includes('开发者工具暂时不支持')
}

function wxLogin(): Promise<string> {
  return new Promise((resolve, reject) => {
    wx.login({
      success(res) {
        if (res.code) {
          resolve(res.code)
        } else {
          reject(new Error('Unable to get login code'))
        }
      },
      fail(error) {
        reject(error)
      },
    })
  })
}

async function resolveLoginProfilePayload(): Promise<LoginProfilePayload | undefined> {
  const state = getStoreState()
  const payload: LoginProfilePayload = {}
  const cachedNickname = state.user?.nickname?.trim()
  const cachedAvatar = state.user?.avatarUrl?.trim()
  if (cachedNickname) {
    payload.nickname = cachedNickname
  }
  if (cachedAvatar) {
    payload.avatarUrl = cachedAvatar
  }

  // 注意：wx.getUserProfile 和 wx.getUserInfo 已废弃
  // 不再自动获取用户信息，需要用户主动通过编辑资料页面填写

  return Object.keys(payload).length ? payload : undefined
}

App<IAppOption>({
  globalData: {
    token: null,
  },
  storeUnsubscribe: undefined as Unsubscribe | undefined,
  async onLaunch() {
    // 注意：AI 能力已迁移到自有后端，不再需要微信云开发环境

    initializeStore({
      token: getToken(),
      user: getCachedUser<UserProfile>() ?? null,
      progress: getCachedProgress<UserProgress>() ?? null,
    })
    this.syncFromStore()
    this.storeUnsubscribe = subscribe(() => {
      this.syncFromStore()
    })

    // 🚀 优化 iOS 音频播放：即使在静音模式下也能播放声音
    if (wx.setInnerAudioOption) {
      wx.setInnerAudioOption({
        obeyMuteSwitch: false,
        speakerOn: true, // 默认开启扬声器
        success: () => console.log('[App] 全局音频配置成功'),
        fail: (err) => {
          if (!isDevtoolsUnsupportedAudioOptionError(err)) {
            console.warn('[App] 全局音频配置失败', err)
          }
        }
      })
    }

    const configPromise = this.refreshAppConfig()

    const state = getStoreState()
    if (state.token) {
      const readyPromise = Promise.all([this.initializeAuth(), configPromise]).then(() => undefined)
      this.globalData.readyPromise = readyPromise
      try {
        await readyPromise
      } catch (error) {
        console.error('Failed to initialize auth', error)
        wx.showToast({
          title: '登录失败，请稍后重试',
          icon: 'none',
        })
      }
    } else {
      this.globalData.readyPromise = configPromise
    }
  },
  onShow() {
    void this.refreshAppConfig()
    this.restoreBackgroundAudioRoute?.()
  },
  async ensureAuth(profileOverride?: LoginProfilePayload) {
    const state = getStoreState()

    // 如果传入了 profileOverride，强制重新初始化以更新用户信息
    if (profileOverride) {
      await this.initializeAuth(true, profileOverride)
      return
    }

    if (!state.token) {
      await this.initializeAuth(true, profileOverride)
      return
    }
    if (!state.user) {
      await this.fetchUserData()
    }
  },
  async refreshProgress() {
    const state = getStoreState()
    if (!state.token) {
      return
    }
    try {
      const progress = await fetchUserProgress()
      updateProgressInStore(progress)
    } catch (error) {
      console.warn('Failed to refresh progress', error)
    }
  },
  async refreshAppConfig() {
    await syncAppConfig(fetchAppConfig, appConfig => {
      updateAppConfigInStore(appConfig)
    })
  },
  restoreBackgroundAudioRoute() {
    let resumeState: unknown = null
    try {
      resumeState = wx.getStorageSync(BACKGROUND_AUDIO_RESUME_KEY)
    } catch (error) {
      console.warn('[App] Failed to read background audio resume state', error)
      return
    }

    const resume = normalizeBackgroundAudioResumeState(resumeState)
    if (!resume) {
      return
    }

    const pages = getCurrentPages()
    const currentPage = pages[pages.length - 1] as
      | { route?: string; options?: { id?: string } }
      | undefined
    const manager = wx.getBackgroundAudioManager?.()
    const shouldRestore = shouldRestoreBackgroundAudioRoute({
      resumeState,
      currentRoute: currentPage?.route,
      currentCourseId: currentPage?.options?.id ?? null,
      managerSrc: manager ? String(manager.src || '') : '',
    })

    if (!shouldRestore) {
      return
    }

    const url = buildCourseNavigationUrl(resume.courseId, {
      fromBackgroundAudio: 1,
    })

    setTimeout(() => {
      const latestPages = getCurrentPages()
      const latestPage = latestPages[latestPages.length - 1] as
        | { route?: string; options?: { id?: string } }
        | undefined
      if (
        latestPage?.route === 'pages/course/course' &&
        latestPage.options?.id === resume.courseId
      ) {
        return
      }

      wx.navigateTo({
        url,
        fail(error) {
          console.warn('[App] Background audio navigateTo failed, trying redirectTo', error)
          wx.redirectTo({ url })
        },
      })
    }, 80)
  },
  async initializeAuth(force = false, profileOverride?: LoginProfilePayload) {
    const state = getStoreState()
    if (!force && state.token) {
      try {
        await this.fetchUserData()
        return
      } catch (error) {
        console.warn('Cached token invalid, relogin required', error)
        clearToken()
        clearUserCache()
        updateTokenInStore(null)
        updateUserInStore(null)
        updateProgressInStore(null)
        updateFullAccessInStore(false)
      }
    }

    const code = await wxLogin()
    const profilePayload = profileOverride ?? (await resolveLoginProfilePayload())
    const loginResult = await loginWithCode(code, profilePayload)
    const mergedUser: UserProfile = {
      ...loginResult.user,
      nickname: profilePayload?.nickname ?? loginResult.user.nickname,
      avatarUrl: profilePayload?.avatarUrl ?? loginResult.user.avatarUrl,
    }
    updateTokenInStore(loginResult.token)
    updateUserInStore(mergedUser)
    updateFullAccessInStore(Boolean(loginResult.fullAccess))

    try {
      const progress = loginResult.progress ?? await fetchUserProgress()
      updateProgressInStore(progress)
    } catch (error) {
      console.warn('Failed to fetch progress', error)
      updateProgressInStore(null)
    }
  },
  async fetchUserData() {
    const state = getStoreState()
    if (!state.token) {
      throw new Error('token missing')
    }
    const profile = await fetchCurrentUser()
    updateUserInStore(profile.user)
    updateFullAccessInStore(Boolean(profile.fullAccess))
    try {
      const progress = profile.progress ?? await fetchUserProgress()
      updateProgressInStore(progress)
    } catch (error) {
      console.warn('Failed to fetch progress', error)
      updateProgressInStore(null)
    }
  },
  syncFromStore() {
    const snapshot = getStoreState()
    this.globalData.token = snapshot.token
    this.globalData.user = snapshot.user ?? undefined
    this.globalData.progress = snapshot.progress ?? undefined
    this.globalData.fullAccess = snapshot.fullAccess
    this.globalData.appConfig = snapshot.appConfig
  },
})
