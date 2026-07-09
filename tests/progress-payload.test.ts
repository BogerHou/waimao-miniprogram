import assert from "node:assert/strict"

import { buildUpdateProgressPayload } from "../miniprogram/utils/api"

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

testBuildsSceneProgressPayloadWithCuePosition()
console.log("progress payload tests passed.")
