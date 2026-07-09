import assert from "node:assert/strict"

import {
  BACKGROUND_AUDIO_RESUME_TTL_MS,
  buildBackgroundPlaybackMeta,
  buildCourseNavigationUrl,
  normalizeBackgroundAudioResumeState,
  resolveEchoToShadowSwitchState,
  findSubtitleByCourseTime,
  resolveCourseTimeFromForeground,
  resolveForegroundResumeState,
  resolveObservedShadowCourseTime,
  resolveShadowPlaybackStartTime,
  resolveShadowModeSwitchState,
  shouldRestoreBackgroundAudioRoute,
  shouldApplyShadowSeekCorrection,
} from "../miniprogram/pages/course/shadow-background-handoff"

const subtitles = [
  { id: "s1", start: 0, end: 2 },
  { id: "s2", start: 2.1, end: 4.6 },
  { id: "s3", start: 4.7, end: 7.2 },
]

function testResolveCourseTimeUsesPlayerProgress() {
  const courseTime = resolveCourseTimeFromForeground({
    audioCurrentTime: 5.25,
    activeSubtitle: subtitles[1],
    lastKnownCourseTime: 1.2,
  })

  assert.equal(courseTime, 5.25)
}

function testResolveCourseTimeFallsBackToSubtitleStart() {
  const courseTime = resolveCourseTimeFromForeground({
    audioCurrentTime: 0.05,
    activeSubtitle: subtitles[2],
    lastKnownCourseTime: 0,
  })

  assert.equal(courseTime, 4.7)
}

function testResolveCourseTimeUsesLastKnownAfterEchoFinishedAndCurrentTimeResets() {
  const courseTime = resolveCourseTimeFromForeground({
    audioCurrentTime: 0,
    activeSubtitle: subtitles[1],
    lastKnownCourseTime: 4.6,
  })

  assert.equal(courseTime, 4.6)
}

function testFindSubtitleByCourseTimePrefersCurrentWindow() {
  const match = findSubtitleByCourseTime(subtitles, 4.55, 0.3)

  assert.equal(match?.subtitle.id, "s2")
  assert.equal(match?.index, 1)
}

function testFindSubtitleByCourseTimeFallsForwardNearBoundary() {
  const match = findSubtitleByCourseTime(subtitles, 4.68, 0.2)

  assert.equal(match?.subtitle.id, "s3")
  assert.equal(match?.index, 2)
}

function testResolveForegroundResumeStateKeepsPlaybackIntent() {
  const resume = resolveForegroundResumeState({
    subtitles,
    courseTime: 4.9,
    tolerance: 0.3,
    wasPlayingInBackground: true,
  })

  assert.ok(resume)
  assert.equal(resume.resumeTime, 4.9)
  assert.equal(resume.shouldAutoplay, true)
  assert.equal(resume.subtitle.id, "s3")
  assert.equal(resume.index, 2)
}

function testBuildBackgroundPlaybackMetaUsesCourseInfo() {
  const meta = buildBackgroundPlaybackMeta(
    {
      id: "englishpod_0001",
      title: "Difficult Customer",
      audio: "https://cdn.example.com/audio.mp3",
      tag: "Elementary",
    },
    12.5,
  )

  assert.equal(meta.src, "https://cdn.example.com/audio.mp3")
  assert.equal(meta.startTime, 12.5)
  assert.equal(meta.title, "Difficult Customer")
  assert.equal(meta.epname, "外贸英语影子跟读")
  assert.equal(meta.singer, "外贸英语影子跟读")
}

function testBuildCourseNavigationUrlAddsRestoreFlag() {
  assert.equal(
    buildCourseNavigationUrl("englishpod_0001", { fromBackgroundAudio: 1 }),
    "/pages/course/course?id=englishpod_0001&fromBackgroundAudio=1",
  )
}

function testNormalizeBackgroundAudioResumeStateRejectsExpiredState() {
  assert.equal(
    normalizeBackgroundAudioResumeState(
      {
        courseId: "englishpod_0001",
        courseTime: 12,
        savedAt: 1000,
      },
      1000 + BACKGROUND_AUDIO_RESUME_TTL_MS + 1,
    ),
    null,
  )
}

function testShouldRestoreBackgroundAudioRouteSkipsCurrentCourse() {
  assert.equal(
    shouldRestoreBackgroundAudioRoute({
      resumeState: {
        courseId: "englishpod_0001",
        courseTime: 12,
        audioSrc: "https://cdn.example.com/audio.mp3",
        wasPlaying: true,
        savedAt: 1000,
      },
      currentRoute: "pages/course/course",
      currentCourseId: "englishpod_0001",
      managerSrc: "https://cdn.example.com/audio.mp3",
      now: 1200,
    }),
    false,
  )
}

function testShouldRestoreBackgroundAudioRouteRequiresMatchingAudio() {
  assert.equal(
    shouldRestoreBackgroundAudioRoute({
      resumeState: {
        courseId: "englishpod_0001",
        courseTime: 12,
        audioSrc: "https://cdn.example.com/audio.mp3",
        wasPlaying: true,
        savedAt: 1000,
      },
      currentRoute: "pages/index/index",
      currentCourseId: null,
      managerSrc: "https://cdn.example.com/other.mp3",
      now: 1200,
    }),
    false,
  )
}

function testShouldRestoreBackgroundAudioRouteFromIndex() {
  assert.equal(
    shouldRestoreBackgroundAudioRoute({
      resumeState: {
        courseId: "englishpod_0001",
        courseTime: 12,
        audioSrc: "https://cdn.example.com/audio.mp3",
        wasPlaying: true,
        savedAt: 1000,
      },
      currentRoute: "pages/index/index",
      currentCourseId: null,
      managerSrc: "https://cdn.example.com/audio.mp3",
      now: 1200,
    }),
    true,
  )
}

function testResolveShadowModeSwitchStateUsesCurrentProgress() {
  const result = resolveShadowModeSwitchState({
    subtitles,
    courseTime: 4.95,
    fallbackSubtitleId: "s1",
    shouldAutoplay: true,
  })

  assert.equal(result?.resumeTime, 4.95)
  assert.equal(result?.subtitle.id, "s3")
  assert.equal(result?.index, 2)
  assert.equal(result?.shouldAutoplay, true)
}

function testResolveEchoToShadowSwitchStateUsesCompletionTimeAndAutoplays() {
  const result = resolveEchoToShadowSwitchState({
    subtitles,
    audioCurrentTime: 0,
    lastKnownCourseTime: 0,
    activeSubtitle: subtitles[1],
    fallbackSubtitleId: "s2",
    echoCompletedCourseTime: 4.6,
    echoCompletedSubtitleId: "s2",
    tolerance: 0.3,
  })

  assert.equal(result?.resumeTime, 4.6)
  assert.equal(result?.subtitle.id, "s3")
  assert.equal(result?.index, 2)
  assert.equal(result?.shouldAutoplay, true)
}

function testResolveShadowPlaybackStartTimePrefersLastKnownWhenManagerHasZero() {
  const result = resolveShadowPlaybackStartTime({
    backgroundCurrentTime: 0,
    lastKnownCourseTime: 23.4,
  })

  assert.equal(result, 23.4)
}

function testResolveObservedShadowCourseTimeKeepsPendingTargetWhenIosReportsZero() {
  const result = resolveObservedShadowCourseTime({
    observedTime: 0,
    lastKnownCourseTime: 23.4,
    pendingTargetTime: 23.4,
  })

  assert.equal(result, 23.4)
}

function testShouldApplyShadowSeekCorrectionWhenObservedTimeStillNearZero() {
  const shouldCorrect = shouldApplyShadowSeekCorrection({
    currentTime: 0.05,
    targetTime: 23.4,
    tolerance: 0.35,
  })

  assert.equal(shouldCorrect, true)
}

function testShouldNotApplyShadowSeekCorrectionWhenAlreadyNearTarget() {
  const shouldCorrect = shouldApplyShadowSeekCorrection({
    currentTime: 23.2,
    targetTime: 23.4,
    tolerance: 0.35,
  })

  assert.equal(shouldCorrect, false)
}

testResolveCourseTimeUsesPlayerProgress()
testResolveCourseTimeFallsBackToSubtitleStart()
testResolveCourseTimeUsesLastKnownAfterEchoFinishedAndCurrentTimeResets()
testFindSubtitleByCourseTimePrefersCurrentWindow()
testFindSubtitleByCourseTimeFallsForwardNearBoundary()
testResolveForegroundResumeStateKeepsPlaybackIntent()
testBuildBackgroundPlaybackMetaUsesCourseInfo()
testBuildCourseNavigationUrlAddsRestoreFlag()
testNormalizeBackgroundAudioResumeStateRejectsExpiredState()
testShouldRestoreBackgroundAudioRouteSkipsCurrentCourse()
testShouldRestoreBackgroundAudioRouteRequiresMatchingAudio()
testShouldRestoreBackgroundAudioRouteFromIndex()
testResolveShadowModeSwitchStateUsesCurrentProgress()
testResolveEchoToShadowSwitchStateUsesCompletionTimeAndAutoplays()
testResolveShadowPlaybackStartTimePrefersLastKnownWhenManagerHasZero()
testResolveObservedShadowCourseTimeKeepsPendingTargetWhenIosReportsZero()
testShouldApplyShadowSeekCorrectionWhenObservedTimeStillNearZero()
testShouldNotApplyShadowSeekCorrectionWhenAlreadyNearTarget()
console.log("shadow background handoff tests passed.")
