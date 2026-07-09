"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("../../config/env");
const share_1 = require("../../utils/share");
const share_card_1 = require("../../utils/share-card");
const share_poster_1 = require("../../utils/share-poster");
Page({
    data: {
        qrCodeUrl: `${env_1.API_BASE_URL}/static/images/community-qr.png`,
        shareImageUrl: ''
    },
    onLoad() {
        (0, share_1.enablePageShareMenu)();
        void this.generateShareImage();
    },
    onShareAppMessage() {
        return (0, share_1.buildAppMessageShare)({
            title: '加入外贸英语学习交流社群',
            path: '/pages/contact/contact',
            imageUrl: this.data.shareImageUrl || undefined,
        });
    },
    onShareTimeline() {
        return (0, share_1.buildTimelineShare)({
            title: '加入外贸英语学习交流社群',
            imageUrl: this.data.shareImageUrl || undefined,
        });
    },
    previewQRCode() {
        wx.previewImage({
            urls: [this.data.qrCodeUrl],
            current: this.data.qrCodeUrl
        });
    },
    async generateShareImage() {
        try {
            const shareImageUrl = await (0, share_poster_1.renderSharePoster)(this, 'contact-share-canvas', (0, share_card_1.buildContactShareCardModel)(), '加入社群');
            this.setData({ shareImageUrl });
        }
        catch (error) {
            console.warn('[Share] generate contact share image failed', error);
        }
    }
});
