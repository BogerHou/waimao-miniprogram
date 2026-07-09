"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const course_share_card_1 = require("../miniprogram/pages/course/course-share-card");
function testUsesCurrentSubtitleFirst() {
    const model = (0, course_share_card_1.buildCourseShareCardModel)({
        title: "Difficult Customer",
        tag: "Elementary",
        playMode: "shadow",
        currentText: "Hello, English learners, and welcome to Englishpod.",
        leadText: "My name is Marco.",
    });
    strict_1.default.equal(model.modeLabel, "影子跟读");
    strict_1.default.equal(model.tagLabel, "Elementary");
    strict_1.default.equal(model.snippet, "Hello, English learners, and welcome to Englishpod.");
}
function testFallsBackToLeadText() {
    const model = (0, course_share_card_1.buildCourseShareCardModel)({
        title: "Difficult Customer",
        playMode: "echo",
        currentText: "",
        leadText: "My name is Marco.",
    });
    strict_1.default.equal(model.modeLabel, "Echo模式");
    strict_1.default.equal(model.snippet, "My name is Marco.");
}
function testNormalizesWhitespaceAndTruncatesLongSnippet() {
    const model = (0, course_share_card_1.buildCourseShareCardModel)({
        title: "Difficult Customer",
        playMode: "shadow",
        currentText: "Hello,\n\nEnglish learners, and welcome to Englishpod. This sentence is intentionally long for truncation.",
        leadText: "",
        maxSnippetLength: 40,
    });
    strict_1.default.equal(model.snippet, "Hello, English learners, and welcome...");
}
function testProvidesDefaultSnippetWhenContentMissing() {
    const model = (0, course_share_card_1.buildCourseShareCardModel)({
        title: "Difficult Customer",
        playMode: "echo",
        currentText: "",
        leadText: "",
    });
    strict_1.default.equal(model.snippet, "外贸英语影子跟读练习，打开继续学习。");
}
testUsesCurrentSubtitleFirst();
testFallsBackToLeadText();
testNormalizesWhitespaceAndTruncatesLongSnippet();
testProvidesDefaultSnippetWhenContentMissing();
console.log("course share card tests passed.");
