import assert from 'node:assert/strict'
import { filterChaptersBySceneQuery, countChapterScenes } from '../miniprogram/utils/scene-search'
import type { ChapterListItem } from '../miniprogram/utils/api'

const chapters: ChapterListItem[] = [
  {
    id: 'chapter-1', number: 1, label: '第一章', title: '电话沟通', audio: '', duration: 0, free: true,
    scenes: [
      { id: 'scene-1', index: 1, title: '报价后的电话跟进', cueCount: 1, duration: 1, free: true },
      { id: 'scene-2', index: 2, title: '催促紧急事宜', cueCount: 1, duration: 1, free: true },
    ],
  },
  {
    id: 'chapter-2', number: 2, label: '第二章', title: '展会接待', audio: '', duration: 0, free: false,
    scenes: [{ id: 'scene-3', index: 1, title: '介绍新产品', cueCount: 1, duration: 1, free: false }],
  },
]

assert.equal(countChapterScenes(filterChaptersBySceneQuery(chapters, '电话')), 2)
assert.equal(filterChaptersBySceneQuery(chapters, '报价')[0]?.scenes[0]?.id, 'scene-1')
assert.equal(filterChaptersBySceneQuery(chapters, '展会')[0]?.id, 'chapter-2')
assert.equal(filterChaptersBySceneQuery(chapters, '不存在').length, 0)

console.log('scene search tests passed.')
