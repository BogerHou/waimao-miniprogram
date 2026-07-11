import assert from "node:assert/strict"

import {
  normalizeStarredCueMap,
  toggleStarredCue,
  getStarredCueIds,
  isCueStarred,
} from "../miniprogram/utils/practice-marks"
import { resolveNextScene } from "../miniprogram/utils/next-scene"
import type { ChapterListItem } from "../miniprogram/utils/api"

// ==================== 星标存储模型 ====================

// normalize：非法输入回退空表，去重、剔除非字符串
assert.deepEqual(normalizeStarredCueMap(null), {})
assert.deepEqual(normalizeStarredCueMap("junk"), {})
assert.deepEqual(normalizeStarredCueMap([1, 2]), {})
assert.deepEqual(
  normalizeStarredCueMap({ "scene-01": ["s1", "s1", "", 3, "s2"], "scene-02": "junk", "scene-03": [] }),
  { "scene-01": ["s1", "s2"] },
)

// toggle：加星、去星、清空后删除课程键
{
  let map = {}
  map = toggleStarredCue(map, "scene-01", "s1")
  assert.deepEqual(getStarredCueIds(map, "scene-01"), ["s1"])
  assert.equal(isCueStarred(map, "scene-01", "s1"), true)

  map = toggleStarredCue(map, "scene-01", "s2")
  assert.deepEqual(getStarredCueIds(map, "scene-01"), ["s1", "s2"])

  map = toggleStarredCue(map, "scene-01", "s1")
  assert.deepEqual(getStarredCueIds(map, "scene-01"), ["s2"])

  map = toggleStarredCue(map, "scene-01", "s2")
  assert.deepEqual(map, {})
  assert.equal(isCueStarred(map, "scene-01", "s2"), false)
}

// ==================== 下一节解析 ====================

const chapters = [
  {
    id: "chapter-01",
    number: 1,
    label: "第 1 章",
    title: "开发客户",
    audio: "",
    duration: 0,
    free: true,
    scenes: [
      { id: "scene-01", index: 1, title: "初次联系", cueCount: 10, duration: 60, free: true },
      { id: "scene-02", index: 2, title: "跟进报价", cueCount: 12, duration: 70, free: true },
    ],
  },
  {
    id: "chapter-02",
    number: 2,
    label: "第 2 章",
    title: "价格谈判",
    audio: "",
    duration: 0,
    free: false,
    locked: true,
    scenes: [
      { id: "scene-03", index: 1, title: "还价", cueCount: 9, duration: 55, free: false, locked: true },
      { id: "scene-04", index: 2, title: "让步", cueCount: 8, duration: 50, free: false, locked: false },
    ],
  },
] as unknown as ChapterListItem[]

// 同章下一节
assert.deepEqual(resolveNextScene(chapters, "scene-01"), {
  id: "scene-02",
  title: "跟进报价",
  chapterLabel: "第 1 章",
})

// 跨章时跳过锁定小节，取第一个未锁定的
assert.deepEqual(resolveNextScene(chapters, "scene-02"), {
  id: "scene-04",
  title: "让步",
  chapterLabel: "第 2 章",
})

// 最后一节 / 未知小节返回 null
assert.equal(resolveNextScene(chapters, "scene-04"), null)
assert.equal(resolveNextScene(chapters, "missing"), null)

console.log("practice marks and next scene tests passed.")
