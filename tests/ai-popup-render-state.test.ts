import assert from "node:assert/strict"

import { getAssistantDisplayState } from "../miniprogram/components/ai-popup/render-state"

function testStreamingMessageUsesRawText() {
  const state = getAssistantDisplayState({
    role: "assistant",
    content: "完整内容",
    displayText: "完整内",
    parsedNodes: [{ type: "paragraph", content: "完整内容" }],
    isStreaming: true,
  })

  assert.equal(state.showStreamingText, true)
  assert.equal(state.showParsedNodes, false)
  assert.equal(state.text, "完整内")
}

function testCompletedMessageUsesParsedNodes() {
  const state = getAssistantDisplayState({
    role: "assistant",
    content: "完整内容",
    parsedNodes: [{ type: "paragraph", content: "完整内容" }],
    isStreaming: false,
  })

  assert.equal(state.showStreamingText, false)
  assert.equal(state.showParsedNodes, true)
  assert.equal(state.text, "完整内容")
}

function testAssistantWithoutParsedNodesFallsBackToText() {
  const state = getAssistantDisplayState({
    role: "assistant",
    content: "纯文本回退",
    isStreaming: false,
  })

  assert.equal(state.showStreamingText, true)
  assert.equal(state.showParsedNodes, false)
  assert.equal(state.text, "纯文本回退")
}

testStreamingMessageUsesRawText()
testCompletedMessageUsesParsedNodes()
testAssistantWithoutParsedNodesFallsBackToText()
console.log("ai-popup render-state tests passed.")
