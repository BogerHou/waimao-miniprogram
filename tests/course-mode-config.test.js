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
