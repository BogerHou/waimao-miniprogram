"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const coach_progress_1 = require("../miniprogram/utils/coach-progress");
const baseInput = {
    sceneId: 'scene-1',
    sentenceId: 'cue-1',
    cueIndex: 0,
    sceneTitle: '电话跟进',
    chapterLabel: '第一章',
    text: 'I wanted to follow up.',
    translation: '我想跟进一下。',
    recordingPath: '',
};
function testReviewQueueAndMasterySummary() {
    const now = 1000000;
    let state = (0, coach_progress_1.createEmptyCoachProgress)();
    state = (0, coach_progress_1.upsertSentenceProgress)(state, { ...baseInput, status: 'review' }, now);
    state = (0, coach_progress_1.upsertSentenceProgress)(state, {
        ...baseInput,
        sentenceId: 'cue-2',
        cueIndex: 1,
        text: 'Did you have a chance to look?',
        status: 'mastered',
    }, now);
    strict_1.default.equal((0, coach_progress_1.getReviewItems)(state, now).length, 1);
    strict_1.default.equal((0, coach_progress_1.getCoachSummary)(state, now).masteredCount, 1);
    strict_1.default.equal(state.sentences.find(item => item.sentenceId === 'cue-1')?.attempts, 1);
}
function testSceneSessionKeepsLatestStage() {
    const now = 2000000;
    let state = (0, coach_progress_1.createEmptyCoachProgress)();
    state = (0, coach_progress_1.saveSceneSessionProgress)(state, {
        sceneId: 'scene-1',
        sceneTitle: '电话跟进',
        stage: 'respond',
        cueIndex: 2,
        completedAt: null,
    }, now);
    state = (0, coach_progress_1.saveSceneSessionProgress)(state, {
        sceneId: 'scene-1',
        sceneTitle: '电话跟进',
        stage: 'summary',
        cueIndex: 4,
        batchStart: 8,
        completedAt: now + 10,
    }, now + 10);
    state = (0, coach_progress_1.saveSceneSessionProgress)(state, {
        sceneId: 'scene-1',
        sceneTitle: '电话跟进',
        stage: 'listen',
        cueIndex: 0,
        completedAt: null,
    }, now + 20);
    strict_1.default.equal(state.sessions.length, 1);
    strict_1.default.equal(state.sessions[0].stage, 'listen');
    strict_1.default.equal(state.sessions[0].batchStart, 8);
    strict_1.default.equal(state.sessions[0].completedAt, now + 10);
    strict_1.default.equal((0, coach_progress_1.getCoachSummary)(state, now + 20).completedSceneCount, 1);
}
function testRecordingUpdateDoesNotDoubleCountPractice() {
    const now = 3000000;
    let state = (0, coach_progress_1.createEmptyCoachProgress)();
    state = (0, coach_progress_1.upsertSentenceProgress)(state, {
        ...baseInput,
        status: 'learning',
        recordingPath: 'local-recording.mp3',
        countAttempt: false,
    }, now);
    state = (0, coach_progress_1.upsertSentenceProgress)(state, {
        ...baseInput,
        status: 'review',
        recordingPath: 'local-recording.mp3',
    }, now + 10);
    strict_1.default.equal(state.sentences[0].attempts, 1);
    strict_1.default.equal(state.sentences[0].recordingPath, 'local-recording.mp3');
}
function testTrainingPlanMigratesAndPreservesPriority() {
    const migrated = (0, coach_progress_1.normalizeCoachProgress)({
        version: 1,
        sentences: [],
        sessions: [],
    });
    strict_1.default.deepEqual(migrated.plannedSceneIds, []);
    let state = (0, coach_progress_1.addCoachPlannedScene)(migrated, 'scene-2');
    state = (0, coach_progress_1.addCoachPlannedScene)(state, 'scene-1');
    state = (0, coach_progress_1.addCoachPlannedScene)(state, 'scene-2');
    strict_1.default.deepEqual(state.plannedSceneIds, ['scene-2', 'scene-1']);
    state = (0, coach_progress_1.removeCoachPlannedScene)(state, 'scene-2');
    strict_1.default.deepEqual(state.plannedSceneIds, ['scene-1']);
}
testReviewQueueAndMasterySummary();
testSceneSessionKeepsLatestStage();
testRecordingUpdateDoesNotDoubleCountPractice();
testTrainingPlanMigratesAndPreservesPriority();
console.log('coach progress tests passed.');
