import { API_BASE_URL } from '../config/env'
import { getToken, clearToken } from './storage'

type HttpMethod = WechatMiniprogram.RequestOption['method']

interface RequestOptions {
  url: string
  method?: HttpMethod
  data?: Record<string, unknown> | string | ArrayBuffer
  header?: Record<string, string>
}

const MAX_RETRY = 1

export function request<T>(options: RequestOptions): Promise<T> {
  return executeRequest<T>(options, 0)
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
        const errorPayload = res.data as { message?: string; error?: string } | undefined
        const message =
          errorPayload?.message ||
          errorPayload?.error ||
          `Request failed with status ${res.statusCode}`
        reject(new Error(message))
      },
      fail(error) {
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
