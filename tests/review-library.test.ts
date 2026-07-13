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
let resolveWordAudioTapAction: ((
  current: { id: string; status: 'idle' | 'loading' | 'playing' | 'paused' },
  targetId: string,
) => 'start' | 'pause' | 'resume' | 'cancel') | undefined
let reviewPageDefinition: Record<string, (...args: any[]) => any> | null = null

try {
  testGlobals.Page = definition => {
    reviewPageDefinition = definition as Record<string, (...args: any[]) => any>
  }
  testGlobals.wx = {}
  ;({ resolveWordAudioTapAction } = require('../miniprogram/pages/review/review'))
} finally {
  testGlobals.Page = previousPage
  testGlobals.wx = previousWx
}

assert.ok(resolveWordAudioTapAction)
assert.equal(resolveWordAudioTapAction({ id: 'quote', status: 'playing' }, 'quote'), 'pause')
assert.equal(resolveWordAudioTapAction({ id: 'quote', status: 'paused' }, 'quote'), 'resume')
assert.equal(resolveWordAudioTapAction({ id: 'quote', status: 'loading' }, 'quote'), 'cancel')
assert.equal(resolveWordAudioTapAction({ id: 'quote', status: 'playing' }, 'sample'), 'start')

assert.ok(reviewPageDefinition)
const reviewPage = reviewPageDefinition as Record<string, (...args: any[]) => any>
const audioHandlers: Record<string, () => void> = {}
const fakeAudioContext = {
  autoplay: false,
  obeyMuteSwitch: false,
  paused: false,
  src: '',
  play() {},
  pause() {},
  stop() {},
  destroy() {},
  onPlay(handler: () => void) { audioHandlers.play = handler },
  onPause(handler: () => void) { audioHandlers.pause = handler },
  onWaiting(handler: () => void) { audioHandlers.waiting = handler },
  onCanplay(handler: () => void) { audioHandlers.canplay = handler },
  onEnded(handler: () => void) { audioHandlers.ended = handler },
  onError(handler: () => void) { audioHandlers.error = handler },
}
const pageHarness: any = {
  data: { activeWordAudioId: 'quote', wordAudioStatus: 'loading' },
  wordAudioContext: null,
  setData(update: Record<string, unknown>) { Object.assign(this.data, update) },
  resetWordAudio: reviewPage.resetWordAudio,
}

try {
  testGlobals.wx = {
    createInnerAudioContext: () => fakeAudioContext,
    showToast: () => undefined,
  }
  reviewPage.ensureWordAudioContext.call(pageHarness)
  audioHandlers.play?.()
  assert.equal(pageHarness.data.wordAudioStatus, 'playing')
  audioHandlers.waiting?.()
  assert.equal(pageHarness.data.wordAudioStatus, 'loading')
  audioHandlers.canplay?.()
  assert.equal(pageHarness.data.wordAudioStatus, 'playing')
  audioHandlers.pause?.()
  assert.equal(pageHarness.data.wordAudioStatus, 'paused')
  audioHandlers.ended?.()
  assert.equal(pageHarness.data.wordAudioStatus, 'idle')
  assert.equal(pageHarness.data.activeWordAudioId, '')
} finally {
  testGlobals.wx = previousWx
}

console.log('review library tests passed.')
