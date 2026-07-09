import { API_BASE_URL } from '../../config/env'
import { fetchAppConfig, HomeAdConfig } from '../../utils/api'
import {
  setAppConfig as updateAppConfigInStore,
  subscribe,
} from '../../store/index'
import type { StoreState } from '../../store/index'
import {
  buildAppMessageShare,
  buildTimelineShare,
  enablePageShareMenu,
} from '../../utils/share'

type WebsiteIntroData = {
  adId: string
  navTitle: string
  websiteUrl: string
  bannerUrl: string
  showDetailBanner: boolean
  contentImageUrl: string
  showContentImage: boolean
  eyebrow: string
  title: string
  description: string
  features: HomeAdConfig['features']
  showPromotion: boolean
  showPromotionTop: boolean
  showPromotionPrice: boolean
  promotionBadge: string
  promotionTitle: string
  promotionSubtitle: string
  promotionPrice: string
  promotionPricePrefix: string
  promotionPriceSuffix: string
  promotionOriginalPrice: string
  promotionFeatures: string[]
  promotionNote: string
  trialTitle: string
  trialDescription: string
  ctaText: string
  showContactQr: boolean
  contactQrUrl: string
  contactTitle: string
  contactDescription: string
  contactTip: string
}

Page<WebsiteIntroData, WechatMiniprogram.IAnyObject>({
  storeUnsubscribe: undefined as (() => void) | undefined,
  data: {
    adId: '',
    navTitle: '',
    websiteUrl: '',
    bannerUrl: '',
    showDetailBanner: false,
    contentImageUrl: '',
    showContentImage: false,
    eyebrow: '',
    title: '',
    description: '',
    features: [],
    showPromotion: false,
    showPromotionTop: false,
    showPromotionPrice: false,
    promotionBadge: '',
    promotionTitle: '',
    promotionSubtitle: '',
    promotionPrice: '',
    promotionPricePrefix: '',
    promotionPriceSuffix: '',
    promotionOriginalPrice: '',
    promotionFeatures: [],
    promotionNote: '',
    trialTitle: '',
    trialDescription: '',
    ctaText: '',
    showContactQr: false,
    contactQrUrl: '',
    contactTitle: '',
    contactDescription: '',
    contactTip: '',
  },
  onLoad(query) {
    enablePageShareMenu()
    const adId =
      typeof query?.adId === 'string' ? decodeURIComponent(query.adId) : ''
    this.setData({ adId })
    this.storeUnsubscribe = subscribe((state) =>
      this.applyAdConfig(state, adId),
    )
    void this.refreshAdConfig()
  },
  onUnload() {
    this.storeUnsubscribe?.()
  },
  onShareAppMessage() {
    return buildAppMessageShare({
      title: this.data.title || this.data.navTitle || '推荐一个英语学习工具',
      path: this.data.adId
        ? `/pages/website-intro/website-intro?adId=${encodeURIComponent(this.data.adId)}`
        : '/pages/website-intro/website-intro',
    })
  },
  onShareTimeline() {
    return buildTimelineShare({
      title: this.data.title || this.data.navTitle || '推荐一个英语学习工具',
      query: this.data.adId ? `adId=${encodeURIComponent(this.data.adId)}` : '',
    })
  },
  async refreshAdConfig() {
    try {
      const appConfig = await fetchAppConfig()
      updateAppConfigInStore(appConfig)
    } catch (error) {
      console.warn('[WebsiteIntro] refresh app config failed', error)
    }
  },
  applyAdConfig(state: StoreState, preferredAdId: string) {
    const ad = pickAd(
      state.appConfig.home.ads ?? [],
      preferredAdId || state.appConfig.home.activeAdId || '',
    )
    if (!ad) {
      return
    }
    const promotion = ad.promotion
    const promotionFeatures = promotion?.features ?? []
    const hasPromotionContent = Boolean(
      promotion?.title ||
      promotion?.subtitle ||
      promotion?.price ||
      promotionFeatures.length ||
      promotion?.note,
    )

    this.setData({
      adId: ad.id,
      navTitle: ad.navTitle || '网站试用',
      websiteUrl: ad.targetUrl,
      bannerUrl: resolveAssetUrl(ad.bannerUrl),
      showDetailBanner: Boolean(ad.detailBannerEnabled && ad.bannerUrl),
      contentImageUrl: resolveAssetUrl(ad.contentImageUrl),
      showContentImage: Boolean(ad.contentImageUrl),
      eyebrow: ad.eyebrow,
      title: ad.title,
      description: ad.description,
      features: ad.features,
      showPromotion: Boolean(promotion?.enabled && hasPromotionContent),
      showPromotionTop: Boolean(promotion?.badge || promotion?.originalPrice),
      showPromotionPrice: Boolean(promotion?.price),
      promotionBadge: promotion?.badge ?? '',
      promotionTitle: promotion?.title ?? '',
      promotionSubtitle: promotion?.subtitle ?? '',
      promotionPrice: promotion?.price ?? '',
      promotionPricePrefix: promotion?.pricePrefix ?? '',
      promotionPriceSuffix: promotion?.priceSuffix ?? '',
      promotionOriginalPrice: promotion?.originalPrice ?? '',
      promotionFeatures,
      promotionNote: promotion?.note ?? '',
      trialTitle: ad.trialTitle,
      trialDescription: ad.trialDescription,
      ctaText: ad.ctaText,
      showContactQr: Boolean(ad.contactQrUrl),
      contactQrUrl: resolveAssetUrl(ad.contactQrUrl),
      contactTitle: ad.contactTitle,
      contactDescription: ad.contactDescription,
      contactTip: ad.contactTip,
    })
  },
  copyWebsiteUrl() {
    wx.setClipboardData({
      data: this.data.websiteUrl,
      success() {
        wx.showToast({
          title: '网址已复制',
          icon: 'success',
        })
      },
    })
  },
  previewContactQr() {
    if (!this.data.contactQrUrl) {
      return
    }
    wx.previewImage({
      current: this.data.contactQrUrl,
      urls: [this.data.contactQrUrl],
    })
  },
  previewContentImage() {
    if (!this.data.contentImageUrl) {
      return
    }
    wx.previewImage({
      current: this.data.contentImageUrl,
      urls: [this.data.contentImageUrl],
    })
  },
})

function pickAd(ads: HomeAdConfig[], preferredAdId: string) {
  const enabledAds = Array.isArray(ads) ? ads.filter((ad) => ad.enabled) : []
  return (
    enabledAds.find((ad) => ad.id === preferredAdId) ?? enabledAds[0] ?? null
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
