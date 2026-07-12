import { API_BASE_URL } from '../config/env'
import { getToken, clearToken } from './storage'
import { normalizeMetricPath, reportMetric } from './metrics'

type HttpMethod = WechatMiniprogram.RequestOption['method']

interface RequestOptions {
  url: string
  method?: HttpMethod
  data?: Record<string, unknown> | string | ArrayBuffer
  header?: Record<string, string>
}

const MAX_RETRY = 1
// 统一请求超时：弱网下不让用户干等微信默认的 60s
export const REQUEST_TIMEOUT_MS = 15_000

export function request<T>(options: RequestOptions): Promise<T> {
  return executeRequest<T>(options, 0)
}

function reportApiError(url: string, method: HttpMethod, status: number | 'network' | 'timeout') {
  reportMetric('api_error', {
    path: normalizeMetricPath(url, API_BASE_URL),
    method: String(method ?? 'GET'),
    status,
  })
}

function executeRequest<T>(options: RequestOptions, attempt: number): Promise<T> {
  const { url, method = 'GET', data, header } = options
  const token = getToken()
  const headers: Record<string, string> = {
    ...(header ?? {}),
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  if (method !== 'GET' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  return new Promise<T>((resolve, reject) => {
    wx.request({
      url: resolveUrl(url),
      method,
      data,
      header: headers,
      timeout: REQUEST_TIMEOUT_MS,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const payload = (res.data ?? (undefined as unknown)) as T
          resolve(payload)
          return
        }
        if (res.statusCode === 401 && attempt < MAX_RETRY) {
          handleUnauthorized()
            .then(() => executeRequest<T>(options, attempt + 1).then(resolve).catch(reject))
            .catch(reject)
          return
        }
        // 观测：服务端错误（4xx 属业务边界不上报，401 重登已单独处理）
        if (res.statusCode >= 500) {
          reportApiError(url, method, res.statusCode)
        }
        const errorPayload = res.data as { message?: string; error?: string } | undefined
        const message =
          errorPayload?.message ||
          errorPayload?.error ||
          `Request failed with status ${res.statusCode}`
        reject(new Error(message))
      },
      fail(error) {
        const errMsg = String(error?.errMsg ?? '')
        reportApiError(url, method, errMsg.includes('timeout') ? 'timeout' : 'network')
        reject(error)
      },
    })
  })
}

function handleUnauthorized() {
  clearToken()
  const app = getApp<IAppOption>()
  if (app && typeof app.initializeAuth === 'function') {
    return app.initializeAuth(true)
  }
  return Promise.reject(new Error('Unauthorized'))
}

function resolveUrl(url: string) {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  return `${API_BASE_URL}${url.startsWith('/') ? url : `/${url}`}`
}
