import assert from "node:assert/strict"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"

const INVALID_PAGE_JSON_KEYS = ["enableShareAppMessage", "enableShareTimeline"]

function listPageJsonFiles() {
  const pagesDir = path.join(process.cwd(), "miniprogram", "pages")
  return readdirSync(pagesDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(pagesDir, entry.name, `${entry.name}.json`))
    .filter(filePath => existsSync(filePath))
}

function testPageJsonDoesNotUseUnsupportedShareKeys() {
  for (const filePath of listPageJsonFiles()) {
    const pageConfig = JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>
    for (const key of INVALID_PAGE_JSON_KEYS) {
      assert.equal(pageConfig[key], undefined, `${filePath} should not contain ${key}`)
    }
  }
}

function testGlobalConfigurationDoesNotUseUnsupportedRecordPermission() {
  const appConfig = JSON.parse(
    readFileSync(path.join(process.cwd(), "miniprogram", "app.json"), "utf8"),
  ) as { permission?: Record<string, unknown> }
  assert.equal(
    appConfig.permission?.["scope.record"],
    undefined,
    "app.json permission only supports documented permission keys; recording is authorized at runtime",
  )
}

function testProjectConfigurationKeepsImportedModulesInBuilds() {
  const projectConfig = JSON.parse(
    readFileSync(path.join(process.cwd(), "project.config.json"), "utf8"),
  ) as { setting?: Record<string, unknown> }
  assert.equal(projectConfig.setting?.ignoreDevUnusedFiles, false)
  assert.equal(projectConfig.setting?.ignoreUploadUnusedFiles, false)
}

testPageJsonDoesNotUseUnsupportedShareKeys()
testGlobalConfigurationDoesNotUseUnsupportedRecordPermission()
testProjectConfigurationKeepsImportedModulesInBuilds()
console.log("page json schema tests passed.")
