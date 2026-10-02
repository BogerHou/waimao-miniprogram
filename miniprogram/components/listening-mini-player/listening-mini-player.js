"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const listening_player_1 = require("../../utils/listening-player");
Component({
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
            this.pageVisible = true;
            this.listeningUnsubscribe = (0, listening_player_1.subscribeListening)((state) => this.applyState(state));
        },
        detached() {
            this.listeningUnsubscribe?.();
            this.listeningUnsubscribe = undefined;
        },
    },
    pageLifetimes: {
        show() {
            this.pageVisible = true;
            this.applyState((0, listening_player_1.getListeningState)());
        },
        hide() {
            this.pageVisible = false;
        },
    },
    methods: {
        applyState(state) {
            if (this.pageVisible === false)
                return;
            const next = {
                visible: Boolean(state.active && state.albumId && state.trackId),
                title: state.trackTitle || state.albumTitle,
                albumTitle: state.albumTitle,
                playing: state.playing,
                loading: state.loading,
                status: state.loading ? '加载中' : state.error ? '播放失败，点击重试' : state.playing ? '正在收听' : '已暂停',
            };
            if (next.visible === this.data.visible && next.title === this.data.title &&
                next.albumTitle === this.data.albumTitle && next.playing === this.data.playing &&
                next.loading === this.data.loading && next.status === this.data.status)
                return;
            this.setData(next);
        },
        openListening() {
            wx.switchTab({ url: '/pages/listening/listening' });
        },
        async togglePlayback() {
            try {
                await (0, listening_player_1.toggleListeningPlayback)();
            }
            catch {
                wx.showToast({ title: '暂时无法播放，请重试', icon: 'none' });
            }
        },
        closePlayer() {
            (0, listening_player_1.stopListeningPlayback)();
        },
    },
});
