// logs.ts
// const util = require('../../utils/util.js')
import { formatTime } from '../../utils/util'
import {
  buildAppMessageShare,
  buildTimelineShare,
  enablePageShareMenu,
} from '../../utils/share'
import { buildLogsShareCardModel } from '../../utils/share-card'
import { renderSharePoster } from '../../utils/share-poster'

type LogItem = {
  date: string
  timeStamp: string
}

Component({
  data: {
    logs: [] as LogItem[],
    shareImageUrl: '',
  },
  lifetimes: {
    attached() {
      enablePageShareMenu();
      this.setData({
        logs: (wx.getStorageSync('logs') || []).map((log: string) => {
          return {
            date: formatTime(new Date(log)),
            timeStamp: log
          }
        }),
      })
      void this.generateShareImage()
    }
  },
  methods: {
    onShareAppMessage() {
      return buildAppMessageShare({
        title: '外贸英语影子跟读启动日志',
        path: '/pages/logs/logs',
        imageUrl: this.data.shareImageUrl || undefined,
      })
    },
    onShareTimeline() {
      return buildTimelineShare({
        title: '外贸英语影子跟读启动日志',
        imageUrl: this.data.shareImageUrl || undefined,
      })
    },
    async generateShareImage() {
      try {
        const latestLog = (this.data.logs as LogItem[])[0]?.date || ''
        const shareImageUrl = await renderSharePoster(
          this,
          'logs-share-canvas',
          buildLogsShareCardModel({
            logCount: this.data.logs.length,
            latestLogDate: latestLog,
          }),
          '启动日志'
        )
        this.setData({ shareImageUrl })
      } catch (error) {
        console.warn('[Share] generate logs share image failed', error)
      }
    },
  }
})
