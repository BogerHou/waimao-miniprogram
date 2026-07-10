type ShareOptions = {
  title: string
  path?: string
  query?: string
  imageUrl?: string
}

const DEFAULT_SHARE_IMAGE = '/assets/images/icon.png'

export function enablePageShareMenu() {
  if (typeof wx.showShareMenu !== 'function') {
    return
  }

  try {
    wx.showShareMenu({
      menus: ['shareAppMessage', 'shareTimeline'],
    })
  } catch (error) {
    console.warn('[Share] showShareMenu failed', error)
  }
}

export function buildAppMessageShare(options: ShareOptions) {
  return {
    title: options.title,
    path: options.path || '/pages/index/index',
    imageUrl: options.imageUrl || DEFAULT_SHARE_IMAGE,
  }
}

export function buildTimelineShare(options: ShareOptions) {
  return {
    title: options.title,
    query: options.query || '',
    imageUrl: options.imageUrl || DEFAULT_SHARE_IMAGE,
  }
}
