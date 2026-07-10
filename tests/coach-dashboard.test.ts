import assert from 'node:assert/strict'

import type { ChapterListItem, UserProgress } from '../miniprogram/utils/api'
import { selectCoachLearningScene } from '../miniprogram/utils/coach-dashboard'
import type { CoachSceneSession } from '../miniprogram/utils/coach-progress'

const chapters: ChapterListItem[] = [
  {
    id: 'chapter-01',
    number: 1,
    label: '第一章',
    title: '客户开发',
    audio: '',
    duration: 300,
    free: true,
    locked: false,
    scenes: [
      { id: 'scene-1', index: 1, title: '首次联系', cueCount: 8, duration: 80, free: true, status: 'pending' },
      { id: 'scene-2', index: 2, title: '电话跟进', cueCount: 10, duration: 100, free: true, status: 'pending' },
    ],
  },
  {
    id: 'chapter-02',
    number: 2,
    label: '第二章',
    title: '报价谈判',
    audio: '',
    duration: 300,
    free: false,
    locked: true,
    scenes: [
      { id: 'scene-locked', index: 1, title: '价格谈判', cueCount: 9, duration: 90, free: false, locked: true },
    ],
  },
]

const progress: UserProgress = {
  currentSceneId: 'scene-1',
  completedCourseIds: [],
  completedSceneIds: [],
  streakCount: 0,
  totalCompleted: 0,
  lastStudyDate: null,
}

function session(sceneId: string, stage: CoachSceneSession['stage'], updatedAt: number): CoachSceneSession {
  return { sceneId, sceneTitle: sceneId, stage, cueIndex: 0, completedAt: null, updatedAt }
}

function testResumableSessionWins() {
  const selected = selectCoachLearningScene({
    chapters,
    progress,
    sessions: [session('scene-2', 'respond', 20)],
    plannedSceneIds: ['scene-1'],
  })
  assert.equal(selected?.scene.id, 'scene-2')
  assert.equal(selected?.source, 'resume')
}

function testUserPlanWinsOverServerCurrentScene() {
  const selected = selectCoachLearningScene({
    chapters,
    progress,
    sessions: [],
    plannedSceneIds: ['scene-locked', 'scene-2'],
  })
  assert.equal(selected?.scene.id, 'scene-2')
  assert.equal(selected?.source, 'plan')
}

function testCurrentAndRecommendedFallbacks() {
  const current = selectCoachLearningScene({ chapters, progress, sessions: [], plannedSceneIds: [] })
  assert.equal(current?.scene.id, 'scene-1')
  assert.equal(current?.source, 'current')

  const recommended = selectCoachLearningScene({
    chapters,
    progress: { ...progress, currentSceneId: null },
    sessions: [],
    plannedSceneIds: [],
  })
  assert.equal(recommended?.scene.id, 'scene-1')
  assert.equal(recommended?.source, 'recommended')
}

testResumableSessionWins()
testUserPlanWinsOverServerCurrentScene()
testCurrentAndRecommendedFallbacks()
console.log('coach dashboard tests passed.')
