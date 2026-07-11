import assert from "node:assert/strict"

import {
  SCENE_END_EPSILON,
  SCENE_RESTART_EPSILON,
  buildCompletionCuePayload,
  clampCourseTimeToScene,
  hasReachedSceneEnd,
  resolveProgressCueIndex,
} from "../miniprogram/pages/course/player-core"

const range = { start: 10, end: 30 }

// clampCourseTimeToScene：无 range 时只做非负钳制
assert.equal(clampCourseTimeToScene(-5, null), 0)
assert.equal(clampCourseTimeToScene(42.5, null), 42.5)
assert.equal(clampCourseTimeToScene(Number.NaN, null), 0)

// 在 range 内保持原值，越界钳回边界
assert.equal(clampCourseTimeToScene(15, range), 15)
assert.equal(clampCourseTimeToScene(3, range), 10)
assert.equal(clampCourseTimeToScene(99, range), 30)

// restartWhenPastEnd：进入末尾容差窗口时回到小节开头，未进入则不受影响
assert.equal(clampCourseTimeToScene(30, range, { restartWhenPastEnd: true }), 10)
assert.equal(
  clampCourseTimeToScene(range.end - SCENE_RESTART_EPSILON, range, { restartWhenPastEnd: true }),
  10,
)
assert.equal(
  clampCourseTimeToScene(range.end - SCENE_RESTART_EPSILON - 0.01, range, { restartWhenPastEnd: true }),
  range.end - SCENE_RESTART_EPSILON - 0.01,
)
assert.equal(clampCourseTimeToScene(99, range, { restartWhenPastEnd: true }), 10)

// hasReachedSceneEnd：完成容差比重启容差更紧（先重启判定命中的时间点不应同时判定完成）
assert.ok(SCENE_END_EPSILON < SCENE_RESTART_EPSILON)
assert.equal(hasReachedSceneEnd(30, range), true)
assert.equal(hasReachedSceneEnd(range.end - SCENE_END_EPSILON, range), true)
assert.equal(hasReachedSceneEnd(range.end - SCENE_END_EPSILON - 0.01, range), false)
assert.equal(hasReachedSceneEnd(999, null), false)

// resolveProgressCueIndex：优先命中指定字幕，其次回退索引并钳到合法区间
const subtitles = [{ id: "s1" }, { id: "s2" }, { id: "s3" }]
assert.equal(
  resolveProgressCueIndex({ subtitles, preferredSubtitleId: "s2", fallbackIndex: 0 }),
  1,
)
assert.equal(
  resolveProgressCueIndex({ subtitles, preferredSubtitleId: "missing", fallbackIndex: 2 }),
  2,
)
assert.equal(
  resolveProgressCueIndex({ subtitles, preferredSubtitleId: null, fallbackIndex: -1 }),
  0,
)
assert.equal(
  resolveProgressCueIndex({ subtitles, preferredSubtitleId: undefined, fallbackIndex: 99 }),
  2,
)
assert.equal(
  resolveProgressCueIndex({ subtitles: [], preferredSubtitleId: "s1", fallbackIndex: 5 }),
  0,
)

// buildCompletionCuePayload：完成上报永远落在最后一个 cue，空字幕安全兜底
assert.deepEqual(buildCompletionCuePayload(3, 1), { totalCues: 3, cueIndex: 2 })
assert.deepEqual(buildCompletionCuePayload(3, 2), { totalCues: 3, cueIndex: 2 })
assert.deepEqual(buildCompletionCuePayload(0, 0), { totalCues: 0, cueIndex: 0 })

console.log("player core tests passed.")
