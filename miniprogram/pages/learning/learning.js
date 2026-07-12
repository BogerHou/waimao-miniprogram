"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = require("../../utils/api");
const learning_records_1 = require("../../utils/learning-records");
const index_1 = require("../../store/index");
Page({
    data: {
        isAuthenticated: false, nickname: '', avatarUrl: '', avatarInitial: 'L',
        fullAccess: false, membershipLabel: '登录后查看会员权益', streakCount: 0, totalCompleted: 0,
        studyDurationLabel: '0 分钟', totalPracticeCount: 0, activeDays: 0,
        calendar: [], loading: false, error: '',
    },
    onShow() {
        const state = (0, index_1.getState)();
        if (!state.token || !state.user) {
            this.setData({
                isAuthenticated: false,
                nickname: '',
                avatarUrl: '',
                avatarInitial: 'L',
                fullAccess: false,
                membershipLabel: '登录后查看会员权益',
                streakCount: 0,
                totalCompleted: 0,
                studyDurationLabel: '0 分钟',
                totalPracticeCount: 0,
                activeDays: 0,
                calendar: [],
                loading: false,
                error: '',
            });
            return;
        }
        const nickname = state.user.nickname || 'Learner';
        this.setData({
            isAuthenticated: true,
            nickname,
            avatarUrl: state.user.avatarUrl || '',
            avatarInitial: nickname.charAt(0).toUpperCase() || 'L',
            fullAccess: state.fullAccess,
            membershipLabel: state.fullAccess ? '全部课程已解锁' : '第一章免费，后 6 章待解锁',
            streakCount: state.progress?.streakCount ?? state.user.streakCount ?? 0,
            totalCompleted: state.progress?.totalCompleted ?? state.user.totalCompleted ?? 0,
            studyDurationLabel: (0, learning_records_1.formatStudyDuration)(state.user.studySeconds ?? 0),
        });
        void this.loadRecords();
    },
    async loadRecords() {
        this.setData({ loading: true, error: '' });
        try {
            const response = await (0, api_1.fetchLearningRecords)(28);
            this.setData({
                streakCount: response.summary.streakCount,
                totalCompleted: response.summary.totalCompleted,
                studyDurationLabel: (0, learning_records_1.formatStudyDuration)(response.summary.studySeconds),
                totalPracticeCount: response.summary.totalPracticeCount,
                activeDays: response.summary.activeDays,
                calendar: (0, learning_records_1.buildRecentCalendar)(response.days, { totalDays: 28 }),
                loading: false,
            });
        }
        catch (_error) {
            this.setData({
                loading: false,
                error: '学习记录暂时不可用，请稍后重试',
                calendar: (0, learning_records_1.buildRecentCalendar)([], { totalDays: 28 }),
            });
        }
    },
    goToLogin() {
        const app = getApp();
        app.globalData.requestIndexAction = 'login';
        wx.switchTab({ url: '/pages/index/index' });
    },
    goToUnlock() {
        const state = (0, index_1.getState)();
        const nickname = state.user?.nickname?.trim();
        if (!this.data.isAuthenticated || !nickname || nickname === 'Learner') {
            const app = getApp();
            app.globalData.requestIndexAction = 'unlock';
            wx.switchTab({ url: '/pages/index/index' });
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
    handleRetry() {
        void this.loadRecords();
    },
});
