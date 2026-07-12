import assert from "node:assert/strict"

import {
  SCENE_END_EPSILON,
  SCENE_RESTART_EPSILON,
  REPEAT_STOP_COMPENSATION_S,
  buildCompletionCuePayload,
  buildEchoSegmentUrl,
  clampCourseTimeToScene,
  computeRepeatStopWindow,
  createAudioLoadTimeoutController,
  hasReachedSceneEnd,
  resolveAudioErrorTip,
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

// ==================== 音频加载超时控制器 ====================

type FakeTimerHarness = {
  fire(id: number): void
  pendingCount(): number
}

function createFakeTimers(): FakeTimerHarness & {
  setTimer: (handler: () => void, ms: number) => number
  clearTimer: (id: number) => void
  lastDelayMs: () => number | null
} {
  const handlers = new Map<number, () => void>()
  let nextId = 1
  let lastDelay: number | null = null
  return {
    setTimer(handler, ms) {
      lastDelay = ms
      const id = nextId++
      handlers.set(id, handler)
      return id
    },
    clearTimer(id) {
      handlers.delete(id)
    },
    fire(id) {
      const handler = handlers.get(id)
      handlers.delete(id)
      handler?.()
    },
    pendingCount() {
      return handlers.size
    },
    lastDelayMs() {
      return lastDelay
    },
  }
}

function createControllerHarness(overrides: {
  sources?: Array<{ provider: "qiniu" | "mirror" | "server"; url: string }>
  currentSource?: string
} = {}) {
  const timers = createFakeTimers()
  const fallbackCalls: string[] = []
  const timeoutCalls: string[] = []
  const logs: string[] = []
  const warns: string[] = []
  const sources = overrides.sources ?? [
    { provider: "qiniu" as const, url: "https://cdn/audio.mp3" },
    { provider: "server" as const, url: "https://server/audio.mp3" },
  ]
  let currentSource = overrides.currentSource ?? "https://cdn/audio.mp3"
  let audioReady = false

  const controller = createAudioLoadTimeoutController({
    getSourceOptions: () => sources,
    getCurrentSource: () => currentSource,
    getAudioReady: () => audioReady,
    onTimeout: source => {
      timeoutCalls.push(source)
    },
    onTimeoutFallback: source => {
      fallbackCalls.push(source)
    },
    log: message => logs.push(message),
    warn: message => warns.push(message),
    timeoutMs: 10000,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  })

  return {
    controller,
    timers,
    fallbackCalls,
    timeoutCalls,
    logs,
    warns,
    setCurrentSource(value: string) {
      currentSource = value
    },
    setAudioReady(value: boolean) {
      audioReady = value
    },
  }
}

// server 源与未知源不启动计时器
{
  const harness = createControllerHarness()
  harness.controller.schedule("https://server/audio.mp3")
  assert.equal(harness.timers.pendingCount(), 0)
  harness.controller.schedule("https://unknown/audio.mp3")
  assert.equal(harness.timers.pendingCount(), 0)
  assert.equal(harness.logs.length, 0)
}

// CDN 源超时且存在下一个源时触发回退
{
  const harness = createControllerHarness()
  harness.controller.schedule("https://cdn/audio.mp3")
  assert.equal(harness.timers.pendingCount(), 1)
  assert.equal(harness.timers.lastDelayMs(), 10000)
  harness.timers.fire(1)
  assert.deepEqual(harness.timeoutCalls, ["https://cdn/audio.mp3"])
  assert.deepEqual(harness.fallbackCalls, ["https://cdn/audio.mp3"])
  assert.equal(harness.warns.length, 1)
}

// 超时前音源已切换（当前源≠超时源）则不回退
{
  const harness = createControllerHarness()
  harness.controller.schedule("https://cdn/audio.mp3")
  harness.setCurrentSource("https://server/audio.mp3")
  harness.timers.fire(1)
  assert.deepEqual(harness.timeoutCalls, [])
  assert.deepEqual(harness.fallbackCalls, [])
}

// 超时回调触发前音频已就绪时，不记录超时也不切源
{
  const harness = createControllerHarness()
  harness.controller.schedule("https://cdn/audio.mp3")
  harness.setAudioReady(true)
  harness.timers.fire(1)
  assert.deepEqual(harness.timeoutCalls, [])
  assert.deepEqual(harness.fallbackCalls, [])
}

// clear 取消计时器；重复 schedule 会先清掉上一个
{
  const harness = createControllerHarness()
  harness.controller.schedule("https://cdn/audio.mp3")
  harness.controller.clear()
  assert.equal(harness.timers.pendingCount(), 0)

  harness.controller.schedule("https://cdn/audio.mp3")
  harness.controller.schedule("https://cdn/audio.mp3")
  assert.equal(harness.timers.pendingCount(), 1)
}

// ==================== 播放事件纯决策 ====================

// computeRepeatStopWindow：按倍速换算播放时长并加固定补偿
{
  const window = computeRepeatStopWindow({ start: 10, end: 14 }, 2)
  assert.equal(window.totalDuration, 4)
  assert.equal(window.playDuration, 2)
  assert.equal(window.adjustedDuration, 2 + REPEAT_STOP_COMPENSATION_S)
}

// resolveAudioErrorTip：错误码映射与兜底文案
assert.equal(resolveAudioErrorTip(10001, "ignored"), "系统错误 (iOS 格式或压缩问题)")
assert.equal(resolveAudioErrorTip(10002, "ignored"), "网络错误")
assert.equal(resolveAudioErrorTip(10004, "ignored"), "格式错误")
assert.equal(resolveAudioErrorTip(99999, "自定义错误"), "自定义错误")
assert.equal(resolveAudioErrorTip(undefined, ""), "播放失败")

// buildEchoSegmentUrl：切片地址拼接
assert.equal(
  buildEchoSegmentUrl("https://api.example.com", "scene-01", "s3"),
  "https://api.example.com/static/audio-segments/scene-01/segment_s3.m4a",
)

console.log("player core tests passed.")

// ==================== 学习阶段模型 ====================

import {
  MIN_GAP_MS,
  computeGapMs,
  findNextCue,
  resolveAudioFallbackPlaybackState,
  resolveStagePlan,
} from "../miniprogram/pages/course/player-core"

// 后台音频切源：优先保留待 seek 位置与明确的 autoplay 意图；否则回退当前时间和播放状态。
assert.deepEqual(
  resolveAudioFallbackPlaybackState({
    pendingTargetTime: 12.5,
    currentTime: 10,
    lastKnownCourseTime: 8,
    pendingShouldAutoplay: false,
    playing: true,
    backgroundPlaybackActive: true,
    managerPaused: false,
  }),
  { courseTime: 12.5, shouldAutoplay: false },
)
assert.deepEqual(
  resolveAudioFallbackPlaybackState({
    currentTime: 10,
    lastKnownCourseTime: 8,
    playing: false,
    backgroundPlaybackActive: true,
    managerPaused: true,
  }),
  { courseTime: 10, shouldAutoplay: true },
)

// 阶段→通道与句末策略
assert.deepEqual(resolveStagePlan("listen", false), { channel: "shadow", cueEndPolicy: "none" })
assert.deepEqual(resolveStagePlan("listen", true), { channel: "shadow", cueEndPolicy: "none" })
assert.deepEqual(resolveStagePlan("practice", false), { channel: "echo", cueEndPolicy: "none" })
assert.deepEqual(resolveStagePlan("follow", false), { channel: "shadow", cueEndPolicy: "none" })
assert.deepEqual(resolveStagePlan("follow", true), { channel: "echo", cueEndPolicy: "gap-advance" })

// 留白时长≈句长按倍速换算，短句保底
assert.equal(computeGapMs({ start: 10, end: 14 }, 1), 4000)
assert.equal(computeGapMs({ start: 10, end: 14 }, 2), 2000)
assert.equal(computeGapMs({ start: 10, end: 10.2 }, 1), MIN_GAP_MS)
assert.equal(computeGapMs({ start: 10, end: 9 }, 1), MIN_GAP_MS)

// 下一句查找
const cueList = [{ id: "s1" }, { id: "s2" }, { id: "s3" }]
assert.equal(findNextCue(cueList, "s1")?.id, "s2")
assert.equal(findNextCue(cueList, "s3"), null)
assert.equal(findNextCue(cueList, "missing"), null)
assert.equal(findNextCue(cueList, null)?.id, "s1")
assert.equal(findNextCue([], "s1"), null)

console.log("stage plan tests passed.")
