import type { AppConfigResponse } from './api'

export async function refreshAppConfig(
  fetcher: () => Promise<AppConfigResponse>,
  setter: (appConfig: AppConfigResponse) => void,
) {
  try {
    const appConfig = await fetcher()
    setter(appConfig)
  } catch (error) {
    console.warn('[AppConfig] refresh failed', error)
  }
}
