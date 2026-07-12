import assert from 'node:assert/strict'

import {
  CourseListResponse,
  fetchAppConfig,
  fetchCourseList,
  getCachedCourseList,
} from '../miniprogram/utils/api'
import {
  METRICS_ENDPOINT,
  MetricEvent,
  createMetricsCollector,
  flushMetrics,
  normalizeMetricPath,
} from '../miniprogram/utils/metrics'
import { REQUEST_TIMEOUT_MS } from '../miniprogram/utils/request'
import { LocalCache } from '../miniprogram/utils/storage'

type FakeRequestOptions = {
  url: string
  method?: string
  data?: unknown
  header?: Record<string, string>
  timeout?: number
  success?: (response: { statusCode: number; data?: unknown }) => void
  fail?: (error: { errMsg: string }) => void
}

type FakeWx = {
  getStorageSync(key: string): unknown
  setStorageSync(key: string, value: unknown): void
  removeStorageSync(key: string): void
  request(options: FakeRequestOptions): void
}

function createCourseListResponse(): CourseListResponse {
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
  }
}

function testMetricsCollector() {
  const timerHandlers = new Map<number, () => void>()
  let nextTimerId = 1
  const sentBatches: MetricEvent[][] = []
  let now = 100
  const collector = createMetricsCollector({
    send: events => sentBatches.push(events),
    batchSize: 2,
    maxBuffer: 3,
    now: () => now++,
    setTimer(handler) {
      const id = nextTimerId++
      timerHandlers.set(id, handler)
      return id
    },
    clearTimer(id) {
      timerHandlers.delete(id)
    },
  })

  collector.report('api_error', { path: '/first' })
  assert.equal(collector.pendingCount(), 1)
  assert.equal(timerHandlers.size, 1)
  collector.report('api_error', { path: '/second' })
  assert.equal(collector.pendingCount(), 0)
  assert.equal(timerHandlers.size, 0)
  assert.deepEqual(sentBatches[0].map(item => item.payload.path), ['/first', '/second'])

  const timerCollector = createMetricsCollector({
    send: events => sentBatches.push(events),
    batchSize: 10,
    setTimer(handler) {
      const id = nextTimerId++
      timerHandlers.set(id, handler)
      return id
    },
    clearTimer(id) {
      timerHandlers.delete(id)
    },
  })
  timerCollector.report('audio_load_timeout', { courseId: 'scene-01' })
  const timer = [...timerHandlers.values()][0]
  assert.ok(timer)
  timer()
  assert.equal(timerCollector.pendingCount(), 0)
  assert.equal(sentBatches[sentBatches.length - 1]?.[0].event, 'audio_load_timeout')

  const cappedBatches: MetricEvent[][] = []
  const cappedCollector = createMetricsCollector({
    send: events => cappedBatches.push(events),
    batchSize: 10,
    maxBuffer: 2,
    setTimer: () => 1,
    clearTimer: () => undefined,
  })
  cappedCollector.report('api_error', { order: 1 })
  cappedCollector.report('api_error', { order: 2 })
  cappedCollector.report('api_error', { order: 3 })
  cappedCollector.flush()
  assert.deepEqual(cappedBatches[0].map(item => item.payload.order), [2, 3])

  const sampledCollector = createMetricsCollector({
    send: () => assert.fail('sampled event should not be sent'),
    sampleRate: 0.25,
    random: () => 0.75,
    setTimer: () => assert.fail('sampled event should not schedule a timer'),
  })
  sampledCollector.report('api_error', { path: '/sampled-out' })
  assert.equal(sampledCollector.pendingCount(), 0)
}

function testMetricPathNormalization() {
  assert.equal(
    normalizeMetricPath(
      'https://englishecho.site/api/waimao-mini/courses/chapter-01-scene-01?token=secret',
      'https://englishecho.site',
    ),
    '/api/waimao-mini/courses/:id',
  )
  assert.equal(
    normalizeMetricPath('/api/waimao-mini/courses?withProgress=true', 'https://englishecho.site'),
    '/api/waimao-mini/courses',
  )
  assert.equal(normalizeMetricPath(`/${'x'.repeat(200)}`, 'https://englishecho.site').length, 120)
}

async function testCacheFallbackAndRequestMetrics() {
  const originalWx = (globalThis as { wx?: unknown }).wx
  const originalDateNow = Date.now
  const storage = new Map<string, unknown>()
  let now = 1_000
  let requestHandler: (options: FakeRequestOptions) => void = () => {
    throw new Error('request handler not configured')
  }
  const fakeWx: FakeWx = {
    getStorageSync: key => storage.get(key) ?? '',
    setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: key => {
      storage.delete(key)
    },
    request: options => requestHandler(options),
  }

  ;(globalThis as { wx?: unknown }).wx = fakeWx
  Date.now = () => now

  const metricEvents: MetricEvent[] = []
  const requestTimeouts: number[] = []
  const response = createCourseListResponse()

  try {
    const localCache = new LocalCache<{ value: string }>('network-resilience-local-cache', 10)
    assert.equal(localCache.set({ value: 'cached' }), true)
    now += 11
    assert.equal(localCache.get(), null)
    assert.deepEqual(localCache.getStale(), { value: 'cached' })
    assert.equal(storage.has('network-resilience-local-cache'), true)
    localCache.clear()

    const legacyPersonalizedCache = createCourseListResponse()
    legacyPersonalizedCache.entitlement = { fullAccess: true, expiresAt: now + 100_000 }
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
    })
    storage.set('waimao_mini_course_list', JSON.stringify({
      data: legacyPersonalizedCache,
      expireAt: now + 60_000,
    }))
    const sanitizedLegacyCache = getCachedCourseList({ allowStale: true })
    assert.equal(sanitizedLegacyCache?.progress, undefined)
    assert.equal(sanitizedLegacyCache?.entitlement, undefined)
    assert.equal(sanitizedLegacyCache?.data[1].audio, '')
    assert.equal(sanitizedLegacyCache?.data[1].locked, true)
    assert.equal(sanitizedLegacyCache?.data[1].scenes[0].progress, null)
    assert.equal(sanitizedLegacyCache?.data[1].scenes[0].status, 'pending')
    storage.delete('waimao_mini_course_list')

    requestHandler = options => {
      requestTimeouts.push(options.timeout ?? 0)
      options.success?.({ statusCode: 200, data: response })
    }
    storage.set('waimao_mini_token', 'authenticated-token')
    await fetchCourseList(1, 50, { forceRefresh: true })
    assert.equal(storage.has('waimao_mini_course_list'), false)
    storage.delete('waimao_mini_token')

    const initial = await fetchCourseList(1, 50, { forceRefresh: true })
    assert.equal(initial.data[0].id, 'chapter-01')
    assert.equal(requestTimeouts[0], REQUEST_TIMEOUT_MS)

    now += 11 * 60 * 1000
    assert.equal(getCachedCourseList(), null)
    assert.equal(getCachedCourseList({ allowStale: true })?.data[0].id, 'chapter-01')

    requestHandler = options => {
      if (options.url.endsWith(METRICS_ENDPOINT)) {
        const body = options.data as { events?: MetricEvent[] }
        metricEvents.push(...(body.events ?? []))
        options.success?.({ statusCode: 204 })
        return
      }
      requestTimeouts.push(options.timeout ?? 0)
      options.fail?.({ errMsg: 'request:fail timeout' })
    }

    const stale = await fetchCourseList(1, 50, { forceRefresh: true })
    assert.equal(stale.data[0].id, 'chapter-01')
    assert.equal(storage.has('waimao_mini_course_list'), true)

    storage.set('waimao_mini_token', 'cached-token')
    const authenticatedStale = await fetchCourseList(1, 50, {
      withProgress: true,
      forceRefresh: true,
    })
    assert.equal(authenticatedStale.data[0].id, 'chapter-01')
    assert.equal(authenticatedStale.progress, undefined)
    assert.equal(authenticatedStale.entitlement, undefined)

    requestHandler = options => {
      if (options.url.endsWith(METRICS_ENDPOINT)) {
        const body = options.data as { events?: MetricEvent[] }
        metricEvents.push(...(body.events ?? []))
        options.success?.({ statusCode: 204 })
        return
      }
      requestTimeouts.push(options.timeout ?? 0)
      options.success?.({ statusCode: 503, data: { message: 'service unavailable' } })
    }
    await assert.rejects(fetchAppConfig(), /service unavailable/)
    flushMetrics()

    assert.ok(requestTimeouts.every(timeout => timeout === REQUEST_TIMEOUT_MS))
    assert.ok(metricEvents.some(event => event.payload.status === 'timeout'))
    assert.ok(metricEvents.some(event => event.payload.status === 503))
    assert.ok(metricEvents.every(event => !String(event.payload.path).includes('?')))
  } finally {
    flushMetrics()
    Date.now = originalDateNow
    ;(globalThis as { wx?: unknown }).wx = originalWx
  }
}

async function run() {
  testMetricsCollector()
  testMetricPathNormalization()
  await testCacheFallbackAndRequestMetrics()
  console.log('network resilience tests passed.')
}

export const networkResilienceTestDone = run()

if (process.argv[1]?.endsWith('network-resilience.test.js')) {
  networkResilienceTestDone.catch(error => {
    console.error(error)
    process.exit(1)
  })
}
