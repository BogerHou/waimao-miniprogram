"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createReviewStorageGuard = createReviewStorageGuard;
exports.createWxReviewStorageGuard = createWxReviewStorageGuard;
const practice_marks_1 = require("./practice-marks");
const review_library_1 = require("./review-library");
const REVIEW_STORAGE_KEYS = [
    review_library_1.REVIEW_LIBRARY_STORAGE_KEY,
    practice_marks_1.STARRED_CUES_STORAGE_KEY,
];
function createReviewStorageGuard(storage) {
    const snapshot = new Map();
    for (const key of REVIEW_STORAGE_KEYS) {
        const value = storage.get(key);
        if (value !== undefined && value !== null && value !== '') {
            snapshot.set(key, value);
        }
    }
    return () => {
        for (const [key, value] of snapshot) {
            const current = storage.get(key);
            if (current === undefined || current === null || current === '') {
                storage.set(key, value);
            }
        }
    };
}
function createWxReviewStorageGuard() {
    return createReviewStorageGuard({
        get: key => wx.getStorageSync(key),
        set: (key, value) => wx.setStorageSync(key, value),
    });
}
