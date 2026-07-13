import assert from 'node:assert/strict'
import { formatStudyDuration } from '../miniprogram/utils/learning-records'

assert.equal(formatStudyDuration(59), '59 秒')
assert.equal(formatStudyDuration(60), '1 分钟')
assert.equal(formatStudyDuration(7260), '2 小时 1 分钟')

console.log('learning duration tests passed.')
