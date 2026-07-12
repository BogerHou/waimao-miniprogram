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
console.log('review library tests passed.');
