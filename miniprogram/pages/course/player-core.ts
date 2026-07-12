// 课程播放引擎的纯逻辑核心。
// 里程碑 1（见 docs/exec-plans/active/2026-07-11-course-player-unification.md）：
// 切片 A：范围钳制、进度 cue 计算；
// 切片 B：音频加载超时控制器与播放事件里的纯决策（错误提示、重复停止窗口、Echo 切片地址）。

import { AudioSourceOption, getNextAudioSourceOption } from './audio-source-fallback'

export type SceneRange = {
  start: number
  end: number
}

// 距小节末尾不足该值时视为"已越过末尾"，restartWhenPastEnd 会回到小节开头。
export const SCENE_RESTART_EPSILON = 0.1
// 播放时间进入该容差窗口即判定小节播放完成；比 restart 容差更紧，避免完成判定抢先触发重启。
export const SCENE_END_EPSILON = 0.08

export function clampCourseTimeToScene(
  courseTime: number,
  range: SceneRange | null,
  options: { restartWhenPastEnd?: boolean } = {},
): number {
  const safeTime = Math.max(0, Number(courseTime) || 0)
  if (!range) {
    return safeTime
  }
  if (options.restartWhenPastEnd && safeTime >= range.end - SCENE_RESTART_EPSILON) {
    return range.start
  }
  return Math.min(Math.max(safeTime, range.start), range.end)
}

export function hasReachedSceneEnd(courseTime: number, range: SceneRange | null): boolean {
  return Boolean(range && courseTime >= range.end - SCENE_END_EPSILON)
}

export function resolveProgressCueIndex(options: {
  subtitles: Array<{ id: string }>
  preferredSubtitleId?: string | null
  fallbackIndex: number
}): number {
  const totalCues = options.subtitles.length
  if (totalCues <= 0) {
    return 0
  }

  const preferred = options.preferredSubtitleId
  const subtitleIndex = preferred
    ? options.subtitles.findIndex(subtitle => subtitle.id === preferred)
    : -1
  if (subtitleIndex >= 0) {
    return subtitleIndex
  }

  return Math.min(Math.max(options.fallbackIndex, 0), totalCues - 1)
}

export function buildCompletionCuePayload(totalCues: number, progressCueIndex: number): {
  totalCues: number
  cueIndex: number
} {
  return {
    totalCues,
    cueIndex: totalCues > 0 ? Math.max(progressCueIndex, totalCues - 1) : 0,
  }
}

// ==================== 音频加载超时控制器（切片 B） ====================

export const AUDIO_LOAD_TIMEOUT_MS = 10000

export type AudioLoadTimeoutController = {
  schedule(src: string): void
  clear(): void
}

// CDN 音源加载超时守卫：仅对非 server 源计时，超时且存在下一个可用源时触发回退。
// 定时器可注入，便于在 Node 测试里驱动超时路径。
export function createAudioLoadTimeoutController(options: {
  getSourceOptions: () => AudioSourceOption[]
  getCurrentSource: () => string
  getAudioReady: () => boolean
  onTimeoutFallback: (timedOutSource: string) => void
  log: (message: string, payload: Record<string, unknown>) => void
  warn: (message: string, payload: Record<string, unknown>) => void
  timeoutMs?: number
  setTimer?: (handler: () => void, ms: number) => number
  clearTimer?: (id: number) => void
}): AudioLoadTimeoutController {
  const timeoutMs = options.timeoutMs ?? AUDIO_LOAD_TIMEOUT_MS
  const setTimer =
    options.setTimer ?? ((handler: () => void, ms: number) => setTimeout(handler, ms) as unknown as number)
  const clearTimer = options.clearTimer ?? ((id: number) => clearTimeout(id))
  let timerId: number | null = null

  const clear = () => {
    if (timerId !== null) {
      clearTimer(timerId)
      timerId = null
    }
  }

  return {
    clear,
    schedule(src: string) {
      clear()
      const sourceOption = options.getSourceOptions().find(source => source.url === src)
      if (!sourceOption || sourceOption.provider === 'server') {
        return
      }
      options.log('[Audio] 启动 CDN 加载超时计时器', {
        src,
        timeoutMs,
      })
      timerId = setTimer(() => {
        const currentSource = options.getCurrentSource()
        const nextAudioSource = getNextAudioSourceOption({
          timedOutSource: src,
          currentSource,
          audioSources: options.getSourceOptions(),
        })

        options.warn('[Audio] CDN 加载超时检查', {
          timedOutSource: src,
          currentSource,
          nextProvider: nextAudioSource?.provider ?? null,
          nextSource: nextAudioSource?.url ?? null,
          audioReady: options.getAudioReady(),
        })

        timerId = null

        if (nextAudioSource) {
          options.onTimeoutFallback(src)
        }
      }, timeoutMs)
    },
  }
}

// ==================== 播放事件纯决策（切片 B） ====================

// 重复模式备用停止定时器的补偿量：onTimeUpdate 失效时兜底，宁可多播 0.5s 不提前截断。
export const REPEAT_STOP_COMPENSATION_S = 0.5

export function computeRepeatStopWindow(
  subtitle: { start: number; end: number },
  playbackRate: number,
): { totalDuration: number; playDuration: number; adjustedDuration: number } {
  const totalDuration = subtitle.end - subtitle.start
  const playDuration = totalDuration / playbackRate
  return {
    totalDuration,
    playDuration,
    adjustedDuration: playDuration + REPEAT_STOP_COMPENSATION_S,
  }
}

export function resolveAudioErrorTip(errCode?: number, errMsg?: string): string {
  let tip = errMsg || '播放失败'
  if (errCode === 10001) tip = '系统错误 (iOS 格式或压缩问题)'
  if (errCode === 10002) tip = '网络错误'
  if (errCode === 10004) tip = '格式错误'
  return tip
}

export function buildEchoSegmentUrl(apiBaseUrl: string, courseId: string, subtitleId: string): string {
  return `${apiBaseUrl}/static/audio-segments/${courseId}/segment_${subtitleId}.m4a`
}

// ==================== 学习阶段模型（里程碑 2） ====================

export type LearningStage = 'listen' | 'practice' | 'follow'

export type PlaybackChannel = 'shadow' | 'echo'

// 句末策略：none=不干预（连续通道自己推进；精练停在当前句等用户操作）；
// gap-advance=句末静音留白（约等于句长）后自动播下一句。
export type CueEndPolicy = 'none' | 'gap-advance'

export type StagePlan = {
  channel: PlaybackChannel
  cueEndPolicy: CueEndPolicy
}

// 阶段只是播放行为预设：通听/跟读（无留白）走后台连续通道，精练与留白跟读走前台逐句通道。
// 精练句末不自动推进，停在当前句由用户决定重复还是换句。
export function resolveStagePlan(stage: LearningStage, gapEnabled: boolean): StagePlan {
  if (stage === 'practice') {
    return { channel: 'echo', cueEndPolicy: 'none' }
  }
  if (stage === 'follow' && gapEnabled) {
    return { channel: 'echo', cueEndPolicy: 'gap-advance' }
  }
  return { channel: 'shadow', cueEndPolicy: 'none' }
}

// 留白时长≈句长按倍速换算；过短的句子保底 600ms，保证用户来得及开口。
export const MIN_GAP_MS = 600

export function computeGapMs(subtitle: { start: number; end: number }, playbackRate: number): number {
  const duration = Math.max(0, subtitle.end - subtitle.start)
  const rate = playbackRate > 0 ? playbackRate : 1
  return Math.max(MIN_GAP_MS, Math.round((duration / rate) * 1000))
}

export function findNextCue<T extends { id: string }>(subtitles: T[], currentId: string | null): T | null {
  if (!subtitles.length) {
    return null
  }
  if (!currentId) {
    return subtitles[0]
  }
  const index = subtitles.findIndex(subtitle => subtitle.id === currentId)
  if (index < 0) {
    return null
  }
  return subtitles[index + 1] ?? null
}
