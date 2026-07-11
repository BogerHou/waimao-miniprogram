"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const auth_session_1 = require("../miniprogram/utils/auth-session");
strict_1.default.equal((0, auth_session_1.shouldPreserveCachedSessionAfterRefreshFailure)('cached-token'), true);
strict_1.default.equal((0, auth_session_1.shouldPreserveCachedSessionAfterRefreshFailure)(null), false);
strict_1.default.equal((0, auth_session_1.shouldPreserveCachedSessionAfterRefreshFailure)(undefined), false);
strict_1.default.equal((0, auth_session_1.shouldPreserveCachedSessionAfterRefreshFailure)(''), false);
console.log('auth session tests passed.');
