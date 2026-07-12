"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = require("../../utils/api");
const storage_1 = require("../../utils/storage");
const index_1 = require("../../store/index");
const env_1 = require("../../config/env");
const share_1 = require("../../utils/share");
const share_card_1 = require("../../utils/share-card");
const share_poster_1 = require("../../utils/share-poster");
const scene_search_1 = require("../../utils/scene-search");
const DEFAULT_NICKNAME = 'Learner';
const DEFAULT_AVATAR_INITIAL = 'L';
Page({
    storeUnsubscribe: undefined,
    courseScrollLastTop: null,
    pendingUnlockAfterLogin: false,
    pageInitialized: false,
    data: {
        userNickname: DEFAULT_NICKNAME,
        avatarInitial: DEFAULT_AVATAR_INITIAL,
        avatarUrl: '',
        streakCount: 0,
        completedCount: 0,
        courseCount: 0,
        chapters: [],
        displayChapters: [],
        searchQuery: '',
        searchResultCount: 0,
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
    scheduleShareImage: (0, storage_1.debounce)(function () {
        void this.generateShareImage();
    }, 240),
    async onLoad() {
        (0, share_1.enablePageShareMenu)();
        this.storeUnsubscribe = (0, index_1.subscribe)(state => this.handleStoreUpdate(state));
        await this.initializePage();
    },
    async onShow() {
        const app = getApp();
        const requestedAction = app.globalData.requestIndexAction;
        if (requestedAction) {
            app.globalData.requestIndexAction = null;
            if (requestedAction === 'unlock') {
                ;
                this.pendingUnlockAfterLogin = true;
            }
            setTimeout(() => this.showLoginDialog(requestedAction === 'unlock'), 0);
        }
        if (!this.pageInitialized || !this.data.chapters.length || this.data.loading)
            return;
        await this.loadCourses(true, true);
    },
    onShareAppMessage() {
        return (0, share_1.buildAppMessageShare)({
            title: '外贸英语影子跟读',
            path: '/pages/index/index',
            imageUrl: this.data.shareImageUrl || undefined,
        });
    },
    onShareTimeline() {
        return (0, share_1.buildTimelineShare)({
            title: '外贸英语影子跟读',
            imageUrl: this.data.shareImageUrl || undefined,
        });
    },
    async onPullDownRefresh() {
        try {
            await this.loadCourses(true);
        }
        finally {
            wx.stopPullDownRefresh();
        }
    },
    onUnload() {
        ;
        this.storeUnsubscribe?.();
    },
    async initializePage() {
        const hasCachedCourses = this.hydrateCachedCourses();
        const app = getApp();
        if (app.globalData.readyPromise) {
            try {
                await app.globalData.readyPromise;
            }
            catch (error) {
                console.warn('readyPromise rejected', error);
            }
        }
        this.handleStoreUpdate((0, index_1.getState)());
        await this.loadCourses(true, hasCachedCourses);
        this.scheduleShareImage();
        this.pageInitialized = true;
    },
    hydrateCachedCourses() {
        const cached = (0, api_1.getCachedCourseList)({ allowStale: true });
        if (!cached) {
            return false;
        }
        this.renderCourseList(cached);
        return true;
    },
    renderCourseList(response) {
        const chapters = normalizeChapters(response.data);
        const sceneCount = countScenes(chapters);
        this.setData({
            chapters,
            courseCount: sceneCount,
        });
        this.handleStoreUpdate((0, index_1.getState)(), sceneCount, chapters);
        this.scheduleShareImage();
    },
    async loadCourses(forceRefresh = false, silent = false) {
        if (this.data.loading)
            return;
        this.setData({
            loading: true,
            error: null,
        });
        try {
            const state = (0, index_1.getState)();
            const response = await (0, api_1.fetchCourseList)(1, 50, { withProgress: Boolean(state.token), forceRefresh });
            if (response.progress) {
                (0, index_1.setProgress)(normalizeProgress(response.progress));
            }
            if (response.appConfig) {
                (0, index_1.setAppConfig)(response.appConfig);
            }
            if (response.entitlement) {
                (0, index_1.setEntitlement)(response.entitlement);
            }
            this.renderCourseList(response);
            this.setData({ loading: false });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : '课程加载失败，请重试';
            if (silent && this.data.chapters.length) {
                console.warn('[Index] Silent course refresh failed', error);
                this.setData({ loading: false });
                return;
            }
            this.setData({
                error: message,
                loading: false,
            });
        }
    },
    handleStoreUpdate(state, courseCountOverride, chaptersOverride) {
        const isAuthenticated = Boolean(state.token && state.user);
        const rawNickname = state.user?.nickname?.trim();
        const nickname = rawNickname || DEFAULT_NICKNAME;
        const initialSource = rawNickname || DEFAULT_AVATAR_INITIAL;
        const avatarInitial = (initialSource.charAt(0) || DEFAULT_AVATAR_INITIAL).toUpperCase();
        const avatarUrl = isAuthenticated ? (state.user?.avatarUrl?.trim() ?? '') : '';
        const chapters = applyProgressToChapters(chaptersOverride ?? this.data.chapters, state.progress, state.fullAccess);
        const displayChapters = (0, scene_search_1.filterChaptersBySceneQuery)(chapters, this.data.searchQuery);
        const sceneCount = courseCountOverride ?? countScenes(chapters);
        const continueScene = isAuthenticated
            ? findContinueScene(chapters, state.progress?.currentSceneId ?? null)
            : null;
        const completedCount = isAuthenticated ? state.progress?.totalCompleted ?? 0 : 0;
        const streakCount = isAuthenticated ? state.progress?.streakCount ?? 0 : 0;
        const home = state.appConfig.home;
        this.setData({
            userNickname: nickname,
            avatarInitial,
            avatarUrl,
            streakCount,
            completedCount,
            courseCount: sceneCount,
            chapters,
            displayChapters,
            searchResultCount: (0, scene_search_1.countChapterScenes)(displayChapters),
            continueScene,
            isAuthenticated,
            fullAccess: state.fullAccess,
            showUnlockPrompt: Boolean(home.unlockPromptEnabled) && !state.fullAccess,
            unlockPromptTitle: home.unlockPromptTitle || this.data.unlockPromptTitle,
            unlockPromptDescription: home.unlockPromptDescription || this.data.unlockPromptDescription,
            unlockPromptCta: home.unlockPromptCta || this.data.unlockPromptCta,
            showPracticeHelp: Boolean(home.practiceHelpEnabled),
            shareImageUrl: this.data.shareImageUrl,
        });
        this.scheduleShareImage();
    },
    handleRetry() {
        void this.loadCourses(true);
    },
    handleSearchInput(event) {
        const searchQuery = event.detail.value;
        const displayChapters = (0, scene_search_1.filterChaptersBySceneQuery)(this.data.chapters, searchQuery);
        this.setData({
            searchQuery,
            displayChapters,
            searchResultCount: (0, scene_search_1.countChapterScenes)(displayChapters),
        });
    },
    handleClearSearch() {
        this.setData({
            searchQuery: '',
            displayChapters: this.data.chapters,
            searchResultCount: (0, scene_search_1.countChapterScenes)(this.data.chapters),
        });
    },
    handleCourseScroll(event) {
        this.courseScrollLastTop = event.detail.scrollTop ?? 0;
    },
    toggleChapter(event) {
        const { id } = event.currentTarget.dataset;
        if (!id)
            return;
        this.setData({
            expandedChapterId: this.data.expandedChapterId === id ? '' : id,
        });
    },
    goToDetail(event) {
        const { id } = event.currentTarget.dataset;
        if (!id)
            return;
        const scene = findScene(this.data.chapters, id);
        if (scene?.locked) {
            this.goToUnlock();
            return;
        }
        wx.navigateTo({
            url: `/pages/course/course?id=${id}`,
        });
    },
    async goToUnlock() {
        const state = (0, index_1.getState)();
        const nickname = state.user?.nickname?.trim();
        const needsProfile = !nickname || nickname === DEFAULT_NICKNAME;
        if (!this.data.isAuthenticated || needsProfile) {
            ;
            this.pendingUnlockAfterLogin = true;
            this.showLoginDialog(true);
            return;
        }
        wx.navigateTo({
            url: '/pages/unlock/unlock',
        });
    },
    goToContact() {
        wx.navigateTo({
            url: '/pages/contact/contact',
        });
    },
    goToPracticeHelp() {
        wx.navigateTo({
            url: '/pages/practice-help/practice-help',
        });
    },
    goToLearning() {
        if (!this.data.isAuthenticated) {
            this.showLoginDialog();
            return;
        }
        wx.switchTab({ url: '/pages/learning/learning' });
    },
    handleLoginTap() {
        this.showLoginDialog();
    },
    showLoginDialog(force = false) {
        const forceOpen = force === true;
        if (this.data.isAuthenticated && !forceOpen)
            return;
        const unlocking = Boolean(this.pendingUnlockAfterLogin);
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
        });
    },
    hideLoginDialog() {
        ;
        this.pendingUnlockAfterLogin = false;
        this.setData({
            showLoginModal: false,
            loginNickname: '',
            loginAvatarUrl: '',
            canLogin: false,
            loginError: '',
        });
    },
    onChooseAvatar(e) {
        const { avatarUrl } = e.detail;
        this.setData({
            loginAvatarUrl: avatarUrl,
            canLogin: Boolean(avatarUrl && this.data.loginNickname),
            loginError: '',
        });
    },
    onNicknameInput(e) {
        const nickname = e.detail.value.trim();
        this.setData({
            loginNickname: nickname,
            canLogin: Boolean(nickname && this.data.loginAvatarUrl),
            loginError: '',
        });
    },
    onNicknameBlur(e) {
        const nickname = e.detail.value.trim();
        this.setData({
            loginNickname: nickname,
            canLogin: Boolean(nickname && this.data.loginAvatarUrl),
            loginError: '',
        });
    },
    async handleLoginConfirm() {
        if (!this.data.canLogin || this.data.authLoading)
            return;
        const { loginNickname, loginAvatarUrl } = this.data;
        const shouldOpenUnlock = Boolean(this.pendingUnlockAfterLogin);
        this.setData({ authLoading: true });
        try {
            const app = getApp();
            if (app && typeof app.ensureAuth === 'function') {
                await app.ensureAuth({
                    nickname: loginNickname,
                    avatarUrl: '',
                });
            }
            else if (app && typeof app.initializeAuth === 'function') {
                await app.initializeAuth(true, {
                    nickname: loginNickname,
                    avatarUrl: '',
                });
            }
            else {
                throw new Error('登录功能未初始化');
            }
            const isTempFile = loginAvatarUrl && (loginAvatarUrl.startsWith('http://tmp/') ||
                loginAvatarUrl.startsWith('wxfile://') ||
                loginAvatarUrl.includes('/tmp/'));
            if (isTempFile) {
                try {
                    const uploadedAvatarUrl = await this.uploadAvatar(loginAvatarUrl);
                    if (app && typeof app.ensureAuth === 'function') {
                        await app.ensureAuth({
                            nickname: loginNickname,
                            avatarUrl: uploadedAvatarUrl,
                        });
                    }
                }
                catch (uploadError) {
                    console.warn('[Login] avatar upload failed', uploadError);
                }
            }
            this.setData({
                showLoginModal: false,
                loginNickname: '',
                loginAvatarUrl: '',
                canLogin: false,
                loginError: '',
            });
            this.pendingUnlockAfterLogin = false;
            await this.loadCourses(true);
            if (shouldOpenUnlock) {
                wx.navigateTo({
                    url: '/pages/unlock/unlock',
                });
            }
            else {
                wx.showToast({
                    title: '登录成功',
                    icon: 'success',
                });
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : '登录失败，请稍后重试';
            this.setData({
                loginError: message || '登录失败，请稍后重试',
            });
        }
        finally {
            this.setData({ authLoading: false });
        }
    },
    uploadAvatar(tempFilePath) {
        return new Promise((resolve, reject) => {
            const app = getApp();
            const token = app.globalData.token;
            if (!token) {
                resolve(tempFilePath);
                return;
            }
            // 上传前压缩，控制体积（头像无需原图，base64 直传对大图尤其敏感）
            const readAndUpload = (filePath) => {
                wx.getFileSystemManager().readFile({
                    filePath,
                    encoding: 'base64',
                    success: (res) => {
                        const avatar = `data:image/jpeg;base64,${res.data}`;
                        wx.request({
                            url: `${env_1.API_BASE_URL}/api/waimao-mini/users/me/avatar`,
                            method: 'POST',
                            header: {
                                'content-type': 'application/json',
                                Authorization: `Bearer ${token}`,
                            },
                            data: { avatar },
                            success: (uploadRes) => {
                                if (uploadRes.statusCode === 200) {
                                    const data = uploadRes.data;
                                    resolve(`${env_1.API_BASE_URL}${data.avatarUrl}`);
                                }
                                else {
                                    reject(new Error('上传失败'));
                                }
                            },
                            fail: reject,
                        });
                    },
                    fail: reject,
                });
            };
            wx.compressImage({
                src: tempFilePath,
                quality: 80,
                compressedWidth: 400,
                success: (res) => readAndUpload(res.tempFilePath),
                // 压缩不支持或失败时退回原图，不阻断登录
                fail: () => readAndUpload(tempFilePath),
            });
        });
    },
    async generateShareImage() {
        const firstChapter = this.data.chapters[0];
        const firstScene = firstChapter?.scenes?.[0];
        const card = (0, share_card_1.buildIndexShareCardModel)({
            isAuthenticated: this.data.isAuthenticated,
            userNickname: this.data.userNickname,
            completedCount: this.data.completedCount,
            courseCount: this.data.courseCount,
            streakCount: this.data.streakCount,
            featuredCourseTitle: firstScene ? `${firstChapter.label} ${firstScene.title}` : '外贸英语影子跟读',
        });
        try {
            const shareImageUrl = await (0, share_poster_1.renderSharePoster)(this, 'index-share-canvas', card, '学习主页');
            this.setData({ shareImageUrl });
        }
        catch (error) {
            console.warn('[Share] generate index share image failed', error);
        }
    },
});
function normalizeChapters(chapters) {
    return chapters.map(chapter => ({
        ...chapter,
        scenes: Array.isArray(chapter.scenes) ? chapter.scenes : [],
    }));
}
function normalizeProgress(progress) {
    const completedSceneIds = progress.completedSceneIds ?? progress.completedCourseIds ?? [];
    return {
        ...progress,
        completedSceneIds,
        completedCourseIds: completedSceneIds,
    };
}
function applyProgressToChapters(chapters, progress, fullAccess) {
    const sceneProgress = new Map((progress?.scenes ?? []).map(item => [item.sceneId, item]));
    const completed = new Set(progress?.completedSceneIds ?? progress?.completedCourseIds ?? []);
    const currentSceneId = progress?.currentSceneId ?? null;
    return chapters.map(chapter => {
        const locked = !chapter.free && !fullAccess;
        const scenes = chapter.scenes.map(scene => {
            const progressItem = sceneProgress.get(scene.id) ?? scene.progress ?? null;
            const done = completed.has(scene.id) || Boolean(progressItem?.sceneCompleted);
            return {
                ...scene,
                locked,
                isCurrent: currentSceneId === scene.id,
                status: done ? 'completed' : 'pending',
                progress: progressItem,
            };
        });
        return {
            ...chapter,
            locked,
            scenes,
        };
    });
}
function findContinueScene(chapters, sceneId) {
    if (!sceneId)
        return null;
    for (const chapter of chapters) {
        const scene = chapter.scenes.find(item => item.id === sceneId);
        if (!scene || scene.locked) {
            continue;
        }
        return {
            id: scene.id,
            chapterLabel: chapter.label,
            title: scene.title,
            statusText: buildContinueStatusText(scene),
        };
    }
    return null;
}
function buildContinueStatusText(scene) {
    if (scene.status === 'completed') {
        return '已完成，可再次练习';
    }
    const progress = scene.progress;
    if (progress && progress.completedCueCount > 0) {
        return `上次学到第 ${Math.max(1, progress.cueIndex + 1)} 句`;
    }
    return '上次学到这里';
}
function countScenes(chapters) {
    return chapters.reduce((sum, chapter) => sum + chapter.scenes.length, 0);
}
function findScene(chapters, id) {
    for (const chapter of chapters) {
        const scene = chapter.scenes.find(item => item.id === id);
        if (scene)
            return scene;
    }
    return null;
}
