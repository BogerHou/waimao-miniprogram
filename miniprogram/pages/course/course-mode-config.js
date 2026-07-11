"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveCourseModePresentation = resolveCourseModePresentation;
exports.resolveStagePresentation = resolveStagePresentation;
const player_core_1 = require("./player-core");
function resolveCourseModePresentation(options) {
    const showShadowMode = options.shadowModeEnabled;
    return {
        showModeSelector: showShadowMode,
        showShadowMode,
        showPracticeControls: showShadowMode,
        effectivePlayMode: showShadowMode ? options.currentPlayMode : "echo",
    };
}
// 阶段版呈现逻辑：后台配置关闭 shadow 时页面进入只读态（与旧 resolveCourseModePresentation 语义一致），
// 阶段强制回退到 practice（前台逐句通道）。
function resolveStagePresentation(options) {
    const enabled = options.shadowModeEnabled;
    const effectiveStage = enabled ? options.currentStage : 'practice';
    const plan = (0, player_core_1.resolveStagePlan)(effectiveStage, options.gapEnabled);
    return {
        showModeSelector: enabled,
        showShadowMode: enabled,
        showPracticeControls: enabled,
        effectiveStage,
        effectivePlayMode: plan.channel,
        cueEndPolicy: plan.cueEndPolicy,
    };
}
