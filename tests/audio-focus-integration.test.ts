import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import * as featureFlags from '../miniprogram/config/feature-flags'
import * as playerCore from '../miniprogram/pages/course/player-core'
import * as handoff from '../miniprogram/pages/course/shadow-background-handoff'

function readGenerated(relative: string) {
  return fs.readFileSync(path.resolve(__dirname, '../miniprogram', relative), 'utf8')
}

function isolatedModule(relative: string) {
  const exports: any = {}
  vm.runInNewContext(readGenerated(relative), { exports })
  return exports
}

function timers() {
  const tasks: Array<{ id: number; delay: number; callback: () => void; cancelled: boolean }> = []
  return {
    setTimeout(callback: () => void, delay: number) {
      const id = tasks.length + 1
      tasks.push({ id, delay, callback, cancelled: false })
      return id
    },
    clearTimeout(id: number) {
      const task = tasks.find(item => item.id === id)
      if (task) task.cancelled = true
    },
    run(delay: number) {
      for (const task of tasks.filter(item => item.delay === delay && !item.cancelled)) {
        task.cancelled = true
        task.callback()
      }
    },
  }
}

function audioManager() {
  const listeners = new Map<string, Array<(...args: any[]) => void>>()
  const calls: string[] = []
  const manager: any = {
    src: 'https://example.test/course.mp3', currentTime: 5, duration: 60, paused: false,
    title: '', epname: '', singer: '', coverImgUrl: '', startTime: 0, playbackRate: 1,
    play: () => { calls.push('play'); manager.paused = false },
    pause: () => { calls.push('pause'); manager.paused = true },
    stop: () => { calls.push('stop'); manager.paused = true },
    destroy: () => { calls.push('destroy') },
    seek: (value: number) => { calls.push(`seek:${value}`); manager.currentTime = value },
  }
  for (const name of ['onPlay', 'onPause', 'onStop', 'onEnded', 'onWaiting', 'onCanplay', 'onTimeUpdate', 'onNext', 'onPrev', 'onError']) {
    manager[name] = (callback: (...args: any[]) => void) => {
      listeners.set(name, [...(listeners.get(name) ?? []), callback])
    }
  }
  return { manager, calls, emit: (name: string, ...args: any[]) => listeners.get(name)?.forEach(fn => fn(...args)) }
}

function courseFixture() {
  const focus = isolatedModule('utils/audio-focus.js')
  const events = isolatedModule('utils/background-audio-events.js')
  const clock = timers()
  const background = audioManager()
  const inner = audioManager()
  const store = { appConfig: { interactiveFeaturesEnabled: true } }
  let page: any
  const modules: Record<string, any> = {
    '../../config/env': { API_BASE_URL: 'https://example.test' },
    '../../config/feature-flags': featureFlags,
    '../../utils/audio-focus': focus,
    '../../utils/background-audio-events': events,
    '../../utils/storage': { debounce: (fn: any) => fn, throttle: (fn: any) => fn },
    '../../utils/share': { enablePageShareMenu: () => {} },
    '../../store/index': {
      getState: () => store,
      subscribe: () => () => {},
    },
    './player-core': { ...playerCore, createAudioLoadTimeoutController: () => ({ clear() {}, schedule() {} }) },
    './shadow-background-handoff': handoff,
  }
  vm.runInNewContext(readGenerated('pages/course/course.js'), {
    exports: {}, require: (name: string) => modules[name] ?? {}, Page: (definition: any) => { page = definition },
    console: { log() {}, warn() {}, error() {}, info() {} },
    setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, setInterval: clock.setTimeout, clearInterval: clock.clearTimeout,
    wx: {
      getStorageSync: () => undefined, setStorageSync() {}, removeStorageSync() {},
      getStorageInfoSync: () => ({ keys: [] }), getBackgroundAudioManager: () => background.manager,
      createInnerAudioContext: () => inner.manager, showLoading() {}, hideLoading() {}, showToast() {},
    },
  })
  page.setData = (value: any, callback?: () => void) => { Object.assign(page.data, value); callback?.() }
  page.handleStoreUpdate = () => {}
  page.loadCourse = () => {}
  page.stopTracking = () => {}
  page.startTracking = () => {}
  page.scheduleSceneProgressSync = () => {}
  page.centerSubtitle = () => {}
  page.debugShadowBackground = () => {}
  page.syncCurrentSceneProgress = async () => {}
  page.finalizeStudySession = async () => {}
  page.onLoad({ id: 'course' })
  page.data.course = { id: 'course', title: '课程', audio: 'https://example.test/course-new.mp3' }
  page.data.subtitles = [{ id: 'first', start: 0, end: 3 }, { id: 'second', start: 3, end: 6 }]
  page.data.showPracticeControls = true
  page.data.audioPlaybackEnabled = true
  return { page, focus, clock, background, inner, store }
}

function checkOldCourseCallbacksAndUnload() {
  const fixture = courseFixture()
  fixture.page.ensureBackgroundAudioManager()
  fixture.focus.claimAudioFocus('listening')
  fixture.background.manager.src = 'https://example.test/listening.mp3'
  fixture.background.calls.length = 0
  fixture.background.emit('onCanplay')
  fixture.background.emit('onPlay')
  fixture.background.emit('onTimeUpdate')
  assert.equal(fixture.page.data.playing, false, 'Course callbacks ignore another owner\'s background audio events')
  assert.deepEqual(fixture.background.calls, [])
  fixture.page.onUnload()
  assert.ok(!(fixture.background.calls as string[]).includes('stop'), 'Unloading a course must not stop the listening manager')
  assert.equal(fixture.focus.getAudioFocusOwner(), 'listening', 'Course cleanup cannot release listening focus')
  fixture.background.emit('onPlay')
  assert.equal(fixture.page.data.playing, false, 'Disposed course pages no longer receive manager events')
}

function checkDelayedBackgroundSeek() {
  const fixture = courseFixture()
  fixture.page.playShadowCourseAt(2)
  fixture.focus.claimAudioFocus('listening')
  fixture.background.manager.src = 'https://example.test/listening.mp3'
  fixture.background.calls.length = 0
  fixture.clock.run(80)
  assert.deepEqual(fixture.background.calls, [], 'A delayed course seek cannot seek or restart listening audio')
}

function checkDelayedBackgroundSeekAfterDisable() {
  const fixture = courseFixture()
  fixture.page.playShadowCourseAt(2)
  fixture.store.appConfig.interactiveFeaturesEnabled = false
  fixture.background.calls.length = 0
  fixture.clock.run(80)
  assert.deepEqual(fixture.background.calls, [], 'Disabling audio blocks a previously scheduled course seek and play')
}

function checkDelayedBackgroundSeekAfterReclaim() {
  const fixture = courseFixture()
  fixture.page.playShadowCourseAt(2)
  fixture.focus.claimAudioFocus('listening')
  fixture.focus.claimAudioFocus('course')
  fixture.page.data.course.audio = 'https://example.test/new-course-source.mp3'
  fixture.page.playShadowCourseAt(9)
  fixture.background.calls.length = 0
  fixture.clock.run(80)
  assert.ok(!fixture.background.calls.includes('seek:2'), 'Reclaiming course focus cannot revive a seek from the previous focus session')
  assert.ok(fixture.background.calls.includes('seek:9'), 'The newest course seek still runs')
}

function checkDelayedSpeedResume() {
  const fixture = courseFixture()
  fixture.page.data.playMode = 'echo'
  fixture.page.data.playing = true
  fixture.page.audioContext = fixture.inner.manager
  fixture.page.applyPlaybackRate(1.2)
  fixture.focus.claimAudioFocus('listening')
  fixture.inner.calls.length = 0
  fixture.clock.run(50)
  assert.deepEqual(fixture.inner.calls, [], 'A delayed speed change must not restart course audio after losing focus')
}

function checkDelayedRepeatAdvance() {
  const fixture = courseFixture()
  fixture.page.data.playMode = 'shadow'
  fixture.page.data.repeatTarget = 1
  fixture.page.data.isRepeating = true
  fixture.page.handleRepeatNext(fixture.page.data.subtitles[0])
  fixture.focus.claimAudioFocus('listening')
  fixture.background.manager.src = 'https://example.test/listening.mp3'
  fixture.background.calls.length = 0
  fixture.clock.run(200)
  assert.equal(fixture.focus.getAudioFocusOwner(), 'listening', 'Finishing repeat cannot reclaim focus through a delayed next-cue callback')
  assert.deepEqual(fixture.background.calls, [])
}

function checkOldInnerCanplay() {
  const fixture = courseFixture()
  fixture.page.data.playMode = 'echo'
  fixture.page.ensureAudioContext('https://example.test/course.mp3')
  fixture.page.pendingShadowResume = { courseTime: 9, shouldAutoplay: true }
  fixture.focus.claimAudioFocus('listening')
  fixture.inner.calls.length = 0
  fixture.background.calls.length = 0
  fixture.inner.emit('onCanplay')
  assert.equal(fixture.focus.getAudioFocusOwner(), 'listening', 'A stale inner-audio ready callback cannot resume the old course')
  assert.deepEqual(fixture.background.calls, [])
}

function checkReviewClaimsFocus() {
  const focus = isolatedModule('utils/audio-focus.js')
  const inner = audioManager()
  let listeningPauses = 0
  focus.claimAudioFocus('listening')
  focus.subscribeAudioFocus((next: string, previous: string) => {
    if (previous === 'listening' && next !== 'listening') listeningPauses++
  })
  let page: any
  vm.runInNewContext(readGenerated('pages/review/review.js'), {
    exports: {}, Page: (definition: any) => { page = definition },
    require: (name: string) => name === '../../utils/audio-focus' ? focus
      : name === '../../config/feature-flags' ? featureFlags : {},
    wx: { createInnerAudioContext: () => inner.manager, showToast() {} }, console,
  })
  page.setData = (value: any) => Object.assign(page.data, value)
  page.onLoad()
  page.data.audioPlaybackEnabled = true
  page.handlePlayWordAudio({ currentTarget: { dataset: { id: 'hello', url: 'https://example.test/hello.mp3' } } })
  assert.equal(listeningPauses, 1)
  assert.equal(focus.getAudioFocusOwner(), 'review')
  assert.ok(inner.calls.includes('play'))
  focus.claimAudioFocus('listening')
  assert.equal(page.data.wordAudioStatus, 'idle')
  page.onHide()
  assert.equal(focus.getAudioFocusOwner(), 'listening', 'Review hide cannot release another player\'s focus')
  page.onUnload()
}

function checkAppForegroundNavigationRace() {
  const focus = isolatedModule('utils/audio-focus.js')
  const clock = timers()
  const background = audioManager()
  let app: any
  let navigations = 0
  const resume = { courseId: 'course', courseTime: 5, audioSrc: background.manager.src, wasPlaying: true, savedAt: Date.now() }
  const modules: Record<string, any> = {
    './utils/audio-focus': focus,
    './utils/listening-player': { reconcileListeningForeground() {}, persistListeningPlayback() {} },
    './config/feature-flags': featureFlags,
    './store/index': { getState: () => ({ appConfig: { interactiveFeaturesEnabled: true } }) },
    './pages/course/shadow-background-handoff': handoff,
  }
  vm.runInNewContext(readGenerated('app.js'), {
    exports: {}, require: (name: string) => modules[name] ?? {}, App: (definition: any) => { app = definition },
    setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    getCurrentPages: () => [{ route: 'pages/listening/listening' }],
    wx: { getStorageSync: () => resume, getBackgroundAudioManager: () => background.manager,
      navigateTo: () => { navigations++ }, redirectTo: () => { navigations++ } }, console,
  })
  app.refreshAppConfig = async () => {}
  focus.claimAudioFocus('course')
  app.onShow()
  focus.claimAudioFocus('listening')
  background.manager.src = 'https://example.test/listening.mp3'
  clock.run(80)
  assert.equal(navigations, 0, 'A scheduled course route restore must recheck listening focus before navigating')
}

checkOldCourseCallbacksAndUnload()
checkDelayedBackgroundSeek()
checkDelayedBackgroundSeekAfterDisable()
checkDelayedBackgroundSeekAfterReclaim()
checkReviewClaimsFocus()
checkDelayedSpeedResume()
checkDelayedRepeatAdvance()
checkOldInnerCanplay()
checkAppForegroundNavigationRace()
console.log('audio focus integration tests passed.')
