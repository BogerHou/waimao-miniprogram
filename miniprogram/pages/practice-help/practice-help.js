"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const share_1 = require("../../utils/share");
const share_card_1 = require("../../utils/share-card");
const share_poster_1 = require("../../utils/share-poster");
const feature_flags_1 = require("../../config/feature-flags");
const index_1 = require("../../store/index");
Page({
    data: {
        shareImageUrl: '',
        stageSteps: [
            {
                label: '1',
                title: '通听',
                subtitle: '先听完整，弄清场景',
                desc: '从对话开头连续播放，边听边看双语字幕，先理解双方在谈什么。第一遍不要频繁暂停，也不用急着模仿。',
                action: '建议设置：双语 · 1x · 连续播放',
            },
            {
                label: '2',
                title: '精练',
                subtitle: '逐句停下，把难点练顺',
                desc: '点一句听一句，播放结束会停在当前句。听不清就重复或降速，长按单词查词；重要句可以标记，录音后与原声对比。',
                action: '卡住时使用：重复 · 慢速 · 录音对比',
            },
            {
                label: '3',
                title: '跟读',
                subtitle: '回到开头，连续开口',
                desc: '从对话开头紧跟原声连续说完整节。先直接跟读，节奏稳定后再开启留白，让每句后留出同等时间自己复述。',
                action: '完成标准：跟读播完整节；可选留白跟读',
            },
        ],
        practiceTips: [
            {
                title: '听不清，不要硬追',
                desc: '回到精练，点按当前句反复听；必要时切到 0.75x，再回到原速。',
            },
            {
                title: '说不顺，先做一次录音对比',
                desc: '先听原句，再听自己的录音，只改一个最明显的停顿、重音或连读。',
            },
            {
                title: '值得复用的表达，马上留下',
                desc: '长按单词会自动加入生词；标记难句后，可在“复习”Tab 直接回到原句。',
            },
        ],
        checkpoints: [
            {
                title: '能说清这个场景在解决什么',
                desc: '不用逐字翻译，也知道双方的目的、分歧和下一步。',
            },
            {
                title: '关键句离开字幕也能自然说出',
                desc: '把本节最有用的两三句练到不看文字也能开口。',
            },
            {
                title: '能连续跟读完整一节',
                desc: '原速跟读时不频繁停下，说明节奏和表达已经连起来。',
            },
        ],
    },
    async onLoad() {
        const app = getApp();
        try {
            await app.globalData.readyPromise;
        }
        catch (_error) {
            // App config keeps its safe local fallback when refresh fails.
        }
        if (!(0, feature_flags_1.resolveInteractiveFeaturesEnabled)((0, index_1.getState)().appConfig)) {
            wx.switchTab({ url: '/pages/index/index' });
            return;
        }
        (0, share_1.enablePageShareMenu)();
        void this.generateShareImage();
    },
    onShareAppMessage() {
        return (0, share_1.buildAppMessageShare)({
            title: '通听、精练、跟读三步练习法',
            path: '/pages/practice-help/practice-help',
            imageUrl: this.data.shareImageUrl || undefined,
        });
    },
    onShareTimeline() {
        return (0, share_1.buildTimelineShare)({
            title: '通听、精练、跟读三步练习法',
            imageUrl: this.data.shareImageUrl || undefined,
        });
    },
    goToCourses() {
        wx.switchTab({
            url: '/pages/index/index',
        });
    },
    async generateShareImage() {
        try {
            const shareImageUrl = await (0, share_poster_1.renderSharePoster)(this, 'practice-help-share-canvas', (0, share_card_1.buildPracticeHelpShareCardModel)(), '三步练习法');
            this.setData({ shareImageUrl });
        }
        catch (error) {
            console.warn('[Share] generate practice help image failed', error);
        }
    },
});
