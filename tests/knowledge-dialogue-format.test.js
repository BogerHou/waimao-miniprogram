"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const dialogue_format_1 = require("../miniprogram/utils/dialogue-format");
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
function testSpeakerToneResolverKeepsSameSpeakerConsistent() {
    const toneIndexes = new Map();
    const first = (0, dialogue_format_1.resolveSpeakerToneClass)("Yibing", toneIndexes);
    const second = (0, dialogue_format_1.resolveSpeakerToneClass)("Walter", toneIndexes);
    const third = (0, dialogue_format_1.resolveSpeakerToneClass)("Yibing", toneIndexes);
    strict_1.default.equal(first, third);
    strict_1.default.notEqual(first, second);
}
function testSplitPairedDialogueSentencesKeepsTranslationUnderEnglish() {
    strict_1.default.deepEqual((0, dialogue_format_1.splitPairedDialogueSentences)("Great, appreciate that! If you have any questions, feel free to call.", "太好了，十分感谢！如果你有任何问题，请随时联系我。"), [
        {
            text: "Great, appreciate that!",
            translation: "太好了，十分感谢！",
        },
        {
            text: "If you have any questions, feel free to call.",
            translation: "如果你有任何问题，请随时联系我。",
        },
    ]);
}
function testTimedDialogueSentencesStayInsideOriginalCue() {
    const segments = (0, dialogue_format_1.buildTimedDialogueSentences)({
        text: "Great, appreciate that! If you have any questions, feel free to call.",
        translation: "太好了，十分感谢！如果你有任何问题，请随时联系我。",
        start: 10,
        end: 16,
    });
    strict_1.default.equal(segments.length, 2);
    strict_1.default.equal(segments[0].start, 10);
    strict_1.default.equal(segments[1].end, 16);
    strict_1.default.ok(segments[0].end > segments[0].start);
    strict_1.default.equal(segments[0].end, segments[1].start);
}
testSplitDialogueSentencesByTerminalPunctuation();
testSplitKeepsDecimalsAndEmailFragmentsTogether();
testFormatDialogueKeepsSpeakerToneStable();
testSpeakerToneResolverKeepsSameSpeakerConsistent();
testSplitPairedDialogueSentencesKeepsTranslationUnderEnglish();
testTimedDialogueSentencesStayInsideOriginalCue();
console.log("knowledge dialogue format tests passed.");
