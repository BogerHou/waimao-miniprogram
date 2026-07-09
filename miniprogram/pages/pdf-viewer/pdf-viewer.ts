import { API_BASE_URL } from '../../config/env'
import {
  buildAppMessageShare,
  buildTimelineShare,
  enablePageShareMenu,
} from '../../utils/share'
import { shouldContinuePdfImageScan } from './pdf-image-scan'

Page({
  data: {
    courseId: '',
    courseTitle: '',
    images: [] as string[],
    loading: true,
    error: '',
    shareImageUrl: ''
  },

  onLoad(query: { courseId: string, title?: string }) {
    enablePageShareMenu();
    const title = query.title ? decodeURIComponent(query.title) : '知识点'
    
    wx.setNavigationBarTitle({ title })
    
    if (query.courseId) {
      this.setData({ 
        courseId: query.courseId,
        courseTitle: title
      })
      this.loadImages(query.courseId)
    } else {
      this.setData({ loading: false, error: '课程ID未找到' })
    }
  },

  loadImages(courseId: string) {
    this.setData({ loading: true, error: '' })

    void this.checkImagesExist(courseId)
  },

  async checkImagesExist(courseId: string) {
    const maxPages = 10
    const validImages: string[] = []

    for (let i = 1; i <= maxPages; i += 1) {
      const url = `${API_BASE_URL}/static/pdf-images/${courseId}_${i}.jpg`
      const statusCode = await this.checkSingleImage(url)
      if (statusCode === 200) {
        validImages.push(url)
      }

      if (!shouldContinuePdfImageScan({ foundCount: validImages.length, statusCode })) {
        break
      }
    }

    this.setData({
      loading: false,
      images: validImages,
      error: validImages.length === 0 ? '暂无知识点内容' : '',
      shareImageUrl: validImages[0] || '',
    })
  },

  checkSingleImage(url: string) {
    return new Promise<number>((resolve) => {
      wx.request({
        url,
        method: 'HEAD',
        success: (res) => {
          resolve(res.statusCode)
        },
        fail: () => {
          resolve(0)
        },
      })
    })
  },

  // 预览大图
  handlePreview(e: WechatMiniprogram.BaseEvent) {
    const url = e.currentTarget.dataset.url as string
    wx.previewImage({
      current: url,
      urls: this.data.images
    })
  },

  handleRetry() {
    if (this.data.courseId) {
      this.loadImages(this.data.courseId)
    }
  },

  // 图片加载完成
  handleImageLoad(_e: WechatMiniprogram.ImageLoad) {
    // 可以在这里添加加载完成的动画效果
  },

  // 图片加载失败
  handleImageError(e: WechatMiniprogram.ImageError) {
    console.error('[PDF Image] Load failed:', e.detail.errMsg)
  },

  onShareAppMessage() {
    const encodedTitle = encodeURIComponent(this.data.courseTitle || '知识点')
    return buildAppMessageShare({
      title: `${this.data.courseTitle || '知识点'} | 外贸英语影子跟读`,
      path: `/pages/pdf-viewer/pdf-viewer?courseId=${this.data.courseId}&title=${encodedTitle}`,
      imageUrl: this.data.shareImageUrl || this.data.images[0] || undefined,
    })
  },

  onShareTimeline() {
    const encodedTitle = encodeURIComponent(this.data.courseTitle || '知识点')
    return buildTimelineShare({
      title: `${this.data.courseTitle || '知识点'} | 外贸英语影子跟读`,
      query: this.data.courseId
        ? `courseId=${this.data.courseId}&title=${encodedTitle}`
        : '',
      imageUrl: this.data.shareImageUrl || this.data.images[0] || undefined,
    })
  }
})
