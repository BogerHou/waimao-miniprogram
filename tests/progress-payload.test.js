"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const api_1 = require("../miniprogram/utils/api");
function testBuildsSceneProgressPayloadWithCuePosition() {
    strict_1.default.deepEqual((0, api_1.buildUpdateProgressPayload)("chapter-01-scene-01", "completed", {
        cueIndex: 5,
        totalCues: 6,
    }), {
        sceneId: "chapter-01-scene-01",
        status: "completed",
        cueIndex: 5,
        totalCues: 6,
    });
}
function testBuildsCurrentSceneProgressPayloadWithoutCompletionStatus() {
    strict_1.default.deepEqual((0, api_1.buildRecordProgressPayload)("chapter-01-scene-02", {
        cueIndex: 2,
        totalCues: 6,
    }), {
        sceneId: "chapter-01-scene-02",
        cueIndex: 2,
        totalCues: 6,
    });
}
testBuildsSceneProgressPayloadWithCuePosition();
testBuildsCurrentSceneProgressPayloadWithoutCompletionStatus();
console.log("progress payload tests passed.");
