import assert from "node:assert/strict"

import { resolveCourseModePresentation } from "../miniprogram/pages/course/course-mode-config"

function testKeepsShadowModeWhenFeatureEnabled() {
  const result = resolveCourseModePresentation({
    currentPlayMode: "shadow",
    shadowModeEnabled: true,
  })

  assert.deepEqual(result, {
    showModeSelector: true,
    showShadowMode: true,
    showPracticeControls: true,
    effectivePlayMode: "shadow",
  })
}

function testFallsBackToEchoWhenShadowModeDisabled() {
  const result = resolveCourseModePresentation({
    currentPlayMode: "shadow",
    shadowModeEnabled: false,
  })

  assert.deepEqual(result, {
    showModeSelector: false,
    showShadowMode: false,
    showPracticeControls: false,
    effectivePlayMode: "echo",
  })
}

testKeepsShadowModeWhenFeatureEnabled()
testFallsBackToEchoWhenShadowModeDisabled()
console.log("course mode config tests passed.")

// ==================== resolveStagePresentation ====================

import { resolveStagePresentation } from "../miniprogram/pages/course/course-mode-config"

// 通听/跟读（无留白）走后台连续通道
assert.deepEqual(resolveStagePresentation({
  currentStage: "listen",
  gapEnabled: false,
  shadowModeEnabled: true,
}), {
  showModeSelector: true,
  showShadowMode: true,
  showPracticeControls: true,
  effectiveStage: "listen",
  effectivePlayMode: "shadow",
  cueEndPolicy: "none",
})

assert.deepEqual(resolveStagePresentation({
  currentStage: "follow",
  gapEnabled: false,
  shadowModeEnabled: true,
}).effectivePlayMode, "shadow")

// 精练与留白跟读走前台逐句通道，句末策略不同
assert.deepEqual(resolveStagePresentation({
  currentStage: "practice",
  gapEnabled: false,
  shadowModeEnabled: true,
}), {
  showModeSelector: true,
  showShadowMode: true,
  showPracticeControls: true,
  effectiveStage: "practice",
  effectivePlayMode: "echo",
  cueEndPolicy: "none",
})

assert.deepEqual(resolveStagePresentation({
  currentStage: "follow",
  gapEnabled: true,
  shadowModeEnabled: true,
}), {
  showModeSelector: true,
  showShadowMode: true,
  showPracticeControls: true,
  effectiveStage: "follow",
  effectivePlayMode: "echo",
  cueEndPolicy: "gap-advance",
})

// 后台关闭 shadow 时页面只读、阶段回退 practice
assert.deepEqual(resolveStagePresentation({
  currentStage: "listen",
  gapEnabled: true,
  shadowModeEnabled: false,
}), {
  showModeSelector: false,
  showShadowMode: false,
  showPracticeControls: false,
  effectiveStage: "practice",
  effectivePlayMode: "echo",
  cueEndPolicy: "none",
})

console.log("stage presentation tests passed.")

// 阶段切换属于用户主动导航，必须绕过播放过程的滚动节流并立即回到第一句。
type CoursePageDefinition = {
  startStageFromBeginning(stage: "listen" | "practice" | "follow"): void
  focusCueFromSource(cueId: string, autoplay: boolean): void
}

const testGlobals = globalThis as typeof globalThis & {
  Page?: (definition: CoursePageDefinition) => void
  wx?: Record<string, unknown>
}
const previousPage = testGlobals.Page
const previousWx = testGlobals.wx
let coursePageDefinition: CoursePageDefinition | null = null

try {
  testGlobals.Page = definition => {
    coursePageDefinition = definition
  }
  testGlobals.wx = {}
  require("../miniprogram/pages/course/course")
} finally {
  testGlobals.Page = previousPage
  testGlobals.wx = previousWx
}

assert.ok(coursePageDefinition)
const pageDefinition = coursePageDefinition as CoursePageDefinition

for (const playMode of ["echo", "shadow"] as const) {
  const selected: string[] = []
  const started: string[] = []
  const centeredImmediately: string[] = []
  pageDefinition.startStageFromBeginning.call({
    data: {
      subtitles: [{ id: "first-cue", start: 0, end: 1 }],
      playMode,
      audioLoading: false,
    },
    audioReady: false,
    selectCue: (cueId: string) => selected.push(cueId),
    startShadowMode: () => started.push("shadow"),
    _centerSubtitleImpl: (cueId: string) => centeredImmediately.push(cueId),
  }, playMode === "echo" ? "practice" : "follow")

  assert.deepEqual(centeredImmediately, ["first-cue"])
  assert.deepEqual(selected, playMode === "echo" ? ["first-cue"] : [])
  assert.deepEqual(started, playMode === "shadow" ? ["shadow"] : [])
}

console.log("stage reset scroll tests passed.")

const focusTarget = { id: "focus-cue", start: 2, end: 3 }
const selectedFromSource: string[] = []
const centeredFromSource: string[] = []
const playedFromSource: string[] = []
const readyFocusHarness: any = {
  data: {
    subtitles: [focusTarget],
    showPracticeControls: true,
    playMode: "echo",
    audioLoading: false,
    course: { audio: "https://audio.test/course.mp3" },
  },
  audioContext: {},
  audioReady: true,
  pendingSubtitle: null,
  selectCue: (cueId: string) => selectedFromSource.push(cueId),
  _centerSubtitleImpl: (cueId: string) => centeredFromSource.push(cueId),
  ensureAudioContext: () => undefined,
  playSubtitle: (cue: { id: string }) => playedFromSource.push(cue.id),
}
pageDefinition.focusCueFromSource.call(readyFocusHarness, focusTarget.id, true)
assert.deepEqual(selectedFromSource, [focusTarget.id])
assert.deepEqual(centeredFromSource, [focusTarget.id])
assert.deepEqual(playedFromSource, [focusTarget.id])

const loadingFocusHarness: any = {
  ...readyFocusHarness,
  data: { ...readyFocusHarness.data, audioLoading: true },
  audioReady: false,
  pendingSubtitle: null,
  playSubtitle: () => assert.fail("loading source focus must wait for onCanplay"),
}
pageDefinition.focusCueFromSource.call(loadingFocusHarness, focusTarget.id, true)
assert.equal(loadingFocusHarness.pendingSubtitle?.id, focusTarget.id)

const locateOnlyHarness: any = {
  ...readyFocusHarness,
  pendingSubtitle: null,
  playSubtitle: () => assert.fail("ordinary cue deep links must not autoplay"),
}
pageDefinition.focusCueFromSource.call(locateOnlyHarness, focusTarget.id, false)
assert.equal(locateOnlyHarness.pendingSubtitle, null)

console.log("course source focus autoplay tests passed.")
