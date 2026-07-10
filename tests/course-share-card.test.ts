import assert from "node:assert/strict"

import {
  buildCourseShareCardModel,
} from "../miniprogram/pages/course/course-share-card"

function testUsesCurrentSubtitleFirst() {
  const model = buildCourseShareCardModel({
    title: "Difficult Customer",
    tag: "Elementary",
    playMode: "shadow",
    currentText: "Hello, English learners, and welcome to Englishpod.",
    leadText: "My name is Marco.",
  })

  assert.equal(model.modeLabel, "影子跟读")
  assert.equal(model.tagLabel, "Elementary")
  assert.equal(model.snippet, "Hello, English learners, and welcome to Englishpod.")
}

function testFallsBackToLeadText() {
  const model = buildCourseShareCardModel({
    title: "Difficult Customer",
    playMode: "echo",
    currentText: "",
    leadText: "My name is Marco.",
  })

  assert.equal(model.modeLabel, "逐句跟读")
  assert.equal(model.snippet, "My name is Marco.")
}

function testNormalizesWhitespaceAndTruncatesLongSnippet() {
  const model = buildCourseShareCardModel({
    title: "Difficult Customer",
    playMode: "shadow",
    currentText: "Hello,\n\nEnglish learners, and welcome to Englishpod. This sentence is intentionally long for truncation.",
    leadText: "",
    maxSnippetLength: 40,
  })

  assert.equal(model.snippet, "Hello, English learners, and welcome...")
}

function testProvidesDefaultSnippetWhenContentMissing() {
  const model = buildCourseShareCardModel({
    title: "Difficult Customer",
    playMode: "echo",
    currentText: "",
    leadText: "",
  })

  assert.equal(model.snippet, "外贸英语影子跟读练习，打开继续学习。")
}

testUsesCurrentSubtitleFirst()
testFallsBackToLeadText()
testNormalizesWhitespaceAndTruncatesLongSnippet()
testProvidesDefaultSnippetWhenContentMissing()
console.log("course share card tests passed.")
