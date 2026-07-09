"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveCourseModePresentation = resolveCourseModePresentation;
function resolveCourseModePresentation(options) {
    const showShadowMode = options.shadowModeEnabled;
    return {
        showModeSelector: showShadowMode,
        showShadowMode,
        showPracticeControls: showShadowMode,
        effectivePlayMode: showShadowMode ? options.currentPlayMode : "echo",
    };
}
