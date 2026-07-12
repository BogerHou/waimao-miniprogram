"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const record_auth_1 = require("../miniprogram/pages/course/record-auth");
// 已授权 → 直接录
strict_1.default.deepEqual((0, record_auth_1.decideRecordAuthAction)({ recordAuth: true }), { action: "start" });
// 从未询问 → 走系统授权弹窗
strict_1.default.deepEqual((0, record_auth_1.decideRecordAuthAction)({ recordAuth: undefined }), { action: "request" });
// 曾拒绝 → 引导去设置页
strict_1.default.deepEqual((0, record_auth_1.decideRecordAuthAction)({ recordAuth: false }), { action: "guide-setting" });
console.log("record auth tests passed.");
