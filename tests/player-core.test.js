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
console.log("player core tests passed.");
