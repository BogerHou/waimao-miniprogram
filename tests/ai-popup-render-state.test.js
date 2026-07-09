"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const render_state_1 = require("../miniprogram/components/ai-popup/render-state");
function testStreamingMessageUsesRawText() {
    const state = (0, render_state_1.getAssistantDisplayState)({
        role: "assistant",
        content: "完整内容",
        displayText: "完整内",
        parsedNodes: [{ type: "paragraph", content: "完整内容" }],
        isStreaming: true,
    });
    strict_1.default.equal(state.showStreamingText, true);
    strict_1.default.equal(state.showParsedNodes, false);
    strict_1.default.equal(state.text, "完整内");
}
function testCompletedMessageUsesParsedNodes() {
    const state = (0, render_state_1.getAssistantDisplayState)({
        role: "assistant",
        content: "完整内容",
        parsedNodes: [{ type: "paragraph", content: "完整内容" }],
        isStreaming: false,
    });
    strict_1.default.equal(state.showStreamingText, false);
    strict_1.default.equal(state.showParsedNodes, true);
    strict_1.default.equal(state.text, "完整内容");
}
function testAssistantWithoutParsedNodesFallsBackToText() {
    const state = (0, render_state_1.getAssistantDisplayState)({
        role: "assistant",
        content: "纯文本回退",
        isStreaming: false,
    });
    strict_1.default.equal(state.showStreamingText, true);
    strict_1.default.equal(state.showParsedNodes, false);
    strict_1.default.equal(state.text, "纯文本回退");
}
testStreamingMessageUsesRawText();
testCompletedMessageUsesParsedNodes();
testAssistantWithoutParsedNodesFallsBackToText();
console.log("ai-popup render-state tests passed.");
