// 轻量线上观测：三类事件（音源回退 / 音频加载超时 / API 错误）的采样、
// 聚合与批量上报。核心收集器纯逻辑可注入（transport/定时器/采样），便于测试；
// wx 侧单例在文件末尾组装。
//
// 设计约束（见 docs/exec-plans/active/2026-07-11-engineering-hardening.md）：
// - 上报失败静默丢弃，绝不重试排队，避免弱网下放大流量；
// - 上报请求自身的失败不再进入收集器，避免递归；
// - 缓冲有上限，超出丢最旧的。

import { API_BASE_URL } from '../config/env'

export type MetricEventName = 'audio_fallback' | 'audio_load_timeout' | 'api_error'

export type MetricEvent = {
  event: MetricEventName
  ts: number
  payload: Record<string, string | number | boolean | null>
}

export type MetricsTransport = (events: MetricEvent[]) => void

export type MetricsCollector = {
  report(event: MetricEventName, payload: MetricEvent['payload']): void
  flush(): void
  pendingCount(): number
}

export const METRICS_ENDPOINT = '/api/waimao-mini/metrics'
export const METRICS_SAMPLE_RATE = 1
export const METRICS_MAX_BUFFER = 50
export const METRICS_BATCH_SIZE = 10
export const METRICS_FLUSH_INTERVAL_MS = 30_000

export function createMetricsCollector(options: {
  send: MetricsTransport
  sampleRate?: number
  batchSize?: number
  maxBuffer?: number
  flushIntervalMs?: number
  now?: () => number
  random?: () => number
  setTimer?: (handler: () => void, ms: number) => number
  clearTimer?: (id: number) => void
}): MetricsCollector {
  const sampleRate = options.sampleRate ?? METRICS_SAMPLE_RATE
  const batchSize = options.batchSize ?? METRICS_BATCH_SIZE
  const maxBuffer = options.maxBuffer ?? METRICS_MAX_BUFFER
  const flushIntervalMs = options.flushIntervalMs ?? METRICS_FLUSH_INTERVAL_MS
  const now = options.now ?? (() => Date.now())
  const random = options.random ?? Math.random
  const setTimer =
    options.setTimer ?? ((handler: () => void, ms: number) => setTimeout(handler, ms) as unknown as number)
  const clearTimer = options.clearTimer ?? ((id: number) => clearTimeout(id))

  let buffer: MetricEvent[] = []
  let flushTimerId: number | null = null

  const clearFlushTimer = () => {
    if (flushTimerId !== null) {
      clearTimer(flushTimerId)
      flushTimerId = null
    }
  }

  const flush = () => {
    clearFlushTimer()
    if (!buffer.length) {
      return
    }
    const batch = buffer
    buffer = []
    try {
      options.send(batch)
    } catch (_error) {
      // 上报失败静默丢弃
    }
  }

  return {
    flush,
    pendingCount() {
      return buffer.length
    },
    report(event, payload) {
      if (sampleRate <= 0 || (sampleRate < 1 && random() >= sampleRate)) {
        return
      }
      buffer.push({ event, ts: now(), payload })
      if (buffer.length > maxBuffer) {
        buffer = buffer.slice(buffer.length - maxBuffer)
      }
      if (buffer.length >= batchSize) {
        flush()
        return
      }
      if (flushTimerId === null) {
        flushTimerId = setTimer(() => {
          flushTimerId = null
          flush()
        }, flushIntervalMs)
      }
    },
  }
}

// API 错误事件的 path 归一化：去掉 base 与 query，限制长度，避免高基数。
export function normalizeMetricPath(url: string, apiBaseUrl: string): string {
  let path = url.startsWith(apiBaseUrl) ? url.slice(apiBaseUrl.length) : url
  const queryIndex = path.indexOf('?')
  if (queryIndex >= 0) {
    path = path.slice(0, queryIndex)
  }
  // 课程详情等带 id 的路径收敛为模板，控制事件基数
  path = path.replace(/\/courses\/[^/]+$/, '/courses/:id')
  return path.slice(0, 120)
}

// ==================== wx 侧单例 ====================

let sharedCollector: MetricsCollector | null = null

function getWxCollector(): MetricsCollector {
  if (!sharedCollector) {
    sharedCollector = createMetricsCollector({
      send: events => {
        // 直接使用 wx.request（不走 utils/request.ts），失败静默，避免递归上报
        wx.request({
          url: `${API_BASE_URL}${METRICS_ENDPOINT}`,
          method: 'POST',
          data: { events },
          timeout: 10_000,
          fail: () => {
            // 静默丢弃
          },
        })
      },
    })
  }
  return sharedCollector
}

export function reportMetric(event: MetricEventName, payload: MetricEvent['payload']) {
  try {
    getWxCollector().report(event, payload)
  } catch (_error) {
    // 观测层任何异常都不影响主流程
  }
}

export function flushMetrics() {
  try {
    sharedCollector?.flush()
  } catch (_error) {
    // 静默
  }
}
