"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_APP_CONFIG = exports.DEFAULT_HOME_AD = void 0;
exports.getState = getState;
exports.setToken = setToken;
exports.setUser = setUser;
exports.setProgress = setProgress;
exports.setFullAccess = setFullAccess;
exports.setAppConfig = setAppConfig;
exports.subscribe = subscribe;
exports.initializeStore = initializeStore;
const storage_1 = require("../utils/storage");
exports.DEFAULT_HOME_AD = {
    id: 'waimao-mini-unlock',
    enabled: false,
    navTitle: '解锁课程',
    bannerUrl: '',
    detailBannerEnabled: false,
    contentImageUrl: '',
    title: '外贸英语影子跟读',
    eyebrow: 'Trade English Shadowing',
    description: '添加微信购买邀请码，解锁后 6 章。',
    features: [],
    promotion: {
        enabled: false,
        badge: '',
        title: '',
        subtitle: '',
        price: '',
        pricePrefix: '',
        priceSuffix: '',
        originalPrice: '',
        features: [],
        note: '',
    },
    trialTitle: '全部章节开放 1 年',
    trialDescription: '添加微信购买邀请码，输入后解锁后 6 章。',
    targetUrl: '',
    ctaText: '去解锁',
    contactQrUrl: '/static/images/waimao-purchase-wechat-qr.jpg',
    contactTitle: '扫码添加微信购买邀请码',
    contactDescription: '添加微信购买会员邀请码，输入后开通全部章节 1 年访问权。',
    contactTip: '点击预览，长按识别二维码',
};
exports.DEFAULT_APP_CONFIG = {
    home: {
        bannerEnabled: false,
        practiceHelpEnabled: false,
        unlockPromptEnabled: true,
        unlockPromptTitle: '全部章节开放 1 年',
        unlockPromptDescription: '添加微信购买邀请码，解锁后 6 章。',
        unlockPromptCta: '去解锁',
        activeAdId: exports.DEFAULT_HOME_AD.id,
        ads: [exports.DEFAULT_HOME_AD],
    },
    courseDetail: {
        shadowModeEnabled: true,
        audioSource: {
            priority: ['server'],
            enabled: {
                qiniu: false,
                mirror: false,
                server: true,
            },
        },
    },
};
const AUDIO_SOURCE_PROVIDERS = ['qiniu', 'mirror', 'server'];
const state = {
    token: null,
    user: null,
    progress: null,
    fullAccess: false,
    appConfig: exports.DEFAULT_APP_CONFIG,
};
const listeners = new Set();
function getState() {
    return { ...state };
}
function setToken(token, notify = true) {
    state.token = token;
    if (!token) {
        (0, storage_1.clearToken)();
    }
    else {
        (0, storage_1.setToken)(token);
    }
    if (notify) {
        emit();
    }
}
function setUser(user, notify = true) {
    state.user = user;
    if (user) {
        (0, storage_1.cacheUser)(user);
    }
    if (notify) {
        emit();
    }
}
function setProgress(progress, notify = true) {
    state.progress = progress;
    if (progress) {
        (0, storage_1.cacheProgress)(progress);
    }
    if (notify) {
        emit();
    }
}
function setFullAccess(fullAccess, notify = true) {
    state.fullAccess = fullAccess;
    if (notify) {
        emit();
    }
}
function setAppConfig(appConfig, notify = true) {
    state.appConfig = {
        home: normalizeHomeConfig(appConfig.home),
        courseDetail: {
            shadowModeEnabled: appConfig.courseDetail?.shadowModeEnabled ?? exports.DEFAULT_APP_CONFIG.courseDetail.shadowModeEnabled,
            audioSource: normalizeAudioSourceConfig(appConfig.courseDetail?.audioSource),
        },
    };
    if (notify) {
        emit();
    }
}
function subscribe(listener) {
    listeners.add(listener);
    listener(getState());
    return () => {
        listeners.delete(listener);
    };
}
function initializeStore(initial) {
    state.token = initial?.token ?? (0, storage_1.getToken)();
    state.user = initial?.user ?? null;
    state.progress = initial?.progress ?? null;
    state.fullAccess = initial?.fullAccess ?? false;
    state.appConfig = initial?.appConfig
        ? {
            home: normalizeHomeConfig(initial.appConfig.home),
            courseDetail: {
                shadowModeEnabled: initial.appConfig.courseDetail?.shadowModeEnabled ?? exports.DEFAULT_APP_CONFIG.courseDetail.shadowModeEnabled,
                audioSource: normalizeAudioSourceConfig(initial.appConfig.courseDetail?.audioSource),
            },
        }
        : exports.DEFAULT_APP_CONFIG;
    emit();
}
function normalizeAudioSourceConfig(input) {
    const enabledInput = input?.enabled && typeof input.enabled === 'object'
        ? input.enabled
        : exports.DEFAULT_APP_CONFIG.courseDetail.audioSource.enabled;
    const enabled = AUDIO_SOURCE_PROVIDERS.reduce((result, provider) => {
        result[provider] =
            typeof enabledInput[provider] === 'boolean'
                ? enabledInput[provider]
                : exports.DEFAULT_APP_CONFIG.courseDetail.audioSource.enabled[provider];
        return result;
    }, {});
    enabled.server = true;
    const configuredPriority = Array.isArray(input?.priority)
        ? uniqueAudioSourceProviders(input.priority)
        : [];
    const priorityInput = configuredPriority.length
        ? ensureServerFallback(configuredPriority)
        : exports.DEFAULT_APP_CONFIG.courseDetail.audioSource.priority;
    const priority = priorityInput.filter(provider => enabled[provider]);
    return {
        priority: priority.length ? priority : ['server'],
        enabled,
    };
}
function ensureServerFallback(providers) {
    if (providers.includes('server')) {
        return providers;
    }
    return [...providers, 'server'];
}
function uniqueAudioSourceProviders(input) {
    const seen = new Set();
    return input
        .filter((provider) => AUDIO_SOURCE_PROVIDERS.includes(provider))
        .filter(provider => {
        if (seen.has(provider)) {
            return false;
        }
        seen.add(provider);
        return true;
    });
}
function emit() {
    const snapshot = getState();
    listeners.forEach(listener => listener(snapshot));
}
function normalizeHomeConfig(home) {
    const ads = Array.isArray(home?.ads) && home?.ads.length ? home.ads : exports.DEFAULT_APP_CONFIG.home.ads;
    return {
        bannerEnabled: home?.bannerEnabled ?? exports.DEFAULT_APP_CONFIG.home.bannerEnabled,
        practiceHelpEnabled: home?.practiceHelpEnabled ?? exports.DEFAULT_APP_CONFIG.home.practiceHelpEnabled,
        unlockPromptEnabled: home?.unlockPromptEnabled ?? exports.DEFAULT_APP_CONFIG.home.unlockPromptEnabled,
        unlockPromptTitle: home?.unlockPromptTitle || exports.DEFAULT_APP_CONFIG.home.unlockPromptTitle,
        unlockPromptDescription: home?.unlockPromptDescription || exports.DEFAULT_APP_CONFIG.home.unlockPromptDescription,
        unlockPromptCta: home?.unlockPromptCta || exports.DEFAULT_APP_CONFIG.home.unlockPromptCta,
        activeAdId: home?.activeAdId || exports.DEFAULT_APP_CONFIG.home.activeAdId,
        ads,
    };
}
