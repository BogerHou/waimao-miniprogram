"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = require("../../utils/api");
const storage_1 = require("../../utils/storage");
const index_1 = require("../../store/index");
const env_1 = require("../../config/env");
const share_1 = require("../../utils/share");
const share_card_1 = require("../../utils/share-card");
const share_poster_1 = require("../../utils/share-poster");
const DEFAULT_NICKNAME = 'Learner';
const DEFAULT_AVATAR_INITIAL = 'L';
const PRACTICE_HELP_GUIDE_SEEN_KEY = 'waimao_practice_help_guide_seen_v1';
Page({
    storeUnsubscribe: undefined,
    courseScrollLastTop: null,
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
        shareImageUrl: '',
        fullAccess: false,
        expandedChapterId: 'chapter-01',
        showUnlockPrompt: true,
        unlockPromptTitle: '全部章节开放 1 年',
        unlockPromptDescription: '添加微信购买邀请码，解锁后 6 章。',
        unlockPromptCta: '去解锁',
        showPracticeHelp: false,
        showPracticeGuide: false,
        scrollWithAnimation: true,
    },
    scheduleShareImage: (0, storage_1.debounce)(function () {
        void this.generateShareImage();
    }, 240),
    async onLoad() {
        (0, share_1.enablePageShareMenu)();
        this.storeUnsubscribe = (0, index_1.subscribe)(state => this.handleStoreUpdate(state));
        await this.initializePage();
        this.maybeShowPracticeGuide();
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
        await this.loadCourses(true);
        this.scheduleShareImage();
    },
    async loadCourses(forceRefresh = false) {
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
                (0, index_1.setFullAccess)(Boolean(response.entitlement.fullAccess));
            }
            const chapters = normalizeChapters(response.data);
            const sceneCount = countScenes(chapters);
            this.setData({
                chapters,
                courseCount: sceneCount,
                loading: false,
            });
            this.handleStoreUpdate((0, index_1.getState)(), sceneCount, chapters);
            this.scheduleShareImage();
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load courses';
            this.setData({
                error: message,
                loading: false,
            });
            wx.showToast({
                title: message,
                icon: 'none',
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
            continueScene,
            isAuthenticated,
            fullAccess: state.fullAccess,
            showUnlockPrompt: Boolean(home.unlockPromptEnabled) && !state.fullAccess,
            unlockPromptTitle: home.unlockPromptTitle || this.data.unlockPromptTitle,
            unlockPromptDescription: home.unlockPromptDescription || this.data.unlockPromptDescription,
            unlockPromptCta: home.unlockPromptCta || this.data.unlockPromptCta,
            showPracticeHelp: Boolean(home.practiceHelpEnabled),
            showPracticeGuide: home.practiceHelpEnabled ? this.data.showPracticeGuide : false,
            shareImageUrl: this.data.shareImageUrl,
        });
        this.scheduleShareImage();
    },
    maybeShowPracticeGuide() {
        if (!(0, index_1.getState)().appConfig.home.practiceHelpEnabled) {
            return;
        }
        if (hasSeenPracticeGuide()) {
            return;
        }
        this.setData({ showPracticeGuide: true });
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
            wx.showToast({
                title: '解锁后可学习后续章节',
                icon: 'none',
                duration: 1800,
            });
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
        markPracticeGuideSeen();
        this.setData({ showPracticeGuide: false });
        wx.navigateTo({
            url: '/pages/practice-help/practice-help',
        });
    },
    startPracticeHelpFromGuide() {
        markPracticeGuideSeen();
        this.setData({ showPracticeGuide: false });
        wx.navigateTo({
            url: '/pages/practice-help/practice-help',
        });
    },
    hidePracticeGuide() {
        markPracticeGuideSeen();
        this.setData({ showPracticeGuide: false });
    },
    handleLoginTap() {
        this.showLoginDialog();
    },
    showLoginDialog(force = false) {
        const forceOpen = force === true;
        if (this.data.isAuthenticated && !forceOpen)
            return;
        this.setData({
            showLoginModal: true,
            loginNickname: '',
            loginAvatarUrl: '',
            canLogin: false,
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
        });
    },
    onChooseAvatar(e) {
        const { avatarUrl } = e.detail;
        this.setData({
            loginAvatarUrl: avatarUrl,
            canLogin: Boolean(avatarUrl && this.data.loginNickname),
        });
    },
    onNicknameInput(e) {
        const nickname = e.detail.value.trim();
        this.setData({
            loginNickname: nickname,
            canLogin: Boolean(nickname && this.data.loginAvatarUrl),
        });
    },
    onNicknameBlur(e) {
        const nickname = e.detail.value.trim();
        this.setData({
            loginNickname: nickname,
            canLogin: Boolean(nickname && this.data.loginAvatarUrl),
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
            });
            this.pendingUnlockAfterLogin = false;
            await this.loadCourses(true);
            wx.showToast({
                title: '登录成功',
                icon: 'success',
            });
            if (shouldOpenUnlock) {
                wx.navigateTo({
                    url: '/pages/unlock/unlock',
                });
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : '登录失败，请稍后重试';
            wx.showToast({
                title: message,
                icon: 'none',
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
            wx.getFileSystemManager().readFile({
                filePath: tempFilePath,
                encoding: 'base64',
                success: (res) => {
                    const avatar = `data:image/png;base64,${res.data}`;
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
            statusText: scene.status === 'completed' ? '上次完成，可复习' : '上次学到这里',
        };
    }
    return null;
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
function hasSeenPracticeGuide() {
    try {
        return Boolean(wx.getStorageSync(PRACTICE_HELP_GUIDE_SEEN_KEY));
    }
    catch (_error) {
        return false;
    }
}
function markPracticeGuideSeen() {
    try {
        wx.setStorageSync(PRACTICE_HELP_GUIDE_SEEN_KEY, true);
    }
    catch (_error) {
        // ignore
    }
}
