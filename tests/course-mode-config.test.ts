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
