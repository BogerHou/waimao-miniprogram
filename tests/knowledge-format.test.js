"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const knowledge_format_1 = require("../miniprogram/utils/knowledge-format");
function testSplitPhraseLineSeparatesTermAndDefinition() {
    strict_1.default.deepEqual((0, knowledge_format_1.splitPhraseLine)("follow up on something跟进某个项目"), {
        term: "follow up on something",
        definition: "跟进某个项目",
    });
    strict_1.default.deepEqual((0, knowledge_format_1.splitPhraseLine)("Sounds good. 好的。"), {
        term: "Sounds good.",
        definition: "好的。",
    });
}
function testParsePhraseItemsMergesWrappedDefinitionLines() {
    const items = (0, knowledge_format_1.parsePhraseItems)([
        "shoot me an email 发我邮件（这里的shoot 比 send更加有力，侧重于发",
        "送的动作)",
        "take a look看一下",
    ].join("\n"));
    strict_1.default.equal(items.length, 2);
    strict_1.default.equal(items[0].term, "shoot me an email");
    strict_1.default.equal(items[0].definition, "发我邮件（这里的shoot 比 send更加有力，侧重于发送的动作)");
    strict_1.default.equal(items[1].term, "take a look");
    strict_1.default.equal(items[1].definition, "看一下");
}
function testParsePhraseItemsStopsAtKnowledgeHeading() {
    const items = (0, knowledge_format_1.parsePhraseItems)([
        "display box展示盒",
        "Chinglish Correction（中式英语纠错）",
        "这些是我们的老产品。",
    ].join("\n"));
    strict_1.default.equal(items.length, 1);
    strict_1.default.equal(items[0].term, "display box");
    strict_1.default.equal(items[0].definition, "展示盒");
}
function testParseCorrectionBlockGroupsExamples() {
    const block = (0, knowledge_format_1.parseCorrectionBlock)([
        "Chinglish Correction（中式英语纠错）",
        "如果运气好，你明天就能收到报价单。",
        "【Chinglish】",
        "If you're lucky, you could receive the offer sheet tomorrow.",
        "【Native English】",
        "With any luck, I'll get the offer sheet to you tomorrow.",
    ].join("\n"));
    strict_1.default.equal(block.hasContent, true);
    strict_1.default.deepEqual(block.promptLines.map(line => line.text), [
        "如果运气好，你明天就能收到报价单。",
    ]);
    strict_1.default.deepEqual(block.chinglishLines.map(line => line.text), [
        "If you're lucky, you could receive the offer sheet tomorrow.",
    ]);
    strict_1.default.deepEqual(block.nativeLines.map(line => line.text), [
        "With any luck, I'll get the offer sheet to you tomorrow.",
    ]);
}
function testFormatKnowledgeContentStripsHeadings() {
    const content = (0, knowledge_format_1.formatKnowledgeContent)({
        background: "展会后电话跟进客户。",
        phrases: "get back to you 回复你",
        correction: "Chinglish Correction（中式英语纠错）\n现在进展如何？",
        notes: "毅冰补充：\n这里要用更自然的口语表达。",
    });
    strict_1.default.equal(content.hasKnowledgeContent, true);
    strict_1.default.deepEqual(content.backgroundParagraphs.map(line => line.text), ["展会后电话跟进客户。"]);
    strict_1.default.equal(content.phraseItems[0].term, "get back to you");
    strict_1.default.deepEqual(content.correction.promptLines.map(line => line.text), ["现在进展如何？"]);
    strict_1.default.deepEqual(content.noteParagraphs.map(line => line.text), ["这里要用更自然的口语表达。"]);
}
testSplitPhraseLineSeparatesTermAndDefinition();
testParsePhraseItemsMergesWrappedDefinitionLines();
testParsePhraseItemsStopsAtKnowledgeHeading();
testParseCorrectionBlockGroupsExamples();
testFormatKnowledgeContentStripsHeadings();
console.log("knowledge format tests passed.");
