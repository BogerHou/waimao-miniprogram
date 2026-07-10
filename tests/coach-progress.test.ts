import assert from 'node:assert/strict'

import {
  createEmptyCoachProgress,
  getCoachSummary,
  getReviewItems,
  saveSceneSessionProgress,
  upsertSentenceProgress,
} from '../miniprogram/utils/coach-progress'

const baseInput = {
  sceneId: 'scene-1',
  sentenceId: 'cue-1',
  cueIndex: 0,
  sceneTitle: '电话跟进',
  chapterLabel: '第一章',
  text: 'I wanted to follow up.',
  translation: '我想跟进一下。',
  recordingPath: '',
} as const

function testReviewQueueAndMasterySummary() {
  const now = 1_000_000
  let state = createEmptyCoachProgress()
  state = upsertSentenceProgress(state, { ...baseInput, status: 'review' }, now)
  state = upsertSentenceProgress(state, {
    ...baseInput,
    sentenceId: 'cue-2',
    cueIndex: 1,
    text: 'Did you have a chance to look?',
    status: 'mastered',
  }, now)

  assert.equal(getReviewItems(state, now).length, 1)
  assert.equal(getCoachSummary(state, now).masteredCount, 1)
  assert.equal(state.sentences.find(item => item.sentenceId === 'cue-1')?.attempts, 1)
}

function testSceneSessionKeepsLatestStage() {
  const now = 2_000_000
  let state = createEmptyCoachProgress()
  state = saveSceneSessionProgress(state, {
    sceneId: 'scene-1',
    sceneTitle: '电话跟进',
    stage: 'respond',
    cueIndex: 2,
    completedAt: null,
  }, now)
  state = saveSceneSessionProgress(state, {
    sceneId: 'scene-1',
    sceneTitle: '电话跟进',
    stage: 'summary',
    cueIndex: 4,
    completedAt: now + 10,
  }, now + 10)
  state = saveSceneSessionProgress(state, {
    sceneId: 'scene-1',
    sceneTitle: '电话跟进',
    stage: 'listen',
    cueIndex: 0,
    completedAt: null,
  }, now + 20)

  assert.equal(state.sessions.length, 1)
  assert.equal(state.sessions[0].stage, 'listen')
  assert.equal(state.sessions[0].completedAt, now + 10)
  assert.equal(getCoachSummary(state, now + 20).completedSceneCount, 1)
}

function testRecordingUpdateDoesNotDoubleCountPractice() {
  const now = 3_000_000
  let state = createEmptyCoachProgress()
  state = upsertSentenceProgress(state, {
    ...baseInput,
    status: 'learning',
    recordingPath: 'local-recording.mp3',
    countAttempt: false,
  }, now)
  state = upsertSentenceProgress(state, {
    ...baseInput,
    status: 'review',
    recordingPath: 'local-recording.mp3',
  }, now + 10)

  assert.equal(state.sentences[0].attempts, 1)
  assert.equal(state.sentences[0].recordingPath, 'local-recording.mp3')
}

testReviewQueueAndMasterySummary()
testSceneSessionKeepsLatestStage()
testRecordingUpdateDoesNotDoubleCountPractice()
console.log('coach progress tests passed.')
