type IndexShareCardOptions = {
  isAuthenticated: boolean
  userNickname?: string
  completedCount: number
  courseCount: number
  streakCount: number
  featuredCourseTitle?: string
  audioPlaybackEnabled?: boolean
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
      : options.audioPlaybackEnabled === false
        ? '随时开始一节场景课程'
        : '随时开始一节听力课程',
    snippet: truncateText(
      featuredCourseTitle
        ? `下一节推荐：${featuredCourseTitle}`
        : options.audioPlaybackEnabled === false
          ? '外贸场景、双语内容与学习记录都在这里。'
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
    title: '通听、精练、跟读三步练习法',
    badge: '练习方法',
    highlight: '听懂 · 练顺 · 跟上',
    snippet: '一节外贸场景课，按三个阶段分别解决理解、难句和流畅度。',
  }
}
