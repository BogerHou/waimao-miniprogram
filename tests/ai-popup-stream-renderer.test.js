"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const stream_renderer_1 = require("../miniprogram/components/ai-popup/stream-renderer");
function testDrainStreamingBufferUsesFixedStep() {
    const result = (0, stream_renderer_1.drainStreamingBuffer)({
        pendingText: "abcdef",
        displayedText: "12",
        charsPerTick: 3,
    });
    strict_1.default.equal(result.displayedText, "12abc");
    strict_1.default.equal(result.pendingText, "def");
}
function testDrainStreamingBufferFlushesAll() {
    const result = (0, stream_renderer_1.drainStreamingBuffer)({
        pendingText: "abcdef",
        displayedText: "12",
        charsPerTick: 3,
        flushAll: true,
    });
    strict_1.default.equal(result.displayedText, "12abcdef");
    strict_1.default.equal(result.pendingText, "");
}
function testDrainStreamingBufferAlwaysMovesForward() {
    const result = (0, stream_renderer_1.drainStreamingBuffer)({
        pendingText: "a",
        displayedText: "",
        charsPerTick: 0,
    });
    strict_1.default.equal(result.displayedText, "a");
    strict_1.default.equal(result.pendingText, "");
}
testDrainStreamingBufferUsesFixedStep();
testDrainStreamingBufferFlushesAll();
testDrainStreamingBufferAlwaysMovesForward();
console.log("ai-popup stream-renderer tests passed.");
