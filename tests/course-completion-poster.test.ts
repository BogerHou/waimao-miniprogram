import assert from 'node:assert/strict'

import { buildCompletionStatsLabel } from '../miniprogram/pages/course/course-completion-poster'

assert.equal(buildCompletionStatsLabel({ totalCues: 12, practicedCount: 3 }), '共 12 句 · 本次精练 3 句')
assert.equal(buildCompletionStatsLabel({ totalCues: 12, practicedCount: 0 }), '共 12 句')

console.log('course completion poster tests passed.')
