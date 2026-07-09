"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const env_1 = require("../miniprogram/config/env");
function testDevelopUsesProductionBackend() {
    strict_1.default.equal(env_1.DEVELOPMENT_API_BASE_URL, env_1.PRODUCTION_API_BASE_URL);
    strict_1.default.equal((0, env_1.resolveApiBaseUrl)("develop"), env_1.PRODUCTION_API_BASE_URL);
}
function testTrialAndReleaseUseProductionBackend() {
    strict_1.default.equal((0, env_1.resolveApiBaseUrl)("trial"), env_1.PRODUCTION_API_BASE_URL);
    strict_1.default.equal((0, env_1.resolveApiBaseUrl)("release"), env_1.PRODUCTION_API_BASE_URL);
}
function testUnknownEnvironmentUsesProductionBackend() {
    strict_1.default.equal((0, env_1.resolveApiBaseUrl)(null), env_1.PRODUCTION_API_BASE_URL);
    strict_1.default.equal((0, env_1.resolveApiBaseUrl)("unknown"), env_1.PRODUCTION_API_BASE_URL);
}
testDevelopUsesProductionBackend();
testTrialAndReleaseUseProductionBackend();
testUnknownEnvironmentUsesProductionBackend();
console.log("env config tests passed.");
