export type RawKnowledgeDialogueItem = {
  speaker: string
  text: string
  translation?: string
}

export type KnowledgeDialogueSegment = {
  id: string
  text: string
}

export type KnowledgeDialogueItem = {
  id: string
  speaker: string
  toneClass: string
  textSegments: KnowledgeDialogueSegment[]
  translationSegments: KnowledgeDialogueSegment[]
}

export const SPEAKER_TONE_CLASSES = [
  'dialogue-tone-0',
  'dialogue-tone-1',
  'dialogue-tone-2',
  'dialogue-tone-3',
  'dialogue-tone-4',
  'dialogue-tone-5',
]

const CLOSING_MARKS = new Set(['"', "'", '”', '’', ')', '）', ']', '】'])
const SENTENCE_PUNCTUATION = new Set(['.', '?', '!', '。', '？', '！', '…'])
const EXTRA_PUNCTUATION = new Set(['.', '?', '!', '。', '？', '！', '…', '·'])

export function formatKnowledgeDialogue(
  items: RawKnowledgeDialogueItem[] = [],
): KnowledgeDialogueItem[] {
  const speakerToneIndexes = new Map<string, number>()

  return items
    .filter(item => item && String(item.text ?? '').trim())
    .map((item, itemIndex) => {
      const speaker = String(item.speaker || 'Speaker').trim() || 'Speaker'
      const speakerKey = normalizeSpeakerKey(speaker)

      return {
        id: `${speakerKey}-${itemIndex}`,
        speaker,
        toneClass: resolveSpeakerToneClass(speaker, speakerToneIndexes),
        textSegments: buildSegments(item.text, `${itemIndex}-text`),
        translationSegments: buildSegments(item.translation ?? '', `${itemIndex}-translation`),
      }
    })
}

export function resolveSpeakerToneClass(
  speaker: string,
  speakerToneIndexes: Map<string, number>,
): string {
  const speakerKey = normalizeSpeakerKey(speaker)
  let toneIndex = speakerToneIndexes.get(speakerKey)
  if (toneIndex === undefined) {
    toneIndex = speakerToneIndexes.size % SPEAKER_TONE_CLASSES.length
    speakerToneIndexes.set(speakerKey, toneIndex)
  }
  return SPEAKER_TONE_CLASSES[toneIndex]
}

export function splitDialogueSentences(input: string): string[] {
  const text = String(input ?? '').replace(/\s+/g, ' ').trim()
  if (!text) {
    return []
  }

  const parts: string[] = []
  let start = 0
  let index = 0

  while (index < text.length) {
    const char = text[index]
    if (SENTENCE_PUNCTUATION.has(char) && shouldSplitAt(text, index, start)) {
      let end = index + 1
      while (end < text.length && EXTRA_PUNCTUATION.has(text[end])) {
        end += 1
      }
      while (end < text.length && CLOSING_MARKS.has(text[end])) {
        end += 1
      }

      const part = text.slice(start, end).trim()
      if (part) {
        parts.push(part)
      }

      start = end
      while (start < text.length && /\s/.test(text[start])) {
        start += 1
      }
      index = start
      continue
    }
    index += 1
  }

  const tail = text.slice(start).trim()
  if (tail) {
    parts.push(tail)
  }

  return parts.length ? parts : [text]
}

function buildSegments(input: string, prefix: string): KnowledgeDialogueSegment[] {
  return splitDialogueSentences(input).map((text, index) => ({
    id: `${prefix}-${index}`,
    text,
  }))
}

function normalizeSpeakerKey(speaker: string): string {
  return String(speaker || 'Speaker').trim().toLowerCase() || 'speaker'
}

function shouldSplitAt(text: string, index: number, segmentStart: number): boolean {
  if (text[index] !== '.') {
    return true
  }

  const prev = text[index - 1] ?? ''
  const next = text[index + 1] ?? ''
  if (isDigit(prev) && isDigit(next)) {
    return false
  }

  const token = text.slice(findTokenStart(text, index, segmentStart), index + 1)
  if (token.includes('@')) {
    return false
  }

  const nextVisible = findNextVisibleChar(text, index + 1)
  if (nextVisible && isAsciiLowercase(nextVisible) && isAsciiLetter(prev)) {
    return false
  }

  return true
}

function findTokenStart(text: string, index: number, fallback: number): number {
  for (let cursor = index; cursor >= fallback; cursor -= 1) {
    if (/\s/.test(text[cursor])) {
      return cursor + 1
    }
  }
  return fallback
}

function findNextVisibleChar(text: string, start: number): string {
  for (let index = start; index < text.length; index += 1) {
    if (!/\s/.test(text[index])) {
      return text[index]
    }
  }
  return ''
}

function isDigit(char: string): boolean {
  return /^[0-9]$/.test(char)
}

function isAsciiLetter(char: string): boolean {
  return /^[A-Za-z]$/.test(char)
}

function isAsciiLowercase(char: string): boolean {
  return /^[a-z]$/.test(char)
}
