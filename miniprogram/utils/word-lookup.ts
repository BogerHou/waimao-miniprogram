export type WordLookupResponse = {
  word: string
  normalized: string
  translation: string | null
  phoneticUk: string | null
  phoneticUs: string | null
  audioUk: string | null
  audioUs: string | null
  source: string
  dictionaryVersion?: string
}

export function normalizeLookupWord(input: string) {
  return String(input ?? '').trim().toLowerCase().replace(/’/g, "'")
}

export function normalizeWordLookupResponse(
  input: Partial<WordLookupResponse> | null | undefined,
  fallbackWord: string,
): WordLookupResponse {
  const normalized = normalizeLookupWord(input?.normalized || fallbackWord)
  return {
    word: String(input?.word || fallbackWord).trim() || fallbackWord,
    normalized,
    translation: cleanNullable(input?.translation),
    phoneticUk: cleanNullable(input?.phoneticUk),
    phoneticUs: cleanNullable(input?.phoneticUs),
    audioUk: cleanNullable(input?.audioUk),
    audioUs: cleanNullable(input?.audioUs),
    source: String(input?.source || 'course-dictionary'),
    dictionaryVersion: input?.dictionaryVersion ? String(input.dictionaryVersion) : undefined,
  }
}

function cleanNullable(input: unknown) {
  const value = String(input ?? '').trim()
  return value || null
}
