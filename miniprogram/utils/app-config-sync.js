"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshAppConfig = refreshAppConfig;
async function refreshAppConfig(fetcher, setter) {
    try {
        const appConfig = await fetcher();
        setter(appConfig);
    }
    catch (error) {
        console.warn('[AppConfig] refresh failed', error);
    }
}
