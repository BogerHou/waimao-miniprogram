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
let resolveWordAudioTapAction;
let buildReviewSourceUrl;
let reviewPageDefinition = null;
try {
    testGlobals.Page = definition => {
        reviewPageDefinition = definition;
    };
    testGlobals.wx = {};
    ({ resolveWordAudioTapAction, buildReviewSourceUrl } = require('../miniprogram/pages/review/review'));
}
finally {
    testGlobals.Page = previousPage;
    testGlobals.wx = previousWx;
}
strict_1.default.ok(resolveWordAudioTapAction);
strict_1.default.equal(resolveWordAudioTapAction({ id: 'quote', status: 'playing' }, 'quote'), 'pause');
strict_1.default.equal(resolveWordAudioTapAction({ id: 'quote', status: 'paused' }, 'quote'), 'resume');
strict_1.default.equal(resolveWordAudioTapAction({ id: 'quote', status: 'loading' }, 'quote'), 'cancel');
strict_1.default.equal(resolveWordAudioTapAction({ id: 'quote', status: 'playing' }, 'sample'), 'start');
strict_1.default.ok(buildReviewSourceUrl);
strict_1.default.equal(buildReviewSourceUrl({ courseId: 'scene 1', cueId: 'cue/2' }), '/pages/course/course?id=scene%201&cueId=cue%2F2&stage=practice&autoplay=1');
strict_1.default.equal(buildReviewSourceUrl({ courseId: 'scene-1', cueId: 'cue-2' }, true), '/pages/course/course?id=scene-1&cueId=cue-2&stage=practice&autoplay=1&review=1');
strict_1.default.equal(buildReviewSourceUrl(undefined), '');
strict_1.default.ok(reviewPageDefinition);
const reviewPage = reviewPageDefinition;
const audioHandlers = {};
const fakeAudioContext = {
    autoplay: false,
    obeyMuteSwitch: false,
    paused: false,
    src: '',
    play() { },
    pause() { },
    stop() { },
    destroy() { },
    onPlay(handler) { audioHandlers.play = handler; },
    onPause(handler) { audioHandlers.pause = handler; },
    onWaiting(handler) { audioHandlers.waiting = handler; },
    onCanplay(handler) { audioHandlers.canplay = handler; },
    onEnded(handler) { audioHandlers.ended = handler; },
    onError(handler) { audioHandlers.error = handler; },
};
const pageHarness = {
    data: { activeWordAudioId: 'quote', wordAudioStatus: 'loading' },
    wordAudioContext: null,
    setData(update) { Object.assign(this.data, update); },
    resetWordAudio: reviewPage.resetWordAudio,
};
try {
    testGlobals.wx = {
        createInnerAudioContext: () => fakeAudioContext,
        showToast: () => undefined,
    };
    reviewPage.ensureWordAudioContext.call(pageHarness);
    audioHandlers.play?.();
    strict_1.default.equal(pageHarness.data.wordAudioStatus, 'playing');
    audioHandlers.waiting?.();
    strict_1.default.equal(pageHarness.data.wordAudioStatus, 'loading');
    audioHandlers.canplay?.();
    strict_1.default.equal(pageHarness.data.wordAudioStatus, 'playing');
    audioHandlers.pause?.();
    strict_1.default.equal(pageHarness.data.wordAudioStatus, 'paused');
    audioHandlers.ended?.();
    strict_1.default.equal(pageHarness.data.wordAudioStatus, 'idle');
    strict_1.default.equal(pageHarness.data.activeWordAudioId, '');
}
finally {
    testGlobals.wx = previousWx;
}
console.log('review library tests passed.');
