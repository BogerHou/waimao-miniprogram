"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PAGE_SIZE_DEFAULT = exports.API_BASE_URL = exports.DEVELOPMENT_API_BASE_URL = exports.PRODUCTION_API_BASE_URL = void 0;
exports.resolveApiBaseUrl = resolveApiBaseUrl;
exports.PRODUCTION_API_BASE_URL = 'https://englishecho.site';
exports.DEVELOPMENT_API_BASE_URL = exports.PRODUCTION_API_BASE_URL;
function getMiniProgramEnvVersion() {
    if (typeof wx === 'undefined' || typeof wx.getAccountInfoSync !== 'function') {
        return null;
    }
    try {
        return wx.getAccountInfoSync().miniProgram.envVersion ?? null;
    }
    catch {
        return null;
    }
}
function resolveApiBaseUrl(envVersion = getMiniProgramEnvVersion()) {
    return envVersion === 'develop' ? exports.DEVELOPMENT_API_BASE_URL : exports.PRODUCTION_API_BASE_URL;
}
exports.API_BASE_URL = resolveApiBaseUrl();
exports.PAGE_SIZE_DEFAULT = 10;
