export const REVIEW_LIBRARY_STORAGE_KEY = 'waimao_review_library_v1'

export type ReviewSource = {
  courseId: string
  courseTitle: string
  cueId: string
  cueText: string
  cueTranslation: string
}

export type ReviewWord = ReviewSource & {
  normalized: string
  word: string
  definition: string
  phoneticUk: string
  phoneticUs: string
  audioUk: string
  audioUs: string
  savedAt: number
}

export type ReviewCue = ReviewSource & {
  savedAt: number
}

export type ReviewLibrary = {
  words: ReviewWord[]
  cues: ReviewCue[]
}

const EMPTY_LIBRARY: ReviewLibrary = { words: [], cues: [] }

export function normalizeReviewLibrary(input: unknown): ReviewLibrary {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ...EMPTY_LIBRARY }
  }
  const source = input as Record<string, unknown>
  return {
    words: Array.isArray(source.words)
      ? source.words.map(normalizeWord).filter((item): item is ReviewWord => Boolean(item))
      : [],
    cues: Array.isArray(source.cues)
      ? source.cues.map(normalizeCue).filter((item): item is ReviewCue => Boolean(item))
      : [],
  }
}

export function upsertReviewWord(
  library: ReviewLibrary,
  input: Partial<ReviewWord> & Pick<ReviewWord, 'word' | 'normalized'>,
): ReviewLibrary {
  const normalized = normalizeWordKey(input.normalized || input.word)
  if (!normalized) return library
  const existing = library.words.find(item => item.normalized === normalized)
  const merged = {
    ...(existing ?? {}),
    ...input,
    word: clean(input.word) || existing?.word || '',
    definition: clean(input.definition) || existing?.definition || '',
    phoneticUk: clean(input.phoneticUk) || existing?.phoneticUk || '',
    phoneticUs: clean(input.phoneticUs) || existing?.phoneticUs || '',
    audioUk: clean(input.audioUk) || existing?.audioUk || '',
    audioUs: clean(input.audioUs) || existing?.audioUs || '',
    courseId: clean(input.courseId) || existing?.courseId || '',
    courseTitle: clean(input.courseTitle) || existing?.courseTitle || '',
    cueId: clean(input.cueId) || existing?.cueId || '',
    cueText: clean(input.cueText) || existing?.cueText || '',
    cueTranslation: clean(input.cueTranslation) || existing?.cueTranslation || '',
  }
  const next = normalizeWord({
    ...merged,
    normalized,
    savedAt: input.savedAt ?? Date.now(),
  })
  if (!next) return library
  return {
    ...library,
    words: [next, ...library.words.filter(item => item.normalized !== normalized)]
      .sort((a, b) => b.savedAt - a.savedAt),
  }
}

export function removeReviewWord(library: ReviewLibrary, normalizedInput: string): ReviewLibrary {
  const normalized = normalizeWordKey(normalizedInput)
  return {
    ...library,
    words: library.words.filter(item => item.normalized !== normalized),
  }
}

export function upsertReviewCue(
  library: ReviewLibrary,
  input: Partial<ReviewCue> & Pick<ReviewCue, 'courseId' | 'cueId'>,
): ReviewLibrary {
  const key = cueKey(input.courseId, input.cueId)
  if (!key) return library
  const existing = library.cues.find(item => cueKey(item.courseId, item.cueId) === key)
  const next = normalizeCue({
    ...(existing ?? {}),
    ...input,
    savedAt: input.savedAt ?? existing?.savedAt ?? Date.now(),
  })
  if (!next) return library
  return {
    ...library,
    cues: [next, ...library.cues.filter(item => cueKey(item.courseId, item.cueId) !== key)]
      .sort((a, b) => b.savedAt - a.savedAt),
  }
}

export function removeReviewCue(library: ReviewLibrary, courseId: string, cueId: string): ReviewLibrary {
  const key = cueKey(courseId, cueId)
  return {
    ...library,
    cues: library.cues.filter(item => cueKey(item.courseId, item.cueId) !== key),
  }
}

export function cueKey(courseId: string, cueId: string) {
  const course = String(courseId ?? '').trim()
  const cue = String(cueId ?? '').trim()
  return course && cue ? `${course}:${cue}` : ''
}

function normalizeWord(input: unknown): ReviewWord | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const source = input as Record<string, unknown>
  const word = clean(source.word)
  const normalized = normalizeWordKey(clean(source.normalized) || word)
  if (!word || !normalized) return null
  return {
    ...normalizeSource(source),
    word,
    normalized,
    definition: clean(source.definition),
    phoneticUk: clean(source.phoneticUk),
    phoneticUs: clean(source.phoneticUs),
    audioUk: clean(source.audioUk),
    audioUs: clean(source.audioUs),
    savedAt: normalizeTimestamp(source.savedAt),
  }
}

function normalizeCue(input: unknown): ReviewCue | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const source = input as Record<string, unknown>
  const normalized = normalizeSource(source)
  if (!normalized.courseId || !normalized.cueId) return null
  return {
    ...normalized,
    savedAt: normalizeTimestamp(source.savedAt),
  }
}

function normalizeSource(source: Record<string, unknown>): ReviewSource {
  return {
    courseId: clean(source.courseId),
    courseTitle: clean(source.courseTitle),
    cueId: clean(source.cueId),
    cueText: clean(source.cueText),
    cueTranslation: clean(source.cueTranslation),
  }
}

function clean(input: unknown) {
  return typeof input === 'string' ? input.trim().slice(0, 1000) : ''
}

function normalizeWordKey(input: string) {
  return String(input ?? '').trim().toLowerCase().replace(/[’‘]/g, "'")
}

function normalizeTimestamp(input: unknown) {
  const value = Number(input)
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : Date.now()
}
