export const DEVELOPMENT_API_BASE_URL = 'http://127.0.0.1:4000'
export const PRODUCTION_API_BASE_URL = 'https://englishecho.site'

type MiniProgramEnvVersion = 'develop' | 'trial' | 'release' | string | null

function getMiniProgramEnvVersion(): MiniProgramEnvVersion {
  if (typeof wx === 'undefined' || typeof wx.getAccountInfoSync !== 'function') {
    return null
  }

  try {
    return wx.getAccountInfoSync().miniProgram.envVersion ?? null
  } catch {
    return null
  }
}

export function resolveApiBaseUrl(envVersion: MiniProgramEnvVersion = getMiniProgramEnvVersion()) {
  return envVersion === 'develop' ? DEVELOPMENT_API_BASE_URL : PRODUCTION_API_BASE_URL
}

export const API_BASE_URL = resolveApiBaseUrl()

export const PAGE_SIZE_DEFAULT = 10
