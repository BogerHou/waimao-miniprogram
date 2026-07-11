"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldPreserveCachedSessionAfterRefreshFailure = shouldPreserveCachedSessionAfterRefreshFailure;
function shouldPreserveCachedSessionAfterRefreshFailure(persistedToken) {
    return Boolean(persistedToken);
}
