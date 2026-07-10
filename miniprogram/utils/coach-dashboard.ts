import type { ChapterListItem, ChapterSceneItem, UserProgress } from './api'
import type { CoachSceneSession } from './coach-progress'

export type CoachLearningSource = 'resume' | 'plan' | 'current' | 'recommended' | 'repeat'

export type CoachLearningSelection = {
  chapter: ChapterListItem
  scene: ChapterSceneItem
  session: CoachSceneSession | null
  source: CoachLearningSource
}

export type SelectCoachLearningSceneInput = {
  chapters: ChapterListItem[]
  progress: UserProgress | null
  sessions: CoachSceneSession[]
  plannedSceneIds: string[]
}

export function selectCoachLearningScene({
  chapters,
  progress,
  sessions,
  plannedSceneIds,
}: SelectCoachLearningSceneInput): CoachLearningSelection | null {
  const available = flattenAvailableScenes(chapters)
  if (!available.length) return null

  const sceneById = new Map(available.map(item => [item.scene.id, item]))
  const resumableSession = sessions.find(item => item.stage !== 'summary' && sceneById.has(item.sceneId))
  if (resumableSession) {
    const selected = sceneById.get(resumableSession.sceneId)
    if (selected) return { ...selected, session: resumableSession, source: 'resume' }
  }

  for (const sceneId of plannedSceneIds) {
    const selected = sceneById.get(sceneId)
    if (!selected) continue
    return {
      ...selected,
      session: sessions.find(item => item.sceneId === sceneId) ?? null,
      source: 'plan',
    }
  }

  const current = progress?.currentSceneId ? sceneById.get(progress.currentSceneId) : null
  if (current && current.scene.status !== 'completed') {
    return {
      ...current,
      session: sessions.find(item => item.sceneId === current.scene.id) ?? null,
      source: 'current',
    }
  }

  const pending = available.find(item => item.scene.status !== 'completed')
  if (pending) {
    return {
      ...pending,
      session: sessions.find(item => item.sceneId === pending.scene.id) ?? null,
      source: 'recommended',
    }
  }

  const first = available[0]
  return {
    ...first,
    session: sessions.find(item => item.sceneId === first.scene.id) ?? null,
    source: 'repeat',
  }
}

export function flattenAvailableScenes(chapters: ChapterListItem[]) {
  return chapters.flatMap(chapter => chapter.scenes
    .filter(scene => !scene.locked)
    .map(scene => ({ chapter, scene })))
}
