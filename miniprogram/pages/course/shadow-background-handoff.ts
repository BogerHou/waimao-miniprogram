export type ShadowSubtitle = {
  id: string
  start: number
  end: number
}

export type ShadowCourseMeta = {
  id: string
  title: string
  audio: string
  tag?: string
}

export type BackgroundAudioResumeState = {
  courseId: string
  courseTime: number
  subtitleId: string | null
  audioSrc: string
  wasPlaying: boolean
  savedAt: number
}

type ResolveCourseTimeOptions = {
  audioCurrentTime?: number
  activeSubtitle?: ShadowSubtitle | null
  lastKnownCourseTime?: number
}

type ResumeStateOptions = {
  subtitles: ShadowSubtitle[]
  courseTime: number
  tolerance?: number
  wasPlayingInBackground: boolean
}

type ShadowModeSwitchOptions = {
  subtitles: ShadowSubtitle[]
  courseTime: number
  fallbackSubtitleId?: string | null
  shouldAutoplay: boolean
  tolerance?: number
}

type EchoToShadowSwitchOptions = {
  subtitles: ShadowSubtitle[]
  audioCurrentTime?: number
  activeSubtitle?: ShadowSubtitle | null
  lastKnownCourseTime?: number
  fallbackSubtitleId?: string | null
  echoCompletedCourseTime?: number | null
  echoCompletedSubtitleId?: string | null
  tolerance?: number
}

type ShadowPlaybackStartTimeOptions = {
  backgroundCurrentTime?: number
  lastKnownCourseTime?: number
}

type ObservedShadowCourseTimeOptions = {
  observedTime?: number
  lastKnownCourseTime?: number
  pendingTargetTime?: number
  tolerance?: number
}

type ShadowSeekCorrectionOptions = {
  currentTime?: number
  targetTime?: number
  tolerance?: number
}

type BuildCourseNavigationUrlParams = Record<string, string | number | boolean | null | undefined>

type ShouldRestoreBackgroundAudioRouteOptions = {
  resumeState: unknown
  currentRoute?: string
  currentCourseId?: string | null
  managerSrc?: string
  now?: number
}

export const BACKGROUND_AUDIO_RESUME_KEY = 'waimao_mini_background_audio_resume'
export const BACKGROUND_AUDIO_RESUME_TTL_MS = 12 * 60 * 60 * 1000

export function normalizeCourseTime(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, value)
}

export function resolveCourseTimeFromForeground(options: ResolveCourseTimeOptions) {
  const audioCurrentTime = normalizeCourseTime(options.audioCurrentTime)
  const lastKnownCourseTime = normalizeCourseTime(options.lastKnownCourseTime)
  const activeSubtitle = options.activeSubtitle

  if (activeSubtitle) {
    const subtitleStart = normalizeCourseTime(activeSubtitle.start)
    if (audioCurrentTime + 0.2 < subtitleStart && lastKnownCourseTime >= subtitleStart - 0.2) {
      return lastKnownCourseTime
    }
    if (audioCurrentTime + 0.2 < subtitleStart) {
      return subtitleStart
    }
  }

  if (audioCurrentTime > 0) {
    return audioCurrentTime
  }

  if (activeSubtitle) {
    return normalizeCourseTime(activeSubtitle.start)
  }

  return lastKnownCourseTime
}

export function findSubtitleByCourseTime(
  subtitles: ShadowSubtitle[],
  courseTime: number,
  tolerance = 0.3,
) {
  if (!subtitles.length) {
    return null
  }

  const safeTime = normalizeCourseTime(courseTime)
  const safeTolerance = Math.max(0, tolerance)

  for (let index = 0; index < subtitles.length; index += 1) {
    const subtitle = subtitles[index]
    if (safeTime >= subtitle.start - safeTolerance && safeTime <= subtitle.end + safeTolerance) {
      const nextSubtitle = subtitles[index + 1]
      if (
        nextSubtitle &&
        safeTime >= nextSubtitle.start - safeTolerance &&
        safeTime >= subtitle.end
      ) {
        return { subtitle: nextSubtitle, index: index + 1 }
      }
      return { subtitle, index }
    }
  }

  for (let index = subtitles.length - 1; index >= 0; index -= 1) {
    const subtitle = subtitles[index]
    if (safeTime >= subtitle.start) {
      return { subtitle, index }
    }
  }

  return { subtitle: subtitles[0], index: 0 }
}

export function resolveForegroundResumeState(options: ResumeStateOptions) {
  const resumeTime = normalizeCourseTime(options.courseTime)
  const matched = findSubtitleByCourseTime(options.subtitles, resumeTime, options.tolerance ?? 0.3)
  if (!matched) {
    return null
  }

  return {
    subtitle: matched.subtitle,
    index: matched.index,
    resumeTime,
    shouldAutoplay: options.wasPlayingInBackground,
  }
}

export function resolveShadowModeSwitchState(options: ShadowModeSwitchOptions) {
  const resumeTime = normalizeCourseTime(options.courseTime)
  const matched = findSubtitleByCourseTime(options.subtitles, resumeTime, options.tolerance ?? 0.3)
  if (matched) {
    return {
      subtitle: matched.subtitle,
      index: matched.index,
      resumeTime,
      shouldAutoplay: options.shouldAutoplay,
    }
  }

  if (options.fallbackSubtitleId) {
    const fallbackIndex = options.subtitles.findIndex(subtitle => subtitle.id === options.fallbackSubtitleId)
    if (fallbackIndex >= 0) {
      const fallbackSubtitle = options.subtitles[fallbackIndex]
      return {
        subtitle: fallbackSubtitle,
        index: fallbackIndex,
        resumeTime: normalizeCourseTime(fallbackSubtitle.start),
        shouldAutoplay: options.shouldAutoplay,
      }
    }
  }

  if (!options.subtitles.length) {
    return null
  }

  return {
    subtitle: options.subtitles[0],
    index: 0,
    resumeTime: normalizeCourseTime(options.subtitles[0].start),
    shouldAutoplay: options.shouldAutoplay,
  }
}

export function resolveEchoToShadowSwitchState(options: EchoToShadowSwitchOptions) {
  const tolerance = options.tolerance ?? 0.3
  const activeSubtitle = options.activeSubtitle
  const completedCourseTime = normalizeCourseTime(options.echoCompletedCourseTime ?? undefined)
  const completionMatchesActiveSubtitle =
    !!activeSubtitle &&
    !!options.echoCompletedSubtitleId &&
    options.echoCompletedSubtitleId === activeSubtitle.id

  const courseTime =
    completionMatchesActiveSubtitle && completedCourseTime > 0
      ? completedCourseTime
      : resolveCourseTimeFromForeground({
          audioCurrentTime: options.audioCurrentTime,
          activeSubtitle,
          lastKnownCourseTime: options.lastKnownCourseTime,
        })

  return resolveShadowModeSwitchState({
    subtitles: options.subtitles,
    courseTime,
    fallbackSubtitleId: options.fallbackSubtitleId,
    shouldAutoplay: true,
    tolerance,
  })
}

export function resolveShadowPlaybackStartTime(options: ShadowPlaybackStartTimeOptions) {
  const backgroundCurrentTime = normalizeCourseTime(options.backgroundCurrentTime)
  const lastKnownCourseTime = normalizeCourseTime(options.lastKnownCourseTime)

  if (backgroundCurrentTime > 0.2) {
    return backgroundCurrentTime
  }

  return lastKnownCourseTime
}

export function resolveObservedShadowCourseTime(options: ObservedShadowCourseTimeOptions) {
  const observedTime = normalizeCourseTime(options.observedTime)
  const lastKnownCourseTime = normalizeCourseTime(options.lastKnownCourseTime)
  const pendingTargetTime = normalizeCourseTime(options.pendingTargetTime)
  const tolerance = Math.max(0, options.tolerance ?? 0.35)

  if (
    pendingTargetTime > tolerance &&
    observedTime + tolerance < pendingTargetTime
  ) {
    return pendingTargetTime
  }

  if (observedTime > 0.2) {
    return observedTime
  }

  if (pendingTargetTime > 0.2) {
    return pendingTargetTime
  }

  return lastKnownCourseTime
}

export function shouldApplyShadowSeekCorrection(options: ShadowSeekCorrectionOptions) {
  const currentTime = normalizeCourseTime(options.currentTime)
  const targetTime = normalizeCourseTime(options.targetTime)
  const tolerance = Math.max(0, options.tolerance ?? 0.35)

  if (targetTime <= tolerance) {
    return false
  }

  return currentTime + tolerance < targetTime
}

function encodeQueryParam(value: string | number | boolean) {
  return encodeURIComponent(String(value))
}

export function buildCourseNavigationUrl(
  courseId: string,
  params: BuildCourseNavigationUrlParams = {},
) {
  const id = String(courseId || '').trim()
  const queryEntries: string[] = []

  if (id) {
    queryEntries.push(`id=${encodeQueryParam(id)}`)
  }

  Object.keys(params).forEach(key => {
    const value = params[key]
    if (value === undefined || value === null || value === '') {
      return
    }
    queryEntries.push(`${encodeQueryParam(key)}=${encodeQueryParam(value)}`)
  })

  return queryEntries.length
    ? `/pages/course/course?${queryEntries.join('&')}`
    : '/pages/index/index'
}

export function normalizeBackgroundAudioResumeState(
  value: unknown,
  now = Date.now(),
): BackgroundAudioResumeState | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const raw = value as Partial<BackgroundAudioResumeState>
  const courseId = String(raw.courseId || '').trim()
  const savedAt = Number(raw.savedAt)
  if (!courseId || !Number.isFinite(savedAt)) {
    return null
  }
  if (now - savedAt > BACKGROUND_AUDIO_RESUME_TTL_MS) {
    return null
  }

  return {
    courseId,
    courseTime: normalizeCourseTime(Number(raw.courseTime)),
    subtitleId: typeof raw.subtitleId === 'string' && raw.subtitleId
      ? raw.subtitleId
      : null,
    audioSrc: typeof raw.audioSrc === 'string' ? raw.audioSrc : '',
    wasPlaying: Boolean(raw.wasPlaying),
    savedAt,
  }
}

export function shouldRestoreBackgroundAudioRoute(options: ShouldRestoreBackgroundAudioRouteOptions) {
  const resumeState = normalizeBackgroundAudioResumeState(options.resumeState, options.now)
  if (!resumeState) {
    return false
  }

  if (
    options.currentRoute === 'pages/course/course' &&
    options.currentCourseId === resumeState.courseId
  ) {
    return false
  }

  const managerSrc = String(options.managerSrc || '')
  const hasMatchingAudio =
    !resumeState.audioSrc ||
    !managerSrc ||
    managerSrc === resumeState.audioSrc

  if (!hasMatchingAudio) {
    return false
  }

  return true
}

export function buildBackgroundPlaybackMeta(course: ShadowCourseMeta, courseTime: number) {
  return {
    src: course.audio,
    startTime: normalizeCourseTime(courseTime),
    title: course.title || '外贸英语影子跟读',
    epname: '外贸英语影子跟读',
    singer: '外贸英语影子跟读',
    coverImgUrl: '',
  }
}

// ==================== 恢复状态存储（里程碑 1 切片 C） ====================

export type BackgroundResumeStorage = {
  get(key: string): unknown
  set(key: string, value: unknown): void
  remove(key: string): void
}

export type BackgroundResumeStore = {
  read(): BackgroundAudioResumeState | null
  save(state: BackgroundAudioResumeState): boolean
  clear(): boolean
}

// 后台音频恢复状态的存取封装：storage 可注入，读取时统一走 normalize 校验，
// 任一 storage 异常都吞掉并通过 onError 上报调试信息，不阻断播放主流程。
export function createBackgroundResumeStore(options: {
  storage: BackgroundResumeStorage
  onError?: (stage: 'read' | 'save' | 'clear', error: unknown) => void
}): BackgroundResumeStore {
  return {
    read() {
      try {
        return normalizeBackgroundAudioResumeState(options.storage.get(BACKGROUND_AUDIO_RESUME_KEY))
      } catch (error) {
        options.onError?.('read', error)
        return null
      }
    },
    save(state: BackgroundAudioResumeState) {
      try {
        options.storage.set(BACKGROUND_AUDIO_RESUME_KEY, state)
        return true
      } catch (error) {
        options.onError?.('save', error)
        return false
      }
    },
    clear() {
      try {
        options.storage.remove(BACKGROUND_AUDIO_RESUME_KEY)
        return true
      } catch (error) {
        options.onError?.('clear', error)
        return false
      }
    },
  }
}
