import type { ChapterListItem } from './api'

export function normalizeSceneSearchQuery(input: string) {
  return String(input ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export function filterChaptersBySceneQuery(
  chapters: ChapterListItem[],
  queryInput: string,
): ChapterListItem[] {
  const query = normalizeSceneSearchQuery(queryInput)
  if (!query) return chapters

  return chapters.flatMap(chapter => {
    const chapterMatch = searchable(`${chapter.label} ${chapter.title}`).includes(query)
    const scenes = chapterMatch
      ? chapter.scenes
      : chapter.scenes.filter(scene => searchable(`${scene.index} ${scene.title}`).includes(query))
    return scenes.length ? [{ ...chapter, scenes }] : []
  })
}

export function countChapterScenes(chapters: ChapterListItem[]) {
  return chapters.reduce((sum, chapter) => sum + chapter.scenes.length, 0)
}

function searchable(input: string) {
  return normalizeSceneSearchQuery(input)
}
