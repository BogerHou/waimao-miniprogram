"use strict";
// 课程播放引擎的纯逻辑核心。
// 里程碑 1 切片 A（见 docs/exec-plans/active/2026-07-11-course-player-unification.md）：
// 先收拢与页面无关的范围钳制、进度 cue 计算，后续切片继续把音频上下文管理迁入。
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCENE_END_EPSILON = exports.SCENE_RESTART_EPSILON = void 0;
exports.clampCourseTimeToScene = clampCourseTimeToScene;
exports.hasReachedSceneEnd = hasReachedSceneEnd;
exports.resolveProgressCueIndex = resolveProgressCueIndex;
exports.buildCompletionCuePayload = buildCompletionCuePayload;
// 距小节末尾不足该值时视为"已越过末尾"，restartWhenPastEnd 会回到小节开头。
exports.SCENE_RESTART_EPSILON = 0.1;
// 播放时间进入该容差窗口即判定小节播放完成；比 restart 容差更紧，避免完成判定抢先触发重启。
exports.SCENE_END_EPSILON = 0.08;
function clampCourseTimeToScene(courseTime, range, options = {}) {
    const safeTime = Math.max(0, Number(courseTime) || 0);
    if (!range) {
        return safeTime;
    }
    if (options.restartWhenPastEnd && safeTime >= range.end - exports.SCENE_RESTART_EPSILON) {
        return range.start;
    }
    return Math.min(Math.max(safeTime, range.start), range.end);
}
function hasReachedSceneEnd(courseTime, range) {
    return Boolean(range && courseTime >= range.end - exports.SCENE_END_EPSILON);
}
function resolveProgressCueIndex(options) {
    const totalCues = options.subtitles.length;
    if (totalCues <= 0) {
        return 0;
    }
    const preferred = options.preferredSubtitleId;
    const subtitleIndex = preferred
        ? options.subtitles.findIndex(subtitle => subtitle.id === preferred)
        : -1;
    if (subtitleIndex >= 0) {
        return subtitleIndex;
    }
    return Math.min(Math.max(options.fallbackIndex, 0), totalCues - 1);
}
function buildCompletionCuePayload(totalCues, progressCueIndex) {
    return {
        totalCues,
        cueIndex: totalCues > 0 ? Math.max(progressCueIndex, totalCues - 1) : 0,
    };
}
