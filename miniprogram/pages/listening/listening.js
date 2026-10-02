"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatListeningDuration = formatListeningDuration;
exports.buildListeningAlbumView = buildListeningAlbumView;
exports.listeningModeLabel = listeningModeLabel;
const listening_api_1 = require("../../utils/listening-api");
const listening_player_1 = require("../../utils/listening-player");
const index_1 = require("../../store/index");
const feature_flags_1 = require("../../config/feature-flags");
function formatListeningDuration(seconds, clock = false) {
    const value = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
    if (clock) {
        const hours = Math.floor(value / 3600);
        const minutes = Math.floor(value % 3600 / 60);
        const remainder = String(value % 60).padStart(2, '0');
        return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${remainder}` : `${minutes}:${remainder}`;
    }
    if (value < 60)
        return `${value} 秒`;
    const minutes = Math.round(value / 60);
    return minutes < 60 ? `${minutes} 分钟` : `${Math.floor(minutes / 60)} 小时${minutes % 60 ? ` ${minutes % 60} 分钟` : ''}`;
}
function buildListeningAlbumView(album) {
    return {
        ...album,
        durationLabel: formatListeningDuration(album.duration),
        availableCount: album.tracks.filter(track => !track.locked).length,
        trackItems: album.tracks.map((track, index) => ({
            ...track,
            durationLabel: formatListeningDuration(track.duration),
            numberLabel: String(index + 1).padStart(2, '0'),
        })),
    };
}
function listeningModeLabel(mode) {
    if (mode === 'repeat-all')
        return '列表循环';
    if (mode === 'repeat-one')
        return '单条循环';
    return '顺序播放';
}
Page({
    playerUnsubscribe: undefined,
    storeUnsubscribe: undefined,
    loadGeneration: 0,
    pageDisposed: false,
    pageVisible: true,
    seeking: false,
    timerTicker: undefined,
    data: {
        albums: [],
        visibleAlbums: [],
        categories: [],
        category: '',
        selectedAlbum: null,
        loading: false,
        error: null,
        audioPlaybackEnabled: (0, feature_flags_1.resolveInteractiveFeaturesEnabled)((0, index_1.getState)().appConfig),
        player: (0, listening_player_1.getListeningState)(),
        progressValue: 0,
        positionLabel: '0:00',
        durationLabel: '0:00',
        modeLabel: '顺序播放',
        timerLabel: '定时关闭',
        playerStatus: '',
        queueVisible: false,
        queueItems: [],
        transcriptTitle: '',
        transcriptText: '',
        listenedLabel: '',
    },
    onLoad() {
        this.pageDisposed = false;
        this.playerUnsubscribe = (0, listening_player_1.subscribeListening)((state) => this.applyPlayerState(state));
        this.storeUnsubscribe = (0, index_1.subscribe)((state) => {
            this.setData({ audioPlaybackEnabled: (0, feature_flags_1.resolveInteractiveFeaturesEnabled)(state.appConfig) });
        });
    },
    async onShow() {
        this.pageVisible = true;
        this.applyPlayerState((0, listening_player_1.getListeningState)());
        this.startTimerTicker();
        try {
            await getApp().globalData.readyPromise;
        }
        catch {
            // Catalog access remains available to visitors if account initialization fails.
        }
        if (!this.pageDisposed)
            await this.loadAlbums();
    },
    onHide() {
        this.pageVisible = false;
        this.stopTimerTicker();
    },
    onUnload() {
        this.pageDisposed = true;
        this.loadGeneration += 1;
        this.playerUnsubscribe?.();
        this.storeUnsubscribe?.();
        this.playerUnsubscribe = undefined;
        this.storeUnsubscribe = undefined;
        this.stopTimerTicker();
    },
    async loadAlbums() {
        const generation = ++this.loadGeneration;
        this.setData({ loading: true, error: null });
        try {
            const response = await (0, listening_api_1.fetchListeningAlbums)();
            if (this.pageDisposed || generation !== this.loadGeneration)
                return;
            (0, index_1.setAppConfig)(response.appConfig);
            const albums = response.data.map(buildListeningAlbumView);
            const categories = Array.from(new Set(albums.map(album => album.category).filter(Boolean)));
            const category = categories.includes(this.data.category) ? this.data.category : '';
            const selectedAlbum = albums.find(album => album.id === this.data.selectedAlbum?.id) ?? null;
            this.setData({
                albums,
                categories,
                category,
                visibleAlbums: category ? albums.filter(album => album.category === category) : albums,
                selectedAlbum,
                loading: false,
                audioPlaybackEnabled: (0, feature_flags_1.resolveInteractiveFeaturesEnabled)(response.appConfig),
            });
        }
        catch {
            if (this.pageDisposed || generation !== this.loadGeneration)
                return;
            this.setData({ loading: false, error: '听力内容暂时没有加载成功，请重试' });
        }
    },
    handleRetry() {
        void this.loadAlbums();
    },
    handleCategory(event) {
        const category = String(event.currentTarget.dataset.category ?? '');
        this.setData({
            category,
            visibleAlbums: category ? this.data.albums.filter(album => album.category === category) : this.data.albums,
        });
    },
    handleOpenAlbum(event) {
        const id = String(event.currentTarget.dataset.id ?? '');
        const selectedAlbum = this.data.albums.find(album => album.id === id);
        if (selectedAlbum)
            this.setData({ selectedAlbum, transcriptText: '', transcriptTitle: '', queueVisible: false });
    },
    handleBackToAlbums() {
        this.setData({ selectedAlbum: null, transcriptText: '', transcriptTitle: '' });
    },
    async handleContinueListening() {
        const state = (0, listening_player_1.getListeningState)();
        if (!state.albumId || !this.data.audioPlaybackEnabled)
            return;
        const selectedAlbum = this.data.albums.find(album => album.id === state.albumId) ?? null;
        this.setData({ selectedAlbum, queueVisible: false });
        if (state.active && state.playing)
            return;
        await this.runPlayerAction(() => (0, listening_player_1.playListeningAlbum)(state.albumId, state.trackId ?? undefined, true));
    },
    async handlePlayAlbum() {
        const album = this.data.selectedAlbum;
        if (!album || !this.data.audioPlaybackEnabled)
            return;
        const firstAvailable = album.tracks.find(track => !track.locked);
        if (!firstAvailable) {
            this.showUnlockPrompt();
            return;
        }
        await this.runPlayerAction(() => (0, listening_player_1.playListeningAlbum)(album.id, firstAvailable.id));
    },
    async handlePlayTrack(event) {
        const album = this.data.selectedAlbum;
        const id = String(event.currentTarget.dataset.id ?? '');
        const track = album?.tracks.find(item => item.id === id);
        if (!album || !track || !this.data.audioPlaybackEnabled)
            return;
        if (track.locked) {
            this.showUnlockPrompt();
            return;
        }
        const state = (0, listening_player_1.getListeningState)();
        const action = state.active && state.albumId === album.id && state.trackId === id
            ? () => (0, listening_player_1.toggleListeningPlayback)()
            : () => (0, listening_player_1.playListeningAlbum)(album.id, id);
        await this.runPlayerAction(action);
    },
    showUnlockPrompt() {
        wx.showModal({
            title: '解锁后继续收听',
            content: '这条音频属于会员内容，解锁课程后即可收听。',
            confirmText: '去解锁',
            success: (result) => {
                if (result.confirm)
                    wx.navigateTo({ url: '/pages/unlock/unlock' });
            },
        });
    },
    async handleTogglePlayback() {
        if (this.data.audioPlaybackEnabled)
            await this.runPlayerAction(listening_player_1.toggleListeningPlayback);
    },
    async handlePrevious() {
        if (this.data.audioPlaybackEnabled)
            await this.runPlayerAction(listening_player_1.previousListeningTrack);
    },
    async handleNext() {
        if (this.data.audioPlaybackEnabled)
            await this.runPlayerAction(listening_player_1.nextListeningTrack);
    },
    handleStopPlayback() {
        (0, listening_player_1.stopListeningPlayback)();
        this.setData({ queueVisible: false });
    },
    handleSeekChanging(event) {
        this.seeking = true;
        this.setData({ progressValue: event.detail.value, positionLabel: formatListeningDuration(event.detail.value, true) });
    },
    handleSeek(event) {
        this.seeking = false;
        if (this.data.audioPlaybackEnabled)
            (0, listening_player_1.seekListeningTo)(event.detail.value);
        this.applyPlayerState((0, listening_player_1.getListeningState)());
    },
    handleRepeatMode() {
        const modes = ['sequence', 'repeat-all', 'repeat-one'];
        const nextIndex = (modes.indexOf((0, listening_player_1.getListeningState)().mode) + 1) % modes.length;
        (0, listening_player_1.setListeningRepeatMode)(modes[nextIndex]);
    },
    handleSleepTimer() {
        const values = [15, 30, 60, null];
        wx.showActionSheet({
            itemList: ['15 分钟后关闭', '30 分钟后关闭', '60 分钟后关闭', '关闭定时'],
            success: (result) => {
                const minutes = values[result.tapIndex];
                if (minutes !== undefined) {
                    (0, listening_player_1.setListeningSleepTimer)(minutes);
                    this.applyPlayerState((0, listening_player_1.getListeningState)());
                }
            },
        });
    },
    handleToggleQueue() {
        this.setData({ queueVisible: !this.data.queueVisible });
    },
    async handleQueueTrack(event) {
        const id = String(event.currentTarget.dataset.id ?? '');
        const state = (0, listening_player_1.getListeningState)();
        if (!state.albumId || !this.data.audioPlaybackEnabled || !state.queue.some(track => track.id === id))
            return;
        await this.runPlayerAction(() => (0, listening_player_1.playListeningAlbum)(state.albumId, id));
    },
    handleTranscript(event) {
        const id = String(event.currentTarget.dataset.id ?? '');
        const track = this.data.selectedAlbum?.tracks.find(item => item.id === id);
        if (!track?.transcript || track.locked)
            return;
        this.setData({ transcriptTitle: track.title, transcriptText: track.transcript });
    },
    handleCloseTranscript() {
        this.setData({ transcriptTitle: '', transcriptText: '' });
    },
    applyPlayerState(state) {
        if (this.pageDisposed || !this.pageVisible)
            return;
        const timerMinutes = state.sleepEndsAt ? Math.max(0, Math.ceil((state.sleepEndsAt - Date.now()) / 60000)) : 0;
        this.setData({
            player: state,
            ...(!this.seeking ? {
                progressValue: Math.min(state.position, Math.max(1, state.duration)),
                positionLabel: formatListeningDuration(state.position, true),
            } : {}),
            durationLabel: formatListeningDuration(state.duration, true),
            modeLabel: listeningModeLabel(state.mode),
            timerLabel: timerMinutes ? `${timerMinutes} 分钟后关闭` : '定时关闭',
            playerStatus: state.loading ? '正在加载音频' : state.error || (state.playing ? '正在播放' : '已暂停'),
            queueItems: state.queue.map((track, index) => ({
                ...track,
                durationLabel: formatListeningDuration(track.duration),
                numberLabel: String(index + 1).padStart(2, '0'),
            })),
            listenedLabel: state.listenedSeconds >= 60 ? `本机累计收听 ${formatListeningDuration(state.listenedSeconds)}` : '',
        });
    },
    async runPlayerAction(action) {
        try {
            await action();
            const error = (0, listening_player_1.getListeningState)().error;
            if (error)
                wx.showToast({ title: error.length <= 24 ? error : '暂时无法播放，请重试', icon: 'none' });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : '暂时无法播放，请重试';
            wx.showToast({ title: message.length <= 24 ? message : '暂时无法播放，请重试', icon: 'none' });
        }
    },
    startTimerTicker() {
        this.stopTimerTicker();
        this.timerTicker = setInterval(() => {
            if ((0, listening_player_1.getListeningState)().sleepEndsAt)
                this.applyPlayerState((0, listening_player_1.getListeningState)());
        }, 30000);
    },
    stopTimerTicker() {
        if (this.timerTicker)
            clearInterval(this.timerTicker);
        this.timerTicker = undefined;
    },
});
