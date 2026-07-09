"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// logs.ts
// const util = require('../../utils/util.js')
const util_1 = require("../../utils/util");
const share_1 = require("../../utils/share");
const share_card_1 = require("../../utils/share-card");
const share_poster_1 = require("../../utils/share-poster");
Component({
    data: {
        logs: [],
        shareImageUrl: '',
    },
    lifetimes: {
        attached() {
            (0, share_1.enablePageShareMenu)();
            this.setData({
                logs: (wx.getStorageSync('logs') || []).map((log) => {
                    return {
                        date: (0, util_1.formatTime)(new Date(log)),
                        timeStamp: log
                    };
                }),
            });
            void this.generateShareImage();
        }
    },
    methods: {
        onShareAppMessage() {
            return (0, share_1.buildAppMessageShare)({
                title: '外贸英语影子跟读启动日志',
                path: '/pages/logs/logs',
                imageUrl: this.data.shareImageUrl || undefined,
            });
        },
        onShareTimeline() {
            return (0, share_1.buildTimelineShare)({
                title: '外贸英语影子跟读启动日志',
                imageUrl: this.data.shareImageUrl || undefined,
            });
        },
        async generateShareImage() {
            try {
                const latestLog = this.data.logs[0]?.date || '';
                const shareImageUrl = await (0, share_poster_1.renderSharePoster)(this, 'logs-share-canvas', (0, share_card_1.buildLogsShareCardModel)({
                    logCount: this.data.logs.length,
                    latestLogDate: latestLog,
                }), '启动日志');
                this.setData({ shareImageUrl });
            }
            catch (error) {
                console.warn('[Share] generate logs share image failed', error);
            }
        },
    }
});
