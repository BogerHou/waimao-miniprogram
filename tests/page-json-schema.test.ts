import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"

const INVALID_PAGE_JSON_KEYS = ["enableShareAppMessage", "enableShareTimeline"]

function listPageJsonFiles() {
  const pagesDir = path.join(process.cwd(), "miniprogram", "pages")
  return readdirSync(pagesDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(pagesDir, entry.name, `${entry.name}.json`))
}

function testPageJsonDoesNotUseUnsupportedShareKeys() {
  for (const filePath of listPageJsonFiles()) {
    const pageConfig = JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>
    for (const key of INVALID_PAGE_JSON_KEYS) {
      assert.equal(pageConfig[key], undefined, `${filePath} should not contain ${key}`)
    }
  }
}

testPageJsonDoesNotUseUnsupportedShareKeys()
console.log("page json schema tests passed.")
