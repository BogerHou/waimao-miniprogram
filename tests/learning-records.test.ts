import assert from 'node:assert/strict'
import { buildRecentCalendar, formatStudyDuration, resolveIntensity } from '../miniprogram/utils/learning-records'

assert.equal(formatStudyDuration(59), '59 秒')
assert.equal(formatStudyDuration(60), '1 分钟')
assert.equal(formatStudyDuration(7260), '2 小时 1 分钟')
assert.equal(resolveIntensity(0), 0)
assert.equal(resolveIntensity(300), 2)

const calendar = buildRecentCalendar([
  { date: '2026-07-11', studySeconds: 600, practiceCount: 4, sessionCount: 2 },
], { totalDays: 3, today: new Date(2026, 6, 12) })
assert.equal(calendar.length, 7)
assert.deepEqual(calendar.slice(-3).map(item => item.date), ['2026-07-10', '2026-07-11', '2026-07-12'])
assert.equal(calendar[5]?.intensity, 2)
assert.equal(calendar[6]?.isToday, true)

console.log('learning records tests passed.')
