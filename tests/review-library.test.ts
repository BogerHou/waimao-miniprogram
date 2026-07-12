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

console.log('review library tests passed.')
