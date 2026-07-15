import assert from 'node:assert/strict'

import { createReviewStorageGuard } from '../miniprogram/utils/review-storage-guard'
import { STARRED_CUES_STORAGE_KEY } from '../miniprogram/utils/practice-marks'
import { REVIEW_LIBRARY_STORAGE_KEY } from '../miniprogram/utils/review-library'

const values = new Map<string, unknown>([
  [REVIEW_LIBRARY_STORAGE_KEY, { words: [{ normalized: 'quote' }], cues: [] }],
  [STARRED_CUES_STORAGE_KEY, { 'scene-1': ['cue-1'] }],
])
const restore = createReviewStorageGuard({
  get: key => values.get(key),
  set: (key, value) => values.set(key, value),
})

values.delete(REVIEW_LIBRARY_STORAGE_KEY)
values.delete(STARRED_CUES_STORAGE_KEY)
restore()

assert.deepEqual(values.get(REVIEW_LIBRARY_STORAGE_KEY), {
  words: [{ normalized: 'quote' }],
  cues: [],
})
assert.deepEqual(values.get(STARRED_CUES_STORAGE_KEY), { 'scene-1': ['cue-1'] })

values.set(REVIEW_LIBRARY_STORAGE_KEY, { words: [{ normalized: 'newer' }], cues: [] })
restore()
assert.deepEqual(values.get(REVIEW_LIBRARY_STORAGE_KEY), {
  words: [{ normalized: 'newer' }],
  cues: [],
})

console.log('review storage guard tests passed.')
