"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const shadow_background_handoff_1 = require("../miniprogram/pages/course/shadow-background-handoff");
const subtitles = [
    { id: "s1", start: 0, end: 2 },
    { id: "s2", start: 2.1, end: 4.6 },
    { id: "s3", start: 4.7, end: 7.2 },
];
function testResolveCourseTimeUsesPlayerProgress() {
    const courseTime = (0, shadow_background_handoff_1.resolveCourseTimeFromForeground)({
        audioCurrentTime: 5.25,
        activeSubtitle: subtitles[1],
        lastKnownCourseTime: 1.2,
    });
    strict_1.default.equal(courseTime, 5.25);
}
function testResolveCourseTimeFallsBackToSubtitleStart() {
    const courseTime = (0, shadow_background_handoff_1.resolveCourseTimeFromForeground)({
        audioCurrentTime: 0.05,
        activeSubtitle: subtitles[2],
        lastKnownCourseTime: 0,
    });
    strict_1.default.equal(courseTime, 4.7);
}
function testResolveCourseTimeUsesLastKnownAfterEchoFinishedAndCurrentTimeResets() {
    const courseTime = (0, shadow_background_handoff_1.resolveCourseTimeFromForeground)({
        audioCurrentTime: 0,
        activeSubtitle: subtitles[1],
        lastKnownCourseTime: 4.6,
    });
    strict_1.default.equal(courseTime, 4.6);
}
function testFindSubtitleByCourseTimePrefersCurrentWindow() {
    const match = (0, shadow_background_handoff_1.findSubtitleByCourseTime)(subtitles, 4.55, 0.3);
    strict_1.default.equal(match?.subtitle.id, "s2");
    strict_1.default.equal(match?.index, 1);
}
function testFindSubtitleByCourseTimeFallsForwardNearBoundary() {
    const match = (0, shadow_background_handoff_1.findSubtitleByCourseTime)(subtitles, 4.68, 0.2);
    strict_1.default.equal(match?.subtitle.id, "s3");
    strict_1.default.equal(match?.index, 2);
}
function testResolveForegroundResumeStateKeepsPlaybackIntent() {
    const resume = (0, shadow_background_handoff_1.resolveForegroundResumeState)({
        subtitles,
        courseTime: 4.9,
        tolerance: 0.3,
        wasPlayingInBackground: true,
    });
    strict_1.default.ok(resume);
    strict_1.default.equal(resume.resumeTime, 4.9);
    strict_1.default.equal(resume.shouldAutoplay, true);
    strict_1.default.equal(resume.subtitle.id, "s3");
    strict_1.default.equal(resume.index, 2);
}
function testBuildBackgroundPlaybackMetaUsesCourseInfo() {
    const meta = (0, shadow_background_handoff_1.buildBackgroundPlaybackMeta)({
        id: "englishpod_0001",
        title: "Difficult Customer",
        audio: "https://cdn.example.com/audio.mp3",
        tag: "Elementary",
    }, 12.5);
    strict_1.default.equal(meta.src, "https://cdn.example.com/audio.mp3");
    strict_1.default.equal(meta.startTime, 12.5);
    strict_1.default.equal(meta.title, "Difficult Customer");
    strict_1.default.equal(meta.epname, "外贸英语影子跟读");
    strict_1.default.equal(meta.singer, "外贸英语影子跟读");
}
function testBuildCourseNavigationUrlAddsRestoreFlag() {
    strict_1.default.equal((0, shadow_background_handoff_1.buildCourseNavigationUrl)("englishpod_0001", { fromBackgroundAudio: 1 }), "/pages/course/course?id=englishpod_0001&fromBackgroundAudio=1");
}
function testNormalizeBackgroundAudioResumeStateRejectsExpiredState() {
    strict_1.default.equal((0, shadow_background_handoff_1.normalizeBackgroundAudioResumeState)({
        courseId: "englishpod_0001",
        courseTime: 12,
        savedAt: 1000,
    }, 1000 + shadow_background_handoff_1.BACKGROUND_AUDIO_RESUME_TTL_MS + 1), null);
}
function testShouldRestoreBackgroundAudioRouteSkipsCurrentCourse() {
    strict_1.default.equal((0, shadow_background_handoff_1.shouldRestoreBackgroundAudioRoute)({
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
    }), false);
}
function testShouldRestoreBackgroundAudioRouteRequiresMatchingAudio() {
    strict_1.default.equal((0, shadow_background_handoff_1.shouldRestoreBackgroundAudioRoute)({
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
    }), false);
}
function testShouldRestoreBackgroundAudioRouteFromIndex() {
    strict_1.default.equal((0, shadow_background_handoff_1.shouldRestoreBackgroundAudioRoute)({
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
    }), true);
}
function testResolveShadowModeSwitchStateUsesCurrentProgress() {
    const result = (0, shadow_background_handoff_1.resolveShadowModeSwitchState)({
        subtitles,
        courseTime: 4.95,
        fallbackSubtitleId: "s1",
        shouldAutoplay: true,
    });
    strict_1.default.equal(result?.resumeTime, 4.95);
    strict_1.default.equal(result?.subtitle.id, "s3");
    strict_1.default.equal(result?.index, 2);
    strict_1.default.equal(result?.shouldAutoplay, true);
}
function testResolveEchoToShadowSwitchStateUsesCompletionTimeAndAutoplays() {
    const result = (0, shadow_background_handoff_1.resolveEchoToShadowSwitchState)({
        subtitles,
        audioCurrentTime: 0,
        lastKnownCourseTime: 0,
        activeSubtitle: subtitles[1],
        fallbackSubtitleId: "s2",
        echoCompletedCourseTime: 4.6,
        echoCompletedSubtitleId: "s2",
        tolerance: 0.3,
    });
    strict_1.default.equal(result?.resumeTime, 4.6);
    strict_1.default.equal(result?.subtitle.id, "s3");
    strict_1.default.equal(result?.index, 2);
    strict_1.default.equal(result?.shouldAutoplay, true);
}
function testResolveShadowPlaybackStartTimePrefersLastKnownWhenManagerHasZero() {
    const result = (0, shadow_background_handoff_1.resolveShadowPlaybackStartTime)({
        backgroundCurrentTime: 0,
        lastKnownCourseTime: 23.4,
    });
    strict_1.default.equal(result, 23.4);
}
function testResolveObservedShadowCourseTimeKeepsPendingTargetWhenIosReportsZero() {
    const result = (0, shadow_background_handoff_1.resolveObservedShadowCourseTime)({
        observedTime: 0,
        lastKnownCourseTime: 23.4,
        pendingTargetTime: 23.4,
    });
    strict_1.default.equal(result, 23.4);
}
function testShouldApplyShadowSeekCorrectionWhenObservedTimeStillNearZero() {
    const shouldCorrect = (0, shadow_background_handoff_1.shouldApplyShadowSeekCorrection)({
        currentTime: 0.05,
        targetTime: 23.4,
        tolerance: 0.35,
    });
    strict_1.default.equal(shouldCorrect, true);
}
function testShouldNotApplyShadowSeekCorrectionWhenAlreadyNearTarget() {
    const shouldCorrect = (0, shadow_background_handoff_1.shouldApplyShadowSeekCorrection)({
        currentTime: 23.2,
        targetTime: 23.4,
        tolerance: 0.35,
    });
    strict_1.default.equal(shouldCorrect, false);
}
testResolveCourseTimeUsesPlayerProgress();
testResolveCourseTimeFallsBackToSubtitleStart();
testResolveCourseTimeUsesLastKnownAfterEchoFinishedAndCurrentTimeResets();
testFindSubtitleByCourseTimePrefersCurrentWindow();
testFindSubtitleByCourseTimeFallsForwardNearBoundary();
testResolveForegroundResumeStateKeepsPlaybackIntent();
testBuildBackgroundPlaybackMetaUsesCourseInfo();
testBuildCourseNavigationUrlAddsRestoreFlag();
testNormalizeBackgroundAudioResumeStateRejectsExpiredState();
testShouldRestoreBackgroundAudioRouteSkipsCurrentCourse();
testShouldRestoreBackgroundAudioRouteRequiresMatchingAudio();
testShouldRestoreBackgroundAudioRouteFromIndex();
testResolveShadowModeSwitchStateUsesCurrentProgress();
testResolveEchoToShadowSwitchStateUsesCompletionTimeAndAutoplays();
testResolveShadowPlaybackStartTimePrefersLastKnownWhenManagerHasZero();
testResolveObservedShadowCourseTimeKeepsPendingTargetWhenIosReportsZero();
testShouldApplyShadowSeekCorrectionWhenObservedTimeStillNearZero();
testShouldNotApplyShadowSeekCorrectionWhenAlreadyNearTarget();
console.log("shadow background handoff tests passed.");
