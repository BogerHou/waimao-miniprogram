import assert from "node:assert/strict"

import { drainStreamingBuffer } from "../miniprogram/components/ai-popup/stream-renderer"

function testDrainStreamingBufferUsesFixedStep() {
  const result = drainStreamingBuffer({
    pendingText: "abcdef",
    displayedText: "12",
    charsPerTick: 3,
  })

  assert.equal(result.displayedText, "12abc")
  assert.equal(result.pendingText, "def")
}

function testDrainStreamingBufferFlushesAll() {
  const result = drainStreamingBuffer({
    pendingText: "abcdef",
    displayedText: "12",
    charsPerTick: 3,
    flushAll: true,
  })

  assert.equal(result.displayedText, "12abcdef")
  assert.equal(result.pendingText, "")
}

function testDrainStreamingBufferAlwaysMovesForward() {
  const result = drainStreamingBuffer({
    pendingText: "a",
    displayedText: "",
    charsPerTick: 0,
  })

  assert.equal(result.displayedText, "a")
  assert.equal(result.pendingText, "")
}

testDrainStreamingBufferUsesFixedStep()
testDrainStreamingBufferFlushesAll()
testDrainStreamingBufferAlwaysMovesForward()
console.log("ai-popup stream-renderer tests passed.")
