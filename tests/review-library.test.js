"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const review_library_1 = require("../miniprogram/utils/review-library");
const normalized = (0, review_library_1.normalizeReviewLibrary)({
    words: [{ word: ' Quote ', normalized: 'QUOTE', definition: '报价', savedAt: 1 }],
    cues: [{ courseId: 'scene-1', cueId: 'cue-1', cueText: 'Follow up.', savedAt: 2 }],
});
strict_1.default.equal(normalized.words[0]?.normalized, 'quote');
strict_1.default.equal(normalized.words[0]?.definition, '报价');
strict_1.default.equal(normalized.cues[0]?.cueText, 'Follow up.');
const withWord = (0, review_library_1.upsertReviewWord)(normalized, {
    word: 'quote',
    normalized: 'quote',
    definition: '报价；引用',
    courseId: 'scene-1',
    cueId: 'cue-1',
});
strict_1.default.equal(withWord.words.length, 1);
strict_1.default.equal(withWord.words[0]?.definition, '报价；引用');
const withPartialRefresh = (0, review_library_1.upsertReviewWord)(withWord, {
    word: 'quote',
    normalized: 'quote',
    definition: '',
    phoneticUs: '/kwoʊt/',
});
strict_1.default.equal(withPartialRefresh.words[0]?.definition, '报价；引用');
strict_1.default.equal(withPartialRefresh.words[0]?.phoneticUs, '/kwoʊt/');
const withCue = (0, review_library_1.upsertReviewCue)(withPartialRefresh, {
    courseId: 'scene-2',
    cueId: 'cue-2',
    cueText: 'Could you confirm the lead time?',
});
strict_1.default.equal(withCue.cues.length, 2);
strict_1.default.equal((0, review_library_1.removeReviewCue)(withCue, 'scene-2', 'cue-2').cues.length, 1);
const testGlobals = globalThis;
const previousPage = testGlobals.Page;
const previousWx = testGlobals.wx;
let resolveReviewAudioTapAction;
let buildReviewCueViews;
let reviewPageDefinition = null;
try {
    testGlobals.Page = definition => {
        reviewPageDefinition = definition;
    };
    testGlobals.wx = {};
    ({ resolveReviewAudioTapAction, buildReviewCueViews } = require('../miniprogram/pages/review/review'));
}
finally {
    testGlobals.Page = previousPage;
    testGlobals.wx = previousWx;
}
strict_1.default.ok(resolveReviewAudioTapAction);
strict_1.default.equal(resolveReviewAudioTapAction({ type: 'word', id: 'quote', status: 'playing' }, { type: 'word', id: 'quote' }), 'pause');
strict_1.default.equal(resolveReviewAudioTapAction({ type: 'cue', id: 'cue-1', status: 'paused' }, { type: 'cue', id: 'cue-1' }), 'resume');
strict_1.default.equal(resolveReviewAudioTapAction({ type: 'cue', id: 'cue-1', status: 'loading' }, { type: 'cue', id: 'cue-1' }), 'cancel');
strict_1.default.equal(resolveReviewAudioTapAction({ type: 'word', id: 'quote', status: 'playing' }, { type: 'cue', id: 'cue-1' }), 'start');
strict_1.default.ok(buildReviewCueViews);
strict_1.default.deepEqual(buildReviewCueViews([
    { courseId: 'scene-1', cueId: 'book-cue-0001-s1' },
    { courseId: 'scene-2', cueId: 'book-cue-0001-s1' },
]).map(item => item.audioId), [
    'scene-1:book-cue-0001-s1',
    'scene-2:book-cue-0001-s1',
]);
strict_1.default.ok(reviewPageDefinition);
const reviewPage = reviewPageDefinition;
const audioHandlers = {};
const fakeAudioContext = {
    autoplay: false,
    obeyMuteSwitch: false,
    paused: false,
    currentTime: 0,
    src: '',
    startTime: 0,
    play() { },
    pause() { },
    stop() { },
    destroy() { },
    onPlay(handler) { audioHandlers.play = handler; },
    onPause(handler) { audioHandlers.pause = handler; },
    onWaiting(handler) { audioHandlers.waiting = handler; },
    onCanplay(handler) { audioHandlers.canplay = handler; },
    onTimeUpdate(handler) { audioHandlers.timeupdate = handler; },
    onEnded(handler) { audioHandlers.ended = handler; },
    onError(handler) { audioHandlers.error = handler; },
};
const pageHarness = {
    data: { activeAudioType: 'word', activeAudioId: 'quote', audioStatus: 'loading' },
    activeAudioTarget: { type: 'word', id: 'quote', url: 'https://audio.test/quote.mp3' },
    reviewAudioContext: null,
    audioStopTimer: null,
    setData(update) { Object.assign(this.data, update); },
    clearReviewAudioTimer: reviewPage.clearReviewAudioTimer,
    scheduleReviewAudioStop: reviewPage.scheduleReviewAudioStop,
    resetReviewAudio: reviewPage.resetReviewAudio,
};
try {
    testGlobals.wx = {
        createInnerAudioContext: () => fakeAudioContext,
        showToast: () => undefined,
    };
    reviewPage.ensureReviewAudioContext.call(pageHarness);
    audioHandlers.play?.();
    strict_1.default.equal(pageHarness.data.audioStatus, 'playing');
    audioHandlers.waiting?.();
    strict_1.default.equal(pageHarness.data.audioStatus, 'loading');
    audioHandlers.canplay?.();
    strict_1.default.equal(pageHarness.data.audioStatus, 'playing');
    audioHandlers.pause?.();
    strict_1.default.equal(pageHarness.data.audioStatus, 'paused');
    pageHarness.activeAudioTarget = {
        type: 'cue', id: 'cue-1', courseId: 'scene-1', url: 'https://audio.test/scene.mp3', start: 2, end: 3,
    };
    pageHarness.data = { activeAudioType: 'cue', activeAudioId: 'cue-1', audioStatus: 'playing' };
    fakeAudioContext.currentTime = 3;
    audioHandlers.timeupdate?.();
    strict_1.default.equal(pageHarness.data.audioStatus, 'idle');
    pageHarness.activeAudioTarget = { type: 'word', id: 'quote', url: 'https://audio.test/quote.mp3' };
    pageHarness.data = { activeAudioType: 'word', activeAudioId: 'quote', audioStatus: 'playing' };
    audioHandlers.ended?.();
    strict_1.default.equal(pageHarness.data.audioStatus, 'idle');
    strict_1.default.equal(pageHarness.activeAudioTarget, null);
}
finally {
    testGlobals.wx = previousWx;
}
console.log('review library tests passed.');
