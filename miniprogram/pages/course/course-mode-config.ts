import { LearningStage, PlaybackChannel, CueEndPolicy, resolveStagePlan } from './player-core'

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

type ResolveStagePresentationOptions = {
  currentStage: LearningStage
  gapEnabled: boolean
  shadowModeEnabled: boolean
}

export type StagePresentation = {
  showModeSelector: boolean
  showShadowMode: boolean
  showPracticeControls: boolean
  effectiveStage: LearningStage
  effectivePlayMode: PlaybackChannel
  cueEndPolicy: CueEndPolicy
}

// 阶段版呈现逻辑：后台配置关闭 shadow 时页面进入只读态（与旧 resolveCourseModePresentation 语义一致），
// 阶段强制回退到 practice（前台逐句通道）。
export function resolveStagePresentation(options: ResolveStagePresentationOptions): StagePresentation {
  const enabled = options.shadowModeEnabled
  const effectiveStage: LearningStage = enabled ? options.currentStage : 'practice'
  const plan = resolveStagePlan(effectiveStage, options.gapEnabled)

  return {
    showModeSelector: enabled,
    showShadowMode: enabled,
    showPracticeControls: enabled,
    effectiveStage,
    effectivePlayMode: plan.channel,
    cueEndPolicy: plan.cueEndPolicy,
  }
}
