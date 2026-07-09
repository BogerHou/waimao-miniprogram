export type KnowledgeTextLine = {
  id: string
  text: string
}

export type KnowledgePhraseItem = {
  id: string
  term: string
  definition: string
}

export type KnowledgeCorrectionBlock = {
  hasContent: boolean
  promptLines: KnowledgeTextLine[]
  chinglishLines: KnowledgeTextLine[]
  nativeLines: KnowledgeTextLine[]
  extraLines: KnowledgeTextLine[]
}

export type RawKnowledgeContent = {
  background?: string
  phrases?: string
  correction?: string
  notes?: string
}

export type FormattedKnowledgeContent = {
  backgroundParagraphs: KnowledgeTextLine[]
  phraseItems: KnowledgePhraseItem[]
  correction: KnowledgeCorrectionBlock
  noteParagraphs: KnowledgeTextLine[]
  hasKnowledgeContent: boolean
}

type CorrectionMode = 'prompt' | 'chinglish' | 'native' | 'extra'

export function formatKnowledgeContent(content: RawKnowledgeContent = {}): FormattedKnowledgeContent {
  const backgroundParagraphs = toTextLines(splitKnowledgeLines(content.background), 'background')
  const phraseItems = parsePhraseItems(content.phrases)
  const correction = parseCorrectionBlock(content.correction)
  const noteParagraphs = toTextLines(stripKnowledgeHeading(content.notes, /^毅冰补充[:：]?/), 'note')

  return {
    backgroundParagraphs,
    phraseItems,
    correction,
    noteParagraphs,
    hasKnowledgeContent: Boolean(
      backgroundParagraphs.length
        || phraseItems.length
        || correction.hasContent
        || noteParagraphs.length,
    ),
  }
}

export function splitKnowledgeLines(text?: string): string[] {
  return String(text || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
}

export function parsePhraseItems(text?: string): KnowledgePhraseItem[] {
  const items: Array<{ term: string; definition: string }> = []
  let current: { term: string; definition: string } | null = null

  for (const line of splitKnowledgeLines(text)) {
    if (isKnowledgeHeadingLine(line)) {
      break
    }

    if (isPhraseStartLine(line)) {
      if (current) {
        items.push(current)
      }
      current = splitPhraseLine(line)
      continue
    }

    if (current) {
      current.definition = `${current.definition}${line}`.trim()
    } else {
      current = {
        term: '',
        definition: line,
      }
    }
  }

  if (current) {
    items.push(current)
  }

  return items
    .filter(item => item.term || item.definition)
    .map((item, index) => ({
      id: `phrase-${index}`,
      term: item.term,
      definition: item.definition,
    }))
}

export function splitPhraseLine(line: string): { term: string; definition: string } {
  const value = String(line || '').trim()
  const chineseIndex = value.search(/[\u3400-\u9fff]/)
  if (chineseIndex > 0) {
    return {
      term: value.slice(0, chineseIndex).trim(),
      definition: value.slice(chineseIndex).trim(),
    }
  }

  const [term = value, ...rest] = value.split(/\s+/)
  return {
    term: chineseIndex === 0 ? '' : term.trim(),
    definition: chineseIndex === 0 ? value : rest.join(' ').trim(),
  }
}

export function parseCorrectionBlock(text?: string): KnowledgeCorrectionBlock {
  const grouped: Record<CorrectionMode, string[]> = {
    prompt: [],
    chinglish: [],
    native: [],
    extra: [],
  }
  let mode: CorrectionMode = 'prompt'

  splitKnowledgeLines(text).forEach(line => {
    if (/^Chinglish Correction/.test(line)) {
      return
    }
    if (/^【Chinglish】$/i.test(line)) {
      mode = 'chinglish'
      return
    }
    if (/^【Native English】$/i.test(line)) {
      mode = 'native'
      return
    }
    grouped[mode].push(line)
  })

  const promptLines = toTextLines(mergeWrappedLines(grouped.prompt), 'correction-prompt')
  const chinglishLines = toTextLines(mergeWrappedLines(grouped.chinglish), 'correction-chinglish')
  const nativeLines = toTextLines(mergeWrappedLines(grouped.native), 'correction-native')
  const extraLines = toTextLines(mergeWrappedLines(grouped.extra), 'correction-extra')

  return {
    hasContent: Boolean(promptLines.length || chinglishLines.length || nativeLines.length || extraLines.length),
    promptLines,
    chinglishLines,
    nativeLines,
    extraLines,
  }
}

export function stripKnowledgeHeading(text: string | undefined, heading: RegExp): string[] {
  return splitKnowledgeLines(text).filter(line => !heading.test(line))
}

function toTextLines(lines: string[], prefix: string): KnowledgeTextLine[] {
  return lines
    .map(line => line.trim())
    .filter(Boolean)
    .map((text, index) => ({
      id: `${prefix}-${index}`,
      text,
    }))
}

function isKnowledgeHeadingLine(line: string): boolean {
  return /^Chinglish Correction/.test(line)
    || /^毅冰补充[:：]?/.test(line)
    || /^【(?:Chinglish|Native English)】$/i.test(line)
}

function isPhraseStartLine(line: string): boolean {
  return /^[A-Za-z0-9]/.test(line)
}

function mergeWrappedLines(lines: string[]): string[] {
  return lines.length ? [lines.join(' ').replace(/\s+/g, ' ').trim()] : []
}
