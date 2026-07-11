import type { LearningStage } from './player-core'

type CourseShareCardOptions = {
  title: string
  tag?: string
  stage: LearningStage
  currentText?: string
  leadText?: string
  maxSnippetLength?: number
}

type CourseShareCardModel = {
  title: string
  tagLabel: string
  modeLabel: string
  snippet: string
}

const DEFAULT_SNIPPET = '外贸英语影子跟读练习，打开继续学习。'

function normalizeText(value?: string) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value
  }

  if (maxLength <= 3) {
    return value.slice(0, maxLength)
  }

  return `${value.slice(0, maxLength - 3).trimEnd()}...`
}

const STAGE_LABELS: Record<LearningStage, string> = {
  listen: '通听',
  practice: '逐句精练',
  follow: '影子跟读',
}

export function buildCourseShareCardModel(options: CourseShareCardOptions): CourseShareCardModel {
  const maxSnippetLength = Math.max(12, options.maxSnippetLength ?? 64)
  const currentText = normalizeText(options.currentText)
  const leadText = normalizeText(options.leadText)
  const snippetSource = currentText || leadText || DEFAULT_SNIPPET

  return {
    title: normalizeText(options.title) || '外贸英语影子跟读',
    tagLabel: normalizeText(options.tag) || '外贸英语',
    modeLabel: STAGE_LABELS[options.stage] ?? STAGE_LABELS.listen,
    snippet: truncateText(snippetSource, maxSnippetLength),
  }
}
