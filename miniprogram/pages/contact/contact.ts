import { API_BASE_URL } from '../../config/env'
import {
    buildAppMessageShare,
    buildTimelineShare,
    enablePageShareMenu,
} from '../../utils/share'
import { buildContactShareCardModel } from '../../utils/share-card'
import { renderSharePoster } from '../../utils/share-poster'

const COMMUNITY_QR_URL = `${API_BASE_URL}/static/images/waimao-community-qr.jpg`

Page({
    data: {
        qrCodeUrl: COMMUNITY_QR_URL,
        shareImageUrl: ''
    },

    onLoad() {
        enablePageShareMenu();
        void this.generateShareImage()
    },

    onShareAppMessage() {
        return buildAppMessageShare({
            title: '加入外贸英语学习交流社群',
            path: '/pages/contact/contact',
            imageUrl: this.data.shareImageUrl || undefined,
        })
    },

    onShareTimeline() {
        return buildTimelineShare({
            title: '加入外贸英语学习交流社群',
            imageUrl: this.data.shareImageUrl || undefined,
        })
    },

    previewQRCode() {
        wx.previewImage({
            urls: [this.data.qrCodeUrl],
            current: this.data.qrCodeUrl
        })
    },

    async generateShareImage() {
        try {
            const shareImageUrl = await renderSharePoster(
                this,
                'contact-share-canvas',
                buildContactShareCardModel(),
                '加入社群'
            )
            this.setData({ shareImageUrl })
        } catch (error) {
            console.warn('[Share] generate contact share image failed', error)
        }
    }
})
