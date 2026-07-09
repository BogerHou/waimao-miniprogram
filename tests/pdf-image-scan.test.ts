import assert from "node:assert/strict"

import { shouldContinuePdfImageScan } from "../miniprogram/pages/pdf-viewer/pdf-image-scan"

function testContinuesWhenPageExists() {
  assert.equal(shouldContinuePdfImageScan({ foundCount: 2, statusCode: 200 }), true)
}

function testStopsAfterFirstMissingPageOnceImagesFound() {
  assert.equal(shouldContinuePdfImageScan({ foundCount: 3, statusCode: 404 }), false)
}

function testAllowsInitialMissToFinishGracefully() {
  assert.equal(shouldContinuePdfImageScan({ foundCount: 0, statusCode: 404 }), false)
}

testContinuesWhenPageExists()
testStopsAfterFirstMissingPageOnceImagesFound()
testAllowsInitialMissToFinishGracefully()
console.log("pdf image scan tests passed.")
