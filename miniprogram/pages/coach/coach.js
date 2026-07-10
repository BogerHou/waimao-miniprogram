"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = require("../../utils/api");
const env_1 = require("../../config/env");
const index_1 = require("../../store/index");
const share_1 = require("../../utils/share");
const coach_model_1 = require("../../utils/coach-model");
const coach_dashboard_1 = require("../../utils/coach-dashboard");
const coach_progress_1 = require("../../utils/coach-progress");
const util_1 = require("../../utils/util");
const DEFAULT_NICKNAME = 'Learner';
const STAGE_LABELS = {
    overview: '了解任务',
    listen: '听懂场景',
    respond: '思考回应',
    practice: '逐句表达',
    shadow: '连续跟读',
    summary: '训练完成',
};
const STAGE_PROGRESS = {
    overview: 0,
    listen: 20,
    respond: 40,
    practice: 60,
    shadow: 80,
    summary: 100,
};
Page({
    storeUnsubscribe: undefined,
    pendingUnlockAfterLogin: false,
    data: {
        activeTab: 'learn',
        greeting: buildGreeting(),
        userNickname: '',
        avatarInitial: '你',
        avatarUrl: '',
        isAuthenticated: false,
        authLoading: false,
        fullAccess: false,
        membershipText: '可学习第一章，其余 6 章需解锁',
        chapters: [],
        expandedChapterId: 'chapter-01',
        learningScene: null,
        plannedScenes: [],
        plannedSceneCount: 0,
        reviewItems: [],
        coachSummary: {
            reviewCount: 0,
            masteredCount: 0,
            completedSceneCount: 0,
            weeklySessionCount: 0,
        },
        loading: true,
        error: '',
        showUnlockPrompt: true,
        showLoginModal: false,
        loginNickname: '',
        loginAvatarUrl: '',
        canLogin: false,
        loginModalTitle: '登录后保存训练记录',
        loginModalDescription: '同步课程进度与会员权益',
        loginError: '',
    },
    async onLoad(options = {}) {
        (0, share_1.enablePageShareMenu)();
        if (options.tab === 'today') {
            this.setData({ activeTab: 'learn' });
        }
        else if (options.tab && ['learn', 'scenes', 'review', 'me'].includes(options.tab)) {
            this.setData({ activeTab: options.tab });
        }
        ;
        this.storeUnsubscribe = (0, index_1.subscribe)(state => this.handleStoreUpdate(state));
        const app = getApp();
        if (app.globalData.readyPromise) {
            try {
                await app.globalData.readyPromise;
            }
            catch (error) {
                console.warn('[Coach] App initialization failed', error);
            }
        }
        this.handleStoreUpdate((0, index_1.getState)());
        await this.loadCourses(true);
    },
    async onShow() {
        this.refreshCoachData();
        if (this.data.chapters.length && !this.data.loading) {
            await this.loadCourses(true);
        }
    },
    onUnload() {
        ;
        this.storeUnsubscribe?.();
    },
    async onPullDownRefresh() {
        try {
            await this.loadCourses(true);
        }
        finally {
            wx.stopPullDownRefresh();
        }
    },
    onShareAppMessage() {
        return (0, share_1.buildAppMessageShare)({
            title: '按你的节奏练外贸真实场景',
            path: '/pages/coach/coach',
        });
    },
    onShareTimeline() {
        return (0, share_1.buildTimelineShare)({ title: '外贸口语实战训练' });
    },
    async loadCourses(forceRefresh = false) {
        if (this.data.loading && this.data.chapters.length)
            return;
        this.setData({ loading: true, error: '' });
        try {
            const state = (0, index_1.getState)();
            const response = await (0, api_1.fetchCourseList)(1, 50, {
                withProgress: Boolean(state.token),
                forceRefresh,
            });
            if (response.progress) {
                (0, index_1.setProgress)(normalizeProgress(response.progress));
            }
            if (response.entitlement) {
                (0, index_1.setEntitlement)(response.entitlement);
            }
            if (response.appConfig) {
                (0, index_1.setAppConfig)(response.appConfig);
            }
            const chapters = applyProgressToChapters(response.data, (0, index_1.getState)().progress, (0, index_1.getState)().fullAccess, (0, coach_progress_1.readCoachProgress)().plannedSceneIds);
            this.setData({ chapters, loading: false });
            this.handleStoreUpdate((0, index_1.getState)(), chapters);
            this.refreshCoachData(chapters);
        }
        catch (error) {
            this.setData({
                loading: false,
                error: error instanceof Error ? error.message : '场景加载失败，请稍后重试',
            });
        }
    },
    handleStoreUpdate(state, chaptersOverride) {
        const chapters = applyProgressToChapters(chaptersOverride ?? this.data.chapters, state.progress, state.fullAccess, (0, coach_progress_1.readCoachProgress)().plannedSceneIds);
        const rawNickname = state.user?.nickname?.trim() || '';
        const isAuthenticated = Boolean(state.token && state.user);
        const displayNickname = rawNickname && rawNickname !== DEFAULT_NICKNAME ? rawNickname : '';
        const avatarInitial = displayNickname ? displayNickname.charAt(0).toUpperCase() : '你';
        this.setData({
            chapters,
            userNickname: displayNickname,
            avatarInitial,
            avatarUrl: isAuthenticated ? state.user?.avatarUrl?.trim() || '' : '',
            isAuthenticated,
            fullAccess: state.fullAccess,
            membershipText: state.fullAccess
                ? (0, util_1.formatEntitlementExpiry)(state.entitlement?.expiresAt)
                : '可学习第一章，其余 6 章需解锁',
            showUnlockPrompt: Boolean(state.appConfig.home.unlockPromptEnabled) && !state.fullAccess,
        });
        this.refreshCoachData(chapters);
    },
    refreshCoachData(chaptersOverride) {
        const chapters = chaptersOverride ?? this.data.chapters;
        const progress = (0, coach_progress_1.readCoachProgress)();
        const coachSummary = (0, coach_progress_1.getCoachSummary)(progress);
        const reviewItems = (0, coach_progress_1.getReviewItems)(progress).slice(0, 30);
        const learningSelection = (0, coach_dashboard_1.selectCoachLearningScene)({
            chapters,
            progress: (0, index_1.getState)().progress,
            sessions: progress.sessions,
            plannedSceneIds: progress.plannedSceneIds,
        });
        const learningScene = learningSelection ? buildLearningScene(learningSelection) : null;
        const plannedScenes = buildPlannedScenes(chapters, progress.plannedSceneIds, progress.sessions);
        const chaptersWithPlan = applyPlanToChapters(chapters, progress.plannedSceneIds);
        this.setData({
            chapters: chaptersWithPlan,
            learningScene,
            plannedScenes,
            plannedSceneCount: plannedScenes.length,
            reviewItems,
            coachSummary,
        });
    },
    handleTabChange(event) {
        const { tab } = event.currentTarget.dataset;
        if (!tab || tab === this.data.activeTab)
            return;
        this.setData({ activeTab: tab });
        if (tab === 'review') {
            this.refreshCoachData();
        }
    },
    openScenesTab() {
        this.setData({ activeTab: 'scenes' });
    },
    openLearnTab() {
        this.setData({ activeTab: 'learn' });
    },
    openReviewTab() {
        this.setData({ activeTab: 'review' });
    },
    toggleChapter(event) {
        const { id } = event.currentTarget.dataset;
        if (!id)
            return;
        this.setData({ expandedChapterId: this.data.expandedChapterId === id ? '' : id });
    },
    goToTraining(event) {
        const dataset = event.currentTarget.dataset;
        const id = dataset.id || dataset.sceneId;
        if (!id)
            return;
        const scene = findScene(this.data.chapters, id);
        if (scene?.locked) {
            this.goToUnlock();
            return;
        }
        const cueQuery = dataset.cueId ? `&reviewCue=${encodeURIComponent(dataset.cueId)}` : '';
        wx.navigateTo({ url: `/pages/training/training?id=${encodeURIComponent(id)}${cueQuery}` });
    },
    toggleScenePlan(event) {
        const { id } = event.currentTarget.dataset;
        if (!id)
            return;
        const scene = findScene(this.data.chapters, id);
        if (!scene)
            return;
        if (scene.locked) {
            void this.goToUnlock();
            return;
        }
        const selected = !scene.inPlan;
        (0, coach_progress_1.updateCoachPlannedScene)(id, selected);
        this.refreshCoachData();
        wx.showToast({ title: selected ? '已加入训练清单' : '已移出训练清单', icon: 'none' });
    },
    removeSceneFromPlan(event) {
        const { id } = event.currentTarget.dataset;
        if (!id)
            return;
        (0, coach_progress_1.updateCoachPlannedScene)(id, false);
        this.refreshCoachData();
    },
    handleRetry() {
        void this.loadCourses(true);
    },
    async goToUnlock() {
        const state = (0, index_1.getState)();
        const nickname = state.user?.nickname?.trim();
        if (!this.data.isAuthenticated || !nickname || nickname === DEFAULT_NICKNAME) {
            ;
            this.pendingUnlockAfterLogin = true;
            this.showLoginDialog(true);
            return;
        }
        wx.navigateTo({ url: '/pages/unlock/unlock' });
    },
    goToPracticeHelp() {
        wx.navigateTo({ url: '/pages/practice-help/practice-help' });
    },
    goToContact() {
        wx.navigateTo({ url: '/pages/contact/contact' });
    },
    goToClassic() {
        wx.navigateTo({ url: '/pages/index/index' });
    },
    handleLoginTap() {
        this.showLoginDialog();
    },
    showLoginDialog(force = false) {
        if (this.data.isAuthenticated && force !== true)
            return;
        const unlocking = Boolean(this.pendingUnlockAfterLogin);
        this.setData({
            showLoginModal: true,
            loginNickname: '',
            loginAvatarUrl: '',
            canLogin: false,
            loginModalTitle: unlocking ? '登录后解锁全部场景' : '登录后保存训练记录',
            loginModalDescription: unlocking
                ? '完成登录后，继续填写会员邀请码'
                : '同步课程进度与会员权益',
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
    onChooseAvatar(event) {
        const avatarUrl = event.detail.avatarUrl;
        this.setData({
            loginAvatarUrl: avatarUrl,
            canLogin: Boolean(avatarUrl && this.data.loginNickname),
            loginError: '',
        });
    },
    onNicknameInput(event) {
        const nickname = event.detail.value.trim();
        this.setData({
            loginNickname: nickname,
            canLogin: Boolean(nickname && this.data.loginAvatarUrl),
            loginError: '',
        });
    },
    onNicknameBlur(event) {
        const nickname = event.detail.value.trim();
        this.setData({
            loginNickname: nickname,
            canLogin: Boolean(nickname && this.data.loginAvatarUrl),
            loginError: '',
        });
    },
    async handleLoginConfirm() {
        if (!this.data.canLogin || this.data.authLoading)
            return;
        const shouldOpenUnlock = Boolean(this.pendingUnlockAfterLogin);
        this.setData({ authLoading: true, loginError: '' });
        try {
            const app = getApp();
            await app.ensureAuth?.({ nickname: this.data.loginNickname, avatarUrl: '' });
            const uploadedAvatarUrl = await this.uploadAvatarIfNeeded(this.data.loginAvatarUrl);
            if (uploadedAvatarUrl) {
                await app.ensureAuth?.({ nickname: this.data.loginNickname, avatarUrl: uploadedAvatarUrl });
            }
            this.setData({
                showLoginModal: false,
                loginNickname: '',
                loginAvatarUrl: '',
                canLogin: false,
            });
            this.pendingUnlockAfterLogin = false;
            await this.loadCourses(true);
            if (shouldOpenUnlock) {
                wx.navigateTo({ url: '/pages/unlock/unlock' });
            }
            else {
                wx.showToast({ title: '登录成功', icon: 'success' });
            }
        }
        catch (error) {
            this.setData({ loginError: error instanceof Error ? error.message : '登录失败，请稍后重试' });
        }
        finally {
            this.setData({ authLoading: false });
        }
    },
    uploadAvatarIfNeeded(tempFilePath) {
        const isTempFile = tempFilePath && (tempFilePath.startsWith('http://tmp/') ||
            tempFilePath.startsWith('wxfile://') ||
            tempFilePath.includes('/tmp/'));
        if (!isTempFile)
            return Promise.resolve('');
        return new Promise((resolve, reject) => {
            const token = getApp().globalData.token;
            if (!token) {
                resolve('');
                return;
            }
            wx.getFileSystemManager().readFile({
                filePath: tempFilePath,
                encoding: 'base64',
                success: result => {
                    wx.request({
                        url: `${env_1.API_BASE_URL}/api/waimao-mini/users/me/avatar`,
                        method: 'POST',
                        header: {
                            'content-type': 'application/json',
                            Authorization: `Bearer ${token}`,
                        },
                        data: { avatar: `data:image/png;base64,${result.data}` },
                        success: uploadResult => {
                            if (uploadResult.statusCode === 200) {
                                const data = uploadResult.data;
                                resolve(`${env_1.API_BASE_URL}${data.avatarUrl}`);
                            }
                            else {
                                reject(new Error('头像上传失败'));
                            }
                        },
                        fail: reject,
                    });
                },
                fail: reject,
            });
        });
    },
});
function normalizeProgress(progress) {
    const completedSceneIds = progress.completedSceneIds ?? progress.completedCourseIds ?? [];
    return { ...progress, completedSceneIds, completedCourseIds: completedSceneIds };
}
function applyProgressToChapters(chapters, progress, fullAccess, plannedSceneIds) {
    const planned = new Set(plannedSceneIds);
    const sceneProgress = new Map((progress?.scenes ?? []).map(item => [item.sceneId, item]));
    const completed = new Set(progress?.completedSceneIds ?? progress?.completedCourseIds ?? []);
    const currentSceneId = progress?.currentSceneId ?? null;
    return (Array.isArray(chapters) ? chapters : []).map(chapter => {
        const locked = !chapter.free && !fullAccess;
        return {
            ...chapter,
            locked,
            scenes: (Array.isArray(chapter.scenes) ? chapter.scenes : []).map(scene => {
                const progressItem = sceneProgress.get(scene.id) ?? scene.progress ?? null;
                const done = completed.has(scene.id) || Boolean(progressItem?.sceneCompleted);
                return {
                    ...scene,
                    locked,
                    inPlan: planned.has(scene.id),
                    isCurrent: currentSceneId === scene.id,
                    status: done ? 'completed' : 'pending',
                    progress: progressItem,
                };
            }),
        };
    });
}
function buildLearningScene(selected) {
    const stage = selected.session?.stage ?? 'overview';
    const isPhraseDrill = selected.scene.id.startsWith('chapter-07-');
    const batchStart = isPhraseDrill ? selected.session?.batchStart ?? 0 : 0;
    const batchNumber = Math.floor(batchStart / 8) + 1;
    return {
        id: selected.scene.id,
        chapterLabel: isPhraseDrill ? `${selected.chapter.label} · 第 ${batchNumber} 组` : selected.chapter.label,
        title: selected.scene.title,
        goal: (0, coach_model_1.resolveBusinessGoal)({ title: selected.scene.title }),
        estimatedMinutes: isPhraseDrill
            ? 10
            : Math.max(6, Math.min(15, Math.ceil(4 + selected.scene.cueCount * 0.45))),
        actionText: selected.source === 'resume'
            ? '继续训练'
            : selected.scene.status === 'completed' || stage === 'summary'
                ? '再练一次'
                : '开始训练',
        sourceLabel: LEARNING_SOURCE_LABELS[selected.source],
        stageLabel: STAGE_LABELS[stage],
        progressPercent: STAGE_PROGRESS[stage],
        hasProgress: selected.source === 'resume' && stage !== 'overview',
    };
}
const LEARNING_SOURCE_LABELS = {
    resume: '继续上次',
    plan: '训练清单',
    current: '接着当前进度',
    recommended: '建议下一步',
    repeat: '再练一个场景',
};
function buildPlannedScenes(chapters, plannedSceneIds, sessions) {
    return plannedSceneIds.reduce((result, sceneId) => {
        const found = findSceneWithChapter(chapters, sceneId);
        if (!found)
            return result;
        const session = sessions.find(item => item.sceneId === sceneId);
        const statusTone = found.scene.locked
            ? 'locked'
            : session && session.stage !== 'summary'
                ? 'active'
                : found.scene.status === 'completed'
                    ? 'completed'
                    : 'pending';
        const statusLabel = statusTone === 'locked'
            ? '需要解锁'
            : statusTone === 'active'
                ? `上次到：${STAGE_LABELS[session?.stage ?? 'overview']}`
                : statusTone === 'completed'
                    ? '已完成，可再练'
                    : '待训练';
        result.push({
            id: sceneId,
            chapterLabel: found.chapter.label,
            title: found.scene.title,
            locked: Boolean(found.scene.locked),
            statusLabel,
            statusTone,
        });
        return result;
    }, []);
}
function applyPlanToChapters(chapters, plannedSceneIds) {
    const planned = new Set(plannedSceneIds);
    return chapters.map(chapter => ({
        ...chapter,
        scenes: chapter.scenes.map(scene => ({ ...scene, inPlan: planned.has(scene.id) })),
    }));
}
function findScene(chapters, id) {
    for (const chapter of chapters) {
        const scene = chapter.scenes.find(item => item.id === id);
        if (scene)
            return scene;
    }
    return null;
}
function findSceneWithChapter(chapters, id) {
    for (const chapter of chapters) {
        const scene = chapter.scenes.find(item => item.id === id);
        if (scene)
            return { chapter, scene };
    }
    return null;
}
function buildGreeting() {
    const hour = new Date().getHours();
    if (hour < 6)
        return '夜深了';
    if (hour < 11)
        return '早上好';
    if (hour < 14)
        return '中午好';
    if (hour < 18)
        return '下午好';
    return '晚上好';
}
