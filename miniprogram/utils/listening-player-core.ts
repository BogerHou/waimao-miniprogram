import type { ListeningPlaybackResponse, ListeningPlaybackTrack } from './listening-api'

export type ListeningRepeatMode = 'sequence' | 'repeat-all' | 'repeat-one'
export type ListeningState = {
  active: boolean
  albumId: string | null
  albumTitle: string
  trackId: string | null
  trackTitle: string
  coverUrl: string
  playing: boolean
  loading: boolean
  position: number
  duration: number
  error: string | null
  mode: ListeningRepeatMode
  sleepEndsAt: number | null
  queue: Array<{ id: string; title: string; duration: number; chapterId?: string }>
  listenedSeconds: number
}

export interface ListeningAudioManager {
  src: string
  title: string
  epname: string
  singer: string
  coverImgUrl: string
  startTime: number
  currentTime: number
  duration: number
  paused: boolean
  playbackRate?: number
  play(): void
  pause(): void
  stop(): void
  seek(seconds: number): void
  onPlay(callback: () => void): void
  onPause(callback: () => void): void
  onStop(callback: () => void): void
  onEnded(callback: () => void): void
  onCanplay(callback: () => void): void
  onTimeUpdate(callback: () => void): void
  onWaiting?(callback: () => void): void
  onNext?(callback: () => void): void
  onPrev?(callback: () => void): void
  onError(callback: (error: unknown) => void): void
}

export const LISTENING_RESUME_KEY = 'waimao_listening_resume_v1'
const LOAD_TIMEOUT_MS = 10_000
type ResumeEntry = {
  albumId: string; albumTitle: string; trackId: string; trackTitle: string
  coverUrl: string; position: number; duration: number; savedAt: number
}
type ResumeData = { version: 1; entries: ResumeEntry[]; mode: ListeningRepeatMode; listenedSeconds: number }
type Timer = ReturnType<typeof setTimeout>
type Dependencies = {
  getManager(): ListeningAudioManager
  fetchPlayback(albumId: string): Promise<ListeningPlaybackResponse>
  canPlay(): boolean
  claimFocus(): void
  ownsFocus(): boolean
  releaseFocus(): void
  readResume(): unknown
  writeResume(value: ResumeData): void
  now?(): number
  setTimer?(callback: () => void, milliseconds: number): Timer
  clearTimer?(timer: Timer): void
  reportFallback?(track: ListeningPlaybackTrack, reason: 'error' | 'timeout', from: string, to: string): void
  reportTimeout?(track: ListeningPlaybackTrack, provider: string): void
}

function finite(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}

export function normalizeListeningResume(value: unknown): ResumeData {
  const raw = value && typeof value === 'object' ? value as Partial<ResumeData> : {}
  const entries: ResumeEntry[] = []
  if (Array.isArray(raw.entries)) {
    for (const entry of raw.entries.slice(0, 50)) {
      if (!entry || typeof entry.albumId !== 'string' || !entry.albumId ||
          typeof entry.trackId !== 'string' || !entry.trackId) continue
      entries.push({
        albumId: entry.albumId.slice(0, 100), trackId: entry.trackId.slice(0, 100),
        albumTitle: String(entry.albumTitle || '').slice(0, 300),
        trackTitle: String(entry.trackTitle || '').slice(0, 300),
        coverUrl: String(entry.coverUrl || '').slice(0, 2000),
        position: finite(entry.position), duration: finite(entry.duration), savedAt: finite(entry.savedAt),
      })
    }
  }
  return {
    version: 1, entries,
    mode: raw.mode === 'repeat-all' || raw.mode === 'repeat-one' ? raw.mode : 'sequence',
    listenedSeconds: finite(raw.listenedSeconds),
  }
}

export function createListeningPlayer(deps: Dependencies) {
  const now = deps.now ?? Date.now
  const setTimer = deps.setTimer ?? ((callback: () => void, milliseconds: number) => setTimeout(callback, milliseconds) as Timer)
  const clearTimer = deps.clearTimer ?? ((timer: Timer) => clearTimeout(timer))
  let resume: ResumeData
  try { resume = normalizeListeningResume(deps.readResume()) } catch (_error) { resume = normalizeListeningResume(null) }
  const last = resume.entries[0]
  let state: ListeningState = {
    active: false, albumId: last?.albumId ?? null, albumTitle: last?.albumTitle ?? '',
    trackId: last?.trackId ?? null, trackTitle: last?.trackTitle ?? '', coverUrl: last?.coverUrl ?? '',
    playing: false, loading: false, position: last?.position ?? 0, duration: last?.duration ?? 0,
    error: null, mode: resume.mode, sleepEndsAt: null, queue: [], listenedSeconds: resume.listenedSeconds,
  }
  let manager: ListeningAudioManager | null = null
  let tracks: ListeningPlaybackTrack[] = []
  let expiresAt = 0
  let generation = 0
  let sourceIndex = 0
  let expectedSource = ''
  let pendingSeek: number | null = null
  let loadTimer: Timer | null = null
  let sleepTimer: Timer | null = null
  let lastObservedPosition: number | null = null
  let lastObservedAt = now()
  let lastPersistedAt = 0
  let playbackIntent = false
  const listeners = new Set<(state: ListeningState) => void>()
  const snapshot = (): ListeningState => ({ ...state, queue: state.queue.map(track => ({ ...track })) })
  const update = (patch: Partial<ListeningState>) => {
    state = { ...state, ...patch }
    listeners.forEach(listener => listener(snapshot()))
  }
  const clearLoadTimer = () => { if (loadTimer !== null) clearTimer(loadTimer); loadTimer = null }
  const ownsSource = () => deps.ownsFocus() && state.active && !!expectedSource && manager?.src === expectedSource
  const persist = () => {
    if (state.albumId && state.trackId) {
      const entry: ResumeEntry = {
        albumId: state.albumId, albumTitle: state.albumTitle, trackId: state.trackId,
        trackTitle: state.trackTitle, coverUrl: state.coverUrl, position: state.position,
        duration: state.duration, savedAt: now(),
      }
      resume.entries = [entry, ...resume.entries.filter(item => item.albumId !== entry.albumId)].slice(0, 50)
    }
    resume.mode = state.mode
    resume.listenedSeconds = state.listenedSeconds
    try { deps.writeResume(resume) } catch (_error) { /* Storage exhaustion must not stop playback. */ }
    lastPersistedAt = now()
  }
  const observe = () => {
    if (!ownsSource() || !manager) return
    const position = finite(manager.currentTime)
    const duration = finite(manager.duration) || state.duration
    const elapsed = Math.max(0, (now() - lastObservedAt) / 1000)
    const delta = lastObservedPosition === null ? 0 : position - lastObservedPosition
    // Count real playback movement, never seeking or buffering wall-clock time.
    const counted = state.playing && delta > 0 && delta <= elapsed + 2 ? delta : 0
    lastObservedPosition = position
    lastObservedAt = now()
    update({ position, duration, listenedSeconds: state.listenedSeconds + counted })
    if (now() - lastPersistedAt >= 10_000) persist()
  }
  const checkSleep = () => {
    if (state.sleepEndsAt === null || now() < state.sleepEndsAt) return false
    ++generation
    playbackIntent = false
    if (ownsSource()) { observe(); manager?.pause() }
    clearLoadTimer()
    update({ playing: false, loading: false, sleepEndsAt: null })
    if (sleepTimer !== null) clearTimer(sleepTimer)
    sleepTimer = null
    persist()
    return true
  }
  const currentTrack = () => tracks.find(track => track.id === state.trackId)
  const fail = (message: string) => {
    playbackIntent = false
    clearLoadTimer()
    if (ownsSource()) manager?.pause()
    update({ playing: false, loading: false, error: message })
    persist()
  }
  const armLoadTimer = () => {
    clearLoadTimer()
    const source = expectedSource
    loadTimer = setTimer(() => {
      loadTimer = null
      if (!ownsSource() || expectedSource !== source || !state.loading) return
      const track = currentTrack()
      if (track) deps.reportTimeout?.(track, track.audioSources[sourceIndex]?.provider || 'unknown')
      fallback('timeout')
    }, LOAD_TIMEOUT_MS)
  }
  const loadTrack = (track: ListeningPlaybackTrack, position = 0, nextSource = 0) => {
    if (checkSleep()) return
    if (!deps.canPlay()) { fail('音频功能暂未开放'); return }
    deps.claimFocus()
    const audio = ensureManager()
    const source = track.audioSources[nextSource]
    if (!source?.url) { fail('这段音频暂时无法播放，请稍后重试'); return }
    clearLoadTimer()
    sourceIndex = nextSource
    expectedSource = source.url
    playbackIntent = true
    pendingSeek = track.duration > 0 && position >= track.duration - 0.2
      ? 0 : Math.min(finite(position), track.duration > 0 ? Math.max(0, track.duration - 0.1) : finite(position))
    lastObservedPosition = pendingSeek
    lastObservedAt = now()
    update({ active: true, trackId: track.id, trackTitle: track.title, duration: track.duration,
      position: pendingSeek, playing: false, loading: true, error: null })
    audio.title = track.title
    audio.epname = state.albumTitle
    audio.singer = '外贸口语 · 磨耳朵'
    audio.coverImgUrl = state.coverUrl
    if ('playbackRate' in audio) { try { audio.playbackRate = 1 } catch (_error) { /* Optional platform support. */ } }
    try {
      audio.startTime = pendingSeek
      if (audio.src === source.url) { audio.seek(pendingSeek); audio.play() }
      else audio.src = source.url // Assigning src starts native background playback.
      armLoadTimer()
      persist()
    } catch (_error) { fallback('error') }
  }
  const fallback = (reason: 'error' | 'timeout') => {
    if (!playbackIntent) return
    const track = currentTrack()
    if (!track) { fail('音频播放失败，请重试'); return }
    const position = pendingSeek ?? (manager && Number.isFinite(manager.currentTime) ? finite(manager.currentTime) : state.position)
    if (expiresAt <= now() + 30_000 && state.albumId) {
      void start(state.albumId, track.id, false, position)
      return
    }
    const next = track.audioSources[sourceIndex + 1]
    if (!next) { fail('音频加载失败，请检查网络后重试'); return }
    deps.reportFallback?.(track, reason, track.audioSources[sourceIndex]?.provider || 'unknown', next.provider)
    loadTrack(track, position, sourceIndex + 1)
  }
  const start = async (albumId: string, trackId?: string, useResume = false, forcedPosition?: number) => {
    const ticket = ++generation
    clearLoadTimer()
    if (ownsSource()) { observe(); manager?.pause(); persist() }
    expectedSource = ''
    playbackIntent = false
    tracks = []; expiresAt = 0
    if (!deps.canPlay()) { update({ playing: false, loading: false, error: '音频功能暂未开放' }); return }
    // Claim on user intent, not after the request: a later course/word play
    // must be able to cancel this pending listening request immediately.
    deps.claimFocus()
    update({ active: true, loading: true, playing: false, error: null, queue: [] })
    try {
      const response = await deps.fetchPlayback(albumId)
      if (ticket !== generation) return
      if (!deps.canPlay()) { fail('音频功能暂未开放'); return }
      if (response.album.id !== albumId || !response.tracks.length) throw new Error('这张专辑暂无可播放音频')
      const saved = useResume ? resume.entries.find(item => item.albumId === albumId) : undefined
      const requested = trackId || saved?.trackId
      let target = response.tracks.find(track => track.id === requested)
      if (trackId && !target) throw new Error('这段音频未发布或暂时没有访问权限')
      target = target ?? response.tracks[0]
      const position = forcedPosition ?? (saved?.trackId === target.id ? saved.position : 0)
      tracks = response.tracks
      expiresAt = response.expiresAt
      update({ albumId, albumTitle: response.album.title, coverUrl: response.album.coverUrl,
        queue: tracks.map(({ id, title, duration, chapterId }) => ({ id, title, duration, chapterId })) })
      loadTrack(target, position)
    } catch (error) {
      if (ticket !== generation) return
      tracks = []
      update({ queue: [] })
      fail(error instanceof Error ? error.message : '无法加载听力专辑，请重试')
    }
  }
  const move = async (direction: 1 | -1, ended = false) => {
    if (!state.albumId || !tracks.length || checkSleep()) return
    observe()
    const index = tracks.findIndex(track => track.id === state.trackId)
    if (index < 0) return
    let next = index + direction
    if (ended && state.mode === 'repeat-one') next = index
    if (!ended && direction === -1 && state.position > 3) next = index
    if (next >= tracks.length) {
      if (state.mode === 'repeat-all') next = 0
      else {
        playbackIntent = false
        clearLoadTimer()
        if (ownsSource()) manager?.pause()
        update({ playing: false, loading: false, ...(ended ? { position: state.duration } : {}) })
        persist(); return
      }
    }
    if (next < 0) next = state.mode === 'repeat-all' ? tracks.length - 1 : 0
    const target = tracks[next]
    if (expiresAt <= now() + 30_000) await start(state.albumId, target.id, false)
    else loadTrack(target)
  }
  const ensureManager = () => {
    if (manager) return manager
    manager = deps.getManager()
    manager.onPlay(() => {
      if (deps.ownsFocus() && !ownsSource()) { manager?.pause(); return }
      if (!ownsSource() || manager?.paused || checkSleep()) return
      if (!deps.canPlay() || expiresAt <= now()) {
        const albumId = state.albumId
        const trackId = state.trackId ?? undefined
        const position = finite(manager?.currentTime)
        manager?.pause()
        if (deps.canPlay() && albumId) void start(albumId, trackId, false, position)
        return
      }
      playbackIntent = true
      clearLoadTimer()
      lastObservedAt = now()
      lastObservedPosition = finite(manager?.currentTime)
      update({ playing: true, loading: false, error: null })
    })
    const pause = () => {
      if (!ownsSource()) return
      observe(); playbackIntent = false; clearLoadTimer(); update({ playing: false, loading: false }); persist()
    }
    manager.onPause(pause)
    manager.onStop(() => {
      if (!ownsSource()) return
      // Some native stop events expose currentTime=0. Keep the last valid
      // position instead of overwriting the saved listening checkpoint.
      playbackIntent = false; clearLoadTimer(); pendingSeek = null
      expectedSource = ''
      expiresAt = 0 // Native stop may reset playback; resume must reload/seek the checkpoint.
      update({ playing: false, loading: false }); persist()
    })
    manager.onCanplay(() => {
      if (!ownsSource() || checkSleep()) return
      clearLoadTimer()
      if (pendingSeek !== null) {
        const target = pendingSeek
        pendingSeek = null
        try { manager?.seek(target) } catch (_error) { /* startTime already provided. */ }
        lastObservedPosition = target
        lastObservedAt = now()
      }
      update({ loading: false, duration: finite(manager?.duration) || state.duration })
    })
    manager.onTimeUpdate(() => { if (!checkSleep()) observe() })
    manager.onEnded(() => {
      if (ownsSource() && playbackIntent && state.playing && manager?.paused !== false) {
        observe(); void move(1, true)
      }
    })
    manager.onWaiting?.(() => { if (ownsSource() && state.playing) { update({ loading: true }); armLoadTimer() } })
    manager.onNext?.(() => { if (ownsSource()) void move(1) })
    manager.onPrev?.(() => { if (ownsSource()) void move(-1) })
    manager.onError(() => { if (ownsSource()) fallback('error') })
    return manager
  }
  return {
    getState: snapshot,
    subscribe(listener: (state: ListeningState) => void) {
      listeners.add(listener); listener(snapshot())
      return () => { listeners.delete(listener) }
    },
    playAlbum: start,
    async toggle() {
      if (state.playing || state.loading) {
        ++generation; observe(); playbackIntent = false; clearLoadTimer()
        if (ownsSource()) manager?.pause()
        update({ playing: false, loading: false }); persist(); return
      }
      if (!state.albumId) return
      if (expiresAt <= now() + 30_000 || !tracks.length || !deps.ownsFocus() || state.error) {
        await start(state.albumId, state.trackId ?? undefined, true)
      } else {
        deps.claimFocus()
        update({ active: true, loading: true, error: null })
        playbackIntent = true
        lastObservedPosition = state.position; lastObservedAt = now()
        manager?.play(); armLoadTimer()
      }
    },
    next: () => move(1),
    previous: () => move(-1),
    seek(seconds: number) {
      if (!ownsSource() || !manager || !Number.isFinite(seconds)) return
      const position = Math.max(0, Math.min(seconds, state.duration || seconds))
      pendingSeek = null; lastObservedPosition = position; lastObservedAt = now()
      manager.seek(position); update({ position }); persist()
    },
    setMode(mode: ListeningRepeatMode) {
      if (!['sequence', 'repeat-all', 'repeat-one'].includes(mode)) return
      update({ mode }); persist()
    },
    setSleep(minutes: number | null) {
      if (sleepTimer !== null) clearTimer(sleepTimer)
      sleepTimer = null
      if (minutes === null) { update({ sleepEndsAt: null }); return }
      if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 180) return
      update({ sleepEndsAt: now() + minutes * 60_000 })
      sleepTimer = setTimer(checkSleep, minutes * 60_000)
    },
    suspend(message: string | null = null, invalidate = false) {
      ++generation
      playbackIntent = false
      observe(); clearLoadTimer()
      if (ownsSource()) {
        if (invalidate) { expectedSource = ''; manager?.stop() }
        else manager?.pause()
      }
      if (invalidate) { tracks = []; expiresAt = 0; expectedSource = '' }
      update({ playing: false, loading: false, error: message, ...(invalidate ? { queue: [] } : {}) })
      persist()
    },
    stop() {
      ++generation; observe(); playbackIntent = false; persist(); clearLoadTimer()
      const stopManager = ownsSource()
      expectedSource = '' // Native onStop may reset currentTime; do not overwrite the saved position.
      if (stopManager) manager?.stop()
      if (sleepTimer !== null) clearTimer(sleepTimer)
      sleepTimer = null; tracks = []; expectedSource = ''; expiresAt = 0
      update({ active: false, playing: false, loading: false, queue: [], sleepEndsAt: null, error: null })
      deps.releaseFocus()
    },
    background() { observe(); persist() },
    foreground() { if (!checkSleep()) observe() },
  }
}
