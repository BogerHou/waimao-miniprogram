import type {
  AppConfigResponse,
  AudioSourceProvider,
  EntitlementInfo,
  UserProfile,
  UserProgress,
} from '../utils/api'
import {
  cacheProgress,
  cacheUser,
  clearToken,
  getToken,
  setToken as persistToken,
} from '../utils/storage'

type Listener = (state: StoreState) => void
type NormalizedAudioSourceConfig = NonNullable<AppConfigResponse['courseDetail']['audioSource']>

export type StoreState = {
  token: string | null
  user: UserProfile | null
  progress: UserProgress | null
  fullAccess: boolean
  entitlement: EntitlementInfo | null
  appConfig: AppConfigResponse
}

export const DEFAULT_HOME_AD = {
  id: 'waimao-mini-unlock',
  enabled: false,
  navTitle: '解锁课程',
  bannerUrl: '',
  detailBannerEnabled: false,
  contentImageUrl: '',
  title: '外贸英语影子跟读',
  eyebrow: 'Trade English Shadowing',
  description: '添加微信购买邀请码，解锁后 6 章。',
  features: [],
  promotion: {
    enabled: false,
    badge: '',
    title: '',
    subtitle: '',
    price: '',
    pricePrefix: '',
    priceSuffix: '',
    originalPrice: '',
    features: [],
    note: '',
  },
  trialTitle: '解锁全部课程',
  trialDescription: '后 6 章开放，1 年内不限次学习。',
  targetUrl: '',
  ctaText: '去解锁',
  contactQrUrl: '/static/images/waimao-purchase-wechat-qr.jpg',
  contactTitle: '添加微信获取邀请码',
  contactDescription: '添加后说明购买外贸英语影子跟读会员。',
  contactTip: '点击放大，长按识别二维码',
}

export const DEFAULT_APP_CONFIG: AppConfigResponse = {
  interactiveFeaturesEnabled: false,
  home: {
    bannerEnabled: false,
    practiceHelpEnabled: false,
    unlockPromptEnabled: true,
    unlockPromptTitle: '解锁全部课程',
    unlockPromptDescription: '后 6 章开放，1 年内不限次学习',
    unlockPromptCta: '去解锁',
    activeAdId: DEFAULT_HOME_AD.id,
    ads: [DEFAULT_HOME_AD],
  },
  courseDetail: {
    shadowModeEnabled: true,
    audioSource: {
      priority: ['server'],
      enabled: {
        qiniu: false,
        mirror: false,
        server: true,
      },
    },
  },
}

const AUDIO_SOURCE_PROVIDERS: AudioSourceProvider[] = ['qiniu', 'mirror', 'server']

const state: StoreState = {
  token: null,
  user: null,
  progress: null,
  fullAccess: false,
  entitlement: null,
  appConfig: DEFAULT_APP_CONFIG,
}

const listeners = new Set<Listener>()

export function getState(): StoreState {
  return { ...state }
}

export function setToken(token: string | null, notify = true) {
  state.token = token
  if (!token) {
    clearToken()
  } else {
    persistToken(token)
  }
  if (notify) {
    emit()
  }
}

export function setUser(user: UserProfile | null, notify = true) {
  state.user = user
  if (user) {
    cacheUser(user)
  }
  if (notify) {
    emit()
  }
}

export function setProgress(progress: UserProgress | null, notify = true) {
  state.progress = progress
  if (progress) {
    cacheProgress(progress)
  }
  if (notify) {
    emit()
  }
}

export function setFullAccess(fullAccess: boolean, notify = true) {
  state.fullAccess = fullAccess
  if (!fullAccess) {
    state.entitlement = null
  }
  if (notify) {
    emit()
  }
}

export function setEntitlement(entitlement: EntitlementInfo | null, notify = true) {
  state.entitlement = entitlement
  state.fullAccess = Boolean(entitlement?.fullAccess)
  if (notify) {
    emit()
  }
}

export function setAppConfig(appConfig: AppConfigResponse, notify = true) {
  state.appConfig = {
    interactiveFeaturesEnabled:
      appConfig.interactiveFeaturesEnabled ?? DEFAULT_APP_CONFIG.interactiveFeaturesEnabled,
    home: normalizeHomeConfig(appConfig.home),
    courseDetail: {
      shadowModeEnabled: appConfig.courseDetail?.shadowModeEnabled ?? DEFAULT_APP_CONFIG.courseDetail.shadowModeEnabled,
      audioSource: normalizeAudioSourceConfig(appConfig.courseDetail?.audioSource),
    },
  }
  if (notify) {
    emit()
  }
}

export function subscribe(listener: Listener) {
  listeners.add(listener)
  listener(getState())
  return () => {
    listeners.delete(listener)
  }
}

export function initializeStore(initial?: Partial<StoreState>) {
  state.token = initial?.token ?? getToken()
  state.user = initial?.user ?? null
  state.progress = initial?.progress ?? null
  state.entitlement = initial?.entitlement ?? null
  state.fullAccess = state.entitlement
    ? Boolean(state.entitlement.fullAccess)
    : initial?.fullAccess ?? false
  state.appConfig = initial?.appConfig
      ? {
        interactiveFeaturesEnabled:
          initial.appConfig.interactiveFeaturesEnabled ?? DEFAULT_APP_CONFIG.interactiveFeaturesEnabled,
        home: normalizeHomeConfig(initial.appConfig.home),
        courseDetail: {
          shadowModeEnabled:
            initial.appConfig.courseDetail?.shadowModeEnabled ?? DEFAULT_APP_CONFIG.courseDetail.shadowModeEnabled,
          audioSource: normalizeAudioSourceConfig(initial.appConfig.courseDetail?.audioSource),
        },
      }
    : DEFAULT_APP_CONFIG
  emit()
}

function normalizeAudioSourceConfig(
  input: Partial<NormalizedAudioSourceConfig> | undefined,
): NormalizedAudioSourceConfig {
  const enabledInput =
    input?.enabled && typeof input.enabled === 'object'
      ? input.enabled
      : DEFAULT_APP_CONFIG.courseDetail.audioSource!.enabled
  const enabled = AUDIO_SOURCE_PROVIDERS.reduce((result, provider) => {
    result[provider] =
      typeof enabledInput[provider] === 'boolean'
        ? enabledInput[provider]
        : DEFAULT_APP_CONFIG.courseDetail.audioSource!.enabled[provider]
    return result
  }, {} as Record<AudioSourceProvider, boolean>)
  enabled.server = true

  const configuredPriority = Array.isArray(input?.priority)
    ? uniqueAudioSourceProviders(input.priority)
    : []
  const priorityInput = configuredPriority.length
    ? ensureServerFallback(configuredPriority)
    : DEFAULT_APP_CONFIG.courseDetail.audioSource!.priority
  const priority = priorityInput.filter(provider => enabled[provider])

  return {
    priority: priority.length ? priority : ['server'],
    enabled,
  }
}

function ensureServerFallback(providers: AudioSourceProvider[]): AudioSourceProvider[] {
  if (providers.includes('server')) {
    return providers
  }
  return [...providers, 'server']
}

function uniqueAudioSourceProviders(input: unknown[]): AudioSourceProvider[] {
  const seen = new Set<AudioSourceProvider>()
  return input
    .filter((provider): provider is AudioSourceProvider =>
      AUDIO_SOURCE_PROVIDERS.includes(provider as AudioSourceProvider),
    )
    .filter(provider => {
      if (seen.has(provider)) {
        return false
      }
      seen.add(provider)
      return true
    })
}

function emit() {
  const snapshot = getState()
  listeners.forEach(listener => listener(snapshot))
}

function normalizeHomeConfig(home: Partial<AppConfigResponse['home']> | undefined): AppConfigResponse['home'] {
  const ads = Array.isArray(home?.ads) && home?.ads.length ? home.ads : DEFAULT_APP_CONFIG.home.ads

  return {
    bannerEnabled: home?.bannerEnabled ?? DEFAULT_APP_CONFIG.home.bannerEnabled,
    practiceHelpEnabled: home?.practiceHelpEnabled ?? DEFAULT_APP_CONFIG.home.practiceHelpEnabled,
    unlockPromptEnabled: home?.unlockPromptEnabled ?? DEFAULT_APP_CONFIG.home.unlockPromptEnabled,
    unlockPromptTitle: home?.unlockPromptTitle || DEFAULT_APP_CONFIG.home.unlockPromptTitle,
    unlockPromptDescription: home?.unlockPromptDescription || DEFAULT_APP_CONFIG.home.unlockPromptDescription,
    unlockPromptCta: home?.unlockPromptCta || DEFAULT_APP_CONFIG.home.unlockPromptCta,
    activeAdId: home?.activeAdId || DEFAULT_APP_CONFIG.home.activeAdId,
    ads,
  }
}
