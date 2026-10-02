import {
  getListeningState,
  subscribeListening,
  toggleListeningPlayback,
  stopListeningPlayback,
} from '../../utils/listening-player'

type ListeningState = ReturnType<typeof getListeningState>
type MiniPlayerData = {
  visible: boolean
  title: string
  albumTitle: string
  playing: boolean
  loading: boolean
  status: string
}
type MiniPlayerMethods = {
  applyState: (state: ListeningState) => void
  openListening: () => void
  togglePlayback: () => Promise<void>
  closePlayer: () => void
}

Component<MiniPlayerData, {}, MiniPlayerMethods, { listeningUnsubscribe?: () => void; pageVisible?: boolean }>({
  data: {
    visible: false,
    title: '',
    albumTitle: '',
    playing: false,
    loading: false,
    status: '',
  },
  lifetimes: {
    attached() {
      this.pageVisible = true
      this.listeningUnsubscribe = subscribeListening((state: ListeningState) => this.applyState(state))
    },
    detached() {
      this.listeningUnsubscribe?.()
      this.listeningUnsubscribe = undefined
    },
  },
  pageLifetimes: {
    show() {
      this.pageVisible = true
      this.applyState(getListeningState())
    },
    hide() {
      this.pageVisible = false
    },
  },
  methods: {
    applyState(state: ListeningState) {
      if (this.pageVisible === false) return
      const next: MiniPlayerData = {
        visible: Boolean(state.active && state.albumId && state.trackId),
        title: state.trackTitle || state.albumTitle,
        albumTitle: state.albumTitle,
        playing: state.playing,
        loading: state.loading,
        status: state.loading ? '加载中' : state.error ? '播放失败，点击重试' : state.playing ? '正在收听' : '已暂停',
      }
      if (next.visible === this.data.visible && next.title === this.data.title &&
          next.albumTitle === this.data.albumTitle && next.playing === this.data.playing &&
          next.loading === this.data.loading && next.status === this.data.status) return
      this.setData(next)
    },
    openListening() {
      wx.switchTab({ url: '/pages/listening/listening' })
    },
    async togglePlayback() {
      try {
        await toggleListeningPlayback()
      } catch {
        wx.showToast({ title: '暂时无法播放，请重试', icon: 'none' })
      }
    },
    closePlayer() {
      stopListeningPlayback()
    },
  },
})
