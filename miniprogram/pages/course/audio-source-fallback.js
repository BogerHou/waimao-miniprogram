"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_AUDIO_SOURCE_CONFIG = void 0;
exports.isCdnAudioUrl = isCdnAudioUrl;
exports.normalizeAudioSourceConfig = normalizeAudioSourceConfig;
exports.buildAudioSourceOptions = buildAudioSourceOptions;
exports.getNextAudioSourceOption = getNextAudioSourceOption;
exports.DEFAULT_AUDIO_SOURCE_CONFIG = {
    priority: ['server'],
    enabled: {
        qiniu: false,
        mirror: false,
        server: true,
    },
};
const AUDIO_SOURCE_PROVIDERS = ['qiniu', 'mirror', 'server'];
function isCdnAudioUrl(url) {
    const value = String(url || '');
    return /^https:\/\/cdn\.jsdmirror\.com\//.test(value)
        || /^https:\/\/audio\.[^/]+\//.test(value);
}
function normalizeAudioSourceConfig(input) {
    const source = input && typeof input === 'object'
        ? input
        : {};
    const enabledSource = source.enabled && typeof source.enabled === 'object'
        ? source.enabled
        : {};
    const enabled = AUDIO_SOURCE_PROVIDERS.reduce((result, provider) => {
        result[provider] =
            typeof enabledSource[provider] === 'boolean'
                ? enabledSource[provider]
                : exports.DEFAULT_AUDIO_SOURCE_CONFIG.enabled[provider];
        return result;
    }, {});
    enabled.server = true;
    const configuredPriority = Array.isArray(source.priority)
        ? uniqueProviders(source.priority.filter(isAudioSourceProvider))
        : [];
    const priority = configuredPriority.length
        ? ensureServerFallback(configuredPriority)
        : [...exports.DEFAULT_AUDIO_SOURCE_CONFIG.priority];
    const enabledPriority = priority.filter(provider => enabled[provider]);
    return {
        priority: enabledPriority.length ? enabledPriority : ['server'],
        enabled,
    };
}
function buildAudioSourceOptions(serverAudioUrl, config = exports.DEFAULT_AUDIO_SOURCE_CONFIG) {
    const sources = {
        qiniu: '',
        mirror: '',
        server: serverAudioUrl,
    };
    const options = config.priority
        .filter(provider => config.enabled[provider])
        .map(provider => ({
        provider,
        url: sources[provider],
    }))
        .filter(option => Boolean(option.url));
    if (!options.some(option => option.provider === 'server') && serverAudioUrl) {
        options.push({ provider: 'server', url: serverAudioUrl });
    }
    return options;
}
function getNextAudioSourceOption(options) {
    const timedOutSource = String(options.timedOutSource || '');
    const currentSource = String(options.currentSource || '');
    if (!isCdnAudioUrl(timedOutSource) || currentSource !== timedOutSource) {
        return null;
    }
    const currentIndex = options.audioSources.findIndex(source => source.url === timedOutSource);
    if (currentIndex < 0) {
        return null;
    }
    return options.audioSources.slice(currentIndex + 1).find(source => source.url) ?? null;
}
function uniqueProviders(providers) {
    const seen = new Set();
    return providers.filter(provider => {
        if (seen.has(provider)) {
            return false;
        }
        seen.add(provider);
        return true;
    });
}
function isAudioSourceProvider(value) {
    return typeof value === 'string' &&
        AUDIO_SOURCE_PROVIDERS.includes(value);
}
function ensureServerFallback(providers) {
    if (providers.includes('server')) {
        return providers;
    }
    return [...providers, 'server'];
}
