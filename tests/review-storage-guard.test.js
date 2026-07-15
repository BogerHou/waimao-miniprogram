"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const review_storage_guard_1 = require("../miniprogram/utils/review-storage-guard");
const practice_marks_1 = require("../miniprogram/utils/practice-marks");
const review_library_1 = require("../miniprogram/utils/review-library");
const values = new Map([
    [review_library_1.REVIEW_LIBRARY_STORAGE_KEY, { words: [{ normalized: 'quote' }], cues: [] }],
    [practice_marks_1.STARRED_CUES_STORAGE_KEY, { 'scene-1': ['cue-1'] }],
]);
const restore = (0, review_storage_guard_1.createReviewStorageGuard)({
    get: key => values.get(key),
    set: (key, value) => values.set(key, value),
});
values.delete(review_library_1.REVIEW_LIBRARY_STORAGE_KEY);
values.delete(practice_marks_1.STARRED_CUES_STORAGE_KEY);
restore();
strict_1.default.deepEqual(values.get(review_library_1.REVIEW_LIBRARY_STORAGE_KEY), {
    words: [{ normalized: 'quote' }],
    cues: [],
});
strict_1.default.deepEqual(values.get(practice_marks_1.STARRED_CUES_STORAGE_KEY), { 'scene-1': ['cue-1'] });
values.set(review_library_1.REVIEW_LIBRARY_STORAGE_KEY, { words: [{ normalized: 'newer' }], cues: [] });
restore();
strict_1.default.deepEqual(values.get(review_library_1.REVIEW_LIBRARY_STORAGE_KEY), {
    words: [{ normalized: 'newer' }],
    cues: [],
});
console.log('review storage guard tests passed.');
