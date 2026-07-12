"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const course_mode_config_1 = require("../miniprogram/pages/course/course-mode-config");
function testKeepsShadowModeWhenFeatureEnabled() {
    const result = (0, course_mode_config_1.resolveCourseModePresentation)({
        currentPlayMode: "shadow",
        shadowModeEnabled: true,
    });
    strict_1.default.deepEqual(result, {
        showModeSelector: true,
        showShadowMode: true,
        showPracticeControls: true,
        effectivePlayMode: "shadow",
    });
}
function testFallsBackToEchoWhenShadowModeDisabled() {
    const result = (0, course_mode_config_1.resolveCourseModePresentation)({
        currentPlayMode: "shadow",
        shadowModeEnabled: false,
    });
    strict_1.default.deepEqual(result, {
        showModeSelector: false,
        showShadowMode: false,
        showPracticeControls: false,
        effectivePlayMode: "echo",
    });
}
testKeepsShadowModeWhenFeatureEnabled();
testFallsBackToEchoWhenShadowModeDisabled();
console.log("course mode config tests passed.");
// ==================== resolveStagePresentation ====================
const course_mode_config_2 = require("../miniprogram/pages/course/course-mode-config");
// 通听/跟读（无留白）走后台连续通道
strict_1.default.deepEqual((0, course_mode_config_2.resolveStagePresentation)({
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
});
strict_1.default.deepEqual((0, course_mode_config_2.resolveStagePresentation)({
    currentStage: "follow",
    gapEnabled: false,
    shadowModeEnabled: true,
}).effectivePlayMode, "shadow");
// 精练与留白跟读走前台逐句通道，句末策略不同
strict_1.default.deepEqual((0, course_mode_config_2.resolveStagePresentation)({
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
});
strict_1.default.deepEqual((0, course_mode_config_2.resolveStagePresentation)({
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
});
// 后台关闭 shadow 时页面只读、阶段回退 practice
strict_1.default.deepEqual((0, course_mode_config_2.resolveStagePresentation)({
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
});
console.log("stage presentation tests passed.");
