"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = require("../../utils/api");
const learning_records_1 = require("../../utils/learning-records");
const review_library_1 = require("../../utils/review-library");
const index_1 = require("../../store/index");
Page({
    data: {
        nickname: '', avatarUrl: '', avatarInitial: 'L', streakCount: 0, totalCompleted: 0,
        studyDurationLabel: '0 分钟', totalPracticeCount: 0, activeDays: 0,
        wordCount: 0, cueCount: 0, calendar: [], loading: true, error: '',
    },
    onShow() {
        const state = (0, index_1.getState)();
        if (!state.token || !state.user) {
            wx.showToast({ title: '登录后查看学习记录', icon: 'none' });
            setTimeout(() => wx.redirectTo({ url: '/pages/index/index' }), 500);
            return;
        }
        const library = (0, review_library_1.normalizeReviewLibrary)(wx.getStorageSync(review_library_1.REVIEW_LIBRARY_STORAGE_KEY));
        const nickname = state.user.nickname || 'Learner';
        this.setData({
            nickname,
            avatarUrl: state.user.avatarUrl || '',
            avatarInitial: nickname.charAt(0).toUpperCase() || 'L',
            streakCount: state.progress?.streakCount ?? state.user.streakCount ?? 0,
            totalCompleted: state.progress?.totalCompleted ?? state.user.totalCompleted ?? 0,
            studyDurationLabel: (0, learning_records_1.formatStudyDuration)(state.user.studySeconds ?? 0),
            wordCount: library.words.length,
            cueCount: library.cues.length,
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
    goToReview() {
        wx.navigateTo({ url: '/pages/review/review' });
    },
    handleRetry() {
        void this.loadRecords();
    },
});
