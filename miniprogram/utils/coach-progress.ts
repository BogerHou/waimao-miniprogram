export type CoachStage = 'overview' | 'listen' | 'respond' | 'practice' | 'shadow' | 'summary'
export type CoachSentenceStatus = 'learning' | 'review' | 'mastered'

export type CoachSentenceRecord = {
  key: string
  sceneId: string
  sentenceId: string
  cueIndex: number
  sceneTitle: string
  chapterLabel: string
  text: string
  translation: string
  status: CoachSentenceStatus
  attempts: number
  recordingPath: string
  updatedAt: number
  nextReviewAt: number | null
}

export type CoachSceneSession = {
  sceneId: string
  sceneTitle: string
  stage: CoachStage
  cueIndex: number
  batchStart?: number
  completedAt: number | null
  updatedAt: number
}

export type CoachProgressState = {
  version: 1
  sentences: CoachSentenceRecord[]
  sessions: CoachSceneSession[]
}

export type SentenceProgressInput = Omit<
  CoachSentenceRecord,
  'key' | 'attempts' | 'updatedAt' | 'nextReviewAt'
> & {
  recordingPath?: string
  countAttempt?: boolean
}

export const COACH_PROGRESS_STORAGE_KEY = 'waimao_coach_progress_v1'
const MASTERED_REVIEW_DELAY = 3 * 24 * 60 * 60 * 1000

export function createEmptyCoachProgress(): CoachProgressState {
  return { version: 1, sentences: [], sessions: [] }
}

export function normalizeCoachProgress(value: unknown): CoachProgressState {
  if (!value || typeof value !== 'object') {
    return createEmptyCoachProgress()
  }
  const source = value as Partial<CoachProgressState>
  return {
    version: 1,
    sentences: Array.isArray(source.sentences)
      ? source.sentences.filter(isSentenceRecord).map(item => ({ ...item }))
      : [],
    sessions: Array.isArray(source.sessions)
      ? source.sessions.filter(isSceneSession).map(item => ({ ...item }))
      : [],
  }
}

export function upsertSentenceProgress(
  state: CoachProgressState,
  input: SentenceProgressInput,
  now = Date.now(),
): CoachProgressState {
  const { countAttempt = true, ...recordInput } = input
  const key = `${input.sceneId}:${input.sentenceId}`
  const existing = state.sentences.find(item => item.key === key)
  const nextReviewAt = input.status === 'review'
    ? now
    : input.status === 'mastered'
      ? now + MASTERED_REVIEW_DELAY
      : null
  const next: CoachSentenceRecord = {
    ...recordInput,
    key,
    recordingPath: input.recordingPath ?? existing?.recordingPath ?? '',
    attempts: (existing?.attempts ?? 0) + (countAttempt ? 1 : 0),
    updatedAt: now,
    nextReviewAt,
  }
  return {
    ...state,
    sentences: [next, ...state.sentences.filter(item => item.key !== key)],
  }
}

export function saveSceneSessionProgress(
  state: CoachProgressState,
  input: Omit<CoachSceneSession, 'updatedAt'>,
  now = Date.now(),
): CoachProgressState {
  const existing = state.sessions.find(item => item.sceneId === input.sceneId)
  const next: CoachSceneSession = {
    ...input,
    batchStart: input.batchStart ?? existing?.batchStart ?? 0,
    completedAt: input.completedAt ?? existing?.completedAt ?? null,
    updatedAt: now,
  }
  return {
    ...state,
    sessions: [next, ...state.sessions.filter(item => item.sceneId !== input.sceneId)],
  }
}

export function getReviewItems(state: CoachProgressState, now = Date.now()) {
  return state.sentences
    .filter(item => item.status === 'review' || Boolean(item.nextReviewAt && item.nextReviewAt <= now))
    .sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'review' ? -1 : 1
      }
      return b.updatedAt - a.updatedAt
    })
}

export function getCoachSummary(state: CoachProgressState, now = Date.now()) {
  const weekStart = now - 7 * 24 * 60 * 60 * 1000
  return {
    reviewCount: getReviewItems(state, now).length,
    masteredCount: state.sentences.filter(item => item.status === 'mastered').length,
    completedSceneCount: state.sessions.filter(item => Boolean(item.completedAt)).length,
    weeklySessionCount: state.sessions.filter(item => item.updatedAt >= weekStart).length,
  }
}

export function readCoachProgress() {
  if (typeof wx === 'undefined' || typeof wx.getStorageSync !== 'function') {
    return createEmptyCoachProgress()
  }
  try {
    return normalizeCoachProgress(wx.getStorageSync(COACH_PROGRESS_STORAGE_KEY))
  } catch (_error) {
    return createEmptyCoachProgress()
  }
}

export function writeCoachProgress(state: CoachProgressState) {
  if (typeof wx === 'undefined' || typeof wx.setStorageSync !== 'function') {
    return
  }
  try {
    wx.setStorageSync(COACH_PROGRESS_STORAGE_KEY, state)
  } catch (error) {
    console.warn('[Coach] Failed to persist progress', error)
  }
}

export function updateCoachSentence(input: SentenceProgressInput, now = Date.now()) {
  const next = upsertSentenceProgress(readCoachProgress(), input, now)
  writeCoachProgress(next)
  return next
}

export function updateCoachSceneSession(
  input: Omit<CoachSceneSession, 'updatedAt'>,
  now = Date.now(),
) {
  const next = saveSceneSessionProgress(readCoachProgress(), input, now)
  writeCoachProgress(next)
  return next
}

export function persistCoachRecording(tempFilePath: string): Promise<string> {
  if (!tempFilePath || typeof wx === 'undefined' || typeof wx.saveFile !== 'function') {
    return Promise.resolve(tempFilePath)
  }
  return new Promise(resolve => {
    wx.saveFile({
      tempFilePath,
      success(result) {
        resolve(result.savedFilePath || tempFilePath)
      },
      fail(error) {
        console.warn('[Coach] Failed to save recording', error)
        resolve(tempFilePath)
      },
    })
  })
}

export function removeCoachRecording(filePath: string) {
  if (!filePath || typeof wx === 'undefined' || typeof wx.getFileSystemManager !== 'function') return
  wx.getFileSystemManager().unlink({
    filePath,
    fail() {
      // The path may already have been reclaimed by WeChat.
    },
  })
}

function isSentenceRecord(value: unknown): value is CoachSentenceRecord {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<CoachSentenceRecord>
  return Boolean(
    item.key &&
    item.sceneId &&
    item.sentenceId &&
    typeof item.cueIndex === 'number' &&
    (item.status === 'learning' || item.status === 'review' || item.status === 'mastered'),
  )
}

function isSceneSession(value: unknown): value is CoachSceneSession {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<CoachSceneSession>
  return Boolean(item.sceneId && item.sceneTitle && item.stage && typeof item.cueIndex === 'number')
}
