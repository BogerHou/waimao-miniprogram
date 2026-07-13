import assert from 'node:assert/strict'
import {
  normalizeReviewLibrary,
  removeReviewCue,
  upsertReviewCue,
  upsertReviewWord,
} from '../miniprogram/utils/review-library'

const normalized = normalizeReviewLibrary({
  words: [{ word: ' Quote ', normalized: 'QUOTE', definition: '报价', savedAt: 1 }],
  cues: [{ courseId: 'scene-1', cueId: 'cue-1', cueText: 'Follow up.', savedAt: 2 }],
})
assert.equal(normalized.words[0]?.normalized, 'quote')
assert.equal(normalized.words[0]?.definition, '报价')
assert.equal(normalized.cues[0]?.cueText, 'Follow up.')

const withWord = upsertReviewWord(normalized, {
  word: 'quote',
  normalized: 'quote',
  definition: '报价；引用',
  courseId: 'scene-1',
  cueId: 'cue-1',
})
assert.equal(withWord.words.length, 1)
assert.equal(withWord.words[0]?.definition, '报价；引用')

const withPartialRefresh = upsertReviewWord(withWord, {
  word: 'quote',
  normalized: 'quote',
  definition: '',
  phoneticUs: '/kwoʊt/',
})
assert.equal(withPartialRefresh.words[0]?.definition, '报价；引用')
assert.equal(withPartialRefresh.words[0]?.phoneticUs, '/kwoʊt/')

const withCue = upsertReviewCue(withPartialRefresh, {
  courseId: 'scene-2',
  cueId: 'cue-2',
  cueText: 'Could you confirm the lead time?',
})
assert.equal(withCue.cues.length, 2)
assert.equal(removeReviewCue(withCue, 'scene-2', 'cue-2').cues.length, 1)

const testGlobals = globalThis as typeof globalThis & {
  Page?: (definition: unknown) => void
  wx?: Record<string, unknown>
}
const previousPage = testGlobals.Page
const previousWx = testGlobals.wx
let resolveReviewAudioTapAction: ((
  current: { type: '' | 'word' | 'cue'; id: string; status: 'idle' | 'loading' | 'playing' | 'paused' },
  target: { type: 'word' | 'cue'; id: string },
) => 'start' | 'pause' | 'resume' | 'cancel') | undefined
let buildReviewCueViews: ((cues: Array<{ courseId: string; cueId: string }>) => Array<{ audioId: string }>) | undefined
let reviewPageDefinition: Record<string, (...args: any[]) => any> | null = null

try {
  testGlobals.Page = definition => {
    reviewPageDefinition = definition as Record<string, (...args: any[]) => any>
  }
  testGlobals.wx = {}
  ;({ resolveReviewAudioTapAction, buildReviewCueViews } = require('../miniprogram/pages/review/review'))
} finally {
  testGlobals.Page = previousPage
  testGlobals.wx = previousWx
}

assert.ok(resolveReviewAudioTapAction)
assert.equal(resolveReviewAudioTapAction(
  { type: 'word', id: 'quote', status: 'playing' },
  { type: 'word', id: 'quote' },
), 'pause')
assert.equal(resolveReviewAudioTapAction(
  { type: 'cue', id: 'cue-1', status: 'paused' },
  { type: 'cue', id: 'cue-1' },
), 'resume')
assert.equal(resolveReviewAudioTapAction(
  { type: 'cue', id: 'cue-1', status: 'loading' },
  { type: 'cue', id: 'cue-1' },
), 'cancel')
assert.equal(resolveReviewAudioTapAction(
  { type: 'word', id: 'quote', status: 'playing' },
  { type: 'cue', id: 'cue-1' },
), 'start')
assert.ok(buildReviewCueViews)
assert.deepEqual(buildReviewCueViews([
  { courseId: 'scene-1', cueId: 'book-cue-0001-s1' },
  { courseId: 'scene-2', cueId: 'book-cue-0001-s1' },
]).map(item => item.audioId), [
  'scene-1:book-cue-0001-s1',
  'scene-2:book-cue-0001-s1',
])

assert.ok(reviewPageDefinition)
const reviewPage = reviewPageDefinition as Record<string, (...args: any[]) => any>
const audioHandlers: Record<string, () => void> = {}
const fakeAudioContext = {
  autoplay: false,
  obeyMuteSwitch: false,
  paused: false,
  currentTime: 0,
  src: '',
  startTime: 0,
  play() {},
  pause() {},
  stop() {},
  destroy() {},
  onPlay(handler: () => void) { audioHandlers.play = handler },
  onPause(handler: () => void) { audioHandlers.pause = handler },
  onWaiting(handler: () => void) { audioHandlers.waiting = handler },
  onCanplay(handler: () => void) { audioHandlers.canplay = handler },
  onTimeUpdate(handler: () => void) { audioHandlers.timeupdate = handler },
  onEnded(handler: () => void) { audioHandlers.ended = handler },
  onError(handler: () => void) { audioHandlers.error = handler },
}
const pageHarness: any = {
  data: { activeAudioType: 'word', activeAudioId: 'quote', audioStatus: 'loading' },
  activeAudioTarget: { type: 'word', id: 'quote', url: 'https://audio.test/quote.mp3' },
  reviewAudioContext: null,
  audioStopTimer: null,
  setData(update: Record<string, unknown>) { Object.assign(this.data, update) },
  clearReviewAudioTimer: reviewPage.clearReviewAudioTimer,
  scheduleReviewAudioStop: reviewPage.scheduleReviewAudioStop,
  resetReviewAudio: reviewPage.resetReviewAudio,
}

try {
  testGlobals.wx = {
    createInnerAudioContext: () => fakeAudioContext,
    showToast: () => undefined,
  }
  reviewPage.ensureReviewAudioContext.call(pageHarness)
  audioHandlers.play?.()
  assert.equal(pageHarness.data.audioStatus, 'playing')
  audioHandlers.waiting?.()
  assert.equal(pageHarness.data.audioStatus, 'loading')
  audioHandlers.canplay?.()
  assert.equal(pageHarness.data.audioStatus, 'playing')
  audioHandlers.pause?.()
  assert.equal(pageHarness.data.audioStatus, 'paused')
  pageHarness.activeAudioTarget = {
    type: 'cue', id: 'cue-1', courseId: 'scene-1', url: 'https://audio.test/scene.mp3', start: 2, end: 3,
  }
  pageHarness.data = { activeAudioType: 'cue', activeAudioId: 'cue-1', audioStatus: 'playing' }
  fakeAudioContext.currentTime = 3
  audioHandlers.timeupdate?.()
  assert.equal(pageHarness.data.audioStatus, 'idle')
  pageHarness.activeAudioTarget = { type: 'word', id: 'quote', url: 'https://audio.test/quote.mp3' }
  pageHarness.data = { activeAudioType: 'word', activeAudioId: 'quote', audioStatus: 'playing' }
  audioHandlers.ended?.()
  assert.equal(pageHarness.data.audioStatus, 'idle')
  assert.equal(pageHarness.activeAudioTarget, null)
} finally {
  testGlobals.wx = previousWx
}

console.log('review library tests passed.')
