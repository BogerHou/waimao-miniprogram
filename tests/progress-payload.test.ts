import assert from "node:assert/strict"

import { buildRecordProgressPayload, buildUpdateProgressPayload } from "../miniprogram/utils/api"

function testBuildsSceneProgressPayloadWithCuePosition() {
  assert.deepEqual(
    buildUpdateProgressPayload("chapter-01-scene-01", "completed", {
      cueIndex: 5,
      totalCues: 6,
    }),
    {
      sceneId: "chapter-01-scene-01",
      status: "completed",
      cueIndex: 5,
      totalCues: 6,
    },
  )
}

function testBuildsCurrentSceneProgressPayloadWithoutCompletionStatus() {
  assert.deepEqual(
    buildRecordProgressPayload("chapter-01-scene-02", {
      cueIndex: 2,
      totalCues: 6,
    }),
    {
      sceneId: "chapter-01-scene-02",
      cueIndex: 2,
      totalCues: 6,
    },
  )
}

testBuildsSceneProgressPayloadWithCuePosition()
testBuildsCurrentSceneProgressPayloadWithoutCompletionStatus()
console.log("progress payload tests passed.")
