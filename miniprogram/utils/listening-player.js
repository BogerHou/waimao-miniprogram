"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getListeningState = getListeningState;
exports.subscribeListening = subscribeListening;
exports.playListeningAlbum = playListeningAlbum;
exports.toggleListeningPlayback = toggleListeningPlayback;
exports.nextListeningTrack = nextListeningTrack;
exports.previousListeningTrack = previousListeningTrack;
exports.seekListeningTo = seekListeningTo;
exports.setListeningRepeatMode = setListeningRepeatMode;
exports.setListeningSleepTimer = setListeningSleepTimer;
exports.stopListeningPlayback = stopListeningPlayback;
exports.persistListeningPlayback = persistListeningPlayback;
exports.reconcileListeningForeground = reconcileListeningForeground;
const feature_flags_1 = require("../config/feature-flags");
const index_1 = require("../store/index");
const audio_focus_1 = require("./audio-focus");
const listening_api_1 = require("./listening-api");
const listening_player_core_1 = require("./listening-player-core");
const metrics_1 = require("./metrics");
let player = null;
function getPlayer() {
    if (player)
        return player;
    player = (0, listening_player_core_1.createListeningPlayer)({
        getManager: () => wx.getBackgroundAudioManager(),
        fetchPlayback: listening_api_1.fetchListeningPlayback,
        canPlay: () => (0, feature_flags_1.resolveInteractiveFeaturesEnabled)((0, index_1.getState)().appConfig),
        claimFocus: () => (0, audio_focus_1.claimAudioFocus)('listening'),
        ownsFocus: () => (0, audio_focus_1.getAudioFocusOwner)() === 'listening',
        releaseFocus: () => (0, audio_focus_1.releaseAudioFocus)('listening'),
        readResume: () => wx.getStorageSync(listening_player_core_1.LISTENING_RESUME_KEY),
        writeResume: value => wx.setStorageSync(listening_player_core_1.LISTENING_RESUME_KEY, value),
        reportTimeout: (track, provider) => {
            (0, metrics_1.reportMetric)('audio_load_timeout', { courseId: track.chapterId || 'listening', provider, timeoutMs: 10000 });
        },
        reportFallback: (track, reason, fromProvider, toProvider) => {
            (0, metrics_1.reportMetric)('audio_fallback', { courseId: track.chapterId || 'listening', reason, fromProvider, toProvider });
        },
    });
    (0, audio_focus_1.subscribeAudioFocus)((next, previous) => {
        if (next !== 'listening' && (previous === 'listening' || player?.getState().loading))
            player?.suspend();
    });
    let permissionKey = '';
    (0, index_1.subscribe)(state => {
        const nextKey = JSON.stringify([state.token, state.user?.id, state.fullAccess,
            state.entitlement?.expiresAt, state.appConfig.interactiveFeaturesEnabled, state.appConfig.allCoursesFree]);
        if (permissionKey && nextKey !== permissionKey) {
            player?.suspend((0, feature_flags_1.resolveInteractiveFeaturesEnabled)(state.appConfig) ? null : '音频功能暂未开放', true);
        }
        permissionKey = nextKey;
    });
    return player;
}
function getListeningState() { return getPlayer().getState(); }
function subscribeListening(listener) {
    return getPlayer().subscribe(listener);
}
function playListeningAlbum(albumId, trackId, resume = false) {
    return getPlayer().playAlbum(albumId, trackId, resume);
}
function toggleListeningPlayback() { return getPlayer().toggle(); }
function nextListeningTrack() { return getPlayer().next(); }
function previousListeningTrack() { return getPlayer().previous(); }
function seekListeningTo(seconds) { getPlayer().seek(seconds); }
function setListeningRepeatMode(mode) { getPlayer().setMode(mode); }
function setListeningSleepTimer(minutes) { getPlayer().setSleep(minutes); }
function stopListeningPlayback() { getPlayer().stop(); }
function persistListeningPlayback() { player?.background(); }
function reconcileListeningForeground() { player?.foreground(); }
