import assert from "node:assert/strict"

import {
  buildContactShareCardModel,
  buildIndexShareCardModel,
  buildLogsShareCardModel,
  buildPdfShareCardModel,
  buildPracticeHelpShareCardModel,
} from "../miniprogram/utils/share-card"

function testBuildIndexShareCardModelUsesCourseStats() {
  const model = buildIndexShareCardModel({
    isAuthenticated: true,
    userNickname: "Marco",
    completedCount: 12,
    courseCount: 365,
    streakCount: 7,
    featuredCourseTitle: "Difficult Customer",
  })

  assert.equal(model.title, "Marco 的外贸英语学习主页")
  assert.equal(model.badge, "已完成 12 / 365")
  assert.equal(model.highlight, "连续学习 7 天")
  assert.equal(model.snippet, "下一节推荐：Difficult Customer")
}

function testBuildContactShareCardModelUsesDefaultText() {
  const model = buildContactShareCardModel()

  assert.equal(model.title, "加入外贸英语学习交流社群")
  assert.equal(model.badge, "学习交流")
  assert.equal(model.snippet, "扫码加入社群，和小伙伴一起坚持听力打卡。")
}

function testBuildPdfShareCardModelUsesImageCount() {
  const model = buildPdfShareCardModel({
    courseTitle: "Difficult Customer",
    imageCount: 4,
  })

  assert.equal(model.title, "Difficult Customer")
  assert.equal(model.badge, "知识点 4 页")
  assert.equal(model.snippet, "课程知识点图解与重点内容整理。")
}

function testBuildPracticeHelpShareCardModelUsesGuideText() {
  const model = buildPracticeHelpShareCardModel()

  assert.equal(model.title, "通听、精练、跟读三步练习法")
  assert.equal(model.badge, "练习方法")
  assert.equal(model.highlight, "听懂 · 练顺 · 跟上")
}

function testBuildLogsShareCardModelUsesLatestLog() {
  const model = buildLogsShareCardModel({
    logCount: 3,
    latestLogDate: "2026/03/18 21:30:00",
  })

  assert.equal(model.title, "外贸英语影子跟读启动日志")
  assert.equal(model.badge, "最近 3 条")
  assert.equal(model.snippet, "最近一次启动：2026/03/18 21:30:00")
}

testBuildIndexShareCardModelUsesCourseStats()
testBuildContactShareCardModelUsesDefaultText()
testBuildPdfShareCardModelUsesImageCount()
testBuildPracticeHelpShareCardModelUsesGuideText()
testBuildLogsShareCardModelUsesLatestLog()
console.log("share card tests passed.")
