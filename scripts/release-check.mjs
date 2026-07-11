import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MINI_PROGRAM_ROOT = path.join(ROOT, 'miniprogram')
const API_BASE_URL = 'https://englishecho.site'
const MAX_MAIN_PACKAGE_BYTES = 2 * 1024 * 1024
const REQUEST_TIMEOUT_MS = 15_000

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function pass(message) {
  console.log(`[ok] ${message}`)
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(ROOT, relativePath), 'utf8'))
}

async function directorySize(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  let total = 0
  for (const entry of entries) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      total += await directorySize(target)
    } else if (entry.isFile()) {
      total += (await stat(target)).size
    }
  }
  return total
}

async function request(relativeOrAbsoluteUrl, options = {}) {
  const url = /^https?:\/\//.test(relativeOrAbsoluteUrl)
    ? relativeOrAbsoluteUrl
    : `${API_BASE_URL}${relativeOrAbsoluteUrl}`
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      'user-agent': 'waimao-miniprogram-release-check/1.0',
      ...(options.headers ?? {}),
    },
  })
  return response
}

async function expectStatus(label, url, expectedStatus, options) {
  const response = await request(url, options)
  assert(
    response.status === expectedStatus,
    `${label}: expected HTTP ${expectedStatus}, received ${response.status}`,
  )
  pass(`${label}: HTTP ${response.status}`)
  return response
}

async function checkStaticConfiguration() {
  const project = await readJson('project.config.json')
  assert(/^wx[0-9a-f]{16}$/i.test(project.appid), 'project.config.json is missing a production appid')
  assert(project.miniprogramRoot === 'miniprogram/', 'miniprogramRoot must remain miniprogram/')
  pass(`production appid: ${project.appid}`)

  const app = await readJson('miniprogram/app.json')
  assert(app.pages?.[0] === 'pages/index/index', 'pages/index/index must remain the launch page')
  assert(app.requiredBackgroundModes?.includes('audio'), 'background audio mode is not declared')
  pass('launch page and background audio declaration')

  const envSource = await readFile(path.join(ROOT, 'miniprogram/config/env.ts'), 'utf8')
  assert(
    envSource.includes(`PRODUCTION_API_BASE_URL = '${API_BASE_URL}'`),
    'production API base URL does not point to englishecho.site',
  )
  assert(
    envSource.includes('DEVELOPMENT_API_BASE_URL = PRODUCTION_API_BASE_URL'),
    'development builds may still point to a local API',
  )
  pass(`all mini program environments use ${API_BASE_URL}`)

  const packageBytes = await directorySize(MINI_PROGRAM_ROOT)
  assert(
    packageBytes < MAX_MAIN_PACKAGE_BYTES,
    `miniprogram directory is ${(packageBytes / 1024 / 1024).toFixed(2)} MiB (limit: 2 MiB)`,
  )
  pass(`miniprogram directory: ${(packageBytes / 1024 / 1024).toFixed(2)} MiB`)
}

async function checkProductionService() {
  const healthResponse = await expectStatus('production health', '/api/health', 200)
  const health = await healthResponse.json()
  assert(health.ok === true, 'production health payload is not ok')
  assert(health.checks?.database === true, 'production database check failed')
  assert(health.checks?.waimaoContent?.ok === true, 'waimao course content check failed')
  assert(health.checks?.waimaoContent?.lessonCount === 7, 'production content is not 7 chapters')
  assert(
    health.checks?.waimaoAudio?.qiniuConfigured === true
      || health.checks?.waimaoAudio?.serverFallback === true,
    'production audio provider has no usable source',
  )
  assert(health.checks?.aiConfigured === true, 'production AI provider is not configured')
  assert(health.checks?.waimaoMiniWechatConfigured === true, 'waimao WeChat credentials are missing')
  assert(health.checks?.mockWechatAllowed === false, 'mock WeChat login must be disabled in production')
  pass('database, 7 chapters, audio provider and WeChat credentials')

  const coursesResponse = await expectStatus(
    'course list',
    '/api/waimao-mini/courses?page=1&pageSize=50',
    200,
  )
  const courses = await coursesResponse.json()
  const chapters = Array.isArray(courses.data) ? courses.data : []
  const sceneCount = chapters.reduce(
    (total, chapter) => total + (Array.isArray(chapter.scenes) ? chapter.scenes.length : 0),
    0,
  )
  assert(chapters.length === 7, `course list returned ${chapters.length} chapters instead of 7`)
  assert(sceneCount === 50, `course list returned ${sceneCount} scenes instead of 50`)
  assert(courses.appConfig?.home?.unlockPromptEnabled === true, 'home unlock prompt is not enabled')
  pass('course list: 7 chapters and 50 scenes')

  const firstSceneId = chapters[0]?.scenes?.[0]?.id
  assert(firstSceneId, 'course list does not contain a first scene')
  const detailResponse = await expectStatus(
    'first course detail',
    `/api/waimao-mini/courses/${encodeURIComponent(firstSceneId)}`,
    200,
  )
  const detail = await detailResponse.json()
  assert(Array.isArray(detail.subtitles) && detail.subtitles.length > 0, 'first course has no subtitles')
  assert(detail.range?.end > detail.range?.start, 'first course has an invalid playback range')
  assert(detail.subtitles.every(item => item.end > item.start), 'first course has invalid subtitle timing')
  assert(Array.isArray(detail.audioSources), 'first course does not provide audio source fallbacks')
  assert(detail.audioSources[0]?.provider === 'qiniu', 'first course does not prefer Qiniu audio')
  assert(
    detail.audioSources.some(source => source.provider === 'server'),
    'first course does not provide a server audio fallback',
  )
  pass(`first course: ${detail.subtitles.length} timed subtitle cues`)

  const primaryAudio = detail.audioSources[0].url
  const primaryAudioUrl = /^https?:\/\//.test(primaryAudio)
    ? primaryAudio
    : `${API_BASE_URL}${primaryAudio}`
  const audioResponse = await expectStatus('first course primary audio', primaryAudioUrl, 200, {
    method: 'HEAD',
  })
  assert(
    audioResponse.headers.get('content-type')?.startsWith('audio/'),
    'first course primary audio response has an invalid content type',
  )

  const assets = [
    ['/static/images/waimao-purchase-wechat-qr.jpg', 'purchase QR code'],
    ['/static/images/waimao-community-qr.jpg', 'community QR code'],
    ['/static/waimao-mini/icon.png', 'mini program icon'],
  ]
  for (const [assetPath, label] of assets) {
    await expectStatus(label, assetPath, 200, { method: 'HEAD' })
  }

  await expectStatus('anonymous current user boundary', '/api/waimao-mini/me', 401)
  await expectStatus('anonymous progress boundary', '/api/waimao-mini/users/me/progress', 401)
  await expectStatus('anonymous invite boundary', '/api/waimao-mini/invite/redeem', 401, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: 'RELEASE-CHECK-NOT-A-REAL-CODE' }),
  })

  await expectStatus(
    'Youdao lookup dependency',
    'https://dict.youdao.com/jsonapi?q=quotation',
    200,
  )
  const pronunciationResponse = await expectStatus(
    'Youdao pronunciation dependency',
    'https://dict.youdao.com/dictvoice?audio=quotation&type=2',
    200,
    { method: 'HEAD' },
  )
  assert(
    pronunciationResponse.headers.get('content-type')?.startsWith('audio/'),
    'Youdao pronunciation response has an invalid content type',
  )
}

async function main() {
  console.log('Waimao mini program release check')
  await checkStaticConfiguration()
  await checkProductionService()
  console.log('[manual] Verify request/download domains in WeChat admin: englishecho.site and dict.youdao.com')
  console.log('[ready] Automated release checks passed')
}

main().catch(error => {
  console.error(`[failed] ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
