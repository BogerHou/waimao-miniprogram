export type LearningDay = {
  date: string
  studySeconds: number
  practiceCount: number
  sessionCount: number
}

export type CalendarDay = LearningDay & {
  dayLabel: string
  isToday: boolean
  intensity: 0 | 1 | 2 | 3
}

export function formatStudyDuration(secondsInput: number) {
  const seconds = Math.max(0, Math.floor(Number(secondsInput) || 0))
  if (seconds < 60) return `${seconds} 秒`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`
}

export function buildRecentCalendar(
  days: LearningDay[],
  options: { totalDays?: number; today?: Date } = {},
): CalendarDay[] {
  const totalDays = Math.min(56, Math.max(7, Math.floor(options.totalDays ?? 28)))
  const today = startOfDay(options.today ?? new Date())
  const byDate = new Map(days.map(item => [item.date, item]))
  const result: CalendarDay[] = []

  for (let offset = totalDays - 1; offset >= 0; offset -= 1) {
    const date = new Date(today)
    date.setDate(today.getDate() - offset)
    const key = formatDateKey(date)
    const source = byDate.get(key)
    const studySeconds = Math.max(0, Number(source?.studySeconds) || 0)
    result.push({
      date: key,
      dayLabel: String(date.getDate()),
      studySeconds,
      practiceCount: Math.max(0, Number(source?.practiceCount) || 0),
      sessionCount: Math.max(0, Number(source?.sessionCount) || 0),
      isToday: offset === 0,
      intensity: resolveIntensity(studySeconds),
    })
  }
  return result
}

export function resolveIntensity(seconds: number): 0 | 1 | 2 | 3 {
  if (seconds <= 0) return 0
  if (seconds < 5 * 60) return 1
  if (seconds < 20 * 60) return 2
  return 3
}

export function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}
