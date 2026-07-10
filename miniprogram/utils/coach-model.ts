import type { CourseDetailResponse, SubtitleEntry } from './api'

export type CoachChallenge = {
  id: string
  cueIndex: number
  promptSpeaker: string
  promptText: string
  promptTranslation: string
  referenceSpeaker: string
  referenceText: string
  referenceTranslation: string
}

export type CoachSceneMode = 'dialogue' | 'phrase-drill'

export type CoachScenePlan = {
  mode: CoachSceneMode
  businessGoal: string
  learnerSpeaker: string
  customerSpeaker: string
  estimatedMinutes: number
  keyExpressions: string[]
  challenges: CoachChallenge[]
  practiceCues: Array<SubtitleEntry & { cueIndex: number }>
}

const TITLE_GOALS: Array<{ pattern: RegExp; goal: string }> = [
  { pattern: /报价|价格/, goal: '自然确认客户是否看过报价，并推动对方给出明确的下一步。' },
  { pattern: /催促|紧急|交期|延期/, goal: '在保持合作关系的同时，明确说明紧迫性并确认处理时间。' },
  { pattern: /展会|接待|拜访/, goal: '快速建立信任，问出客户真正关心的信息并约定后续动作。' },
  { pattern: /谈判|MOQ|数量|付款/, goal: '守住关键条件，同时给客户一个可以继续谈下去的方案。' },
  { pattern: /投诉|售后|质量|问题/, goal: '先承接客户情绪，再确认事实并给出清晰的解决步骤。' },
  { pattern: /开发|陌生|Cold Call/i, goal: '在最短时间内说明价值，争取让客户愿意继续听下去。' },
  { pattern: /邮件|邮箱/, goal: '清楚说明邮件事项，并让客户确认收到或给出下一步反馈。' },
  { pattern: /表达|金句|口语/, goal: '在常见外贸情境中快速调取并说出一组高频表达。' },
]

export function buildCoachScenePlan(course: CourseDetailResponse): CoachScenePlan {
  const subtitles = Array.isArray(course.subtitles) ? course.subtitles : []
  const mode = resolveSceneMode(subtitles)
  const learnerSpeaker = mode === 'phrase-drill' ? '你' : resolveLearnerSpeaker(subtitles)
  const customerSpeaker = mode === 'phrase-drill'
    ? '高频表达'
    : resolveCustomerSpeaker(subtitles, learnerSpeaker)
  const allCues = subtitles.map((cue, cueIndex) => ({ ...cue, cueIndex }))
  const learnerCues = mode === 'phrase-drill'
    ? allCues
    : allCues.filter(cue => normalizeSpeaker(cue.speaker) === normalizeSpeaker(learnerSpeaker))
  const practiceCues = learnerCues.length
    ? learnerCues
    : allCues
  const challenges = practiceCues.slice(0, 6).map((cue, index) => {
    const previous = subtitles[cue.cueIndex - 1]
    const hasCustomerPrompt = mode === 'dialogue' && previous && normalizeSpeaker(previous.speaker) !== normalizeSpeaker(learnerSpeaker)
    return {
      id: `${course.id}:${cue.id}`,
      cueIndex: cue.cueIndex,
      promptSpeaker: mode === 'phrase-drill' ? '表达任务' : hasCustomerPrompt ? previous.speaker || customerSpeaker : '情境',
      promptText: mode === 'phrase-drill'
        ? cue.translation || '请先用英语说出这条表达。'
        : hasCustomerPrompt
          ? previous.text
          : index === 0
            ? 'The customer has just answered your call.'
            : 'The customer is waiting for your next point.',
      promptTranslation: mode === 'phrase-drill'
        ? '先用英语表达，再查看参考说法。'
        : hasCustomerPrompt
          ? previous.translation || ''
          : index === 0
            ? '客户刚刚接通电话，你准备怎样自然开场？'
            : '客户正在等你继续推进，你会怎样表达？',
      referenceSpeaker: cue.speaker || learnerSpeaker,
      referenceText: cue.text,
      referenceTranslation: cue.translation || '',
    }
  })

  return {
    mode,
    businessGoal: resolveBusinessGoal(course),
    learnerSpeaker,
    customerSpeaker,
    estimatedMinutes: mode === 'phrase-drill'
      ? Math.max(10, Math.min(30, Math.ceil(4 + practiceCues.length * 0.45)))
      : Math.max(6, Math.min(15, Math.ceil(4 + practiceCues.length * 0.75))),
    keyExpressions: practiceCues.slice(0, 3).map(cue => cue.text),
    challenges,
    practiceCues,
  }
}

export function resolveBusinessGoal(course: Pick<CourseDetailResponse, 'title' | 'knowledge'>) {
  const title = String(course.title || '')
  const matched = TITLE_GOALS.find(item => item.pattern.test(title))
  if (matched) {
    return matched.goal
  }

  const background = String(course.knowledge?.background || '').replace(/\s+/g, ' ').trim()
  if (background) {
    return truncateText(background, 76)
  }

  return '在真实外贸沟通中组织清楚的回应，并推动对话进入下一步。'
}

function resolveLearnerSpeaker(subtitles: SubtitleEntry[]) {
  const preferred = subtitles.find(item => normalizeSpeaker(item.speaker) === 'yibing')?.speaker
  if (preferred) return preferred
  const firstNamed = subtitles.find(item => normalizeSpeaker(item.speaker))?.speaker
  return firstNamed || '你'
}

function resolveSceneMode(subtitles: SubtitleEntry[]): CoachSceneMode {
  if (!subtitles.length) return 'dialogue'
  const sentenceLabels = subtitles.filter(item => /^句子\s*\d+$/i.test(String(item.speaker || '').trim())).length
  return sentenceLabels / subtitles.length >= 0.8 ? 'phrase-drill' : 'dialogue'
}

function resolveCustomerSpeaker(subtitles: SubtitleEntry[], learnerSpeaker: string) {
  const learner = normalizeSpeaker(learnerSpeaker)
  const other = subtitles.find(item => {
    const speaker = normalizeSpeaker(item.speaker)
    return speaker && speaker !== learner
  })?.speaker
  return other || '客户'
}

function normalizeSpeaker(value?: string) {
  return String(value || '').trim().toLowerCase()
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value
  }
  return `${value.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`
}
