"use strict";
// 难句星标的本地存储模型：courseId -> 星标句 id 列表。
// 纯函数部分不触碰 wx.storage，便于测试；页面侧负责读写持久化。
Object.defineProperty(exports, "__esModule", { value: true });
exports.STARRED_CUES_STORAGE_KEY = void 0;
exports.normalizeStarredCueMap = normalizeStarredCueMap;
exports.getStarredCueIds = getStarredCueIds;
exports.isCueStarred = isCueStarred;
exports.toggleStarredCue = toggleStarredCue;
exports.STARRED_CUES_STORAGE_KEY = 'waimao_starred_cues_v1';
function normalizeStarredCueMap(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return {};
    }
    const result = {};
    for (const [courseId, cueIds] of Object.entries(input)) {
        if (!courseId || !Array.isArray(cueIds)) {
            continue;
        }
        const normalized = cueIds
            .filter((id) => typeof id === 'string' && id.length > 0);
        if (normalized.length) {
            result[courseId] = Array.from(new Set(normalized));
        }
    }
    return result;
}
function getStarredCueIds(map, courseId) {
    return map[courseId] ?? [];
}
function isCueStarred(map, courseId, cueId) {
    return getStarredCueIds(map, courseId).includes(cueId);
}
function toggleStarredCue(map, courseId, cueId) {
    if (!courseId || !cueId) {
        return map;
    }
    const current = getStarredCueIds(map, courseId);
    const next = current.includes(cueId)
        ? current.filter(id => id !== cueId)
        : [...current, cueId];
    const result = { ...map };
    if (next.length) {
        result[courseId] = next;
    }
    else {
        delete result[courseId];
    }
    return result;
}
