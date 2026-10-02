import { resolveInteractiveFeaturesEnabled } from '../config/feature-flags'
import { getState, subscribe } from '../store/index'
import { claimAudioFocus, getAudioFocusOwner, releaseAudioFocus, subscribeAudioFocus } from './audio-focus'
import { fetchListeningPlayback } from './listening-api'
import { createListeningPlayer, LISTENING_RESUME_KEY, ListeningAudioManager } from './listening-player-core'
import { reportMetric } from './metrics'

export type { ListeningState, ListeningRepeatMode } from './listening-player-core'

let player: ReturnType<typeof createListeningPlayer> | null = null
function getPlayer() {
  if (player) return player
  player = createListeningPlayer({
    getManager: () => wx.getBackgroundAudioManager() as unknown as ListeningAudioManager,
    fetchPlayback: fetchListeningPlayback,
    canPlay: () => resolveInteractiveFeaturesEnabled(getState().appConfig),
    claimFocus: () => claimAudioFocus('listening'),
    ownsFocus: () => getAudioFocusOwner() === 'listening',
    releaseFocus: () => releaseAudioFocus('listening'),
    readResume: () => wx.getStorageSync(LISTENING_RESUME_KEY),
    writeResume: value => wx.setStorageSync(LISTENING_RESUME_KEY, value),
    reportTimeout: (track, provider) => {
      reportMetric('audio_load_timeout', { courseId: track.chapterId || 'listening', provider, timeoutMs: 10_000 })
    },
    reportFallback: (track, reason, fromProvider, toProvider) => {
      reportMetric('audio_fallback', { courseId: track.chapterId || 'listening', reason, fromProvider, toProvider })
    },
  })
  subscribeAudioFocus((next, previous) => {
    if (next !== 'listening' && (previous === 'listening' || player?.getState().loading)) player?.suspend()
  })
  let permissionKey = ''
  subscribe(state => {
    const nextKey = JSON.stringify([state.token, state.user?.id, state.fullAccess,
      state.entitlement?.expiresAt, state.appConfig.interactiveFeaturesEnabled, state.appConfig.allCoursesFree])
    if (permissionKey && nextKey !== permissionKey) {
      player?.suspend(resolveInteractiveFeaturesEnabled(state.appConfig) ? null : '音频功能暂未开放', true)
    }
    permissionKey = nextKey
  })
  return player
}

export function getListeningState() { return getPlayer().getState() }
export function subscribeListening(listener: Parameters<ReturnType<typeof createListeningPlayer>['subscribe']>[0]) {
  return getPlayer().subscribe(listener)
}
export function playListeningAlbum(albumId: string, trackId?: string, resume = false) {
  return getPlayer().playAlbum(albumId, trackId, resume)
}
export function toggleListeningPlayback() { return getPlayer().toggle() }
export function nextListeningTrack() { return getPlayer().next() }
export function previousListeningTrack() { return getPlayer().previous() }
export function seekListeningTo(seconds: number) { getPlayer().seek(seconds) }
export function setListeningRepeatMode(mode: 'sequence' | 'repeat-all' | 'repeat-one') { getPlayer().setMode(mode) }
export function setListeningSleepTimer(minutes: number | null) { getPlayer().setSleep(minutes) }
export function stopListeningPlayback() { getPlayer().stop() }
export function persistListeningPlayback() { player?.background() }
export function reconcileListeningForeground() { player?.foreground() }
