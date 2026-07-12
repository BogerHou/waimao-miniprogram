"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = require("./utils/api");
const storage_1 = require("./utils/storage");
const index_1 = require("./store/index");
const app_config_sync_1 = require("./utils/app-config-sync");
const auth_session_1 = require("./utils/auth-session");
const metrics_1 = require("./utils/metrics");
const shadow_background_handoff_1 = require("./pages/course/shadow-background-handoff");
function isDevtoolsUnsupportedAudioOptionError(error) {
    return String(error.errMsg ?? '').includes('开发者工具暂时不支持');
}
function wxLogin() {
    return new Promise((resolve, reject) => {
        wx.login({
            success(res) {
                if (res.code) {
                    resolve(res.code);
                }
                else {
                    reject(new Error('Unable to get login code'));
                }
            },
            fail(error) {
                reject(error);
            },
        });
    });
}
async function resolveLoginProfilePayload() {
    const state = (0, index_1.getState)();
    const payload = {};
    const cachedNickname = state.user?.nickname?.trim();
    const cachedAvatar = state.user?.avatarUrl?.trim();
    if (cachedNickname) {
        payload.nickname = cachedNickname;
    }
    if (cachedAvatar) {
        payload.avatarUrl = cachedAvatar;
    }
    // 注意：wx.getUserProfile 和 wx.getUserInfo 已废弃
    // 不再自动获取用户信息，需要用户主动通过编辑资料页面填写
    return Object.keys(payload).length ? payload : undefined;
}
App({
    globalData: {
        token: null,
    },
    storeUnsubscribe: undefined,
    async onLaunch() {
        // 注意：AI 能力已迁移到自有后端，不再需要微信云开发环境
        (0, index_1.initializeStore)({
            token: (0, storage_1.getToken)(),
            user: (0, storage_1.getCachedUser)() ?? null,
            progress: (0, storage_1.getCachedProgress)() ?? null,
        });
        this.syncFromStore();
        this.storeUnsubscribe = (0, index_1.subscribe)(() => {
            this.syncFromStore();
        });
        // 🚀 优化 iOS 音频播放：即使在静音模式下也能播放声音
        if (wx.setInnerAudioOption) {
            wx.setInnerAudioOption({
                obeyMuteSwitch: false,
                speakerOn: true, // 默认开启扬声器
                success: () => console.log('[App] 全局音频配置成功'),
                fail: (err) => {
                    if (!isDevtoolsUnsupportedAudioOptionError(err)) {
                        console.warn('[App] 全局音频配置失败', err);
                    }
                }
            });
        }
        const configPromise = this.refreshAppConfig();
        const state = (0, index_1.getState)();
        if (state.token) {
            const readyPromise = Promise.all([this.initializeAuth(), configPromise]).then(() => undefined);
            this.globalData.readyPromise = readyPromise;
            try {
                await readyPromise;
            }
            catch (error) {
                console.error('Failed to initialize auth', error);
                wx.showToast({
                    title: '登录失败，请稍后重试',
                    icon: 'none',
                });
            }
        }
        else {
            this.globalData.readyPromise = configPromise;
        }
    },
    onShow() {
        void this.refreshAppConfig();
        this.restoreBackgroundAudioRoute?.();
    },
    onHide() {
        (0, metrics_1.flushMetrics)();
    },
    async ensureAuth(profileOverride) {
        const state = (0, index_1.getState)();
        // 如果传入了 profileOverride，强制重新初始化以更新用户信息
        if (profileOverride) {
            await this.initializeAuth(true, profileOverride);
            return;
        }
        if (!state.token) {
            await this.initializeAuth(true, profileOverride);
            return;
        }
        if (!state.user) {
            await this.fetchUserData();
        }
    },
    async refreshProgress() {
        const state = (0, index_1.getState)();
        if (!state.token) {
            return;
        }
        try {
            const progress = await (0, api_1.fetchUserProgress)();
            (0, index_1.setProgress)(progress);
        }
        catch (error) {
            console.warn('Failed to refresh progress', error);
        }
    },
    async refreshAppConfig() {
        await (0, app_config_sync_1.refreshAppConfig)(api_1.fetchAppConfig, appConfig => {
            (0, index_1.setAppConfig)(appConfig);
        });
    },
    restoreBackgroundAudioRoute() {
        let resumeState = null;
        try {
            resumeState = wx.getStorageSync(shadow_background_handoff_1.BACKGROUND_AUDIO_RESUME_KEY);
        }
        catch (error) {
            console.warn('[App] Failed to read background audio resume state', error);
            return;
        }
        const resume = (0, shadow_background_handoff_1.normalizeBackgroundAudioResumeState)(resumeState);
        if (!resume) {
            return;
        }
        const pages = getCurrentPages();
        const currentPage = pages[pages.length - 1];
        const manager = wx.getBackgroundAudioManager?.();
        const shouldRestore = (0, shadow_background_handoff_1.shouldRestoreBackgroundAudioRoute)({
            resumeState,
            currentRoute: currentPage?.route,
            currentCourseId: currentPage?.options?.id ?? null,
            managerSrc: manager ? String(manager.src || '') : '',
        });
        if (!shouldRestore) {
            return;
        }
        const url = (0, shadow_background_handoff_1.buildCourseNavigationUrl)(resume.courseId, {
            fromBackgroundAudio: 1,
        });
        setTimeout(() => {
            const latestPages = getCurrentPages();
            const latestPage = latestPages[latestPages.length - 1];
            if (latestPage?.route === 'pages/course/course' &&
                latestPage.options?.id === resume.courseId) {
                return;
            }
            wx.navigateTo({
                url,
                fail(error) {
                    console.warn('[App] Background audio navigateTo failed, trying redirectTo', error);
                    wx.redirectTo({ url });
                },
            });
        }, 80);
    },
    async initializeAuth(force = false, profileOverride) {
        const state = (0, index_1.getState)();
        if (!force && state.token) {
            try {
                await this.fetchUserData();
                return;
            }
            catch (error) {
                if ((0, auth_session_1.shouldPreserveCachedSessionAfterRefreshFailure)((0, storage_1.getToken)())) {
                    console.warn('Failed to refresh cached session; preserving local auth', error);
                    return;
                }
                console.warn('Cached token invalid, relogin required', error);
                (0, storage_1.clearToken)();
                (0, storage_1.clearUserCache)();
                (0, index_1.setToken)(null);
                (0, index_1.setUser)(null);
                (0, index_1.setProgress)(null);
                (0, index_1.setFullAccess)(false);
            }
        }
        const code = await wxLogin();
        const profilePayload = profileOverride ?? (await resolveLoginProfilePayload());
        const loginResult = await (0, api_1.loginWithCode)(code, profilePayload);
        const mergedUser = {
            ...loginResult.user,
            nickname: profilePayload?.nickname ?? loginResult.user.nickname,
            avatarUrl: profilePayload?.avatarUrl ?? loginResult.user.avatarUrl,
        };
        (0, index_1.setToken)(loginResult.token);
        (0, index_1.setUser)(mergedUser);
        if (loginResult.entitlement) {
            (0, index_1.setEntitlement)(loginResult.entitlement);
        }
        else {
            (0, index_1.setFullAccess)(Boolean(loginResult.fullAccess));
        }
        try {
            const progress = loginResult.progress ?? await (0, api_1.fetchUserProgress)();
            (0, index_1.setProgress)(progress);
        }
        catch (error) {
            console.warn('Failed to fetch progress', error);
            (0, index_1.setProgress)(null);
        }
    },
    async fetchUserData() {
        const state = (0, index_1.getState)();
        if (!state.token) {
            throw new Error('token missing');
        }
        const profile = await (0, api_1.fetchCurrentUser)();
        (0, index_1.setUser)(profile.user);
        if (profile.entitlement) {
            (0, index_1.setEntitlement)(profile.entitlement);
        }
        else {
            (0, index_1.setFullAccess)(Boolean(profile.fullAccess));
        }
        try {
            const progress = profile.progress ?? await (0, api_1.fetchUserProgress)();
            (0, index_1.setProgress)(progress);
        }
        catch (error) {
            console.warn('Failed to fetch progress', error);
            (0, index_1.setProgress)(null);
        }
    },
    syncFromStore() {
        const snapshot = (0, index_1.getState)();
        this.globalData.token = snapshot.token;
        this.globalData.user = snapshot.user ?? undefined;
        this.globalData.progress = snapshot.progress ?? undefined;
        this.globalData.fullAccess = snapshot.fullAccess;
        this.globalData.appConfig = snapshot.appConfig;
    },
});
