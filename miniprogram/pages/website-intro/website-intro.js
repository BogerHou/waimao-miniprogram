"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("../../config/env");
const api_1 = require("../../utils/api");
const index_1 = require("../../store/index");
const share_1 = require("../../utils/share");
Page({
    storeUnsubscribe: undefined,
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
        (0, share_1.enablePageShareMenu)();
        const adId = typeof query?.adId === 'string' ? decodeURIComponent(query.adId) : '';
        this.setData({ adId });
        this.storeUnsubscribe = (0, index_1.subscribe)((state) => this.applyAdConfig(state, adId));
        void this.refreshAdConfig();
    },
    onUnload() {
        this.storeUnsubscribe?.();
    },
    onShareAppMessage() {
        return (0, share_1.buildAppMessageShare)({
            title: this.data.title || this.data.navTitle || '推荐一个英语学习工具',
            path: this.data.adId
                ? `/pages/website-intro/website-intro?adId=${encodeURIComponent(this.data.adId)}`
                : '/pages/website-intro/website-intro',
        });
    },
    onShareTimeline() {
        return (0, share_1.buildTimelineShare)({
            title: this.data.title || this.data.navTitle || '推荐一个英语学习工具',
            query: this.data.adId ? `adId=${encodeURIComponent(this.data.adId)}` : '',
        });
    },
    async refreshAdConfig() {
        try {
            const appConfig = await (0, api_1.fetchAppConfig)();
            (0, index_1.setAppConfig)(appConfig);
        }
        catch (error) {
            console.warn('[WebsiteIntro] refresh app config failed', error);
        }
    },
    applyAdConfig(state, preferredAdId) {
        const ad = pickAd(state.appConfig.home.ads ?? [], preferredAdId || state.appConfig.home.activeAdId || '');
        if (!ad) {
            return;
        }
        const promotion = ad.promotion;
        const promotionFeatures = promotion?.features ?? [];
        const hasPromotionContent = Boolean(promotion?.title ||
            promotion?.subtitle ||
            promotion?.price ||
            promotionFeatures.length ||
            promotion?.note);
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
        });
    },
    copyWebsiteUrl() {
        wx.setClipboardData({
            data: this.data.websiteUrl,
            success() {
                wx.showToast({
                    title: '网址已复制',
                    icon: 'success',
                });
            },
        });
    },
    previewContactQr() {
        if (!this.data.contactQrUrl) {
            return;
        }
        wx.previewImage({
            current: this.data.contactQrUrl,
            urls: [this.data.contactQrUrl],
        });
    },
    previewContentImage() {
        if (!this.data.contentImageUrl) {
            return;
        }
        wx.previewImage({
            current: this.data.contentImageUrl,
            urls: [this.data.contentImageUrl],
        });
    },
});
function pickAd(ads, preferredAdId) {
    const enabledAds = Array.isArray(ads) ? ads.filter((ad) => ad.enabled) : [];
    return (enabledAds.find((ad) => ad.id === preferredAdId) ?? enabledAds[0] ?? null);
}
function resolveAssetUrl(pathOrUrl) {
    if (!pathOrUrl) {
        return '';
    }
    if (/^https?:\/\//i.test(pathOrUrl)) {
        return pathOrUrl;
    }
    return `${env_1.API_BASE_URL}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
}
