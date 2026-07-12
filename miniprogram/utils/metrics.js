"use strict";
// 轻量线上观测：三类事件（音源回退 / 音频加载超时 / API 错误）的采样、
// 聚合与批量上报。核心收集器纯逻辑可注入（transport/定时器/采样），便于测试；
// wx 侧单例在文件末尾组装。
//
// 设计约束（见 docs/exec-plans/active/2026-07-11-engineering-hardening.md）：
// - 上报失败静默丢弃，绝不重试排队，避免弱网下放大流量；
// - 上报请求自身的失败不再进入收集器，避免递归；
// - 缓冲有上限，超出丢最旧的。
Object.defineProperty(exports, "__esModule", { value: true });
exports.METRICS_FLUSH_INTERVAL_MS = exports.METRICS_BATCH_SIZE = exports.METRICS_MAX_BUFFER = exports.METRICS_SAMPLE_RATE = exports.METRICS_ENDPOINT = void 0;
exports.createMetricsCollector = createMetricsCollector;
exports.normalizeMetricPath = normalizeMetricPath;
exports.reportMetric = reportMetric;
exports.flushMetrics = flushMetrics;
const env_1 = require("../config/env");
exports.METRICS_ENDPOINT = '/api/waimao-mini/metrics';
exports.METRICS_SAMPLE_RATE = 1;
exports.METRICS_MAX_BUFFER = 50;
exports.METRICS_BATCH_SIZE = 10;
exports.METRICS_FLUSH_INTERVAL_MS = 30000;
function createMetricsCollector(options) {
    const sampleRate = options.sampleRate ?? exports.METRICS_SAMPLE_RATE;
    const batchSize = options.batchSize ?? exports.METRICS_BATCH_SIZE;
    const maxBuffer = options.maxBuffer ?? exports.METRICS_MAX_BUFFER;
    const flushIntervalMs = options.flushIntervalMs ?? exports.METRICS_FLUSH_INTERVAL_MS;
    const now = options.now ?? (() => Date.now());
    const random = options.random ?? Math.random;
    const setTimer = options.setTimer ?? ((handler, ms) => setTimeout(handler, ms));
    const clearTimer = options.clearTimer ?? ((id) => clearTimeout(id));
    let buffer = [];
    let flushTimerId = null;
    const clearFlushTimer = () => {
        if (flushTimerId !== null) {
            clearTimer(flushTimerId);
            flushTimerId = null;
        }
    };
    const flush = () => {
        clearFlushTimer();
        if (!buffer.length) {
            return;
        }
        const batch = buffer;
        buffer = [];
        try {
            options.send(batch);
        }
        catch (_error) {
            // 上报失败静默丢弃
        }
    };
    return {
        flush,
        pendingCount() {
            return buffer.length;
        },
        report(event, payload) {
            if (sampleRate <= 0 || (sampleRate < 1 && random() >= sampleRate)) {
                return;
            }
            buffer.push({ event, ts: now(), payload });
            if (buffer.length > maxBuffer) {
                buffer = buffer.slice(buffer.length - maxBuffer);
            }
            if (buffer.length >= batchSize) {
                flush();
                return;
            }
            if (flushTimerId === null) {
                flushTimerId = setTimer(() => {
                    flushTimerId = null;
                    flush();
                }, flushIntervalMs);
            }
        },
    };
}
// API 错误事件的 path 归一化：去掉 base 与 query，限制长度，避免高基数。
function normalizeMetricPath(url, apiBaseUrl) {
    let path = url.startsWith(apiBaseUrl) ? url.slice(apiBaseUrl.length) : url;
    const queryIndex = path.indexOf('?');
    if (queryIndex >= 0) {
        path = path.slice(0, queryIndex);
    }
    // 课程详情等带 id 的路径收敛为模板，控制事件基数
    path = path.replace(/\/courses\/[^/]+$/, '/courses/:id');
    return path.slice(0, 120);
}
// ==================== wx 侧单例 ====================
let sharedCollector = null;
function getWxCollector() {
    if (!sharedCollector) {
        sharedCollector = createMetricsCollector({
            send: events => {
                // 直接使用 wx.request（不走 utils/request.ts），失败静默，避免递归上报
                wx.request({
                    url: `${env_1.API_BASE_URL}${exports.METRICS_ENDPOINT}`,
                    method: 'POST',
                    data: { events },
                    timeout: 10000,
                    fail: () => {
                        // 静默丢弃
                    },
                });
            },
        });
    }
    return sharedCollector;
}
function reportMetric(event, payload) {
    try {
        getWxCollector().report(event, payload);
    }
    catch (_error) {
        // 观测层任何异常都不影响主流程
    }
}
function flushMetrics() {
    try {
        sharedCollector?.flush();
    }
    catch (_error) {
        // 静默
    }
}
