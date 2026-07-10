"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COACH_PROGRESS_STORAGE_KEY = void 0;
exports.createEmptyCoachProgress = createEmptyCoachProgress;
exports.normalizeCoachProgress = normalizeCoachProgress;
exports.addCoachPlannedScene = addCoachPlannedScene;
exports.removeCoachPlannedScene = removeCoachPlannedScene;
exports.upsertSentenceProgress = upsertSentenceProgress;
exports.saveSceneSessionProgress = saveSceneSessionProgress;
exports.getReviewItems = getReviewItems;
exports.getCoachSummary = getCoachSummary;
exports.readCoachProgress = readCoachProgress;
exports.writeCoachProgress = writeCoachProgress;
exports.updateCoachSentence = updateCoachSentence;
exports.updateCoachSceneSession = updateCoachSceneSession;
exports.updateCoachPlannedScene = updateCoachPlannedScene;
exports.removeCoachPlannedSceneById = removeCoachPlannedSceneById;
exports.persistCoachRecording = persistCoachRecording;
exports.removeCoachRecording = removeCoachRecording;
exports.COACH_PROGRESS_STORAGE_KEY = 'waimao_coach_progress_v1';
const MASTERED_REVIEW_DELAY = 3 * 24 * 60 * 60 * 1000;
const MAX_PLANNED_SCENES = 20;
function createEmptyCoachProgress() {
    return { version: 1, sentences: [], sessions: [], plannedSceneIds: [] };
}
function normalizeCoachProgress(value) {
    if (!value || typeof value !== 'object') {
        return createEmptyCoachProgress();
    }
    const source = value;
    return {
        version: 1,
        sentences: Array.isArray(source.sentences)
            ? source.sentences.filter(isSentenceRecord).map(item => ({ ...item }))
            : [],
        sessions: Array.isArray(source.sessions)
            ? source.sessions.filter(isSceneSession).map(item => ({ ...item }))
            : [],
        plannedSceneIds: normalizePlannedSceneIds(source.plannedSceneIds),
    };
}
function addCoachPlannedScene(state, sceneId) {
    const id = String(sceneId || '').trim();
    if (!id || state.plannedSceneIds.includes(id))
        return state;
    return {
        ...state,
        plannedSceneIds: [...state.plannedSceneIds, id].slice(0, MAX_PLANNED_SCENES),
    };
}
function removeCoachPlannedScene(state, sceneId) {
    const plannedSceneIds = state.plannedSceneIds.filter(item => item !== sceneId);
    if (plannedSceneIds.length === state.plannedSceneIds.length)
        return state;
    return { ...state, plannedSceneIds };
}
function upsertSentenceProgress(state, input, now = Date.now()) {
    const { countAttempt = true, ...recordInput } = input;
    const key = `${input.sceneId}:${input.sentenceId}`;
    const existing = state.sentences.find(item => item.key === key);
    const nextReviewAt = input.status === 'review'
        ? now
        : input.status === 'mastered'
            ? now + MASTERED_REVIEW_DELAY
            : null;
    const next = {
        ...recordInput,
        key,
        recordingPath: input.recordingPath ?? existing?.recordingPath ?? '',
        attempts: (existing?.attempts ?? 0) + (countAttempt ? 1 : 0),
        updatedAt: now,
        nextReviewAt,
    };
    return {
        ...state,
        sentences: [next, ...state.sentences.filter(item => item.key !== key)],
    };
}
function saveSceneSessionProgress(state, input, now = Date.now()) {
    const existing = state.sessions.find(item => item.sceneId === input.sceneId);
    const next = {
        ...input,
        batchStart: input.batchStart ?? existing?.batchStart ?? 0,
        completedAt: input.completedAt ?? existing?.completedAt ?? null,
        updatedAt: now,
    };
    return {
        ...state,
        sessions: [next, ...state.sessions.filter(item => item.sceneId !== input.sceneId)],
    };
}
function getReviewItems(state, now = Date.now()) {
    return state.sentences
        .filter(item => item.status === 'review' || Boolean(item.nextReviewAt && item.nextReviewAt <= now))
        .sort((a, b) => {
        if (a.status !== b.status) {
            return a.status === 'review' ? -1 : 1;
        }
        return b.updatedAt - a.updatedAt;
    });
}
function getCoachSummary(state, now = Date.now()) {
    const weekStart = now - 7 * 24 * 60 * 60 * 1000;
    return {
        reviewCount: getReviewItems(state, now).length,
        masteredCount: state.sentences.filter(item => item.status === 'mastered').length,
        completedSceneCount: state.sessions.filter(item => Boolean(item.completedAt)).length,
        weeklySessionCount: state.sessions.filter(item => item.updatedAt >= weekStart).length,
    };
}
function readCoachProgress() {
    if (typeof wx === 'undefined' || typeof wx.getStorageSync !== 'function') {
        return createEmptyCoachProgress();
    }
    try {
        return normalizeCoachProgress(wx.getStorageSync(exports.COACH_PROGRESS_STORAGE_KEY));
    }
    catch (_error) {
        return createEmptyCoachProgress();
    }
}
function writeCoachProgress(state) {
    if (typeof wx === 'undefined' || typeof wx.setStorageSync !== 'function') {
        return;
    }
    try {
        wx.setStorageSync(exports.COACH_PROGRESS_STORAGE_KEY, state);
    }
    catch (error) {
        console.warn('[Coach] Failed to persist progress', error);
    }
}
function updateCoachSentence(input, now = Date.now()) {
    const next = upsertSentenceProgress(readCoachProgress(), input, now);
    writeCoachProgress(next);
    return next;
}
function updateCoachSceneSession(input, now = Date.now()) {
    const next = saveSceneSessionProgress(readCoachProgress(), input, now);
    writeCoachProgress(next);
    return next;
}
function updateCoachPlannedScene(sceneId, selected) {
    const state = readCoachProgress();
    const next = selected
        ? addCoachPlannedScene(state, sceneId)
        : removeCoachPlannedScene(state, sceneId);
    writeCoachProgress(next);
    return next;
}
function removeCoachPlannedSceneById(sceneId) {
    const next = removeCoachPlannedScene(readCoachProgress(), sceneId);
    writeCoachProgress(next);
    return next;
}
function persistCoachRecording(tempFilePath) {
    if (!tempFilePath || typeof wx === 'undefined' || typeof wx.saveFile !== 'function') {
        return Promise.resolve(tempFilePath);
    }
    return new Promise(resolve => {
        wx.saveFile({
            tempFilePath,
            success(result) {
                resolve(result.savedFilePath || tempFilePath);
            },
            fail(error) {
                console.warn('[Coach] Failed to save recording', error);
                resolve(tempFilePath);
            },
        });
    });
}
function removeCoachRecording(filePath) {
    if (!filePath || typeof wx === 'undefined' || typeof wx.getFileSystemManager !== 'function')
        return;
    wx.getFileSystemManager().unlink({
        filePath,
        fail() {
            // The path may already have been reclaimed by WeChat.
        },
    });
}
function isSentenceRecord(value) {
    if (!value || typeof value !== 'object')
        return false;
    const item = value;
    return Boolean(item.key &&
        item.sceneId &&
        item.sentenceId &&
        typeof item.cueIndex === 'number' &&
        (item.status === 'learning' || item.status === 'review' || item.status === 'mastered'));
}
function isSceneSession(value) {
    if (!value || typeof value !== 'object')
        return false;
    const item = value;
    return Boolean(item.sceneId && item.sceneTitle && item.stage && typeof item.cueIndex === 'number');
}
function normalizePlannedSceneIds(value) {
    if (!Array.isArray(value))
        return [];
    const seen = new Set();
    return value.reduce((result, item) => {
        const id = typeof item === 'string' ? item.trim() : '';
        if (!id || seen.has(id) || result.length >= MAX_PLANNED_SCENES)
            return result;
        seen.add(id);
        result.push(id);
        return result;
    }, []);
}
