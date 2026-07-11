// 难句星标的本地存储模型：courseId -> 星标句 id 列表。
// 纯函数部分不触碰 wx.storage，便于测试；页面侧负责读写持久化。

export const STARRED_CUES_STORAGE_KEY = 'waimao_starred_cues_v1'

export type StarredCueMap = Record<string, string[]>

export function normalizeStarredCueMap(input: unknown): StarredCueMap {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {}
  }
  const result: StarredCueMap = {}
  for (const [courseId, cueIds] of Object.entries(input as Record<string, unknown>)) {
    if (!courseId || !Array.isArray(cueIds)) {
      continue
    }
    const normalized = cueIds
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
    if (normalized.length) {
      result[courseId] = Array.from(new Set(normalized))
    }
  }
  return result
}

export function getStarredCueIds(map: StarredCueMap, courseId: string): string[] {
  return map[courseId] ?? []
}

export function isCueStarred(map: StarredCueMap, courseId: string, cueId: string): boolean {
  return getStarredCueIds(map, courseId).includes(cueId)
}

export function toggleStarredCue(map: StarredCueMap, courseId: string, cueId: string): StarredCueMap {
  if (!courseId || !cueId) {
    return map
  }
  const current = getStarredCueIds(map, courseId)
  const next = current.includes(cueId)
    ? current.filter(id => id !== cueId)
    : [...current, cueId]
  const result: StarredCueMap = { ...map }
  if (next.length) {
    result[courseId] = next
  } else {
    delete result[courseId]
  }
  return result
}
