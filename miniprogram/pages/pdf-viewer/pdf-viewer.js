"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("../../config/env");
const share_1 = require("../../utils/share");
const pdf_image_scan_1 = require("./pdf-image-scan");
Page({
    data: {
        courseId: '',
        courseTitle: '',
        images: [],
        loading: true,
        error: '',
        shareImageUrl: ''
    },
    onLoad(query) {
        (0, share_1.enablePageShareMenu)();
        const title = query.title ? decodeURIComponent(query.title) : '知识点';
        wx.setNavigationBarTitle({ title });
        if (query.courseId) {
            this.setData({
                courseId: query.courseId,
                courseTitle: title
            });
            this.loadImages(query.courseId);
        }
        else {
            this.setData({ loading: false, error: '课程ID未找到' });
        }
    },
    loadImages(courseId) {
        this.setData({ loading: true, error: '' });
        void this.checkImagesExist(courseId);
    },
    async checkImagesExist(courseId) {
        const maxPages = 10;
        const validImages = [];
        for (let i = 1; i <= maxPages; i += 1) {
            const url = `${env_1.API_BASE_URL}/static/pdf-images/${courseId}_${i}.jpg`;
            const statusCode = await this.checkSingleImage(url);
            if (statusCode === 200) {
                validImages.push(url);
            }
            if (!(0, pdf_image_scan_1.shouldContinuePdfImageScan)({ foundCount: validImages.length, statusCode })) {
                break;
            }
        }
        this.setData({
            loading: false,
            images: validImages,
            error: validImages.length === 0 ? '暂无知识点内容' : '',
            shareImageUrl: validImages[0] || '',
        });
    },
    checkSingleImage(url) {
        return new Promise((resolve) => {
            wx.request({
                url,
                method: 'HEAD',
                success: (res) => {
                    resolve(res.statusCode);
                },
                fail: () => {
                    resolve(0);
                },
            });
        });
    },
    // 预览大图
    handlePreview(e) {
        const url = e.currentTarget.dataset.url;
        wx.previewImage({
            current: url,
            urls: this.data.images
        });
    },
    handleRetry() {
        if (this.data.courseId) {
            this.loadImages(this.data.courseId);
        }
    },
    // 图片加载完成
    handleImageLoad(_e) {
        // 可以在这里添加加载完成的动画效果
    },
    // 图片加载失败
    handleImageError(e) {
        console.error('[PDF Image] Load failed:', e.detail.errMsg);
    },
    onShareAppMessage() {
        const encodedTitle = encodeURIComponent(this.data.courseTitle || '知识点');
        return (0, share_1.buildAppMessageShare)({
            title: `${this.data.courseTitle || '知识点'} | 外贸英语影子跟读`,
            path: `/pages/pdf-viewer/pdf-viewer?courseId=${this.data.courseId}&title=${encodedTitle}`,
            imageUrl: this.data.shareImageUrl || this.data.images[0] || undefined,
        });
    },
    onShareTimeline() {
        const encodedTitle = encodeURIComponent(this.data.courseTitle || '知识点');
        return (0, share_1.buildTimelineShare)({
            title: `${this.data.courseTitle || '知识点'} | 外贸英语影子跟读`,
            query: this.data.courseId
                ? `courseId=${this.data.courseId}&title=${encodedTitle}`
                : '',
            imageUrl: this.data.shareImageUrl || this.data.images[0] || undefined,
        });
    }
});
