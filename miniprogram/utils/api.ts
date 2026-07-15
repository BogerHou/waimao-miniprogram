import { PAGE_SIZE_DEFAULT } from '../config/env'
import { request } from './request'
import { LocalCache, DictCache, getToken } from './storage'
import {
  normalizeLookupWord,
  normalizeWordLookupResponse,
  type WordLookupResponse,
} from './word-lookup'

export type { WordLookupResponse } from './word-lookup'

export type CourseStatus = 'completed' | 'pending'
export type ProgressStatus = 'completed'

export type CourseListItem = {
  id: string
  title: string
  icon?: string
  tag?: string
  status?: CourseStatus
  locked?: boolean
}

export type SceneProgress = {
  sceneId: string
  chapterId: string
  cueIndex: number
  totalCues: number
  completedCueIndexes: number[]
  completedCueCount: number
  completionPercent: number
  sceneCompleted: boolean
  completedAt: number | null
  updatedAt: number
}

export type ChapterSceneItem = {
  id: string
  index: number
  title: string
  cueCount: number
  duration: number
  free: boolean
  locked?: boolean
  status?: CourseStatus
  isCurrent?: boolean
  progress?: SceneProgress | null
}

export type ChapterListItem = {
  id: string
  number: number
  label: string
  title: string
  audio: string
  duration: number
  free: boolean
  locked?: boolean
  progressPercent?: number
  scenes: ChapterSceneItem[]
}

export type Pagination = {
  page: number
  pageSize: number
  hasMore: boolean
  total: number
}

export type CourseListResponse = {
  data: ChapterListItem[]
  pagination?: Pagination
  progress?: UserProgress
  entitlement?: EntitlementInfo
  appConfig: AppConfigResponse
}

export type EntitlementInfo = {
  fullAccess: boolean
  expiresAt?: number | null
}

export type SubtitleEntry = {
  id: string
  index?: number
  start: number
  end: number
  text: string
  translation?: string
  speaker?: string
  rawStart?: number
  rawEnd?: number
  sourceSubtitleId?: string
  sourceIndex?: number
  segmentIndex?: number
  segmentCount?: number
  timingSource?: 'word-srt' | 'estimated' | 'source-cue'
}

export type CourseDetailResponse = {
  id: string
  chapterId?: string
  chapterNumber?: number
  chapterLabel?: string
  chapterTitle?: string
  sceneIndex?: number
  title: string
  tag?: string
  audio: string
  audioSources?: Array<{
    provider: AudioSourceProvider
    url: string
  }>
  range?: {
    start: number
    end: number
  }
  knowledge?: {
    background: string
    phrases: string
    correction: string
    notes: string
    dialogue: Array<{
      speaker: string
      text: string
      translation?: string
    }>
  }
  subtitles: SubtitleEntry[]
}

export type AppConfigResponse = {
  interactiveFeaturesEnabled?: boolean
  home: {
    bannerEnabled: boolean
    practiceHelpEnabled: boolean
    unlockPromptEnabled?: boolean
    unlockPromptTitle?: string
    unlockPromptDescription?: string
    unlockPromptCta?: string
    activeAdId?: string
    ads?: HomeAdConfig[]
  }
  courseDetail: {
    shadowModeEnabled: boolean
    audioSource?: AudioSourceConfig
  }
}

export type AudioSourceProvider = 'qiniu' | 'mirror' | 'server'

export type AudioSourceConfig = {
  priority: AudioSourceProvider[]
  enabled: Record<AudioSourceProvider, boolean>
}

export type HomeAdFeature = {
  title: string
  desc: string
}

export type HomeAdPromotionConfig = {
  enabled: boolean
  badge: string
  title: string
  subtitle: string
  price: string
  pricePrefix: string
  priceSuffix: string
  originalPrice: string
  features: string[]
  note: string
}

export type HomeAdConfig = {
  id: string
  enabled: boolean
  navTitle?: string
  bannerUrl: string
  detailBannerEnabled: boolean
  contentImageUrl: string
  title: string
  eyebrow: string
  description: string
  features: HomeAdFeature[]
  promotion?: HomeAdPromotionConfig
  trialTitle: string
  trialDescription: string
  targetUrl: string
  ctaText: string
  contactQrUrl: string
  contactTitle: string
  contactDescription: string
  contactTip: string
}

export type UserProfile = {
  id: string
  nickname: string
  avatarUrl: string
  streakCount: number
  totalCompleted: number
  studySeconds: number
}

export type UserProgress = {
  currentSceneId?: string | null
  completedSceneIds?: string[]
  completedCourseIds: string[]
  streakCount: number
  totalCompleted: number
  lastStudyDate: string | null
  scenes?: SceneProgress[]
}

export type LearningRecordDay = {
  date: string
  studySeconds: number
  practiceCount: number
  sessionCount: number
}

export type LearningRecordsResponse = {
  summary: {
    streakCount: number
    totalCompleted: number
    studySeconds: number
    totalPracticeCount: number
    activeDays: number
    lastStudyDate: string | null
  }
  days: LearningRecordDay[]
}

type LoginResponse = {
  token: string
  user: UserProfile
  fullAccess?: boolean
  entitlement?: EntitlementInfo
  progress?: UserProgress
}

type UserResponse = {
  user: UserProfile
  fullAccess?: boolean
  entitlement?: EntitlementInfo
  progress?: UserProgress
}

type UpdateProgressResponse = {
  user: UserProfile
  progress: UserProgress
  sceneProgress?: SceneProgress
}

export type UpdateProgressOptions = {
  cueIndex?: number
  totalCues?: number
  completedCueIndex?: number
  completedCueIndexes?: number[]
}

// ==================== 缓存实例 ====================

// 课程列表缓存 (10分钟过期)
const WAIMAO_MINI_API_PREFIX = '/api/waimao-mini'

const courseListCache = new LocalCache<CourseListResponse>('waimao_mini_course_list', 10 * 60 * 1000)

// 课程详情缓存 (30分钟过期)
const courseDetailCache = new DictCache<CourseDetailResponse>('waimao_mini_course_detail', 30 * 60 * 1000)
// 课程词典版本稳定，客户端缓存 30 天；服务端词典更新后可通过 forceRefresh 主动刷新。
const wordLookupCache = new DictCache<WordLookupResponse>('waimao_mini_word_lookup', 30 * 24 * 60 * 60 * 1000)

// 清除所有缓存的函数
export function clearAllCache() {
  courseListCache.clear()
  courseDetailCache.clearAll()
  console.log('[API] All caches cleared')
}

// 获取缓存统计
export function getCacheStats() {
  return {
    courseList: courseListCache.stats(),
  }
}

export function getCachedCourseList(options: { allowStale?: boolean } = {}): CourseListResponse | null {
  const cached = courseListCache.get()
  if (cached || !options.allowStale) {
    return cached ? toPublicCourseListCache(cached) : null
  }
  const stale = courseListCache.getStale()
  return stale ? toPublicCourseListCache(stale) : null
}

// 课程缓存必须是匿名投影。旧版本可能在带 token 的请求后写入用户进度与解锁态，
// 因此读取和写入两侧都清理顶层及 scene 内的账号字段，避免换账号或退出后串数据。
function toPublicCourseListCache(response: CourseListResponse): CourseListResponse {
  return {
    ...response,
    data: response.data.map(chapter => {
      const locked = !chapter.free
      return {
        ...chapter,
        audio: '',
        locked,
        progressPercent: 0,
        scenes: chapter.scenes.map(scene => ({
          ...scene,
          locked,
          status: 'pending' as const,
          isCurrent: false,
          progress: null,
        })),
      }
    }),
    progress: undefined,
    entitlement: undefined,
  }
}

// ==================== API 函数 ====================


export function fetchCourseList(
  page = 1,
  pageSize = PAGE_SIZE_DEFAULT,
  options?: { withProgress?: boolean; forceRefresh?: boolean }
): Promise<CourseListResponse> {
  // 只有第一页且不需要进度数据时才直接命中新鲜缓存；登录态数据仍以服务端为准。
  const hasAuthenticatedSession = Boolean(getToken())
  const canUseFreshCache = page === 1 && !options?.withProgress && !hasAuthenticatedSession
  // 强制刷新只跳过读取，不删除旧数据。网络失败时仍可用旧课程树兜底。
  const rawStaleFallback = page === 1 ? courseListCache.getStale() : null
  const staleFallback = rawStaleFallback ? toPublicCourseListCache(rawStaleFallback) : null

  if (canUseFreshCache && !options?.forceRefresh) {
    const cached = getCachedCourseList()
    if (cached) {
      console.log('[API] Course list cache hit')
      return Promise.resolve(cached)
    }
  }

  const data: Record<string, unknown> = {
    page,
    pageSize,
  }
  if (options?.withProgress) {
    data.withProgress = true
  }

  console.log('[API] Fetching course list from server')

  return request<CourseListResponse>({
    url: `${WAIMAO_MINI_API_PREFIX}/courses`,
    method: 'GET',
    data,
  }).then(response => {
    // 缓存第一页数据
    if (canUseFreshCache) {
      courseListCache.set(toPublicCourseListCache(response))
    }
    return response
  }).catch(error => {
    if (!staleFallback) {
      throw error
    }

    console.warn('[API] Course list request failed, using stale cache', error)
    // 只复用匿名课程投影；登录态进度与权益继续由 store 提供。
    return staleFallback
  })
}

export function fetchCourseDetail(id: string, forceRefresh = false): Promise<CourseDetailResponse> {
  // 强制刷新时跳过缓存
  if (forceRefresh) {
    courseDetailCache.remove(id)
  }

  // 尝试从缓存获取
  if (!forceRefresh) {
    const cached = courseDetailCache.get(id)
    if (cached) {
      console.log(`[API] Course detail cache hit: ${id}`)
      return Promise.resolve(cached)
    }
  }

  console.log(`[API] Fetching course detail from server: ${id}`)

  return request<CourseDetailResponse>({
    url: `${WAIMAO_MINI_API_PREFIX}/courses/${id}`,
    method: 'GET',
  }).then(response => {
    console.log(`[API] ✅ 服务器返回课程详情:`, response)
    console.log(`[API] 音频路径: ${response.audio}`)

    // 缓存课程详情
    courseDetailCache.set(id, response)
    return response
  })
}

export function fetchAppConfig(): Promise<AppConfigResponse> {
  return request<AppConfigResponse>({
    url: `${WAIMAO_MINI_API_PREFIX}/app-config`,
    method: 'GET',
  })
}


export async function fetchWordLookup(word: string, forceRefresh = false): Promise<WordLookupResponse> {
  const key = normalizeLookupWord(word)
  if (!key) {
    return Promise.reject(new Error('Invalid word'))
  }

  if (!forceRefresh) {
    const cached = wordLookupCache.get(key)
    if (cached) return cached
  }

  const response = await request<WordLookupResponse>({
    url: `${WAIMAO_MINI_API_PREFIX}/dictionary/${encodeURIComponent(key)}`,
    method: 'GET',
  })
  const result = normalizeWordLookupResponse(response, key)
  if (!result.translation) throw new Error('No definition')
  wordLookupCache.set(key, result)
  return result
}

export function loginWithCode(code: string, payload?: { nickname?: string; avatarUrl?: string }) {
  return request<LoginResponse>({
    url: `${WAIMAO_MINI_API_PREFIX}/auth/login`,
    method: 'POST',
    data: {
      code,
      ...payload,
    },
  })
}

export function logout(): Promise<void> {
  return request<void>({
    url: `${WAIMAO_MINI_API_PREFIX}/auth/logout`,
    method: 'POST',
  })
}

export function fetchCurrentUser(): Promise<UserResponse> {
  return request<UserResponse>({
    url: `${WAIMAO_MINI_API_PREFIX}/me`,
    method: 'GET',
  })
}

export function fetchUserProgress(): Promise<UserProgress> {
  return request<UserProgress>({
    url: `${WAIMAO_MINI_API_PREFIX}/users/me/progress`,
    method: 'GET',
  })
}

export function buildUpdateProgressPayload(
  courseId: string,
  status: ProgressStatus | null,
  options: UpdateProgressOptions = {},
) {
  const payload: {
    sceneId: string
    status?: ProgressStatus
  } & UpdateProgressOptions = {
    sceneId: courseId,
    ...options,
  }
  if (status) {
    payload.status = status
  }
  return payload
}

export function buildRecordProgressPayload(
  courseId: string,
  options: UpdateProgressOptions = {},
) {
  return buildUpdateProgressPayload(courseId, null, options)
}

export function updateUserProgress(
  courseId: string,
  status: ProgressStatus,
  options: UpdateProgressOptions = {},
) {
  return request<UpdateProgressResponse>({
    url: `${WAIMAO_MINI_API_PREFIX}/users/me/progress`,
    method: 'POST',
    data: buildUpdateProgressPayload(courseId, status, options),
  })
}

export function recordUserProgress(
  courseId: string,
  options: UpdateProgressOptions = {},
) {
  return request<UpdateProgressResponse>({
    url: `${WAIMAO_MINI_API_PREFIX}/users/me/progress`,
    method: 'POST',
    data: buildRecordProgressPayload(courseId, options),
  })
}

export function resetUserProgress() {
  return request<UpdateProgressResponse>({
    url: `${WAIMAO_MINI_API_PREFIX}/users/me/progress/reset`,
    method: 'POST',
  })
}

export function reportStudyTime(seconds: number, practiceCount = 0) {
  return request<UserResponse>({
    url: `${WAIMAO_MINI_API_PREFIX}/users/me/study-time`,
    method: 'POST',
    data: { seconds, practiceCount },
  })
}

export function fetchLearningRecords(days = 28) {
  const safeDays = Math.min(365, Math.max(7, Math.floor(days)))
  return request<LearningRecordsResponse>({
    url: `${WAIMAO_MINI_API_PREFIX}/users/me/study-records?days=${safeDays}`,
  })
}

export function redeemInviteCode(code: string) {
  return request<LoginResponse>({
    url: `${WAIMAO_MINI_API_PREFIX}/invite/redeem`,
    method: 'POST',
    data: { code },
  })
}
