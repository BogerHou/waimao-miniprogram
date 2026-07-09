"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = require("../../utils/api");
const env_1 = require("../../config/env");
const share_1 = require("../../utils/share");
const index_1 = require("../../store/index");
Page({
    storeUnsubscribe: undefined,
    data: {
        code: '',
        submitting: false,
        authLoading: false,
        isAuthenticated: false,
        fullAccess: false,
        contactQrUrl: '',
        contactTitle: index_1.DEFAULT_HOME_AD.contactTitle,
        contactTip: index_1.DEFAULT_HOME_AD.contactTip,
    },
    onLoad() {
        (0, share_1.enablePageShareMenu)();
        this.storeUnsubscribe = (0, index_1.subscribe)(state => this.handleStoreUpdate(state));
        this.handleStoreUpdate((0, index_1.getState)());
        void this.requireLogin();
    },
    onUnload() {
        ;
        this.storeUnsubscribe?.();
    },
    onShareAppMessage() {
        return (0, share_1.buildAppMessageShare)({
            title: '解锁外贸英语影子跟读完整课程',
            path: '/pages/unlock/unlock',
        });
    },
    onShareTimeline() {
        return (0, share_1.buildTimelineShare)({
            title: '解锁外贸英语影子跟读完整课程',
        });
    },
    handleStoreUpdate(state) {
        const ad = pickUnlockAd(state.appConfig.home.ads ?? [], state.appConfig.home.activeAdId || index_1.DEFAULT_HOME_AD.id);
        this.setData({
            isAuthenticated: Boolean(state.token && state.user),
            fullAccess: state.fullAccess,
            contactQrUrl: resolveAssetUrl(ad.contactQrUrl || index_1.DEFAULT_HOME_AD.contactQrUrl),
            contactTitle: ad.contactTitle || index_1.DEFAULT_HOME_AD.contactTitle,
            contactTip: ad.contactTip || index_1.DEFAULT_HOME_AD.contactTip,
        });
    },
    handleCodeInput(event) {
        this.setData({
            code: event.detail.value.trim(),
        });
    },
    async requireLogin() {
        if (this.data.authLoading)
            return;
        const app = getApp();
        try {
            if (app.globalData.readyPromise) {
                await app.globalData.readyPromise;
            }
        }
        catch (error) {
            console.warn('readyPromise rejected before unlock login', error);
        }
        const state = (0, index_1.getState)();
        if (state.token && state.user) {
            this.handleStoreUpdate(state);
            return;
        }
        wx.showToast({
            title: '请先登录后解锁',
            icon: 'none',
        });
        setTimeout(() => {
            const pages = getCurrentPages();
            if (pages.length > 1) {
                wx.navigateBack();
            }
            else {
                wx.redirectTo({ url: '/pages/index/index' });
            }
        }, 700);
    },
    async handleRedeem() {
        if (this.data.submitting || this.data.authLoading || this.data.fullAccess)
            return;
        const code = this.data.code.trim();
        if (!code) {
            wx.showToast({
                title: '请输入邀请码',
                icon: 'none',
            });
            return;
        }
        this.setData({ submitting: true });
        try {
            const state = (0, index_1.getState)();
            if (!state.token || !state.user) {
                throw new Error('请先登录后解锁');
            }
            const response = await (0, api_1.redeemInviteCode)(code);
            if (response.token) {
                (0, index_1.setToken)(response.token);
            }
            if (response.user) {
                (0, index_1.setUser)(response.user);
            }
            if (response.progress) {
                (0, index_1.setProgress)(response.progress);
            }
            (0, index_1.setFullAccess)(Boolean(response.fullAccess));
            wx.showToast({
                title: '已解锁全部章节',
                icon: 'success',
            });
            setTimeout(() => {
                const pages = getCurrentPages();
                if (pages.length > 1) {
                    wx.navigateBack();
                }
                else {
                    wx.redirectTo({ url: '/pages/index/index' });
                }
            }, 700);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : '解锁失败，请稍后重试';
            wx.showToast({
                title: message,
                icon: 'none',
            });
        }
        finally {
            this.setData({ submitting: false });
        }
    },
    previewContactQr() {
        if (!this.data.contactQrUrl) {
            wx.showToast({
                title: '二维码暂未配置',
                icon: 'none',
            });
            return;
        }
        wx.previewImage({
            current: this.data.contactQrUrl,
            urls: [this.data.contactQrUrl],
        });
    },
    goHome() {
        wx.redirectTo({
            url: '/pages/index/index',
        });
    },
});
function pickUnlockAd(ads, preferredAdId) {
    return (ads.find((ad) => ad.id === preferredAdId) ??
        ads[0] ??
        index_1.DEFAULT_HOME_AD);
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
