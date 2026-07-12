"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearAllCache = clearAllCache;
exports.getCacheStats = getCacheStats;
exports.getCachedCourseList = getCachedCourseList;
exports.fetchCourseList = fetchCourseList;
exports.fetchCourseDetail = fetchCourseDetail;
exports.fetchAppConfig = fetchAppConfig;
exports.fetchWordLookup = fetchWordLookup;
exports.loginWithCode = loginWithCode;
exports.logout = logout;
exports.fetchCurrentUser = fetchCurrentUser;
exports.fetchUserProgress = fetchUserProgress;
exports.buildUpdateProgressPayload = buildUpdateProgressPayload;
exports.buildRecordProgressPayload = buildRecordProgressPayload;
exports.updateUserProgress = updateUserProgress;
exports.recordUserProgress = recordUserProgress;
exports.resetUserProgress = resetUserProgress;
exports.reportStudyTime = reportStudyTime;
exports.fetchLearningRecords = fetchLearningRecords;
exports.redeemInviteCode = redeemInviteCode;
const env_1 = require("../config/env");
const request_1 = require("./request");
const storage_1 = require("./storage");
const word_lookup_1 = require("./word-lookup");
// ==================== 缓存实例 ====================
// 课程列表缓存 (10分钟过期)
const WAIMAO_MINI_API_PREFIX = '/api/waimao-mini';
const courseListCache = new storage_1.LocalCache('waimao_mini_course_list', 10 * 60 * 1000);
// 课程详情缓存 (30分钟过期)
const courseDetailCache = new storage_1.DictCache('waimao_mini_course_detail', 30 * 60 * 1000);
// 课程词典版本稳定，客户端缓存 30 天；服务端词典更新后可通过 forceRefresh 主动刷新。
const wordLookupCache = new storage_1.DictCache('waimao_mini_word_lookup', 30 * 24 * 60 * 60 * 1000);
// 清除所有缓存的函数
function clearAllCache() {
    courseListCache.clear();
    courseDetailCache.clearAll();
    console.log('[API] All caches cleared');
}
// 获取缓存统计
function getCacheStats() {
    return {
        courseList: courseListCache.stats(),
    };
}
function getCachedCourseList(options = {}) {
    const cached = courseListCache.get();
    if (cached || !options.allowStale) {
        return cached ? toPublicCourseListCache(cached) : null;
    }
    const stale = courseListCache.getStale();
    return stale ? toPublicCourseListCache(stale) : null;
}
// 课程缓存必须是匿名投影。旧版本可能在带 token 的请求后写入用户进度与解锁态，
// 因此读取和写入两侧都清理顶层及 scene 内的账号字段，避免换账号或退出后串数据。
function toPublicCourseListCache(response) {
    return {
        ...response,
        data: response.data.map(chapter => {
            const locked = !chapter.free;
            return {
                ...chapter,
                audio: '',
                locked,
                progressPercent: 0,
                scenes: chapter.scenes.map(scene => ({
                    ...scene,
                    locked,
                    status: 'pending',
                    isCurrent: false,
                    progress: null,
                })),
            };
        }),
        progress: undefined,
        entitlement: undefined,
    };
}
// ==================== API 函数 ====================
function fetchCourseList(page = 1, pageSize = env_1.PAGE_SIZE_DEFAULT, options) {
    // 只有第一页且不需要进度数据时才直接命中新鲜缓存；登录态数据仍以服务端为准。
    const hasAuthenticatedSession = Boolean((0, storage_1.getToken)());
    const canUseFreshCache = page === 1 && !options?.withProgress && !hasAuthenticatedSession;
    // 强制刷新只跳过读取，不删除旧数据。网络失败时仍可用旧课程树兜底。
    const rawStaleFallback = page === 1 ? courseListCache.getStale() : null;
    const staleFallback = rawStaleFallback ? toPublicCourseListCache(rawStaleFallback) : null;
    if (canUseFreshCache && !options?.forceRefresh) {
        const cached = getCachedCourseList();
        if (cached) {
            console.log('[API] Course list cache hit');
            return Promise.resolve(cached);
        }
    }
    const data = {
        page,
        pageSize,
    };
    if (options?.withProgress) {
        data.withProgress = true;
    }
    console.log('[API] Fetching course list from server');
    return (0, request_1.request)({
        url: `${WAIMAO_MINI_API_PREFIX}/courses`,
        method: 'GET',
        data,
    }).then(response => {
        // 缓存第一页数据
        if (canUseFreshCache) {
            courseListCache.set(toPublicCourseListCache(response));
        }
        return response;
    }).catch(error => {
        if (!staleFallback) {
            throw error;
        }
        console.warn('[API] Course list request failed, using stale cache', error);
        // 只复用匿名课程投影；登录态进度与权益继续由 store 提供。
        return staleFallback;
    });
}
function fetchCourseDetail(id, forceRefresh = false) {
    // 强制刷新时跳过缓存
    if (forceRefresh) {
        courseDetailCache.remove(id);
    }
    // 尝试从缓存获取
    if (!forceRefresh) {
        const cached = courseDetailCache.get(id);
        if (cached) {
            console.log(`[API] Course detail cache hit: ${id}`);
            return Promise.resolve(cached);
        }
    }
    console.log(`[API] Fetching course detail from server: ${id}`);
    return (0, request_1.request)({
        url: `${WAIMAO_MINI_API_PREFIX}/courses/${id}`,
        method: 'GET',
    }).then(response => {
        console.log(`[API] ✅ 服务器返回课程详情:`, response);
        console.log(`[API] 音频路径: ${response.audio}`);
        // 缓存课程详情
        courseDetailCache.set(id, response);
        return response;
    });
}
function fetchAppConfig() {
    return (0, request_1.request)({
        url: `${WAIMAO_MINI_API_PREFIX}/app-config`,
        method: 'GET',
    });
}
async function fetchWordLookup(word, forceRefresh = false) {
    const key = (0, word_lookup_1.normalizeLookupWord)(word);
    if (!key) {
        return Promise.reject(new Error('Invalid word'));
    }
    if (!forceRefresh) {
        const cached = wordLookupCache.get(key);
        if (cached)
            return cached;
    }
    const response = await (0, request_1.request)({
        url: `${WAIMAO_MINI_API_PREFIX}/dictionary/${encodeURIComponent(key)}`,
        method: 'GET',
    });
    const result = (0, word_lookup_1.normalizeWordLookupResponse)(response, key);
    if (!result.translation)
        throw new Error('No definition');
    wordLookupCache.set(key, result);
    return result;
}
function loginWithCode(code, payload) {
    return (0, request_1.request)({
        url: `${WAIMAO_MINI_API_PREFIX}/auth/login`,
        method: 'POST',
        data: {
            code,
            ...payload,
        },
    });
}
function logout() {
    return (0, request_1.request)({
        url: `${WAIMAO_MINI_API_PREFIX}/auth/logout`,
        method: 'POST',
    });
}
function fetchCurrentUser() {
    return (0, request_1.request)({
        url: `${WAIMAO_MINI_API_PREFIX}/me`,
        method: 'GET',
    });
}
function fetchUserProgress() {
    return (0, request_1.request)({
        url: `${WAIMAO_MINI_API_PREFIX}/users/me/progress`,
        method: 'GET',
    });
}
function buildUpdateProgressPayload(courseId, status, options = {}) {
    const payload = {
        sceneId: courseId,
        ...options,
    };
    if (status) {
        payload.status = status;
    }
    return payload;
}
function buildRecordProgressPayload(courseId, options = {}) {
    return buildUpdateProgressPayload(courseId, null, options);
}
function updateUserProgress(courseId, status, options = {}) {
    return (0, request_1.request)({
        url: `${WAIMAO_MINI_API_PREFIX}/users/me/progress`,
        method: 'POST',
        data: buildUpdateProgressPayload(courseId, status, options),
    });
}
function recordUserProgress(courseId, options = {}) {
    return (0, request_1.request)({
        url: `${WAIMAO_MINI_API_PREFIX}/users/me/progress`,
        method: 'POST',
        data: buildRecordProgressPayload(courseId, options),
    });
}
function resetUserProgress() {
    return (0, request_1.request)({
        url: `${WAIMAO_MINI_API_PREFIX}/users/me/progress/reset`,
        method: 'POST',
    });
}
function reportStudyTime(seconds, practiceCount = 0) {
    return (0, request_1.request)({
        url: `${WAIMAO_MINI_API_PREFIX}/users/me/study-time`,
        method: 'POST',
        data: { seconds, practiceCount },
    });
}
function fetchLearningRecords(days = 28) {
    const safeDays = Math.min(365, Math.max(7, Math.floor(days)));
    return (0, request_1.request)({
        url: `${WAIMAO_MINI_API_PREFIX}/users/me/study-records?days=${safeDays}`,
    });
}
function redeemInviteCode(code) {
    return (0, request_1.request)({
        url: `${WAIMAO_MINI_API_PREFIX}/invite/redeem`,
        method: 'POST',
        data: { code },
    });
}
