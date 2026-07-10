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
function testBuildPdfShareCardModelUsesImageCount() {
    const model = (0, share_card_1.buildPdfShareCardModel)({
        courseTitle: "Difficult Customer",
        imageCount: 4,
    });
    strict_1.default.equal(model.title, "Difficult Customer");
    strict_1.default.equal(model.badge, "知识点 4 页");
    strict_1.default.equal(model.snippet, "课程知识点图解与重点内容整理。");
}
function testBuildPracticeHelpShareCardModelUsesGuideText() {
    const model = (0, share_card_1.buildPracticeHelpShareCardModel)();
    strict_1.default.equal(model.title, "逐句跟读与影子跟读练习指南");
    strict_1.default.equal(model.badge, "练习帮助");
    strict_1.default.equal(model.highlight, "先听懂，再跟上");
}
function testBuildLogsShareCardModelUsesLatestLog() {
    const model = (0, share_card_1.buildLogsShareCardModel)({
        logCount: 3,
        latestLogDate: "2026/03/18 21:30:00",
    });
    strict_1.default.equal(model.title, "外贸英语影子跟读启动日志");
    strict_1.default.equal(model.badge, "最近 3 条");
    strict_1.default.equal(model.snippet, "最近一次启动：2026/03/18 21:30:00");
}
testBuildIndexShareCardModelUsesCourseStats();
testBuildContactShareCardModelUsesDefaultText();
testBuildPdfShareCardModelUsesImageCount();
testBuildPracticeHelpShareCardModelUsesGuideText();
testBuildLogsShareCardModelUsesLatestLog();
console.log("share card tests passed.");
