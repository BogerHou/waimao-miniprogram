export type CoursePlayMode = "echo" | "shadow"

type ResolveCourseModePresentationOptions = {
  currentPlayMode: CoursePlayMode
  shadowModeEnabled: boolean
}

export function resolveCourseModePresentation(options: ResolveCourseModePresentationOptions) {
  const showShadowMode = options.shadowModeEnabled

  return {
    showModeSelector: showShadowMode,
    showShadowMode,
    showPracticeControls: showShadowMode,
    effectivePlayMode: showShadowMode ? options.currentPlayMode : "echo",
  } as const
}
