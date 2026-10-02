import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import * as flags from '../miniprogram/config/feature-flags'
import * as search from '../miniprogram/utils/scene-search'

// Execute generated page code with isolated platform adapters. No shared wx,
// production requests, or user storage is used by these page regressions.
function fixture(pageName: string) {
  let page: any
  let listener: ((value: any) => void) | undefined
  let redirects = 0
  let shareAudioEnabled: boolean | undefined
  const state: any = {
    token: null, user: null, progress: null, fullAccess: false,
    appConfig: { interactiveFeaturesEnabled: true, allCoursesFree: true,
      home: { unlockPromptEnabled: true, practiceHelpEnabled: true, ads: [] },
      courseDetail: { shadowModeEnabled: true } },
  }
  const modules: Record<string, unknown> = {
    '../../config/feature-flags': flags,
    '../../utils/scene-search': search,
    '../../utils/storage': { debounce: (fn: unknown) => fn },
    '../../store/index': {
      getState: () => state,
      subscribe: (fn: (value: any) => void) => { listener = fn; fn(state); return () => { listener = undefined } },
      DEFAULT_HOME_AD: {},
    },
    '../../utils/share': { enablePageShareMenu: () => {} },
    '../../utils/share-card': {
      buildIndexShareCardModel: (input: any) => { shareAudioEnabled = input.audioPlaybackEnabled; return {} },
    },
    '../../utils/share-poster': { renderSharePoster: async () => '' },
  }
  const app = { globalData: { readyPromise: Promise.resolve() } }
  vm.runInNewContext(
    fs.readFileSync(path.resolve(__dirname, `../miniprogram/pages/${pageName}/${pageName}.js`), 'utf8'),
    { exports: {}, require: (name: string) => modules[name] ?? {}, Page: (value: any) => { page = value },
      getApp: () => app, console, wx: { switchTab: () => { redirects++ } } },
  )
  page.setData = (value: any) => Object.assign(page.data, value)
  page.scheduleShareImage = () => {}
  return { page, state, changed: () => listener?.(state),
    redirects: () => redirects, shareAudioEnabled: () => shareAudioEnabled }
}

async function run() {
  const index = fixture('index')
  const chapters = [{ id: 'chapter-02', number: 2, label: '第二章', title: '课程',
    free: true, trialFree: false, scenes: [{ id: 'scene-2', title: '场景', free: true }] }]
  index.page.handleStoreUpdate(index.state, 1, chapters)
  assert.equal(index.page.data.chapters[0].locked, false)
  assert.equal(index.page.data.membershipUnlockEnabled, false)
  assert.equal(index.page.data.showUnlockPrompt, false)
  assert.equal(index.page.data.audioPlaybackEnabled, true)
  assert.equal(index.page.data.showPracticeHelp, true)
  await index.page.generateShareImage()
  assert.equal(index.shareAudioEnabled(), true, 'Free courses keep audio-enabled share copy')
  index.state.appConfig.allCoursesFree = false
  index.page.handleStoreUpdate(index.state)
  assert.equal(index.page.data.chapters[0].locked, true, 'Returning to paid locks a previously free projection')
  assert.equal(index.page.data.showUnlockPrompt, true)
  index.state.fullAccess = true
  index.page.handleStoreUpdate(index.state)
  assert.equal(index.page.data.chapters[0].locked, false, 'Members retain access when the free campaign ends')

  const learning = fixture('learning')
  learning.page.onLoad()
  assert.equal(learning.page.data.membershipUnlockEnabled, false)
  assert.equal(learning.page.data.audioPlaybackEnabled, true)
  learning.state.appConfig.allCoursesFree = false
  learning.changed()
  assert.equal(learning.page.data.membershipUnlockEnabled, true, 'Visible learning page reacts to config refresh')
  learning.page.onUnload()

  const unlock = fixture('unlock')
  await unlock.page.onLoad()
  assert.equal(unlock.redirects(), 1, 'A free-mode unlock deep link returns to courses before asking for login')
  await unlock.page.handleRedeem()
  assert.equal(unlock.redirects(), 2, 'Free mode never sends an invite redemption request')
  console.log('free course page tests passed.')
}

export const freeCoursePagesTestDone = run()
