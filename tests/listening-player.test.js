"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listeningPlayerTestDone = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const audio_focus_1 = require("../miniprogram/utils/audio-focus");
const listening_player_core_1 = require("../miniprogram/utils/listening-player-core");
class FakeAudioManager {
    constructor() {
        this.source = '';
        this.handlers = new Map();
        this.errorHandlers = [];
        this.title = '';
        this.epname = '';
        this.singer = '';
        this.coverImgUrl = '';
        this.startTime = 0;
        this.currentTime = 0;
        this.duration = 120;
        this.paused = true;
        this.playbackRate = 1;
        this.sourceAssignments = [];
        this.seeks = [];
        this.playCalls = 0;
        this.pauseCalls = 0;
        this.stopCalls = 0;
    }
    get src() { return this.source; }
    set src(value) {
        this.source = value;
        this.sourceAssignments.push(value);
        this.currentTime = this.startTime;
        this.paused = false;
    }
    play() { this.playCalls++; this.paused = false; this.emit('play'); }
    pause() { this.pauseCalls++; this.paused = true; this.emit('pause'); }
    stop() { this.stopCalls++; this.paused = true; this.currentTime = 0; this.emit('stop'); }
    seek(seconds) { this.seeks.push(seconds); this.currentTime = seconds; }
    on(event, callback) {
        this.handlers.set(event, [...(this.handlers.get(event) || []), callback]);
    }
    emit(event) { this.handlers.get(event)?.forEach(callback => callback()); }
    ready() { this.emit('canplay'); this.paused = false; this.emit('play'); }
    ended() { this.currentTime = this.duration; this.paused = true; this.emit('ended'); }
    error() { this.errorHandlers.forEach(callback => callback({ errMsg: 'fake media error' })); }
    onPlay(callback) { this.on('play', callback); }
    onPause(callback) { this.on('pause', callback); }
    onStop(callback) { this.on('stop', callback); }
    onEnded(callback) { this.on('ended', callback); }
    onCanplay(callback) { this.on('canplay', callback); }
    onTimeUpdate(callback) { this.on('timeupdate', callback); }
    onWaiting(callback) { this.on('waiting', callback); }
    onNext(callback) { this.on('next', callback); }
    onPrev(callback) { this.on('prev', callback); }
    onError(callback) { this.errorHandlers.push(callback); }
}
function createClock() {
    let time = 1000000;
    let nextId = 1;
    const timers = new Map();
    return {
        now: () => time,
        setTimer(callback, milliseconds) {
            const id = nextId++;
            timers.set(id, { at: time + milliseconds, callback });
            return id;
        },
        clearTimer(timer) { timers.delete(timer); },
        pendingCount: () => timers.size,
        jump(milliseconds) { time += milliseconds; },
        advance(milliseconds) {
            const target = time + milliseconds;
            while (true) {
                const next = [...timers.entries()].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
                if (!next)
                    break;
                timers.delete(next[0]);
                time = next[1].at;
                next[1].callback();
            }
            time = target;
        },
    };
}
function playback(albumId, expiresAt, token = 'first') {
    return {
        album: { id: albumId, title: `Album ${albumId}`, coverUrl: 'https://example.test/cover.jpg' },
        tracks: ['one', 'two', 'three'].map((id, index) => ({
            id: `${albumId}-${id}`,
            title: `Track ${index + 1}`,
            duration: 120,
            chapterId: `chapter-0${index + 1}`,
            audioSources: [
                { provider: 'qiniu', url: `https://cdn.example.test/${albumId}-${id}.mp3?token=${token}` },
                { provider: 'server', url: `https://api.example.test/${albumId}-${id}.mp3?token=${token}` },
            ],
        })),
        expiresAt,
    };
}
function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
function harness(initialResume = null, sharedFocus = false) {
    const clock = createClock();
    const manager = new FakeAudioManager();
    const writes = [];
    const fetched = [];
    const fallbacks = [];
    let allowed = true;
    let focus = false;
    let managerRequests = 0;
    let released = 0;
    let fetcher = (albumId) => Promise.resolve(playback(albumId, clock.now() + 600000));
    const player = (0, listening_player_core_1.createListeningPlayer)({
        getManager() { managerRequests++; return manager; },
        fetchPlayback(albumId) { fetched.push(albumId); return fetcher(albumId); },
        canPlay: () => allowed,
        claimFocus() { if (sharedFocus)
            (0, audio_focus_1.claimAudioFocus)('listening');
        else
            focus = true; },
        ownsFocus: () => sharedFocus ? (0, audio_focus_1.getAudioFocusOwner)() === 'listening' : focus,
        releaseFocus() { if (sharedFocus)
            (0, audio_focus_1.releaseAudioFocus)('listening');
        else
            focus = false; released++; },
        readResume: () => initialResume,
        writeResume(value) { writes.push(JSON.parse(JSON.stringify(value))); },
        now: clock.now,
        setTimer: clock.setTimer,
        clearTimer: clock.clearTimer,
        reportFallback(track, reason, from, to) { fallbacks.push({ trackId: track.id, reason, from, to }); },
    });
    return {
        player, clock, manager, writes, fetched, fallbacks,
        setAllowed(value) { allowed = value; },
        setFocus(value) { focus = value; },
        setFetcher(value) { fetcher = value; },
        managerRequests: () => managerRequests,
        releases: () => released,
    };
}
async function testQueueAndRepeat() {
    const h = harness();
    await h.player.playAlbum('course');
    h.manager.ready();
    strict_1.default.equal(h.player.getState().trackId, 'course-one');
    strict_1.default.equal(h.player.getState().playing, true);
    h.manager.ended();
    strict_1.default.equal(h.player.getState().trackId, 'course-two', 'ending a track starts the next one');
    h.manager.ready();
    h.player.setMode('repeat-one');
    h.manager.ended();
    strict_1.default.equal(h.player.getState().trackId, 'course-two', 'single repeat returns to the same track');
    strict_1.default.equal(h.player.getState().position, 0);
    h.manager.ready();
    await h.player.next();
    strict_1.default.equal(h.player.getState().trackId, 'course-three', 'manual next still advances during single repeat');
    h.manager.ready();
    h.player.setMode('repeat-all');
    h.manager.ended();
    strict_1.default.equal(h.player.getState().trackId, 'course-one', 'album repeat wraps at the last track');
    h.manager.ready();
    await h.player.previous();
    strict_1.default.equal(h.player.getState().trackId, 'course-three', 'previous wraps from the first track in album repeat');
    h.manager.ready();
    h.player.seek(20);
    await h.player.previous();
    strict_1.default.equal(h.player.getState().trackId, 'course-three', 'previous restarts the current track after its first seconds');
    strict_1.default.equal(h.player.getState().position, 0);
    h.manager.ready();
    h.player.setMode('sequence');
    h.manager.ended();
    strict_1.default.equal(h.player.getState().playing, false);
    strict_1.default.equal(h.player.getState().position, 120);
    h.player.stop();
    const last = harness();
    await last.player.playAlbum('course', 'course-three');
    last.manager.ready();
    await last.player.next();
    strict_1.default.equal(last.player.getState().playing, false);
    strict_1.default.equal(last.manager.paused, true, 'next at the end must not leave native audio playing behind a stopped UI');
    last.player.stop();
}
async function testResumeAndListeningTime() {
    const h = harness();
    await h.player.playAlbum('course', 'course-two');
    h.manager.ready();
    h.clock.advance(3000);
    h.manager.currentTime = 3;
    h.manager.emit('timeupdate');
    strict_1.default.equal(h.player.getState().listenedSeconds, 3);
    h.player.seek(80);
    strict_1.default.equal(h.player.getState().listenedSeconds, 3, 'seeking forward is not listening time');
    h.clock.advance(4000);
    h.manager.currentTime = 84;
    h.manager.emit('timeupdate');
    strict_1.default.equal(h.player.getState().listenedSeconds, 7);
    h.player.background();
    const stored = h.writes[h.writes.length - 1];
    strict_1.default.equal(stored.entries[0].position, 84);
    strict_1.default.equal(stored.entries[0].trackId, 'course-two');
    strict_1.default.equal(JSON.stringify(stored).includes('token='), false, 'signed audio URLs must not enter resume storage');
    strict_1.default.equal(JSON.stringify(stored).includes('audioSources'), false);
    const restored = harness(stored);
    strict_1.default.equal(restored.player.getState().active, false, 'resume metadata must not auto-play on construction');
    strict_1.default.equal(restored.managerRequests(), 0);
    await restored.player.toggle();
    strict_1.default.equal(restored.manager.startTime, 84);
    strict_1.default.equal(restored.player.getState().trackId, 'course-two');
    restored.manager.ready();
    strict_1.default.equal(restored.player.getState().listenedSeconds, 7);
    restored.player.stop();
    h.player.stop();
    const unsafe = (0, listening_player_core_1.normalizeListeningResume)({
        entries: [{ albumId: 'course', trackId: 'course-one', position: Number.NaN, duration: -1, audioSrc: 'https://example.test/?token=secret' }],
        mode: 'invalid', listenedSeconds: Number.POSITIVE_INFINITY,
    });
    strict_1.default.equal(unsafe.entries[0].position, 0);
    strict_1.default.equal(unsafe.entries[0].duration, 0);
    strict_1.default.equal(unsafe.listenedSeconds, 0);
    strict_1.default.equal(JSON.stringify(unsafe).includes('secret'), false);
}
async function testFetchRacesAndCancellation() {
    const h = harness();
    const first = deferred();
    const second = deferred();
    h.setFetcher(albumId => albumId === 'first' ? first.promise : second.promise);
    const oldRequest = h.player.playAlbum('first');
    const newestRequest = h.player.playAlbum('second');
    second.resolve(playback('second', h.clock.now() + 600000));
    await newestRequest;
    const selectedSource = h.manager.src;
    first.resolve(playback('first', h.clock.now() + 600000));
    await oldRequest;
    strict_1.default.equal(h.player.getState().albumId, 'second');
    strict_1.default.equal(h.manager.src, selectedSource, 'late old responses cannot replace the selected album');
    h.player.stop();
    for (const cancel of ['toggle', 'suspend', 'stop']) {
        const pending = harness();
        const request = deferred();
        pending.setFetcher(() => request.promise);
        const started = pending.player.playAlbum('course');
        if (cancel === 'toggle')
            await pending.player.toggle();
        else if (cancel === 'suspend')
            pending.player.suspend(null, true);
        else
            pending.player.stop();
        request.resolve(playback('course', pending.clock.now() + 600000));
        await started;
        strict_1.default.equal(pending.managerRequests(), 0, `${cancel} during loading must cancel delayed automatic playback`);
        strict_1.default.equal(pending.player.getState().loading, false);
        pending.player.stop();
    }
    const oldEvents = harness();
    await oldEvents.player.playAlbum('first');
    oldEvents.manager.ready();
    const nextResponse = deferred();
    oldEvents.setFetcher(() => nextResponse.promise);
    const switching = oldEvents.player.playAlbum('second');
    strict_1.default.deepEqual(oldEvents.player.getState().queue, [], 'a fresh request clears the stale playable queue immediately');
    const before = oldEvents.manager.sourceAssignments.length;
    oldEvents.manager.emit('play');
    strict_1.default.equal(oldEvents.player.getState().playing, false, 'old native play events are ignored while a new album is loading');
    oldEvents.manager.emit('ended');
    strict_1.default.equal(oldEvents.manager.sourceAssignments.length, before, 'old native ended events cannot start an old queue during loading');
    nextResponse.resolve(playback('second', oldEvents.clock.now() + 600000));
    await switching;
    strict_1.default.equal(oldEvents.player.getState().albumId, 'second');
    oldEvents.player.stop();
    const denied = harness();
    const permissions = deferred();
    denied.setFetcher(() => permissions.promise);
    const requested = denied.player.playAlbum('course');
    denied.setAllowed(false);
    denied.player.suspend('音频功能暂未开放', true);
    permissions.resolve(playback('course', denied.clock.now() + 600000));
    await requested;
    strict_1.default.equal(denied.managerRequests(), 0, 'a permission change cancels the pending playback request');
    strict_1.default.equal(denied.player.getState().loading, false);
    strict_1.default.ok(denied.player.getState().error?.includes('暂未开放'));
    denied.player.stop();
}
async function testPausedNativeEventsAndPendingFocus() {
    for (const cancel of ['pause', 'sleep', 'suspend']) {
        const h = harness();
        await h.player.playAlbum('course');
        h.manager.ready();
        h.player.seek(16);
        if (cancel === 'pause')
            await h.player.toggle();
        else if (cancel === 'suspend')
            h.player.suspend();
        else {
            h.player.setSleep(1);
            h.clock.advance(60000);
        }
        const paused = h.player.getState();
        const sources = h.manager.sourceAssignments.length;
        const requests = h.fetched.length;
        strict_1.default.equal(h.manager.paused, true);
        h.manager.emit('play');
        h.manager.emit('ended');
        h.manager.error();
        strict_1.default.deepEqual(h.player.getState(), paused, `late native events cannot revive playback after ${cancel}`);
        strict_1.default.equal(h.manager.sourceAssignments.length, sources);
        strict_1.default.equal(h.fetched.length, requests);
        strict_1.default.equal(h.fallbacks.length, 0);
        strict_1.default.equal(h.clock.pendingCount(), 0);
        h.player.stop();
    }
    const initialFocus = (0, audio_focus_1.getAudioFocusOwner)();
    if (initialFocus)
        (0, audio_focus_1.releaseAudioFocus)(initialFocus);
    try {
        for (const nextOwner of ['course', 'review']) {
            const h = harness(null, true);
            const response = deferred();
            h.setFetcher(() => response.promise);
            const unsubscribe = (0, audio_focus_1.subscribeAudioFocus)((next, previous) => {
                if (previous === 'listening' && next !== 'listening')
                    h.player.suspend();
            });
            try {
                const started = h.player.playAlbum('course');
                strict_1.default.equal((0, audio_focus_1.getAudioFocusOwner)(), 'listening', 'listening claims focus before the network response arrives');
                strict_1.default.equal(h.managerRequests(), 0, 'claiming pending focus does not instantiate or start native audio');
                (0, audio_focus_1.claimAudioFocus)(nextOwner);
                strict_1.default.equal(h.player.getState().loading, false);
                response.resolve(playback('course', h.clock.now() + 600000));
                await started;
                strict_1.default.equal(h.managerRequests(), 0, `${nextOwner} focus cancels a pending listening request`);
                strict_1.default.equal((0, audio_focus_1.getAudioFocusOwner)(), nextOwner, 'the late response cannot steal focus back');
            }
            finally {
                unsubscribe();
                h.player.stop();
                (0, audio_focus_1.releaseAudioFocus)(nextOwner);
            }
        }
    }
    finally {
        const owner = (0, audio_focus_1.getAudioFocusOwner)();
        if (owner)
            (0, audio_focus_1.releaseAudioFocus)(owner);
        if (initialFocus)
            (0, audio_focus_1.claimAudioFocus)(initialFocus);
    }
}
async function testFallbackAndExpiration() {
    const h = harness();
    await h.player.playAlbum('course', 'course-two', false, 37);
    h.manager.error();
    strict_1.default.ok(h.manager.src.startsWith('https://api.example.test/'));
    strict_1.default.equal(h.manager.startTime, 37, 'fallback preserves pending resume position');
    strict_1.default.deepEqual(h.fallbacks[0], { trackId: 'course-two', reason: 'error', from: 'qiniu', to: 'server' });
    h.manager.ready();
    h.clock.advance(3000);
    h.manager.currentTime = 40;
    h.manager.emit('timeupdate');
    strict_1.default.equal(h.player.getState().position, 40);
    h.player.stop();
    const playingFallback = harness();
    await playingFallback.player.playAlbum('course');
    playingFallback.manager.ready();
    playingFallback.player.seek(17);
    playingFallback.clock.advance(3000);
    playingFallback.manager.currentTime = 20;
    playingFallback.manager.emit('timeupdate');
    playingFallback.manager.error();
    strict_1.default.equal(playingFallback.manager.startTime, 20, 'fallback after playback begins keeps the observed native position');
    strict_1.default.ok(playingFallback.manager.src.startsWith('https://api.example.test/'));
    playingFallback.player.stop();
    const timeout = harness();
    await timeout.player.playAlbum('course', 'course-one', false, 18);
    timeout.clock.advance(10000);
    strict_1.default.equal(timeout.fallbacks[0].reason, 'timeout');
    strict_1.default.equal(timeout.manager.startTime, 18);
    timeout.manager.ready();
    strict_1.default.equal(timeout.clock.pendingCount(), 0, 'ready events cancel the audio loading timeout');
    timeout.player.stop();
    const expiration = harness();
    let fetched = 0;
    expiration.setFetcher(albumId => Promise.resolve(playback(albumId, expiration.clock.now() + (fetched++ === 0 ? 31000 : 600000), `request-${fetched}`)));
    await expiration.player.playAlbum('course');
    expiration.manager.ready();
    expiration.clock.advance(2000);
    await expiration.player.next();
    strict_1.default.equal(expiration.fetched.length, 2, 'queue advancement refreshes nearly expired signed URLs');
    strict_1.default.ok(expiration.manager.src.endsWith('token=request-2'));
    expiration.manager.ready();
    expiration.player.seek(15);
    await expiration.player.toggle();
    expiration.clock.jump(600000);
    await expiration.player.toggle();
    strict_1.default.equal(expiration.fetched.length, 3, 'resume refreshes expired signed URLs');
    strict_1.default.equal(expiration.manager.startTime, 15);
    expiration.player.stop();
    const expiredError = harness();
    const renewed = deferred();
    expiredError.setFetcher(albumId => expiredError.fetched.length === 1
        ? Promise.resolve(playback(albumId, expiredError.clock.now() + 35000, 'expired'))
        : renewed.promise);
    await expiredError.player.playAlbum('course', 'course-two');
    expiredError.manager.ready();
    expiredError.player.seek(37);
    expiredError.clock.jump(35001);
    expiredError.manager.error();
    strict_1.default.equal(expiredError.fetched.length, 2, 'errors on expired media request fresh signed URLs');
    strict_1.default.equal(expiredError.manager.paused, true);
    strict_1.default.deepEqual(expiredError.player.getState().queue, []);
    strict_1.default.equal(expiredError.fallbacks.length, 0, 'expired media does not fall back to another equally expired URL');
    renewed.resolve(playback('course', expiredError.clock.now() + 600000, 'renewed'));
    await Promise.resolve();
    await Promise.resolve();
    strict_1.default.ok(expiredError.manager.src.endsWith('token=renewed'));
    strict_1.default.equal(expiredError.manager.startTime, 37, 'refreshing expired media preserves the listening position');
    strict_1.default.equal(expiredError.player.getState().trackId, 'course-two');
    expiredError.player.stop();
}
async function testFocusPermissionsAndStop() {
    const blocked = harness();
    blocked.setAllowed(false);
    await blocked.player.playAlbum('course');
    strict_1.default.equal(blocked.fetched.length, 0);
    strict_1.default.equal(blocked.managerRequests(), 0);
    strict_1.default.equal(blocked.player.getState().loading, false);
    strict_1.default.ok(blocked.player.getState().error?.includes('暂未开放'));
    const h = harness();
    await h.player.playAlbum('course');
    h.manager.ready();
    h.player.seek(24);
    h.player.suspend(null, true);
    strict_1.default.equal(h.manager.paused, true);
    strict_1.default.equal(h.manager.stopCalls, 1, 'invalidating permissions stops the native source instead of leaving cached media resumable');
    strict_1.default.equal(h.writes[h.writes.length - 1].entries[0].position, 24);
    strict_1.default.deepEqual(h.player.getState().queue, []);
    h.setFocus(false);
    const before = h.player.getState();
    h.manager.src = 'https://example.test/course-player.mp3';
    h.manager.currentTime = 98;
    for (const event of ['play', 'pause', 'canplay', 'timeupdate', 'ended', 'next', 'prev'])
        h.manager.emit(event);
    h.manager.error();
    strict_1.default.deepEqual(h.player.getState(), before, 'other players native events must not change listening state');
    strict_1.default.equal(h.fallbacks.length, 0);
    await h.player.toggle();
    strict_1.default.equal(h.fetched.length, 2, 'regaining focus uses fresh permissions and media');
    h.manager.ready();
    h.player.seek(42);
    h.player.stop();
    strict_1.default.equal(h.player.getState().active, false);
    strict_1.default.equal(h.releases(), 1);
    strict_1.default.equal(h.writes[h.writes.length - 1].entries[0].position, 42, 'stop preserves the pre-stop position even if native stop resets currentTime');
    strict_1.default.equal(h.clock.pendingCount(), 0);
    const foreign = harness();
    await foreign.player.playAlbum('course');
    foreign.manager.ready();
    foreign.setFocus(false);
    foreign.manager.src = 'https://example.test/another-player.mp3';
    foreign.player.stop();
    strict_1.default.equal(foreign.manager.stopCalls, 0, 'stopping listening cannot stop an audio manager now owned by another player');
    const nativeStop = harness();
    await nativeStop.player.playAlbum('course');
    nativeStop.manager.ready();
    nativeStop.player.seek(50);
    nativeStop.clock.advance(2000);
    nativeStop.manager.currentTime = 52;
    nativeStop.manager.emit('timeupdate');
    nativeStop.manager.stop();
    strict_1.default.equal(nativeStop.manager.currentTime, 0);
    strict_1.default.equal(nativeStop.player.getState().position, 52, 'native stop keeps the last observed position when the native clock resets');
    strict_1.default.equal(nativeStop.writes[nativeStop.writes.length - 1].entries[0].position, 52);
    strict_1.default.equal(nativeStop.player.getState().playing, false);
    await nativeStop.player.toggle();
    strict_1.default.equal(nativeStop.manager.currentTime, 52, 'continuing after native stop resumes the saved position');
    nativeStop.player.stop();
}
async function testSleep() {
    const h = harness();
    await h.player.playAlbum('course');
    h.manager.ready();
    h.player.setSleep(1);
    h.clock.advance(60000);
    strict_1.default.equal(h.manager.paused, true);
    strict_1.default.equal(h.player.getState().playing, false);
    strict_1.default.equal(h.player.getState().sleepEndsAt, null);
    strict_1.default.equal(h.clock.pendingCount(), 0);
    h.player.stop();
    const background = harness();
    await background.player.playAlbum('course');
    background.manager.ready();
    background.player.setSleep(1);
    background.clock.jump(60001);
    background.player.foreground();
    strict_1.default.equal(background.manager.paused, true, 'foreground checks elapsed sleep timers when background callbacks were delayed');
    strict_1.default.equal(background.clock.pendingCount(), 0);
    background.player.stop();
    const cancelled = harness();
    await cancelled.player.playAlbum('course');
    cancelled.manager.ready();
    cancelled.player.setSleep(1);
    cancelled.player.setSleep(null);
    cancelled.clock.advance(60000);
    strict_1.default.equal(cancelled.player.getState().playing, true);
    strict_1.default.equal(cancelled.manager.paused, false);
    cancelled.player.stop();
    const loading = harness();
    const response = deferred();
    loading.setFetcher(() => response.promise);
    const started = loading.player.playAlbum('course');
    loading.player.setSleep(1);
    loading.clock.advance(60000);
    response.resolve(playback('course', loading.clock.now() + 600000));
    await started;
    strict_1.default.equal(loading.managerRequests(), 0, 'a late request cannot restart playback after the sleep timer ended');
    strict_1.default.equal(loading.player.getState().loading, false);
    loading.player.stop();
}
function testAudioFocusNotifications() {
    const initial = (0, audio_focus_1.getAudioFocusOwner)();
    if (initial)
        (0, audio_focus_1.releaseAudioFocus)(initial);
    const notifications = [];
    const unsubscribe = (0, audio_focus_1.subscribeAudioFocus)((next, previous) => notifications.push({ next, previous, observed: (0, audio_focus_1.getAudioFocusOwner)() }));
    try {
        (0, audio_focus_1.claimAudioFocus)('listening');
        (0, audio_focus_1.claimAudioFocus)('listening');
        (0, audio_focus_1.claimAudioFocus)('course');
        (0, audio_focus_1.releaseAudioFocus)('listening');
        strict_1.default.equal((0, audio_focus_1.getAudioFocusOwner)(), 'course', 'an old owner cannot release another player focus');
        (0, audio_focus_1.releaseAudioFocus)('course');
        strict_1.default.deepEqual(notifications, [
            { next: 'listening', previous: null, observed: null },
            { next: 'course', previous: 'listening', observed: 'listening' },
            { next: null, previous: 'course', observed: 'course' },
        ], 'old players are notified while they still own focus so they can pause safely');
    }
    finally {
        unsubscribe();
        const owner = (0, audio_focus_1.getAudioFocusOwner)();
        if (owner)
            (0, audio_focus_1.releaseAudioFocus)(owner);
        if (initial)
            (0, audio_focus_1.claimAudioFocus)(initial);
    }
}
exports.listeningPlayerTestDone = (async () => {
    testAudioFocusNotifications();
    await testQueueAndRepeat();
    await testResumeAndListeningTime();
    await testFetchRacesAndCancellation();
    await testPausedNativeEventsAndPendingFocus();
    await testFallbackAndExpiration();
    await testFocusPermissionsAndStop();
    await testSleep();
    console.log('listening player tests passed.');
})();
