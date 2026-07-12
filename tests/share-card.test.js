"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const share_card_1 = require("../miniprogram/utils/share-card");
function testBuildIndexShareCardModelUsesCourseStats() {
    const model = (0, share_card_1.buildIndexShareCardModel)({
        isAuthenticated: true,
        userNickname: "Marco",
        completedCount: 12,
        courseCount: 365,
        streakCount: 7,
        featuredCourseTitle: "Difficult Customer",
    });
    strict_1.default.equal(model.title, "Marco 的外贸英语学习主页");
    strict_1.default.equal(model.badge, "已完成 12 / 365");
    strict_1.default.equal(model.highlight, "连续学习 7 天");
    strict_1.default.equal(model.snippet, "下一节推荐：Difficult Customer");
}
function testBuildContactShareCardModelUsesDefaultText() {
    const model = (0, share_card_1.buildContactShareCardModel)();
    strict_1.default.equal(model.title, "加入外贸英语学习交流社群");
    strict_1.default.equal(model.badge, "学习交流");
    strict_1.default.equal(model.snippet, "扫码加入社群，和小伙伴一起坚持听力打卡。");
}
function testBuildPracticeHelpShareCardModelUsesGuideText() {
    const model = (0, share_card_1.buildPracticeHelpShareCardModel)();
    strict_1.default.equal(model.title, "通听、精练、跟读三步练习法");
    strict_1.default.equal(model.badge, "练习方法");
    strict_1.default.equal(model.highlight, "听懂 · 练顺 · 跟上");
}
testBuildIndexShareCardModelUsesCourseStats();
testBuildContactShareCardModelUsesDefaultText();
testBuildPracticeHelpShareCardModelUsesGuideText();
console.log("share card tests passed.");
