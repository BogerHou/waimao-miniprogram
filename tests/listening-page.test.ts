import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { resolveInteractiveFeaturesEnabled } from '../miniprogram/config/feature-flags'

function generated(relative: string) {
  return fs.readFileSync(path.resolve(__dirname, '../miniprogram', relative), 'utf8')
}

function checkTemplateExpressions() {
  // WXML does not decode HTML entities inside bindings. Keep text entities valid,
  // but catch escaped operators even when this machine has no WeChat compiler.
  const root = path.resolve(__dirname, '../miniprogram')
  function checkDirectory(directory: string) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name)
      if (entry.isDirectory()) checkDirectory(file)
      else if (entry.isFile() && entry.name.endsWith('.wxml')) {
        const source = fs.readFileSync(file, 'utf8')
        for (const binding of source.match(/\{\{[\s\S]*?\}\}/g) || []) {
          assert.doesNotMatch(binding, /&(?:amp|lt|gt);/,
            `${path.relative(root, file)}: use raw operators in WXML expressions, not HTML entities`)
        }
      }
    }
  }
  checkDirectory(root)
}

const catalog = {
  data: [
    {
      id: 'course', title: '外贸口语课程全集', description: '连续听课程', category: '课程', coverUrl: '',
      duration: 1200, trackCount: 2,
      tracks: [
        { id: 'paid', title: '第二章', duration: 600, free: false, locked: true, transcript: 'locked text' },
        { id: 'free', title: '第一章', duration: 600, free: true, locked: false, transcript: 'Hello.' },
      ],
    },
    { id: 'phone', title: '商务电话', description: '', category: '电话', coverUrl: '', duration: 60, trackCount: 1,
      tracks: [{ id: 'call', title: '打招呼', duration: 60, free: true, locked: false }] },
  ],
  appConfig: { interactiveFeaturesEnabled: true, allCoursesFree: false, home: {}, courseDetail: { shadowModeEnabled: true } },
}

function playerFixture() {
  const state: any = {
    active: false, albumId: 'course', albumTitle: '外贸口语课程全集', trackId: 'free', trackTitle: '第一章',
    coverUrl: '', playing: false, loading: false, position: 75, duration: 600, error: null,
    mode: 'sequence', sleepEndsAt: null, queue: [], listenedSeconds: 120,
  }
  const calls: any[][] = []
  let listener: ((value: any) => void) | undefined
  let unsubscribed = 0
  const emit = () => listener?.(state)
  const player = {
    getListeningState: () => ({ ...state }),
    subscribeListening: (fn: (value: any) => void) => {
      listener = fn
      fn(state)
      return () => { listener = undefined; unsubscribed++ }
    },
    playListeningAlbum: async (...args: any[]) => { calls.push(['play', ...args]) },
    toggleListeningPlayback: async () => { calls.push(['toggle']) },
    nextListeningTrack: async () => { calls.push(['next']) },
    previousListeningTrack: async () => { calls.push(['previous']) },
    seekListeningTo: (value: number) => { calls.push(['seek', value]) },
    setListeningRepeatMode: (value: string) => { state.mode = value; emit() },
    setListeningSleepTimer: (value: number | null) => { calls.push(['timer', value]) },
    stopListeningPlayback: () => { calls.push(['stop']) },
  }
  return { state, calls, player, emit, unsubscribed: () => unsubscribed }
}

async function checkApiBoundary() {
  let reply: any = catalog
  const requests: any[] = []
  const exports: any = {}
  vm.runInNewContext(generated('utils/listening-api.js'), {
    exports,
    require: (name: string) => name === '../config/env' ? { API_BASE_URL: 'https://api.example.test' } : {
      request: async (options: any) => { requests.push(options); return reply },
    },
  })
  reply = { ...catalog, data: [{ ...catalog.data[0], coverUrl: '/static/cover.jpg' }] }
  const response = await exports.fetchListeningAlbums()
  assert.equal(response.data[0].coverUrl, 'https://api.example.test/static/cover.jpg')
  reply = {
    album: { id: 'a/b', title: '课程', coverUrl: '//cdn.example.test/cover.jpg' },
    tracks: [{ id: 'track', title: '章节', duration: 30, audioSources: [
      { provider: 'server', url: '/signed/audio?token=short-lived' },
      { provider: 'qiniu', url: 'https://cdn.example.test/audio?signature=short-lived' },
    ] }], expiresAt: 123,
  }
  const playback = await exports.fetchListeningPlayback('a/b')
  assert.equal(requests[1].url, '/api/waimao-mini/listening/albums/a%2Fb/playback')
  assert.equal(playback.album.coverUrl, 'https://cdn.example.test/cover.jpg')
  assert.equal(playback.tracks[0].audioSources[0].url, 'https://api.example.test/signed/audio?token=short-lived')
  assert.equal(playback.tracks[0].audioSources[1].url, reply.tracks[0].audioSources[1].url)
  await exports.fetchListeningPlayback('a/b')
  assert.equal(requests.length, 3, 'Playback URLs are fetched again instead of being cached across permission changes')
  await assert.rejects(exports.fetchListeningPlayback(' '), /请选择听力专辑/)
  assert.equal(requests.length, 3)
}

async function checkPageActions() {
  const fixture = playerFixture()
  let page: any
  let catalogFails = false
  let storeUnsubscribed = 0
  let unlockPrompts = 0
  let navigated = ''
  const toastMessages: string[] = []
  const exports: any = {}
  const store: any = { appConfig: catalog.appConfig }
  const modules: any = {
    '../../utils/listening-api': { fetchListeningAlbums: async () => {
      if (catalogFails) throw new Error('offline')
      return catalog
    } },
    '../../utils/listening-player': fixture.player,
    '../../config/feature-flags': { resolveInteractiveFeaturesEnabled },
    '../../store/index': {
      getState: () => store,
      setAppConfig: (config: any) => { store.appConfig = config },
      subscribe: (fn: (state: any) => void) => { fn(store); return () => { storeUnsubscribed++ } },
    },
  }
  vm.runInNewContext(generated('pages/listening/listening.js'), {
    exports, require: (name: string) => modules[name], Page: (value: any) => { page = value },
    getApp: () => ({ globalData: {} }), console, setInterval, clearInterval,
    wx: {
      showToast: (options: any) => toastMessages.push(options.title),
      showModal: (options: any) => { unlockPrompts++; options.success({ confirm: true }) },
      navigateTo: (options: any) => { navigated = options.url },
      showActionSheet: (options: any) => options.success({ tapIndex: 1 }),
    },
  })
  page.setData = (value: any) => Object.assign(page.data, value)
  assert.equal(exports.formatListeningDuration(75, true), '1:15')
  assert.equal(exports.formatListeningDuration(3601, true), '1:00:01')
  assert.equal(exports.formatListeningDuration(NaN), '0 秒')
  page.onLoad()
  await page.loadAlbums()
  assert.equal(page.data.albums[0].availableCount, 1)
  assert.equal(page.data.categories.length, 2)
  page.handleCategory({ currentTarget: { dataset: { category: '电话' } } })
  assert.equal(page.data.visibleAlbums[0].id, 'phone')
  page.handleOpenAlbum({ currentTarget: { dataset: { id: 'course' } } })
  await page.handlePlayTrack({ currentTarget: { dataset: { id: 'paid' } } })
  assert.equal(unlockPrompts, 1)
  assert.equal(navigated, '/pages/unlock/unlock')
  assert.equal(fixture.calls.length, 0, 'Locked rows never request playback')
  page.handleTranscript({ currentTarget: { dataset: { id: 'paid' } } })
  assert.equal(page.data.transcriptText, '', 'A locked row cannot reveal its transcript')
  await page.handlePlayAlbum()
  assert.deepEqual(fixture.calls.pop(), ['play', 'course', 'free'], 'Play all starts with the first available track')
  fixture.state.active = true
  await page.handlePlayTrack({ currentTarget: { dataset: { id: 'free' } } })
  assert.deepEqual(fixture.calls.pop(), ['toggle'])
  await page.handleContinueListening()
  assert.deepEqual(fixture.calls.pop(), ['play', 'course', 'free', true], 'Continue uses the saved playback position')
  page.data.audioPlaybackEnabled = false
  await page.handlePlayAlbum()
  await page.handlePlayTrack({ currentTarget: { dataset: { id: 'free' } } })
  await page.handleContinueListening()
  assert.equal(fixture.calls.length, 0, 'The audio master switch blocks every start action')
  page.data.audioPlaybackEnabled = true
  fixture.state.error = '这张专辑暂无可播放音频'
  await page.handlePlayAlbum()
  fixture.calls.pop()
  assert.equal(toastMessages.pop(), '这张专辑暂无可播放音频', 'Player errors that are represented in state still give visible feedback')
  fixture.state.error = null
  page.handleRepeatMode()
  assert.equal(page.data.modeLabel, '列表循环')
  page.handleRepeatMode()
  assert.equal(page.data.modeLabel, '单条循环')
  page.handleSleepTimer()
  assert.deepEqual(fixture.calls.pop(), ['timer', 30])
  catalogFails = true
  await page.loadAlbums()
  assert.match(page.data.error, /重试/)
  assert.equal(page.data.albums.length, 2, 'Catalog refresh failures keep the already loaded directory available')
  page.onUnload()
  assert.equal(fixture.unsubscribed(), 1)
  assert.equal(storeUnsubscribed, 1)
  assert.equal(fixture.calls.length, 0, 'Leaving the listening page never stops background audio')
}

async function checkMiniPlayerLifecycle() {
  const fixture = playerFixture()
  let definition: any
  vm.runInNewContext(generated('components/listening-mini-player/listening-mini-player.js'), {
    exports: {}, require: () => fixture.player, Component: (value: any) => { definition = value },
    wx: { switchTab: () => {}, showToast: () => {} },
  })
  const component = { ...definition.methods, data: definition.data,
    setData(value: any) { Object.assign(this.data, value) } }
  definition.lifetimes.attached.call(component)
  assert.equal(component.data.visible, false, 'A saved resume position alone does not open the mini-player')
  fixture.state.active = true
  fixture.emit()
  assert.equal(component.data.visible, true)
  await component.togglePlayback()
  assert.deepEqual(fixture.calls.pop(), ['toggle'])
  definition.lifetimes.detached.call(component)
  assert.equal(fixture.unsubscribed(), 1)
  assert.equal(fixture.calls.length, 0, 'Removing a mini-player does not terminate playback')
}

export const listeningPageTestDone = (async () => {
  checkTemplateExpressions()
  await checkApiBoundary()
  await checkPageActions()
  await checkMiniPlayerLifecycle()
  console.log('listening page tests passed.')
})()
