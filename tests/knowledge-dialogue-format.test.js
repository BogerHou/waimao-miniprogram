"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const dialogue_format_1 = require("../miniprogram/pages/knowledge/dialogue-format");
function testSplitDialogueSentencesByTerminalPunctuation() {
    strict_1.default.deepEqual((0, dialogue_format_1.splitDialogueSentences)("I understand. What if we split the shipment? Great!"), [
        "I understand.",
        "What if we split the shipment?",
        "Great!",
    ]);
    strict_1.default.deepEqual((0, dialogue_format_1.splitDialogueSentences)("我明白了。所以我们准备新样品。这样可以吗？"), [
        "我明白了。",
        "所以我们准备新样品。",
        "这样可以吗？",
    ]);
}
function testSplitKeepsDecimalsAndEmailFragmentsTogether() {
    strict_1.default.deepEqual((0, dialogue_format_1.splitDialogueSentences)("The result was over 0.1%. Email me at buyer@xxx. com. Oh, and call me Brenda."), [
        "The result was over 0.1%.",
        "Email me at buyer@xxx. com.",
        "Oh, and call me Brenda.",
    ]);
}
function testFormatDialogueKeepsSpeakerToneStable() {
    const dialogue = (0, dialogue_format_1.formatKnowledgeDialogue)([
        {
            speaker: "Yibing",
            text: "I understand. What if we split the shipment?",
            translation: "我明白。那我们分批发货怎么样？",
        },
        {
            speaker: "Walter",
            text: "That sounds perfect!",
            translation: "听起来不错！",
        },
        {
            speaker: "Yibing",
            text: "Great. I'll arrange it.",
            translation: "太好了。我来安排。",
        },
    ]);
    strict_1.default.equal(dialogue[0].toneClass, dialogue[2].toneClass);
    strict_1.default.notEqual(dialogue[0].toneClass, dialogue[1].toneClass);
    strict_1.default.deepEqual(dialogue[0].textSegments.map(segment => segment.text), [
        "I understand.",
        "What if we split the shipment?",
    ]);
    strict_1.default.deepEqual(dialogue[0].translationSegments.map(segment => segment.text), [
        "我明白。",
        "那我们分批发货怎么样？",
    ]);
}
testSplitDialogueSentencesByTerminalPunctuation();
testSplitKeepsDecimalsAndEmailFragmentsTogether();
testFormatDialogueKeepsSpeakerToneStable();
console.log("knowledge dialogue format tests passed.");
