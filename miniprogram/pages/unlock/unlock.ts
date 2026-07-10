import { redeemInviteCode } from '../../utils/api'
import type { HomeAdConfig } from '../../utils/api'
import { API_BASE_URL } from '../../config/env'
import {
  buildAppMessageShare,
  buildTimelineShare,
  enablePageShareMenu,
} from '../../utils/share'
import {
  DEFAULT_HOME_AD,
  getState as getStoreState,
  subscribe,
  setFullAccess as updateFullAccessInStore,
  setEntitlement as updateEntitlementInStore,
  setProgress as updateProgressInStore,
  setToken as updateTokenInStore,
  setUser as updateUserInStore,
  type StoreState,
} from '../../store/index'
import {
  formatEntitlementExpiry,
  formatInviteErrorMessage,
} from '../../utils/util'

type UnlockPageData = {
  code: string
  submitting: boolean
  authLoading: boolean
  isAuthenticated: boolean
  fullAccess: boolean
  contactQrUrl: string
  contactTitle: string
  contactTip: string
  codeError: string
  expiresAtLabel: string
}

Page<UnlockPageData, WechatMiniprogram.IAnyObject>({
  storeUnsubscribe: undefined as (() => void) | undefined,
  data: {
    code: '',
    submitting: false,
    authLoading: false,
    isAuthenticated: false,
    fullAccess: false,
    contactQrUrl: '',
    contactTitle: DEFAULT_HOME_AD.contactTitle,
    contactTip: DEFAULT_HOME_AD.contactTip,
    codeError: '',
    expiresAtLabel: '1 年访问权限已生效',
  },
  onLoad() {
    enablePageShareMenu()
    ;(this as any).storeUnsubscribe = subscribe(state => this.handleStoreUpdate(state))
    this.handleStoreUpdate(getStoreState())
    void this.requireLogin()
  },
  onUnload() {
    ;(this as any).storeUnsubscribe?.()
  },
  onShareAppMessage() {
    return buildAppMessageShare({
      title: '解锁外贸英语影子跟读完整课程',
      path: '/pages/unlock/unlock',
    })
  },
  onShareTimeline() {
    return buildTimelineShare({
      title: '解锁外贸英语影子跟读完整课程',
    })
  },
  handleStoreUpdate(state: StoreState) {
    const ad = pickUnlockAd(
      state.appConfig.home.ads ?? [],
      state.appConfig.home.activeAdId || DEFAULT_HOME_AD.id,
    )
    this.setData({
      isAuthenticated: Boolean(state.token && state.user),
      fullAccess: state.fullAccess,
      contactQrUrl: resolveAssetUrl(ad.contactQrUrl || DEFAULT_HOME_AD.contactQrUrl),
      contactTitle: ad.contactTitle || DEFAULT_HOME_AD.contactTitle,
      contactTip: ad.contactTip || DEFAULT_HOME_AD.contactTip,
      expiresAtLabel: formatEntitlementExpiry(state.entitlement?.expiresAt),
    })
  },
  handleCodeInput(event: WechatMiniprogram.Input) {
    this.setData({
      code: event.detail.value.trim(),
      codeError: '',
    })
  },
  async requireLogin() {
    if (this.data.authLoading) return

    const app = getApp<IAppOption>()
    try {
      if (app.globalData.readyPromise) {
        await app.globalData.readyPromise
      }
    } catch (error) {
      console.warn('readyPromise rejected before unlock login', error)
    }

    const state = getStoreState()
    if (state.token && state.user) {
      this.handleStoreUpdate(state)
      return
    }

    wx.showToast({
      title: '请先在首页完成微信登录',
      icon: 'none',
    })
    setTimeout(() => {
      const pages = getCurrentPages()
      if (pages.length > 1) {
        wx.navigateBack()
      } else {
        wx.redirectTo({ url: '/pages/index/index' })
      }
    }, 700)
  },
  async handleRedeem() {
    if (this.data.submitting || this.data.authLoading || this.data.fullAccess) return

    const code = this.data.code.trim()
    if (!code) {
      this.setData({ codeError: '请输入会员邀请码' })
      return
    }

    this.setData({ submitting: true, codeError: '' })
    try {
      const state = getStoreState()
      if (!state.token || !state.user) {
        throw new Error('请先登录后解锁')
      }
      const response = await redeemInviteCode(code)
      if (response.token) {
        updateTokenInStore(response.token)
      }
      if (response.user) {
        updateUserInStore(response.user)
      }
      if (response.progress) {
        updateProgressInStore(response.progress)
      }
      if (response.entitlement) {
        updateEntitlementInStore(response.entitlement)
      } else {
        updateFullAccessInStore(Boolean(response.fullAccess))
      }
    } catch (error) {
      this.setData({ codeError: formatInviteErrorMessage(error) })
    } finally {
      this.setData({ submitting: false })
    }
  },
  previewContactQr() {
    if (!this.data.contactQrUrl) {
      wx.showToast({
        title: '二维码暂未配置',
        icon: 'none',
      })
      return
    }
    wx.previewImage({
      current: this.data.contactQrUrl,
      urls: [this.data.contactQrUrl],
    })
  },
  goHome() {
    wx.redirectTo({
      url: '/pages/index/index',
    })
  },
})

function pickUnlockAd(ads: HomeAdConfig[], preferredAdId: string) {
  return (
    ads.find((ad) => ad.id === preferredAdId) ??
    ads[0] ??
    DEFAULT_HOME_AD
  )
}

function resolveAssetUrl(pathOrUrl: string) {
  if (!pathOrUrl) {
    return ''
  }
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl
  }
  return `${API_BASE_URL}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`
}
