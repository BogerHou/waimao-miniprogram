"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.request = request;
const env_1 = require("../config/env");
const storage_1 = require("./storage");
const MAX_RETRY = 1;
function request(options) {
    return executeRequest(options, 0);
}
function executeRequest(options, attempt) {
    const { url, method = 'GET', data, header } = options;
    const token = (0, storage_1.getToken)();
    const headers = {
        ...(header ?? {}),
    };
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    if (method !== 'GET' && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }
    return new Promise((resolve, reject) => {
        wx.request({
            url: resolveUrl(url),
            method,
            data,
            header: headers,
            success(res) {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    const payload = (res.data ?? undefined);
                    resolve(payload);
                    return;
                }
                if (res.statusCode === 401 && attempt < MAX_RETRY) {
                    handleUnauthorized()
                        .then(() => executeRequest(options, attempt + 1).then(resolve).catch(reject))
                        .catch(reject);
                    return;
                }
                const errorPayload = res.data;
                const message = errorPayload?.message ||
                    errorPayload?.error ||
                    `Request failed with status ${res.statusCode}`;
                reject(new Error(message));
            },
            fail(error) {
                reject(error);
            },
        });
    });
}
function handleUnauthorized() {
    (0, storage_1.clearToken)();
    const app = getApp();
    if (app && typeof app.initializeAuth === 'function') {
        return app.initializeAuth(true);
    }
    return Promise.reject(new Error('Unauthorized'));
}
function resolveUrl(url) {
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    return `${env_1.API_BASE_URL}${url.startsWith('/') ? url : `/${url}`}`;
}
