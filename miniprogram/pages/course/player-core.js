"use strict";
// 课程播放引擎的纯逻辑核心。
// 里程碑 1（见 docs/exec-plans/active/2026-07-11-course-player-unification.md）：
// 切片 A：范围钳制、进度 cue 计算；
// 切片 B：音频加载超时控制器与播放事件里的纯决策（错误提示、重复停止窗口、Echo 切片地址）。
Object.defineProperty(exports, "__esModule", { value: true });
exports.REPEAT_STOP_COMPENSATION_S = exports.AUDIO_LOAD_TIMEOUT_MS = exports.SCENE_END_EPSILON = exports.SCENE_RESTART_EPSILON = void 0;
exports.clampCourseTimeToScene = clampCourseTimeToScene;
exports.hasReachedSceneEnd = hasReachedSceneEnd;
exports.resolveProgressCueIndex = resolveProgressCueIndex;
exports.buildCompletionCuePayload = buildCompletionCuePayload;
exports.createAudioLoadTimeoutController = createAudioLoadTimeoutController;
exports.computeRepeatStopWindow = computeRepeatStopWindow;
exports.resolveAudioErrorTip = resolveAudioErrorTip;
exports.buildEchoSegmentUrl = buildEchoSegmentUrl;
const audio_source_fallback_1 = require("./audio-source-fallback");
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
// ==================== 音频加载超时控制器（切片 B） ====================
exports.AUDIO_LOAD_TIMEOUT_MS = 10000;
// CDN 音源加载超时守卫：仅对非 server 源计时，超时且存在下一个可用源时触发回退。
// 定时器可注入，便于在 Node 测试里驱动超时路径。
function createAudioLoadTimeoutController(options) {
    const timeoutMs = options.timeoutMs ?? exports.AUDIO_LOAD_TIMEOUT_MS;
    const setTimer = options.setTimer ?? ((handler, ms) => setTimeout(handler, ms));
    const clearTimer = options.clearTimer ?? ((id) => clearTimeout(id));
    let timerId = null;
    const clear = () => {
        if (timerId !== null) {
            clearTimer(timerId);
            timerId = null;
        }
    };
    return {
        clear,
        schedule(src) {
            clear();
            const sourceOption = options.getSourceOptions().find(source => source.url === src);
            if (!sourceOption || sourceOption.provider === 'server') {
                return;
            }
            options.log('[Audio] 启动 CDN 加载超时计时器', {
                src,
                timeoutMs,
            });
            timerId = setTimer(() => {
                const currentSource = options.getCurrentSource();
                const nextAudioSource = (0, audio_source_fallback_1.getNextAudioSourceOption)({
                    timedOutSource: src,
                    currentSource,
                    audioSources: options.getSourceOptions(),
                });
                options.warn('[Audio] CDN 加载超时检查', {
                    timedOutSource: src,
                    currentSource,
                    nextProvider: nextAudioSource?.provider ?? null,
                    nextSource: nextAudioSource?.url ?? null,
                    audioReady: options.getAudioReady(),
                });
                timerId = null;
                if (nextAudioSource) {
                    options.onTimeoutFallback(src);
                }
            }, timeoutMs);
        },
    };
}
// ==================== 播放事件纯决策（切片 B） ====================
// 重复模式备用停止定时器的补偿量：onTimeUpdate 失效时兜底，宁可多播 0.5s 不提前截断。
exports.REPEAT_STOP_COMPENSATION_S = 0.5;
function computeRepeatStopWindow(subtitle, playbackRate) {
    const totalDuration = subtitle.end - subtitle.start;
    const playDuration = totalDuration / playbackRate;
    return {
        totalDuration,
        playDuration,
        adjustedDuration: playDuration + exports.REPEAT_STOP_COMPENSATION_S,
    };
}
function resolveAudioErrorTip(errCode, errMsg) {
    let tip = errMsg || '播放失败';
    if (errCode === 10001)
        tip = '系统错误 (iOS 格式或压缩问题)';
    if (errCode === 10002)
        tip = '网络错误';
    if (errCode === 10004)
        tip = '格式错误';
    return tip;
}
function buildEchoSegmentUrl(apiBaseUrl, courseId, subtitleId) {
    return `${apiBaseUrl}/static/audio-segments/${courseId}/segment_${subtitleId}.m4a`;
}
