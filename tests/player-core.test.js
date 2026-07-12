"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const player_core_1 = require("../miniprogram/pages/course/player-core");
const range = { start: 10, end: 30 };
// clampCourseTimeToScene：无 range 时只做非负钳制
strict_1.default.equal((0, player_core_1.clampCourseTimeToScene)(-5, null), 0);
strict_1.default.equal((0, player_core_1.clampCourseTimeToScene)(42.5, null), 42.5);
strict_1.default.equal((0, player_core_1.clampCourseTimeToScene)(Number.NaN, null), 0);
// 在 range 内保持原值，越界钳回边界
strict_1.default.equal((0, player_core_1.clampCourseTimeToScene)(15, range), 15);
strict_1.default.equal((0, player_core_1.clampCourseTimeToScene)(3, range), 10);
strict_1.default.equal((0, player_core_1.clampCourseTimeToScene)(99, range), 30);
// restartWhenPastEnd：进入末尾容差窗口时回到小节开头，未进入则不受影响
strict_1.default.equal((0, player_core_1.clampCourseTimeToScene)(30, range, { restartWhenPastEnd: true }), 10);
strict_1.default.equal((0, player_core_1.clampCourseTimeToScene)(range.end - player_core_1.SCENE_RESTART_EPSILON, range, { restartWhenPastEnd: true }), 10);
strict_1.default.equal((0, player_core_1.clampCourseTimeToScene)(range.end - player_core_1.SCENE_RESTART_EPSILON - 0.01, range, { restartWhenPastEnd: true }), range.end - player_core_1.SCENE_RESTART_EPSILON - 0.01);
strict_1.default.equal((0, player_core_1.clampCourseTimeToScene)(99, range, { restartWhenPastEnd: true }), 10);
// hasReachedSceneEnd：完成容差比重启容差更紧（先重启判定命中的时间点不应同时判定完成）
strict_1.default.ok(player_core_1.SCENE_END_EPSILON < player_core_1.SCENE_RESTART_EPSILON);
strict_1.default.equal((0, player_core_1.hasReachedSceneEnd)(30, range), true);
strict_1.default.equal((0, player_core_1.hasReachedSceneEnd)(range.end - player_core_1.SCENE_END_EPSILON, range), true);
strict_1.default.equal((0, player_core_1.hasReachedSceneEnd)(range.end - player_core_1.SCENE_END_EPSILON - 0.01, range), false);
strict_1.default.equal((0, player_core_1.hasReachedSceneEnd)(999, null), false);
// resolveProgressCueIndex：优先命中指定字幕，其次回退索引并钳到合法区间
const subtitles = [{ id: "s1" }, { id: "s2" }, { id: "s3" }];
strict_1.default.equal((0, player_core_1.resolveProgressCueIndex)({ subtitles, preferredSubtitleId: "s2", fallbackIndex: 0 }), 1);
strict_1.default.equal((0, player_core_1.resolveProgressCueIndex)({ subtitles, preferredSubtitleId: "missing", fallbackIndex: 2 }), 2);
strict_1.default.equal((0, player_core_1.resolveProgressCueIndex)({ subtitles, preferredSubtitleId: null, fallbackIndex: -1 }), 0);
strict_1.default.equal((0, player_core_1.resolveProgressCueIndex)({ subtitles, preferredSubtitleId: undefined, fallbackIndex: 99 }), 2);
strict_1.default.equal((0, player_core_1.resolveProgressCueIndex)({ subtitles: [], preferredSubtitleId: "s1", fallbackIndex: 5 }), 0);
// buildCompletionCuePayload：完成上报永远落在最后一个 cue，空字幕安全兜底
strict_1.default.deepEqual((0, player_core_1.buildCompletionCuePayload)(3, 1), { totalCues: 3, cueIndex: 2 });
strict_1.default.deepEqual((0, player_core_1.buildCompletionCuePayload)(3, 2), { totalCues: 3, cueIndex: 2 });
strict_1.default.deepEqual((0, player_core_1.buildCompletionCuePayload)(0, 0), { totalCues: 0, cueIndex: 0 });
function createFakeTimers() {
    const handlers = new Map();
    let nextId = 1;
    let lastDelay = null;
    return {
        setTimer(handler, ms) {
            lastDelay = ms;
            const id = nextId++;
            handlers.set(id, handler);
            return id;
        },
        clearTimer(id) {
            handlers.delete(id);
        },
        fire(id) {
            const handler = handlers.get(id);
            handlers.delete(id);
            handler?.();
        },
        pendingCount() {
            return handlers.size;
        },
        lastDelayMs() {
            return lastDelay;
        },
    };
}
function createControllerHarness(overrides = {}) {
    const timers = createFakeTimers();
    const fallbackCalls = [];
    const logs = [];
    const warns = [];
    const sources = overrides.sources ?? [
        { provider: "qiniu", url: "https://cdn/audio.mp3" },
        { provider: "server", url: "https://server/audio.mp3" },
    ];
    let currentSource = overrides.currentSource ?? "https://cdn/audio.mp3";
    const controller = (0, player_core_1.createAudioLoadTimeoutController)({
        getSourceOptions: () => sources,
        getCurrentSource: () => currentSource,
        getAudioReady: () => false,
        onTimeoutFallback: source => {
            fallbackCalls.push(source);
        },
        log: message => logs.push(message),
        warn: message => warns.push(message),
        timeoutMs: 10000,
        setTimer: timers.setTimer,
        clearTimer: timers.clearTimer,
    });
    return {
        controller,
        timers,
        fallbackCalls,
        logs,
        warns,
        setCurrentSource(value) {
            currentSource = value;
        },
    };
}
// server 源与未知源不启动计时器
{
    const harness = createControllerHarness();
    harness.controller.schedule("https://server/audio.mp3");
    strict_1.default.equal(harness.timers.pendingCount(), 0);
    harness.controller.schedule("https://unknown/audio.mp3");
    strict_1.default.equal(harness.timers.pendingCount(), 0);
    strict_1.default.equal(harness.logs.length, 0);
}
// CDN 源超时且存在下一个源时触发回退
{
    const harness = createControllerHarness();
    harness.controller.schedule("https://cdn/audio.mp3");
    strict_1.default.equal(harness.timers.pendingCount(), 1);
    strict_1.default.equal(harness.timers.lastDelayMs(), 10000);
    harness.timers.fire(1);
    strict_1.default.deepEqual(harness.fallbackCalls, ["https://cdn/audio.mp3"]);
    strict_1.default.equal(harness.warns.length, 1);
}
// 超时前音源已切换（当前源≠超时源）则不回退
{
    const harness = createControllerHarness();
    harness.controller.schedule("https://cdn/audio.mp3");
    harness.setCurrentSource("https://server/audio.mp3");
    harness.timers.fire(1);
    strict_1.default.deepEqual(harness.fallbackCalls, []);
}
// clear 取消计时器；重复 schedule 会先清掉上一个
{
    const harness = createControllerHarness();
    harness.controller.schedule("https://cdn/audio.mp3");
    harness.controller.clear();
    strict_1.default.equal(harness.timers.pendingCount(), 0);
    harness.controller.schedule("https://cdn/audio.mp3");
    harness.controller.schedule("https://cdn/audio.mp3");
    strict_1.default.equal(harness.timers.pendingCount(), 1);
}
// ==================== 播放事件纯决策 ====================
// computeRepeatStopWindow：按倍速换算播放时长并加固定补偿
{
    const window = (0, player_core_1.computeRepeatStopWindow)({ start: 10, end: 14 }, 2);
    strict_1.default.equal(window.totalDuration, 4);
    strict_1.default.equal(window.playDuration, 2);
    strict_1.default.equal(window.adjustedDuration, 2 + player_core_1.REPEAT_STOP_COMPENSATION_S);
}
// resolveAudioErrorTip：错误码映射与兜底文案
strict_1.default.equal((0, player_core_1.resolveAudioErrorTip)(10001, "ignored"), "系统错误 (iOS 格式或压缩问题)");
strict_1.default.equal((0, player_core_1.resolveAudioErrorTip)(10002, "ignored"), "网络错误");
strict_1.default.equal((0, player_core_1.resolveAudioErrorTip)(10004, "ignored"), "格式错误");
strict_1.default.equal((0, player_core_1.resolveAudioErrorTip)(99999, "自定义错误"), "自定义错误");
strict_1.default.equal((0, player_core_1.resolveAudioErrorTip)(undefined, ""), "播放失败");
// buildEchoSegmentUrl：切片地址拼接
strict_1.default.equal((0, player_core_1.buildEchoSegmentUrl)("https://api.example.com", "scene-01", "s3"), "https://api.example.com/static/audio-segments/scene-01/segment_s3.m4a");
console.log("player core tests passed.");
// ==================== 学习阶段模型 ====================
const player_core_2 = require("../miniprogram/pages/course/player-core");
// 阶段→通道与句末策略
strict_1.default.deepEqual((0, player_core_2.resolveStagePlan)("listen", false), { channel: "shadow", cueEndPolicy: "none" });
strict_1.default.deepEqual((0, player_core_2.resolveStagePlan)("listen", true), { channel: "shadow", cueEndPolicy: "none" });
strict_1.default.deepEqual((0, player_core_2.resolveStagePlan)("practice", false), { channel: "echo", cueEndPolicy: "none" });
strict_1.default.deepEqual((0, player_core_2.resolveStagePlan)("follow", false), { channel: "shadow", cueEndPolicy: "none" });
strict_1.default.deepEqual((0, player_core_2.resolveStagePlan)("follow", true), { channel: "echo", cueEndPolicy: "gap-advance" });
// 留白时长≈句长按倍速换算，短句保底
strict_1.default.equal((0, player_core_2.computeGapMs)({ start: 10, end: 14 }, 1), 4000);
strict_1.default.equal((0, player_core_2.computeGapMs)({ start: 10, end: 14 }, 2), 2000);
strict_1.default.equal((0, player_core_2.computeGapMs)({ start: 10, end: 10.2 }, 1), player_core_2.MIN_GAP_MS);
strict_1.default.equal((0, player_core_2.computeGapMs)({ start: 10, end: 9 }, 1), player_core_2.MIN_GAP_MS);
// 下一句查找
const cueList = [{ id: "s1" }, { id: "s2" }, { id: "s3" }];
strict_1.default.equal((0, player_core_2.findNextCue)(cueList, "s1")?.id, "s2");
strict_1.default.equal((0, player_core_2.findNextCue)(cueList, "s3"), null);
strict_1.default.equal((0, player_core_2.findNextCue)(cueList, "missing"), null);
strict_1.default.equal((0, player_core_2.findNextCue)(cueList, null)?.id, "s1");
strict_1.default.equal((0, player_core_2.findNextCue)([], "s1"), null);
console.log("stage plan tests passed.");
