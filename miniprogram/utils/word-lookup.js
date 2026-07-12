"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeLookupWord = normalizeLookupWord;
exports.normalizeWordLookupResponse = normalizeWordLookupResponse;
function normalizeLookupWord(input) {
    return String(input ?? '').trim().toLowerCase().replace(/’/g, "'");
}
function normalizeWordLookupResponse(input, fallbackWord) {
    const normalized = normalizeLookupWord(input?.normalized || fallbackWord);
    return {
        word: String(input?.word || fallbackWord).trim() || fallbackWord,
        normalized,
        translation: cleanNullable(input?.translation),
        phoneticUk: cleanNullable(input?.phoneticUk),
        phoneticUs: cleanNullable(input?.phoneticUs),
        audioUk: cleanNullable(input?.audioUk),
        audioUs: cleanNullable(input?.audioUs),
        source: String(input?.source || 'course-dictionary'),
        dictionaryVersion: input?.dictionaryVersion ? String(input.dictionaryVersion) : undefined,
    };
}
function cleanNullable(input) {
    const value = String(input ?? '').trim();
    return value || null;
}
