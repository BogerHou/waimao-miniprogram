import { PAGE_SIZE_DEFAULT } from '../config/env'
import { request } from './request'
import { LocalCache, DictCache } from './storage'

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

export type WordLookupResponse = {
  word: string
  normalized: string
  translation: string | null
  phoneticUk: string | null
  phoneticUs: string | null
  audioUk: string | null
  audioUs: string | null
  source: string
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
// 词典查询缓存 (7天)
const wordLookupCache = new DictCache<WordLookupResponse>('waimao_mini_word_lookup', 7 * 24 * 60 * 60 * 1000)

const YOUDAO_JSONAPI_URL = 'https://dict.youdao.com/jsonapi'
const YOUDAO_AUDIO_BASE = 'https://dict.youdao.com/dictvoice?audio='

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

// ==================== API 函数 ====================


export function fetchCourseList(
  page = 1,
  pageSize = PAGE_SIZE_DEFAULT,
  options?: { withProgress?: boolean; forceRefresh?: boolean }
): Promise<CourseListResponse> {
  // 强制刷新时跳过缓存
  if (options?.forceRefresh) {
    courseListCache.clear()
  }

  // 只有第一页且不需要进度数据时才使用缓存
  const useCache = page === 1 && !options?.withProgress

  if (useCache && !options?.forceRefresh) {
    const cached = courseListCache.get()
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
    if (useCache) {
      courseListCache.set(response)
    }
    return response
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
  const key = word.trim().toLowerCase()
  if (!key) {
    return Promise.reject(new Error('Invalid word'))
  }

  if (!forceRefresh) {
    const cached = wordLookupCache.get(key)
    if (cached && cached.source === 'backend-ai' && (cached.phoneticUk || cached.phoneticUs)) {
      return Promise.resolve(cached)
    }
  }

  let youdaoPayload: any = null
  try {
    youdaoPayload = await fetchYoudaoRaw(key)
  } catch (error) {
    console.warn('[WordLookup] youdao request failed', error)
  }
  const basic = parseYoudaoBasic(youdaoPayload, key)

  let aiDefinition: string | null = null
  try {
    aiDefinition = await fetchWordDefinitionViaBackend(key)
  } catch (error) {
    console.warn('[WordLookup] backend definition failed', error)
  }

  if (aiDefinition) {
    const result: WordLookupResponse = {
      word: basic.word || key,
      normalized: key,
      translation: aiDefinition,
      phoneticUk: basic.phoneticUk,
      phoneticUs: basic.phoneticUs,
      audioUk: basic.audioUk,
      audioUs: basic.audioUs,
      source: 'backend-ai',
    }
    wordLookupCache.set(key, result)
    return result
  }

  const cached = wordLookupCache.get(key)
  if (cached) {
    return cached
  }
  if (!basic.translation) {
    return Promise.reject(new Error('No definition'))
  }
  const fallback: WordLookupResponse = {
    word: basic.word || key,
    normalized: key,
    translation: basic.translation,
    phoneticUk: basic.phoneticUk,
    phoneticUs: basic.phoneticUs,
    audioUk: basic.audioUk,
    audioUs: basic.audioUs,
    source: 'youdao-jsonapi',
  }
  wordLookupCache.set(key, fallback)
  return fallback
}

export type WordBasics = {
  word: string
  translation: string | null
  phoneticUk: string | null
  phoneticUs: string | null
  audioUk: string | null
  audioUs: string | null
}

export async function fetchWordBasics(word: string): Promise<WordBasics> {
  const key = word.trim().toLowerCase()
  if (!key) {
    throw new Error('Invalid word')
  }
  const payload = await fetchYoudaoRaw(key)
  return parseYoudaoBasic(payload, key)
}


function fetchYoudaoRaw(word: string): Promise<any> {
  return new Promise((resolve, reject) => {
    wx.request({
      url: YOUDAO_JSONAPI_URL,
      method: 'GET',
      data: { q: word },
      success(res) {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`Request failed with status ${res.statusCode}`))
          return
        }
        resolve(res.data)
      },
      fail(err) {
        reject(err)
      },
    })
  })
}

export async function fetchWordDefinitionViaBackend(word: string): Promise<string> {
  const result = await request<{ word: string; definition: string }>({
    url: '/api/words/definition',
    method: 'POST',
    data: { word },
  })
  if (!result.definition) {
    throw new Error('Definition empty')
  }
  return result.definition
}

function parseYoudaoBasic(data: unknown, input: string): {
  word: string
  translation: string | null
  phoneticUk: string | null
  phoneticUs: string | null
  audioUk: string | null
  audioUs: string | null
} {
  if (!data || typeof data !== 'object') {
    return {
      word: input,
      translation: null,
      phoneticUk: null,
      phoneticUs: null,
      audioUk: `${YOUDAO_AUDIO_BASE}${encodeURIComponent(input)}&type=1`,
      audioUs: `${YOUDAO_AUDIO_BASE}${encodeURIComponent(input)}&type=2`,
    }
  }
  const payload = data as any
  const simple = payload?.simple?.word?.[0]
  const word = (simple?.['return-phrase'] as string | undefined) ?? input
  const usphone = (simple?.usphone as string | undefined) ?? ''
  const ukphone = (simple?.ukphone as string | undefined) ?? ''

  const translationList = collectYoudaoTranslations(payload)
  let translation = translationList.length ? translationList.join('；') : null
  translation = translation ? stripHtml(translation).trim() : null
  if (translation) {
    translation = translation.replace(/；/g, '\n')
  }

  return {
    word,
    translation,
    phoneticUk: ukphone || null,
    phoneticUs: usphone || null,
    audioUk: `${YOUDAO_AUDIO_BASE}${encodeURIComponent(word)}&type=1`,
    audioUs: `${YOUDAO_AUDIO_BASE}${encodeURIComponent(word)}&type=2`,
  }
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, '')
}


function collectYoudaoTranslations(payload: any): string[] {
  const results: string[] = []
  const maxItems = 6
  const add = (text?: string) => {
    if (!text) return
    const cleaned = stripHtml(String(text)).trim()
    if (!cleaned) return
    if (!results.includes(cleaned)) {
      results.push(cleaned)
    }
  }

  const senses = payload?.video_sents?.word_info?.sense
  if (Array.isArray(senses)) {
    senses.forEach((sense: any) => add(sense))
  }

  const expand = payload?.expand_ec?.word?.[0]?.transList
  if (Array.isArray(expand)) {
    expand.forEach((item: any) => add(item?.trans))
  }

  const ecTrs = payload?.ec?.word?.[0]?.trs
  if (Array.isArray(ecTrs)) {
    ecTrs.forEach((item: any) => {
      const tr = item?.tr?.[0]?.l?.i
      if (Array.isArray(tr)) {
        tr.forEach((t: any) => add(t))
      } else if (typeof tr === 'string') {
        add(tr)
      }
    })
  }

  const simpleTrs = payload?.simple?.word?.[0]?.trs
  if (Array.isArray(simpleTrs)) {
    simpleTrs.forEach((item: any) => {
      if (typeof item === 'string') {
        add(item)
      } else {
        add(item?.tr)
      }
    })
  }
  const simpleTrans = payload?.simple?.word?.[0]?.trans
  if (typeof simpleTrans === 'string') {
    add(simpleTrans)
  }

  if (results.length < maxItems) {
    const webTrans = payload?.web_trans?.['web-translation']
    if (Array.isArray(webTrans)) {
      webTrans.forEach((entry: any) => {
        if (results.length >= maxItems) return
        const trans = entry?.trans
        if (Array.isArray(trans)) {
          trans.forEach((t: any) => {
            if (results.length >= maxItems) return
            add(t?.value)
          })
        }
      })
    }
  }

  return results.slice(0, maxItems)
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

export function reportStudyTime(seconds: number) {
  return request<UserResponse>({
    url: `${WAIMAO_MINI_API_PREFIX}/users/me/study-time`,
    method: 'POST',
    data: { seconds },
  })
}

export function redeemInviteCode(code: string) {
  return request<LoginResponse>({
    url: `${WAIMAO_MINI_API_PREFIX}/invite/redeem`,
    method: 'POST',
    data: { code },
  })
}
