export type AudioSourceProvider = 'qiniu' | 'mirror' | 'server'

export type AudioSourceConfig = {
  priority: AudioSourceProvider[]
  enabled: Record<AudioSourceProvider, boolean>
}

export type AudioSourceOption = {
  provider: AudioSourceProvider
  url: string
}

export const DEFAULT_AUDIO_SOURCE_CONFIG: AudioSourceConfig = {
  priority: ['server'],
  enabled: {
    qiniu: false,
    mirror: false,
    server: true,
  },
}

const AUDIO_SOURCE_PROVIDERS: AudioSourceProvider[] = ['qiniu', 'mirror', 'server']

export function normalizeAudioSourceConfig(input: unknown): AudioSourceConfig {
  const source = input && typeof input === 'object'
    ? input as Record<string, unknown>
    : {}
  const enabledSource = source.enabled && typeof source.enabled === 'object'
    ? source.enabled as Record<string, unknown>
    : {}

  const enabled = AUDIO_SOURCE_PROVIDERS.reduce((result, provider) => {
    result[provider] =
      typeof enabledSource[provider] === 'boolean'
        ? enabledSource[provider] as boolean
        : DEFAULT_AUDIO_SOURCE_CONFIG.enabled[provider]
    return result
  }, {} as Record<AudioSourceProvider, boolean>)
  enabled.server = true

  const configuredPriority: AudioSourceProvider[] = Array.isArray(source.priority)
    ? uniqueProviders(source.priority.filter(isAudioSourceProvider))
    : []
  const priority: AudioSourceProvider[] = configuredPriority.length
    ? ensureServerFallback(configuredPriority)
    : [...DEFAULT_AUDIO_SOURCE_CONFIG.priority]

  const enabledPriority: AudioSourceProvider[] = priority.filter(provider => enabled[provider])

  return {
    priority: enabledPriority.length ? enabledPriority : ['server' as AudioSourceProvider],
    enabled,
  }
}

export function buildAudioSourceOptions(
  serverAudioUrl: string,
  config: AudioSourceConfig = DEFAULT_AUDIO_SOURCE_CONFIG,
  availableSources: AudioSourceOption[] = [],
): AudioSourceOption[] {
  const sources: Record<AudioSourceProvider, string> = {
    qiniu: '',
    mirror: '',
    server: serverAudioUrl,
  }
  for (const source of availableSources) {
    if (source.url && !sources[source.provider]) {
      sources[source.provider] = source.url
    }
  }

  const options = config.priority
    .filter(provider => config.enabled[provider])
    .map(provider => ({
      provider,
      url: sources[provider],
    }))
    .filter(option => Boolean(option.url))

  if (!options.some(option => option.provider === 'server') && serverAudioUrl) {
    options.push({ provider: 'server', url: serverAudioUrl })
  }

  return options
}

export function getNextAudioSourceOption(options: {
  timedOutSource: string
  currentSource: string
  audioSources: AudioSourceOption[]
}) {
  const timedOutSource = String(options.timedOutSource || '')
  const currentSource = String(options.currentSource || '')
  if (currentSource !== timedOutSource) {
    return null
  }

  const currentIndex = options.audioSources.findIndex(source => source.url === timedOutSource)
  if (currentIndex < 0 || options.audioSources[currentIndex].provider === 'server') {
    return null
  }

  return options.audioSources.slice(currentIndex + 1).find(source => source.url) ?? null
}

function uniqueProviders(providers: AudioSourceProvider[]): AudioSourceProvider[] {
  const seen = new Set<AudioSourceProvider>()
  return providers.filter(provider => {
    if (seen.has(provider)) {
      return false
    }
    seen.add(provider)
    return true
  })
}

function isAudioSourceProvider(value: unknown): value is AudioSourceProvider {
  return typeof value === 'string' &&
    (AUDIO_SOURCE_PROVIDERS as readonly string[]).includes(value)
}

function ensureServerFallback(providers: AudioSourceProvider[]): AudioSourceProvider[] {
  if (providers.includes('server')) {
    return providers
  }
  return [...providers, 'server']
}
