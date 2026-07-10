"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const share_1 = require("../../utils/share");
const share_card_1 = require("../../utils/share-card");
const share_poster_1 = require("../../utils/share-poster");
Page({
    data: {
        shareImageUrl: '',
        echoSteps: [
            {
                label: '1',
                title: '点一句，先听完整',
                desc: '先让耳朵抓住语气、停顿和重音，不急着跟读。',
            },
            {
                label: '2',
                title: '暂停后复述',
                desc: '听完这一句后再开口，尽量模仿原音的节奏和连读。',
            },
            {
                label: '3',
                title: '重复到顺口',
                desc: '卡住的句子用重复功能多练几遍，能自然说出后再往下走。',
            },
        ],
        shadowSteps: [
            {
                label: '1',
                title: '先用逐句跟读熟悉内容',
                desc: '影子跟读前先听懂大意，避免一边猜意思一边追音频。',
            },
            {
                label: '2',
                title: '跟在原声后半拍',
                desc: '不要等整句结束，听到什么就马上跟上，保持连续输出。',
            },
            {
                label: '3',
                title: '从慢速回到原速',
                desc: '如果跟不上，先用 0.75x 练稳定，再切回 1x。',
            },
        ],
        routineSteps: [
            {
                label: 'A',
                title: '第一遍：听懂',
                desc: '看英文和中文，把场景、关键词和表达先弄明白。',
            },
            {
                label: 'B',
                title: '第二遍：逐句跟读',
                desc: '重点练发音、停顿、弱读和连读，遇到长句拆开练。',
            },
            {
                label: 'C',
                title: '第三遍：影子跟读',
                desc: '整段连续跟读，把注意力放在节奏和流畅度上。',
            },
        ],
        checkpoints: [
            {
                title: '不看中文能听懂',
                desc: '切到英文或双语时，能大致跟上对话内容。',
            },
            {
                title: '能跟上 1x 速度',
                desc: '原速播放时不明显掉队，说明节奏已经建立起来。',
            },
            {
                title: '能自然说出关键句',
                desc: '把本课最有用的表达练到不用看字幕也能开口。',
            },
        ],
    },
    onLoad() {
        (0, share_1.enablePageShareMenu)();
        void this.generateShareImage();
    },
    onShareAppMessage() {
        return (0, share_1.buildAppMessageShare)({
            title: '逐句跟读与影子跟读练习指南',
            path: '/pages/practice-help/practice-help',
            imageUrl: this.data.shareImageUrl || undefined,
        });
    },
    onShareTimeline() {
        return (0, share_1.buildTimelineShare)({
            title: '逐句跟读与影子跟读练习指南',
            imageUrl: this.data.shareImageUrl || undefined,
        });
    },
    goToCourses() {
        wx.reLaunch({
            url: '/pages/index/index',
        });
    },
    async generateShareImage() {
        try {
            const shareImageUrl = await (0, share_poster_1.renderSharePoster)(this, 'practice-help-share-canvas', (0, share_card_1.buildPracticeHelpShareCardModel)(), '练习帮助');
            this.setData({ shareImageUrl });
        }
        catch (error) {
            console.warn('[Share] generate practice help image failed', error);
        }
    },
});
