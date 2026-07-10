"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const util_1 = require("../miniprogram/utils/util");
function testFormatsExpiryDate() {
    const expiresAt = new Date(2027, 6, 10, 12, 0, 0).getTime();
    strict_1.default.equal((0, util_1.formatEntitlementExpiry)(expiresAt), '有效期至 2027 年 7 月 10 日');
    strict_1.default.equal((0, util_1.formatEntitlementExpiry)(null), '1 年访问权限已生效');
}
function testNormalizesInviteErrors() {
    strict_1.default.equal((0, util_1.formatInviteErrorMessage)(new Error('邀请码已被使用。')), '邀请码已被使用，请联系购买微信');
    strict_1.default.equal((0, util_1.formatInviteErrorMessage)(new Error('邀请码无效。如果还没有邀请码，请添加微信获取。')), '邀请码无效，请检查后重新输入');
}
testFormatsExpiryDate();
testNormalizesInviteErrors();
console.log('unlock format tests passed.');
