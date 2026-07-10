"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const coach_model_1 = require("../miniprogram/utils/coach-model");
function testBuildsBusinessChallengesFromLearnerTurns() {
    const plan = (0, coach_model_1.buildCoachScenePlan)({
        id: 'scene-1',
        title: '报价后的电话跟进',
        audio: '/audio.mp3',
        subtitles: [
            { id: '1', start: 0, end: 1, speaker: 'Yibing', text: 'Hi Bob, this is Yibing.', translation: '嗨，Bob。' },
            { id: '2', start: 1, end: 2, speaker: 'Bob', text: 'How can I help?', translation: '有什么事吗？' },
            { id: '3', start: 2, end: 3, speaker: 'Yibing', text: 'I wanted to follow up on my quotation.', translation: '我想跟进一下报价。' },
        ],
    });
    strict_1.default.equal(plan.learnerSpeaker, 'Yibing');
    strict_1.default.equal(plan.customerSpeaker, 'Bob');
    strict_1.default.equal(plan.mode, 'dialogue');
    strict_1.default.equal(plan.practiceCues.length, 2);
    strict_1.default.equal(plan.challenges[0].promptSpeaker, '情境');
    strict_1.default.equal(plan.challenges[1].promptText, 'How can I help?');
    strict_1.default.equal(plan.challenges[1].referenceText, 'I wanted to follow up on my quotation.');
    strict_1.default.match(plan.businessGoal, /报价/);
}
function testPrefersLearnerRoleWhenCustomerSpeaksFirst() {
    const plan = (0, coach_model_1.buildCoachScenePlan)({
        id: 'scene-customer-first',
        title: '接到客户的 Cold Call（陌生来电），这样应对',
        audio: '/audio.mp3',
        subtitles: [
            { id: '1', start: 0, end: 1, speaker: 'Nina', text: 'Hi, is this Yibing?', translation: '你好，是毅冰吗？' },
            { id: '2', start: 1, end: 2, speaker: 'Yibing', text: 'Yes, speaking.', translation: '是的，我就是。' },
        ],
    });
    strict_1.default.equal(plan.learnerSpeaker, 'Yibing');
    strict_1.default.equal(plan.customerSpeaker, 'Nina');
    strict_1.default.equal(plan.practiceCues.length, 1);
    strict_1.default.equal(plan.challenges[0].promptText, 'Hi, is this Yibing?');
}
function testTreatsSentenceLibraryAsPhraseDrill() {
    const plan = (0, coach_model_1.buildCoachScenePlan)({
        id: 'scene-phrases',
        title: '在办公室：畅聊必备的地道英语表达',
        audio: '/audio.mp3',
        subtitles: [
            { id: '1', start: 0, end: 1, speaker: '句子 1', text: 'Same old, same grind.', translation: '还是老样子，忙忙碌碌的。' },
            { id: '2', start: 1, end: 2, speaker: '句子 2', text: 'How about grabbing a coffee?', translation: '一起去喝杯咖啡？' },
            { id: '3', start: 2, end: 3, speaker: '句子 3', text: 'I will keep you posted.', translation: '我会随时告诉你进展。' },
        ],
    });
    strict_1.default.equal(plan.mode, 'phrase-drill');
    strict_1.default.equal(plan.learnerSpeaker, '你');
    strict_1.default.equal(plan.practiceCues.length, 3);
    strict_1.default.equal(plan.challenges[0].promptSpeaker, '表达任务');
    strict_1.default.equal(plan.challenges[0].promptText, '还是老样子，忙忙碌碌的。');
}
function testFallsBackToBackgroundForUnknownScenario() {
    const goal = (0, coach_model_1.resolveBusinessGoal)({
        title: '特别场景',
        knowledge: {
            background: '这是一个需要先确认客户信息，再提出下一步建议的场景。',
            phrases: '',
            correction: '',
            notes: '',
            dialogue: [],
        },
    });
    strict_1.default.match(goal, /确认客户信息/);
}
testBuildsBusinessChallengesFromLearnerTurns();
testPrefersLearnerRoleWhenCustomerSpeaksFirst();
testTreatsSentenceLibraryAsPhraseDrill();
testFallsBackToBackgroundForUnknownScenario();
console.log('coach model tests passed.');
