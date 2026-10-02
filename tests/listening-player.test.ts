import assert from 'node:assert/strict'

import {
  claimAudioFocus,
  getAudioFocusOwner,
  releaseAudioFocus,
  subscribeAudioFocus,
} from '../miniprogram/utils/audio-focus'
import type { ListeningPlaybackResponse, ListeningPlaybackTrack } from '../miniprogram/utils/listening-api'
import { createListeningPlayer, normalizeListeningResume } from '../miniprogram/utils/listening-player-core'
import type { ListeningAudioManager } from '../miniprogram/utils/listening-player-core'

type Timer = ReturnType<typeof setTimeout>
type AudioEvent = 'play' | 'pause' | 'stop' | 'ended' | 'canplay' | 'timeupdate' | 'waiting' | 'next' | 'prev'

class FakeAudioManager implements ListeningAudioManager {
  private source = ''
  private handlers = new Map<AudioEvent, Array<() => void>>()
  private errorHandlers: Array<(error: unknown) => void> = []
  title = ''
  epname = ''
  singer = ''
  coverImgUrl = ''
  startTime = 0
  currentTime = 0
  duration = 120
  paused = true
  playbackRate = 1
  sourceAssignments: string[] = []
  seeks: number[] = []
  playCalls = 0
  pauseCalls = 0
  stopCalls = 0

  get src() { return this.source }
  set src(value: string) {
    this.source = value
    this.sourceAssignments.push(value)
    this.currentTime = this.startTime
    this.paused = false
  }
  play() { this.playCalls++; this.paused = false; this.emit('play') }
  pause() { this.pauseCalls++; this.paused = true; this.emit('pause') }
  stop() { this.stopCalls++; this.paused = true; this.currentTime = 0; this.emit('stop') }
  seek(seconds: number) { this.seeks.push(seconds); this.currentTime = seconds }
  private on(event: AudioEvent, callback: () => void) {
    this.handlers.set(event, [...(this.handlers.get(event) || []), callback])
  }
  emit(event: AudioEvent) { this.handlers.get(event)?.forEach(callback => callback()) }
  ready() { this.emit('canplay'); this.paused = false; this.emit('play') }
  ended() { this.currentTime = this.duration; this.paused = true; this.emit('ended') }
  error() { this.errorHandlers.forEach(callback => callback({ errMsg: 'fake media error' })) }
  onPlay(callback: () => void) { this.on('play', callback) }
  onPause(callback: () => void) { this.on('pause', callback) }
  onStop(callback: () => void) { this.on('stop', callback) }
  onEnded(callback: () => void) { this.on('ended', callback) }
  onCanplay(callback: () => void) { this.on('canplay', callback) }
  onTimeUpdate(callback: () => void) { this.on('timeupdate', callback) }
  onWaiting(callback: () => void) { this.on('waiting', callback) }
  onNext(callback: () => void) { this.on('next', callback) }
  onPrev(callback: () => void) { this.on('prev', callback) }
  onError(callback: (error: unknown) => void) { this.errorHandlers.push(callback) }
}

function createClock() {
  let time = 1_000_000
  let nextId = 1
  const timers = new Map<number, { at: number; callback: () => void }>()
  return {
    now: () => time,
    setTimer(callback: () => void, milliseconds: number): Timer {
      const id = nextId++
      timers.set(id, { at: time + milliseconds, callback })
      return id as unknown as Timer
    },
    clearTimer(timer: Timer) { timers.delete(timer as unknown as number) },
    pendingCount: () => timers.size,
    jump(milliseconds: number) { time += milliseconds },
    advance(milliseconds: number) {
      const target = time + milliseconds
      while (true) {
        const next = [...timers.entries()].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0]
        if (!next) break
        timers.delete(next[0])
        time = next[1].at
        next[1].callback()
      }
      time = target
    },
  }
}

function playback(albumId: string, expiresAt: number, token = 'first'): ListeningPlaybackResponse {
  return {
    album: { id: albumId, title: `Album ${albumId}`, coverUrl: 'https://example.test/cover.jpg' },
    tracks: ['one', 'two', 'three'].map((id, index) => ({
      id: `${albumId}-${id}`,
      title: `Track ${index + 1}`,
      duration: 120,
      chapterId: `chapter-0${index + 1}`,
      audioSources: [
        { provider: 'qiniu' as const, url: `https://cdn.example.test/${albumId}-${id}.mp3?token=${token}` },
        { provider: 'server' as const, url: `https://api.example.test/${albumId}-${id}.mp3?token=${token}` },
      ],
    })),
    expiresAt,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function harness(initialResume: unknown = null, sharedFocus = false) {
  const clock = createClock()
  const manager = new FakeAudioManager()
  const writes: ReturnType<typeof normalizeListeningResume>[] = []
  const fetched: string[] = []
  const fallbacks: Array<{ trackId: string; reason: string; from: string; to: string }> = []
  let allowed = true
  let focus = false
  let managerRequests = 0
  let released = 0
  let fetcher = (albumId: string): Promise<ListeningPlaybackResponse> => Promise.resolve(playback(albumId, clock.now() + 600_000))
  const player = createListeningPlayer({
    getManager() { managerRequests++; return manager },
    fetchPlayback(albumId) { fetched.push(albumId); return fetcher(albumId) },
    canPlay: () => allowed,
    claimFocus() { if (sharedFocus) claimAudioFocus('listening'); else focus = true },
    ownsFocus: () => sharedFocus ? getAudioFocusOwner() === 'listening' : focus,
    releaseFocus() { if (sharedFocus) releaseAudioFocus('listening'); else focus = false; released++ },
    readResume: () => initialResume,
    writeResume(value) { writes.push(JSON.parse(JSON.stringify(value)) as ReturnType<typeof normalizeListeningResume>) },
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    reportFallback(track: ListeningPlaybackTrack, reason, from, to) { fallbacks.push({ trackId: track.id, reason, from, to }) },
  })
  return {
    player, clock, manager, writes, fetched, fallbacks,
    setAllowed(value: boolean) { allowed = value },
    setFocus(value: boolean) { focus = value },
    setFetcher(value: typeof fetcher) { fetcher = value },
    managerRequests: () => managerRequests,
    releases: () => released,
  }
}

async function testQueueAndRepeat() {
  const h = harness()
  await h.player.playAlbum('course')
  h.manager.ready()
  assert.equal(h.player.getState().trackId, 'course-one')
  assert.equal(h.player.getState().playing, true)
  h.manager.ended()
  assert.equal(h.player.getState().trackId, 'course-two', 'ending a track starts the next one')
  h.manager.ready()
  h.player.setMode('repeat-one')
  h.manager.ended()
  assert.equal(h.player.getState().trackId, 'course-two', 'single repeat returns to the same track')
  assert.equal(h.player.getState().position, 0)
  h.manager.ready()
  await h.player.next()
  assert.equal(h.player.getState().trackId, 'course-three', 'manual next still advances during single repeat')
  h.manager.ready()
  h.player.setMode('repeat-all')
  h.manager.ended()
  assert.equal(h.player.getState().trackId, 'course-one', 'album repeat wraps at the last track')
  h.manager.ready()
  await h.player.previous()
  assert.equal(h.player.getState().trackId, 'course-three', 'previous wraps from the first track in album repeat')
  h.manager.ready()
  h.player.seek(20)
  await h.player.previous()
  assert.equal(h.player.getState().trackId, 'course-three', 'previous restarts the current track after its first seconds')
  assert.equal(h.player.getState().position, 0)
  h.manager.ready()
  h.player.setMode('sequence')
  h.manager.ended()
  assert.equal(h.player.getState().playing, false)
  assert.equal(h.player.getState().position, 120)
  h.player.stop()

  const last = harness()
  await last.player.playAlbum('course', 'course-three')
  last.manager.ready()
  await last.player.next()
  assert.equal(last.player.getState().playing, false)
  assert.equal(last.manager.paused, true, 'next at the end must not leave native audio playing behind a stopped UI')
  last.player.stop()
}

async function testResumeAndListeningTime() {
  const h = harness()
  await h.player.playAlbum('course', 'course-two')
  h.manager.ready()
  h.clock.advance(3000)
  h.manager.currentTime = 3
  h.manager.emit('timeupdate')
  assert.equal(h.player.getState().listenedSeconds, 3)
  h.player.seek(80)
  assert.equal(h.player.getState().listenedSeconds, 3, 'seeking forward is not listening time')
  h.clock.advance(4000)
  h.manager.currentTime = 84
  h.manager.emit('timeupdate')
  assert.equal(h.player.getState().listenedSeconds, 7)
  h.player.background()
  const stored = h.writes[h.writes.length - 1]
  assert.equal(stored.entries[0].position, 84)
  assert.equal(stored.entries[0].trackId, 'course-two')
  assert.equal(JSON.stringify(stored).includes('token='), false, 'signed audio URLs must not enter resume storage')
  assert.equal(JSON.stringify(stored).includes('audioSources'), false)

  const restored = harness(stored)
  assert.equal(restored.player.getState().active, false, 'resume metadata must not auto-play on construction')
  assert.equal(restored.managerRequests(), 0)
  await restored.player.toggle()
  assert.equal(restored.manager.startTime, 84)
  assert.equal(restored.player.getState().trackId, 'course-two')
  restored.manager.ready()
  assert.equal(restored.player.getState().listenedSeconds, 7)
  restored.player.stop()
  h.player.stop()

  const unsafe = normalizeListeningResume({
    entries: [{ albumId: 'course', trackId: 'course-one', position: Number.NaN, duration: -1, audioSrc: 'https://example.test/?token=secret' }],
    mode: 'invalid', listenedSeconds: Number.POSITIVE_INFINITY,
  })
  assert.equal(unsafe.entries[0].position, 0)
  assert.equal(unsafe.entries[0].duration, 0)
  assert.equal(unsafe.listenedSeconds, 0)
  assert.equal(JSON.stringify(unsafe).includes('secret'), false)
}

async function testFetchRacesAndCancellation() {
  const h = harness()
  const first = deferred<ListeningPlaybackResponse>()
  const second = deferred<ListeningPlaybackResponse>()
  h.setFetcher(albumId => albumId === 'first' ? first.promise : second.promise)
  const oldRequest = h.player.playAlbum('first')
  const newestRequest = h.player.playAlbum('second')
  second.resolve(playback('second', h.clock.now() + 600_000))
  await newestRequest
  const selectedSource = h.manager.src
  first.resolve(playback('first', h.clock.now() + 600_000))
  await oldRequest
  assert.equal(h.player.getState().albumId, 'second')
  assert.equal(h.manager.src, selectedSource, 'late old responses cannot replace the selected album')
  h.player.stop()

  for (const cancel of ['toggle', 'suspend', 'stop'] as const) {
    const pending = harness()
    const request = deferred<ListeningPlaybackResponse>()
    pending.setFetcher(() => request.promise)
    const started = pending.player.playAlbum('course')
    if (cancel === 'toggle') await pending.player.toggle()
    else if (cancel === 'suspend') pending.player.suspend(null, true)
    else pending.player.stop()
    request.resolve(playback('course', pending.clock.now() + 600_000))
    await started
    assert.equal(pending.managerRequests(), 0, `${cancel} during loading must cancel delayed automatic playback`)
    assert.equal(pending.player.getState().loading, false)
    pending.player.stop()
  }

  const oldEvents = harness()
  await oldEvents.player.playAlbum('first')
  oldEvents.manager.ready()
  const nextResponse = deferred<ListeningPlaybackResponse>()
  oldEvents.setFetcher(() => nextResponse.promise)
  const switching = oldEvents.player.playAlbum('second')
  assert.deepEqual(oldEvents.player.getState().queue, [], 'a fresh request clears the stale playable queue immediately')
  const before = oldEvents.manager.sourceAssignments.length
  oldEvents.manager.emit('play')
  assert.equal(oldEvents.player.getState().playing, false, 'old native play events are ignored while a new album is loading')
  oldEvents.manager.emit('ended')
  assert.equal(oldEvents.manager.sourceAssignments.length, before, 'old native ended events cannot start an old queue during loading')
  nextResponse.resolve(playback('second', oldEvents.clock.now() + 600_000))
  await switching
  assert.equal(oldEvents.player.getState().albumId, 'second')
  oldEvents.player.stop()

  const denied = harness()
  const permissions = deferred<ListeningPlaybackResponse>()
  denied.setFetcher(() => permissions.promise)
  const requested = denied.player.playAlbum('course')
  denied.setAllowed(false)
  denied.player.suspend('音频功能暂未开放', true)
  permissions.resolve(playback('course', denied.clock.now() + 600_000))
  await requested
  assert.equal(denied.managerRequests(), 0, 'a permission change cancels the pending playback request')
  assert.equal(denied.player.getState().loading, false)
  assert.ok(denied.player.getState().error?.includes('暂未开放'))
  denied.player.stop()
}

async function testPausedNativeEventsAndPendingFocus() {
  for (const cancel of ['pause', 'sleep', 'suspend'] as const) {
    const h = harness()
    await h.player.playAlbum('course')
    h.manager.ready()
    h.player.seek(16)
    if (cancel === 'pause') await h.player.toggle()
    else if (cancel === 'suspend') h.player.suspend()
    else { h.player.setSleep(1); h.clock.advance(60_000) }
    const paused = h.player.getState()
    const sources = h.manager.sourceAssignments.length
    const requests = h.fetched.length
    assert.equal(h.manager.paused, true)
    h.manager.emit('play')
    h.manager.emit('ended')
    h.manager.error()
    assert.deepEqual(h.player.getState(), paused, `late native events cannot revive playback after ${cancel}`)
    assert.equal(h.manager.sourceAssignments.length, sources)
    assert.equal(h.fetched.length, requests)
    assert.equal(h.fallbacks.length, 0)
    assert.equal(h.clock.pendingCount(), 0)
    h.player.stop()
  }

  const initialFocus = getAudioFocusOwner()
  if (initialFocus) releaseAudioFocus(initialFocus)
  try {
    for (const nextOwner of ['course', 'review'] as const) {
      const h = harness(null, true)
      const response = deferred<ListeningPlaybackResponse>()
      h.setFetcher(() => response.promise)
      const unsubscribe = subscribeAudioFocus((next, previous) => {
        if (previous === 'listening' && next !== 'listening') h.player.suspend()
      })
      try {
        const started = h.player.playAlbum('course')
        assert.equal(getAudioFocusOwner(), 'listening', 'listening claims focus before the network response arrives')
        assert.equal(h.managerRequests(), 0, 'claiming pending focus does not instantiate or start native audio')
        claimAudioFocus(nextOwner)
        assert.equal(h.player.getState().loading, false)
        response.resolve(playback('course', h.clock.now() + 600_000))
        await started
        assert.equal(h.managerRequests(), 0, `${nextOwner} focus cancels a pending listening request`)
        assert.equal(getAudioFocusOwner(), nextOwner, 'the late response cannot steal focus back')
      } finally {
        unsubscribe()
        h.player.stop()
        releaseAudioFocus(nextOwner)
      }
    }
  } finally {
    const owner = getAudioFocusOwner()
    if (owner) releaseAudioFocus(owner)
    if (initialFocus) claimAudioFocus(initialFocus)
  }
}

async function testFallbackAndExpiration() {
  const h = harness()
  await h.player.playAlbum('course', 'course-two', false, 37)
  h.manager.error()
  assert.ok(h.manager.src.startsWith('https://api.example.test/'))
  assert.equal(h.manager.startTime, 37, 'fallback preserves pending resume position')
  assert.deepEqual(h.fallbacks[0], { trackId: 'course-two', reason: 'error', from: 'qiniu', to: 'server' })
  h.manager.ready()
  h.clock.advance(3000)
  h.manager.currentTime = 40
  h.manager.emit('timeupdate')
  assert.equal(h.player.getState().position, 40)
  h.player.stop()

  const playingFallback = harness()
  await playingFallback.player.playAlbum('course')
  playingFallback.manager.ready()
  playingFallback.player.seek(17)
  playingFallback.clock.advance(3000)
  playingFallback.manager.currentTime = 20
  playingFallback.manager.emit('timeupdate')
  playingFallback.manager.error()
  assert.equal(playingFallback.manager.startTime, 20, 'fallback after playback begins keeps the observed native position')
  assert.ok(playingFallback.manager.src.startsWith('https://api.example.test/'))
  playingFallback.player.stop()

  const timeout = harness()
  await timeout.player.playAlbum('course', 'course-one', false, 18)
  timeout.clock.advance(10_000)
  assert.equal(timeout.fallbacks[0].reason, 'timeout')
  assert.equal(timeout.manager.startTime, 18)
  timeout.manager.ready()
  assert.equal(timeout.clock.pendingCount(), 0, 'ready events cancel the audio loading timeout')
  timeout.player.stop()

  const expiration = harness()
  let fetched = 0
  expiration.setFetcher(albumId => Promise.resolve(playback(albumId, expiration.clock.now() + (fetched++ === 0 ? 31_000 : 600_000), `request-${fetched}`)))
  await expiration.player.playAlbum('course')
  expiration.manager.ready()
  expiration.clock.advance(2000)
  await expiration.player.next()
  assert.equal(expiration.fetched.length, 2, 'queue advancement refreshes nearly expired signed URLs')
  assert.ok(expiration.manager.src.endsWith('token=request-2'))
  expiration.manager.ready()
  expiration.player.seek(15)
  await expiration.player.toggle()
  expiration.clock.jump(600_000)
  await expiration.player.toggle()
  assert.equal(expiration.fetched.length, 3, 'resume refreshes expired signed URLs')
  assert.equal(expiration.manager.startTime, 15)
  expiration.player.stop()

  const expiredError = harness()
  const renewed = deferred<ListeningPlaybackResponse>()
  expiredError.setFetcher(albumId => expiredError.fetched.length === 1
    ? Promise.resolve(playback(albumId, expiredError.clock.now() + 35_000, 'expired'))
    : renewed.promise)
  await expiredError.player.playAlbum('course', 'course-two')
  expiredError.manager.ready()
  expiredError.player.seek(37)
  expiredError.clock.jump(35_001)
  expiredError.manager.error()
  assert.equal(expiredError.fetched.length, 2, 'errors on expired media request fresh signed URLs')
  assert.equal(expiredError.manager.paused, true)
  assert.deepEqual(expiredError.player.getState().queue, [])
  assert.equal(expiredError.fallbacks.length, 0, 'expired media does not fall back to another equally expired URL')
  renewed.resolve(playback('course', expiredError.clock.now() + 600_000, 'renewed'))
  await Promise.resolve()
  await Promise.resolve()
  assert.ok(expiredError.manager.src.endsWith('token=renewed'))
  assert.equal(expiredError.manager.startTime, 37, 'refreshing expired media preserves the listening position')
  assert.equal(expiredError.player.getState().trackId, 'course-two')
  expiredError.player.stop()
}

async function testFocusPermissionsAndStop() {
  const blocked = harness()
  blocked.setAllowed(false)
  await blocked.player.playAlbum('course')
  assert.equal(blocked.fetched.length, 0)
  assert.equal(blocked.managerRequests(), 0)
  assert.equal(blocked.player.getState().loading, false)
  assert.ok(blocked.player.getState().error?.includes('暂未开放'))

  const h = harness()
  await h.player.playAlbum('course')
  h.manager.ready()
  h.player.seek(24)
  h.player.suspend(null, true)
  assert.equal(h.manager.paused, true)
  assert.equal(h.manager.stopCalls, 1, 'invalidating permissions stops the native source instead of leaving cached media resumable')
  assert.equal(h.writes[h.writes.length - 1].entries[0].position, 24)
  assert.deepEqual(h.player.getState().queue, [])
  h.setFocus(false)
  const before = h.player.getState()
  h.manager.src = 'https://example.test/course-player.mp3'
  h.manager.currentTime = 98
  for (const event of ['play', 'pause', 'canplay', 'timeupdate', 'ended', 'next', 'prev'] as AudioEvent[]) h.manager.emit(event)
  h.manager.error()
  assert.deepEqual(h.player.getState(), before, 'other players native events must not change listening state')
  assert.equal(h.fallbacks.length, 0)
  await h.player.toggle()
  assert.equal(h.fetched.length, 2, 'regaining focus uses fresh permissions and media')
  h.manager.ready()
  h.player.seek(42)
  h.player.stop()
  assert.equal(h.player.getState().active, false)
  assert.equal(h.releases(), 1)
  assert.equal(h.writes[h.writes.length - 1].entries[0].position, 42, 'stop preserves the pre-stop position even if native stop resets currentTime')
  assert.equal(h.clock.pendingCount(), 0)

  const foreign = harness()
  await foreign.player.playAlbum('course')
  foreign.manager.ready()
  foreign.setFocus(false)
  foreign.manager.src = 'https://example.test/another-player.mp3'
  foreign.player.stop()
  assert.equal(foreign.manager.stopCalls, 0, 'stopping listening cannot stop an audio manager now owned by another player')

  const nativeStop = harness()
  await nativeStop.player.playAlbum('course')
  nativeStop.manager.ready()
  nativeStop.player.seek(50)
  nativeStop.clock.advance(2000)
  nativeStop.manager.currentTime = 52
  nativeStop.manager.emit('timeupdate')
  nativeStop.manager.stop()
  assert.equal(nativeStop.manager.currentTime, 0)
  assert.equal(nativeStop.player.getState().position, 52, 'native stop keeps the last observed position when the native clock resets')
  assert.equal(nativeStop.writes[nativeStop.writes.length - 1].entries[0].position, 52)
  assert.equal(nativeStop.player.getState().playing, false)
  await nativeStop.player.toggle()
  assert.equal(nativeStop.manager.currentTime, 52, 'continuing after native stop resumes the saved position')
  nativeStop.player.stop()
}

async function testSleep() {
  const h = harness()
  await h.player.playAlbum('course')
  h.manager.ready()
  h.player.setSleep(1)
  h.clock.advance(60_000)
  assert.equal(h.manager.paused, true)
  assert.equal(h.player.getState().playing, false)
  assert.equal(h.player.getState().sleepEndsAt, null)
  assert.equal(h.clock.pendingCount(), 0)
  h.player.stop()

  const background = harness()
  await background.player.playAlbum('course')
  background.manager.ready()
  background.player.setSleep(1)
  background.clock.jump(60_001)
  background.player.foreground()
  assert.equal(background.manager.paused, true, 'foreground checks elapsed sleep timers when background callbacks were delayed')
  assert.equal(background.clock.pendingCount(), 0)
  background.player.stop()

  const cancelled = harness()
  await cancelled.player.playAlbum('course')
  cancelled.manager.ready()
  cancelled.player.setSleep(1)
  cancelled.player.setSleep(null)
  cancelled.clock.advance(60_000)
  assert.equal(cancelled.player.getState().playing, true)
  assert.equal(cancelled.manager.paused, false)
  cancelled.player.stop()

  const loading = harness()
  const response = deferred<ListeningPlaybackResponse>()
  loading.setFetcher(() => response.promise)
  const started = loading.player.playAlbum('course')
  loading.player.setSleep(1)
  loading.clock.advance(60_000)
  response.resolve(playback('course', loading.clock.now() + 600_000))
  await started
  assert.equal(loading.managerRequests(), 0, 'a late request cannot restart playback after the sleep timer ended')
  assert.equal(loading.player.getState().loading, false)
  loading.player.stop()
}

function testAudioFocusNotifications() {
  const initial = getAudioFocusOwner()
  if (initial) releaseAudioFocus(initial)
  const notifications: Array<{ next: string | null; previous: string | null; observed: string | null }> = []
  const unsubscribe = subscribeAudioFocus((next, previous) => notifications.push({ next, previous, observed: getAudioFocusOwner() }))
  try {
    claimAudioFocus('listening')
    claimAudioFocus('listening')
    claimAudioFocus('course')
    releaseAudioFocus('listening')
    assert.equal(getAudioFocusOwner(), 'course', 'an old owner cannot release another player focus')
    releaseAudioFocus('course')
    assert.deepEqual(notifications, [
      { next: 'listening', previous: null, observed: null },
      { next: 'course', previous: 'listening', observed: 'listening' },
      { next: null, previous: 'course', observed: 'course' },
    ], 'old players are notified while they still own focus so they can pause safely')
  } finally {
    unsubscribe()
    const owner = getAudioFocusOwner()
    if (owner) releaseAudioFocus(owner)
    if (initial) claimAudioFocus(initial)
  }
}

export const listeningPlayerTestDone = (async () => {
  testAudioFocusNotifications()
  await testQueueAndRepeat()
  await testResumeAndListeningTime()
  await testFetchRacesAndCancellation()
  await testPausedNativeEventsAndPendingFocus()
  await testFallbackAndExpiration()
  await testFocusPermissionsAndStop()
  await testSleep()
  console.log('listening player tests passed.')
})()
