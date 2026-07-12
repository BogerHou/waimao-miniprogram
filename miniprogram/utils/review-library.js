"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REVIEW_LIBRARY_STORAGE_KEY = void 0;
exports.normalizeReviewLibrary = normalizeReviewLibrary;
exports.upsertReviewWord = upsertReviewWord;
exports.removeReviewWord = removeReviewWord;
exports.upsertReviewCue = upsertReviewCue;
exports.removeReviewCue = removeReviewCue;
exports.cueKey = cueKey;
exports.REVIEW_LIBRARY_STORAGE_KEY = 'waimao_review_library_v1';
const EMPTY_LIBRARY = { words: [], cues: [] };
function normalizeReviewLibrary(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return { ...EMPTY_LIBRARY };
    }
    const source = input;
    return {
        words: Array.isArray(source.words)
            ? source.words.map(normalizeWord).filter((item) => Boolean(item))
            : [],
        cues: Array.isArray(source.cues)
            ? source.cues.map(normalizeCue).filter((item) => Boolean(item))
            : [],
    };
}
function upsertReviewWord(library, input) {
    const normalized = normalizeWordKey(input.normalized || input.word);
    if (!normalized)
        return library;
    const existing = library.words.find(item => item.normalized === normalized);
    const merged = {
        ...(existing ?? {}),
        ...input,
        word: clean(input.word) || existing?.word || '',
        definition: clean(input.definition) || existing?.definition || '',
        phoneticUk: clean(input.phoneticUk) || existing?.phoneticUk || '',
        phoneticUs: clean(input.phoneticUs) || existing?.phoneticUs || '',
        audioUk: clean(input.audioUk) || existing?.audioUk || '',
        audioUs: clean(input.audioUs) || existing?.audioUs || '',
        courseId: clean(input.courseId) || existing?.courseId || '',
        courseTitle: clean(input.courseTitle) || existing?.courseTitle || '',
        cueId: clean(input.cueId) || existing?.cueId || '',
        cueText: clean(input.cueText) || existing?.cueText || '',
        cueTranslation: clean(input.cueTranslation) || existing?.cueTranslation || '',
    };
    const next = normalizeWord({
        ...merged,
        normalized,
        savedAt: input.savedAt ?? Date.now(),
    });
    if (!next)
        return library;
    return {
        ...library,
        words: [next, ...library.words.filter(item => item.normalized !== normalized)]
            .sort((a, b) => b.savedAt - a.savedAt),
    };
}
function removeReviewWord(library, normalizedInput) {
    const normalized = normalizeWordKey(normalizedInput);
    return {
        ...library,
        words: library.words.filter(item => item.normalized !== normalized),
    };
}
function upsertReviewCue(library, input) {
    const key = cueKey(input.courseId, input.cueId);
    if (!key)
        return library;
    const existing = library.cues.find(item => cueKey(item.courseId, item.cueId) === key);
    const next = normalizeCue({
        ...(existing ?? {}),
        ...input,
        savedAt: input.savedAt ?? existing?.savedAt ?? Date.now(),
    });
    if (!next)
        return library;
    return {
        ...library,
        cues: [next, ...library.cues.filter(item => cueKey(item.courseId, item.cueId) !== key)]
            .sort((a, b) => b.savedAt - a.savedAt),
    };
}
function removeReviewCue(library, courseId, cueId) {
    const key = cueKey(courseId, cueId);
    return {
        ...library,
        cues: library.cues.filter(item => cueKey(item.courseId, item.cueId) !== key),
    };
}
function cueKey(courseId, cueId) {
    const course = String(courseId ?? '').trim();
    const cue = String(cueId ?? '').trim();
    return course && cue ? `${course}:${cue}` : '';
}
function normalizeWord(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input))
        return null;
    const source = input;
    const word = clean(source.word);
    const normalized = normalizeWordKey(clean(source.normalized) || word);
    if (!word || !normalized)
        return null;
    return {
        ...normalizeSource(source),
        word,
        normalized,
        definition: clean(source.definition),
        phoneticUk: clean(source.phoneticUk),
        phoneticUs: clean(source.phoneticUs),
        audioUk: clean(source.audioUk),
        audioUs: clean(source.audioUs),
        savedAt: normalizeTimestamp(source.savedAt),
    };
}
function normalizeCue(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input))
        return null;
    const source = input;
    const normalized = normalizeSource(source);
    if (!normalized.courseId || !normalized.cueId)
        return null;
    return {
        ...normalized,
        savedAt: normalizeTimestamp(source.savedAt),
    };
}
function normalizeSource(source) {
    return {
        courseId: clean(source.courseId),
        courseTitle: clean(source.courseTitle),
        cueId: clean(source.cueId),
        cueText: clean(source.cueText),
        cueTranslation: clean(source.cueTranslation),
    };
}
function clean(input) {
    return typeof input === 'string' ? input.trim().slice(0, 1000) : '';
}
function normalizeWordKey(input) {
    return String(input ?? '').trim().toLowerCase().replace(/[’‘]/g, "'");
}
function normalizeTimestamp(input) {
    const value = Number(input);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : Date.now();
}
