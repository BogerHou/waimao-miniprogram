Page({
  data: {
    message: '正在打开新版知识点…',
  },

  onLoad(query: { courseId?: string; id?: string; title?: string }) {
    const courseId = String(query.courseId || query.id || '').trim()
    if (!courseId) {
      this.setData({ message: '旧链接缺少课程信息，正在返回课程页…' })
      wx.switchTab({ url: '/pages/index/index' })
      return
    }

    const title = query.title ? decodeURIComponent(query.title) : '知识点'
    wx.redirectTo({
      url: `/pages/knowledge/knowledge?id=${encodeURIComponent(courseId)}&title=${encodeURIComponent(title)}`,
    })
  }
})
