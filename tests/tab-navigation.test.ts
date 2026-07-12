import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '..')
const appJson = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/app.json'), 'utf8')) as {
  tabBar?: {
    list?: Array<{ pagePath?: string; text?: string; iconPath?: string; selectedIconPath?: string }>
  }
}

const tabs = appJson.tabBar?.list ?? []
assert.deepEqual(tabs.map(item => item.pagePath), [
  'pages/index/index',
  'pages/review/review',
  'pages/learning/learning',
])
assert.deepEqual(tabs.map(item => item.text), ['课程', '复习', '我的'])

for (const tab of tabs) {
  for (const iconPath of [tab.iconPath, tab.selectedIconPath]) {
    assert.ok(iconPath, `${tab.text} tab should configure both icon states`)
    const absolutePath = path.join(root, 'miniprogram', iconPath as string)
    const buffer = fs.readFileSync(absolutePath)
    assert.equal(buffer.toString('hex', 1, 4), '504e47', `${iconPath} should be a PNG`)
    assert.ok(buffer.length < 40 * 1024, `${iconPath} should stay below the tab icon limit`)
  }
}

console.log('tab navigation tests passed.')
