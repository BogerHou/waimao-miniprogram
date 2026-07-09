import assert from "node:assert/strict"

import {
  DEVELOPMENT_API_BASE_URL,
  PRODUCTION_API_BASE_URL,
  resolveApiBaseUrl,
} from "../miniprogram/config/env"

function testDevelopUsesProductionBackend() {
  assert.equal(DEVELOPMENT_API_BASE_URL, PRODUCTION_API_BASE_URL)
  assert.equal(resolveApiBaseUrl("develop"), PRODUCTION_API_BASE_URL)
}

function testTrialAndReleaseUseProductionBackend() {
  assert.equal(resolveApiBaseUrl("trial"), PRODUCTION_API_BASE_URL)
  assert.equal(resolveApiBaseUrl("release"), PRODUCTION_API_BASE_URL)
}

function testUnknownEnvironmentUsesProductionBackend() {
  assert.equal(resolveApiBaseUrl(null), PRODUCTION_API_BASE_URL)
  assert.equal(resolveApiBaseUrl("unknown"), PRODUCTION_API_BASE_URL)
}

testDevelopUsesProductionBackend()
testTrialAndReleaseUseProductionBackend()
testUnknownEnvironmentUsesProductionBackend()
console.log("env config tests passed.")
