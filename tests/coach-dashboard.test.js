"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const coach_dashboard_1 = require("../miniprogram/utils/coach-dashboard");
const chapters = [
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
];
const progress = {
    currentSceneId: 'scene-1',
    completedCourseIds: [],
    completedSceneIds: [],
    streakCount: 0,
    totalCompleted: 0,
    lastStudyDate: null,
};
function session(sceneId, stage, updatedAt) {
    return { sceneId, sceneTitle: sceneId, stage, cueIndex: 0, completedAt: null, updatedAt };
}
function testResumableSessionWins() {
    const selected = (0, coach_dashboard_1.selectCoachLearningScene)({
        chapters,
        progress,
        sessions: [session('scene-2', 'respond', 20)],
        plannedSceneIds: ['scene-1'],
    });
    strict_1.default.equal(selected?.scene.id, 'scene-2');
    strict_1.default.equal(selected?.source, 'resume');
}
function testUserPlanWinsOverServerCurrentScene() {
    const selected = (0, coach_dashboard_1.selectCoachLearningScene)({
        chapters,
        progress,
        sessions: [],
        plannedSceneIds: ['scene-locked', 'scene-2'],
    });
    strict_1.default.equal(selected?.scene.id, 'scene-2');
    strict_1.default.equal(selected?.source, 'plan');
}
function testCurrentAndRecommendedFallbacks() {
    const current = (0, coach_dashboard_1.selectCoachLearningScene)({ chapters, progress, sessions: [], plannedSceneIds: [] });
    strict_1.default.equal(current?.scene.id, 'scene-1');
    strict_1.default.equal(current?.source, 'current');
    const recommended = (0, coach_dashboard_1.selectCoachLearningScene)({
        chapters,
        progress: { ...progress, currentSceneId: null },
        sessions: [],
        plannedSceneIds: [],
    });
    strict_1.default.equal(recommended?.scene.id, 'scene-1');
    strict_1.default.equal(recommended?.source, 'recommended');
}
testResumableSessionWins();
testUserPlanWinsOverServerCurrentScene();
testCurrentAndRecommendedFallbacks();
console.log('coach dashboard tests passed.');
