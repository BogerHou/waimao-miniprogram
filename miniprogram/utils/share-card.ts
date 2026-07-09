type IndexShareCardOptions = {
  isAuthenticated: boolean
  userNickname?: string
  completedCount: number
  courseCount: number
  streakCount: number
  featuredCourseTitle?: string
}

type PdfShareCardOptions = {
  courseTitle?: string
  imageCount: number
}

type LogsShareCardOptions = {
  logCount: number
  latestLogDate?: string
}

type ShareCardModel = {
  title: string
  badge: string
  highlight: string
  snippet: string
}

function normalizeText(value?: string) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncateText(value: string, maxLength = 56) {
  if (value.length <= maxLength) {
    return value
  }

  if (maxLength <= 3) {
    return value.slice(0, maxLength)
  }

  return `${value.slice(0, maxLength - 3).trimEnd()}...`
}

export function buildIndexShareCardModel(options: IndexShareCardOptions): ShareCardModel {
  const nickname = normalizeText(options.userNickname) || 'Learner'
  const featuredCourseTitle = normalizeText(options.featuredCourseTitle)

  return {
    title: options.isAuthenticated
      ? `${nickname} 的外贸英语学习主页`
      : '外贸英语影子跟读',
    badge: `已完成 ${Math.max(0, options.completedCount)} / ${Math.max(0, options.courseCount)}`,
    highlight: options.isAuthenticated
      ? `连续学习 ${Math.max(0, options.streakCount)} 天`
      : '随时开始一节听力课程',
    snippet: truncateText(
      featuredCourseTitle
        ? `下一节推荐：${featuredCourseTitle}`
        : '外贸场景、跟读练习与学习记录都在这里。'
    ),
  }
}

export function buildContactShareCardModel(): ShareCardModel {
  return {
    title: '加入外贸英语学习交流社群',
    badge: '学习交流',
    highlight: '每日听力打卡',
    snippet: '扫码加入社群，和小伙伴一起坚持听力打卡。',
  }
}

export function buildPracticeHelpShareCardModel(): ShareCardModel {
  return {
    title: 'Echo 法与影子跟读练习指南',
    badge: '练习帮助',
    highlight: '先听懂，再跟上',
    snippet: '用一节课学会 Echo 模式和影子跟读模式的练习节奏。',
  }
}

export function buildPdfShareCardModel(options: PdfShareCardOptions): ShareCardModel {
  const courseTitle = normalizeText(options.courseTitle) || '课程知识点'
  return {
    title: courseTitle,
    badge: `知识点 ${Math.max(0, options.imageCount)} 页`,
    highlight: '图解重点内容',
    snippet: '课程知识点图解与重点内容整理。',
  }
}

export function buildLogsShareCardModel(options: LogsShareCardOptions): ShareCardModel {
  const latestLogDate = normalizeText(options.latestLogDate)
  return {
    title: '外贸英语影子跟读启动日志',
    badge: `最近 ${Math.max(0, options.logCount)} 条`,
    highlight: '运行状态记录',
    snippet: latestLogDate
      ? `最近一次启动：${truncateText(latestLogDate, 40)}`
      : '查看最近的小程序启动时间记录。',
  }
}
