import { API_BASE_URL } from '../../config/env'

Page({
  data: {
    nickname: '',
    avatarUrl: '',
    canSave: false,
  },

  onLoad() {
    // 从全局数据获取当前用户信息
    const app = getApp<IAppOption>()
    const user = app.globalData.user

    if (user) {
      this.setData({
        nickname: user.nickname || '',
        avatarUrl: user.avatarUrl || '',
      })
    }
  },

  // 选择头像
  onChooseAvatar(e: WechatMiniprogram.CustomEvent<{ avatarUrl: string }>) {
    const { avatarUrl } = e.detail
    console.log('[ProfileEdit] 选择头像:', avatarUrl)

    this.setData({
      avatarUrl,
      canSave: true,
    })
  },

  // 输入昵称
  onNicknameInput(e: WechatMiniprogram.Input) {
    const nickname = e.detail.value.trim()
    this.setData({
      nickname,
      canSave: nickname.length > 0,
    })
  },

  // 昵称输入完成
  onNicknameBlur(e: WechatMiniprogram.InputBlur) {
    const nickname = e.detail.value.trim()
    console.log('[ProfileEdit] 昵称输入:', nickname)
  },

  // 保存
  async handleSave() {
    if (!this.data.canSave) {
      return
    }

    const { nickname, avatarUrl } = this.data

    if (!nickname || !avatarUrl) {
      wx.showToast({
        title: '请完善信息',
        icon: 'none',
      })
      return
    }

    wx.showLoading({ title: '保存中...' })

    try {
      const app = getApp<IAppOption>()

      // 上传头像到服务器
      let uploadedAvatarUrl = avatarUrl
      if (avatarUrl.startsWith('http://tmp/')) {
        uploadedAvatarUrl = await this.uploadAvatar(avatarUrl)
      }

      // 使用新的头像和昵称重新登录
      await app.ensureAuth({
        nickname,
        avatarUrl: uploadedAvatarUrl,
      })

      wx.hideLoading()

      wx.showToast({
        title: '保存成功',
        icon: 'success',
      })

      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    } catch (error) {
      wx.hideLoading()
      console.error('[ProfileEdit] 保存失败:', error)
      wx.showToast({
        title: '保存失败',
        icon: 'none',
      })
    }
  },

  // 上传头像
  uploadAvatar(tempFilePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const app = getApp<IAppOption>()
      const token = app.globalData.token

      if (!token) {
        reject(new Error('未登录'))
        return
      }

      // 将微信临时文件转为 base64
      wx.getFileSystemManager().readFile({
        filePath: tempFilePath,
        encoding: 'base64',
        success: (res) => {
          const base64 = res.data as string
          // 微信头像都是 PNG 格式
          const avatar = `data:image/png;base64,${base64}`

          // 上传到服务器
          wx.request({
            url: `${API_BASE_URL}/api/waimao-mini/users/me/avatar`,
            method: 'POST',
            header: {
              'content-type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            data: { avatar },
            success: (uploadRes) => {
              if (uploadRes.statusCode === 200) {
                const data = uploadRes.data as { avatarUrl: string }
                // 返回服务器上的完整URL
                const fullUrl = `${API_BASE_URL}${data.avatarUrl}`
                resolve(fullUrl)
              } else {
                reject(new Error('上传失败'))
              }
            },
            fail: (err) => {
              console.error('[uploadAvatar] 上传失败:', err)
              reject(err)
            },
          })
        },
        fail: (err) => {
          console.error('[uploadAvatar] 读取文件失败:', err)
          reject(err)
        },
      })
    })
  },

  // 取消
  handleCancel() {
    wx.navigateBack()
  },
})
