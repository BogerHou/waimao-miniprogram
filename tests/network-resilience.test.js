"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.networkResilienceTestDone = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const api_1 = require("../miniprogram/utils/api");
const metrics_1 = require("../miniprogram/utils/metrics");
const request_1 = require("../miniprogram/utils/request");
const storage_1 = require("../miniprogram/utils/storage");
function createCourseListResponse() {
    return {
        data: [
            {
                id: 'chapter-01',
                number: 1,
                label: '第一章',
                title: '建立联系',
                audio: '',
                duration: 60,
                free: true,
                scenes: [],
            },
        ],
        progress: {
            completedCourseIds: [],
            streakCount: 0,
            totalCompleted: 0,
            lastStudyDate: null,
        },
        entitlement: {
            fullAccess: false,
            expiresAt: null,
        },
        appConfig: {
            home: {
                bannerEnabled: false,
                practiceHelpEnabled: false,
            },
            courseDetail: {
                shadowModeEnabled: true,
            },
        },
    };
}
function testMetricsCollector() {
    const timerHandlers = new Map();
    let nextTimerId = 1;
    const sentBatches = [];
    let now = 100;
    const collector = (0, metrics_1.createMetricsCollector)({
        send: events => sentBatches.push(events),
        batchSize: 2,
        maxBuffer: 3,
        now: () => now++,
        setTimer(handler) {
            const id = nextTimerId++;
            timerHandlers.set(id, handler);
            return id;
        },
        clearTimer(id) {
            timerHandlers.delete(id);
        },
    });
    collector.report('api_error', { path: '/first' });
    strict_1.default.equal(collector.pendingCount(), 1);
    strict_1.default.equal(timerHandlers.size, 1);
    collector.report('api_error', { path: '/second' });
    strict_1.default.equal(collector.pendingCount(), 0);
    strict_1.default.equal(timerHandlers.size, 0);
    strict_1.default.deepEqual(sentBatches[0].map(item => item.payload.path), ['/first', '/second']);
    const timerCollector = (0, metrics_1.createMetricsCollector)({
        send: events => sentBatches.push(events),
        batchSize: 10,
        setTimer(handler) {
            const id = nextTimerId++;
            timerHandlers.set(id, handler);
            return id;
        },
        clearTimer(id) {
            timerHandlers.delete(id);
        },
    });
    timerCollector.report('audio_load_timeout', { courseId: 'scene-01' });
    const timer = [...timerHandlers.values()][0];
    strict_1.default.ok(timer);
    timer();
    strict_1.default.equal(timerCollector.pendingCount(), 0);
    strict_1.default.equal(sentBatches[sentBatches.length - 1]?.[0].event, 'audio_load_timeout');
    const cappedBatches = [];
    const cappedCollector = (0, metrics_1.createMetricsCollector)({
        send: events => cappedBatches.push(events),
        batchSize: 10,
        maxBuffer: 2,
        setTimer: () => 1,
        clearTimer: () => undefined,
    });
    cappedCollector.report('api_error', { order: 1 });
    cappedCollector.report('api_error', { order: 2 });
    cappedCollector.report('api_error', { order: 3 });
    cappedCollector.flush();
    strict_1.default.deepEqual(cappedBatches[0].map(item => item.payload.order), [2, 3]);
    const sampledCollector = (0, metrics_1.createMetricsCollector)({
        send: () => strict_1.default.fail('sampled event should not be sent'),
        sampleRate: 0.25,
        random: () => 0.75,
        setTimer: () => strict_1.default.fail('sampled event should not schedule a timer'),
    });
    sampledCollector.report('api_error', { path: '/sampled-out' });
    strict_1.default.equal(sampledCollector.pendingCount(), 0);
}
function testMetricPathNormalization() {
    strict_1.default.equal((0, metrics_1.normalizeMetricPath)('https://englishecho.site/api/waimao-mini/courses/chapter-01-scene-01?token=secret', 'https://englishecho.site'), '/api/waimao-mini/courses/:id');
    strict_1.default.equal((0, metrics_1.normalizeMetricPath)('/api/waimao-mini/courses?withProgress=true', 'https://englishecho.site'), '/api/waimao-mini/courses');
    strict_1.default.equal((0, metrics_1.normalizeMetricPath)(`/${'x'.repeat(200)}`, 'https://englishecho.site').length, 120);
}
async function testCacheFallbackAndRequestMetrics() {
    const originalWx = globalThis.wx;
    const originalDateNow = Date.now;
    const storage = new Map();
    let now = 1000;
    let requestHandler = () => {
        throw new Error('request handler not configured');
    };
    const fakeWx = {
        getStorageSync: key => storage.get(key) ?? '',
        setStorageSync: (key, value) => storage.set(key, value),
        removeStorageSync: key => {
            storage.delete(key);
        },
        request: options => requestHandler(options),
    };
    globalThis.wx = fakeWx;
    Date.now = () => now;
    const metricEvents = [];
    const requestTimeouts = [];
    const response = createCourseListResponse();
    try {
        const localCache = new storage_1.LocalCache('network-resilience-local-cache', 10);
        strict_1.default.equal(localCache.set({ value: 'cached' }), true);
        now += 11;
        strict_1.default.equal(localCache.get(), null);
        strict_1.default.deepEqual(localCache.getStale(), { value: 'cached' });
        strict_1.default.equal(storage.has('network-resilience-local-cache'), true);
        localCache.clear();
        const legacyPersonalizedCache = createCourseListResponse();
        legacyPersonalizedCache.entitlement = { fullAccess: true, expiresAt: now + 100000 };
        legacyPersonalizedCache.data.push({
            id: 'chapter-02',
            number: 2,
            label: '第二章',
            title: '报价推进',
            audio: 'https://signed.example/audio.mp3?token=secret',
            duration: 60,
            free: false,
            locked: false,
            progressPercent: 60,
            scenes: [{
                    id: 'chapter-02-scene-01',
                    index: 1,
                    title: '报价',
                    cueCount: 2,
                    duration: 30,
                    free: false,
                    locked: false,
                    status: 'completed',
                    isCurrent: true,
                    progress: {
                        sceneId: 'chapter-02-scene-01',
                        chapterId: 'chapter-02',
                        cueIndex: 1,
                        totalCues: 2,
                        completedCueIndexes: [0, 1],
                        completedCueCount: 2,
                        completionPercent: 100,
                        sceneCompleted: true,
                        completedAt: now,
                        updatedAt: now,
                    },
                }],
        });
        storage.set('waimao_mini_course_list', JSON.stringify({
            data: legacyPersonalizedCache,
            expireAt: now + 60000,
        }));
        const sanitizedLegacyCache = (0, api_1.getCachedCourseList)({ allowStale: true });
        strict_1.default.equal(sanitizedLegacyCache?.progress, undefined);
        strict_1.default.equal(sanitizedLegacyCache?.entitlement, undefined);
        strict_1.default.equal(sanitizedLegacyCache?.data[1].audio, '');
        strict_1.default.equal(sanitizedLegacyCache?.data[1].locked, true);
        strict_1.default.equal(sanitizedLegacyCache?.data[1].scenes[0].progress, null);
        strict_1.default.equal(sanitizedLegacyCache?.data[1].scenes[0].status, 'pending');
        storage.delete('waimao_mini_course_list');
        requestHandler = options => {
            requestTimeouts.push(options.timeout ?? 0);
            options.success?.({ statusCode: 200, data: response });
        };
        storage.set('waimao_mini_token', 'authenticated-token');
        await (0, api_1.fetchCourseList)(1, 50, { forceRefresh: true });
        strict_1.default.equal(storage.has('waimao_mini_course_list'), false);
        storage.delete('waimao_mini_token');
        const initial = await (0, api_1.fetchCourseList)(1, 50, { forceRefresh: true });
        strict_1.default.equal(initial.data[0].id, 'chapter-01');
        strict_1.default.equal(requestTimeouts[0], request_1.REQUEST_TIMEOUT_MS);
        now += 11 * 60 * 1000;
        strict_1.default.equal((0, api_1.getCachedCourseList)(), null);
        strict_1.default.equal((0, api_1.getCachedCourseList)({ allowStale: true })?.data[0].id, 'chapter-01');
        requestHandler = options => {
            if (options.url.endsWith(metrics_1.METRICS_ENDPOINT)) {
                const body = options.data;
                metricEvents.push(...(body.events ?? []));
                options.success?.({ statusCode: 204 });
                return;
            }
            requestTimeouts.push(options.timeout ?? 0);
            options.fail?.({ errMsg: 'request:fail timeout' });
        };
        const stale = await (0, api_1.fetchCourseList)(1, 50, { forceRefresh: true });
        strict_1.default.equal(stale.data[0].id, 'chapter-01');
        strict_1.default.equal(storage.has('waimao_mini_course_list'), true);
        storage.set('waimao_mini_token', 'cached-token');
        const authenticatedStale = await (0, api_1.fetchCourseList)(1, 50, {
            withProgress: true,
            forceRefresh: true,
        });
        strict_1.default.equal(authenticatedStale.data[0].id, 'chapter-01');
        strict_1.default.equal(authenticatedStale.progress, undefined);
        strict_1.default.equal(authenticatedStale.entitlement, undefined);
        requestHandler = options => {
            if (options.url.endsWith(metrics_1.METRICS_ENDPOINT)) {
                const body = options.data;
                metricEvents.push(...(body.events ?? []));
                options.success?.({ statusCode: 204 });
                return;
            }
            requestTimeouts.push(options.timeout ?? 0);
            options.success?.({ statusCode: 503, data: { message: 'service unavailable' } });
        };
        await strict_1.default.rejects((0, api_1.fetchAppConfig)(), /service unavailable/);
        (0, metrics_1.flushMetrics)();
        strict_1.default.ok(requestTimeouts.every(timeout => timeout === request_1.REQUEST_TIMEOUT_MS));
        strict_1.default.ok(metricEvents.some(event => event.payload.status === 'timeout'));
        strict_1.default.ok(metricEvents.some(event => event.payload.status === 503));
        strict_1.default.ok(metricEvents.every(event => !String(event.payload.path).includes('?')));
    }
    finally {
        (0, metrics_1.flushMetrics)();
        Date.now = originalDateNow;
        globalThis.wx = originalWx;
    }
}
async function run() {
    testMetricsCollector();
    testMetricPathNormalization();
    await testCacheFallbackAndRequestMetrics();
    console.log('network resilience tests passed.');
}
exports.networkResilienceTestDone = run();
if (process.argv[1]?.endsWith('network-resilience.test.js')) {
    exports.networkResilienceTestDone.catch(error => {
        console.error(error);
        process.exit(1);
    });
}
