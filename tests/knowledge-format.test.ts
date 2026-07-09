import assert from "node:assert/strict"

import {
  formatKnowledgeContent,
  parseCorrectionBlock,
  parsePhraseItems,
  splitPhraseLine,
} from "../miniprogram/utils/knowledge-format"

function testSplitPhraseLineSeparatesTermAndDefinition() {
  assert.deepEqual(splitPhraseLine("follow up on something跟进某个项目"), {
    term: "follow up on something",
    definition: "跟进某个项目",
  })
  assert.deepEqual(splitPhraseLine("Sounds good. 好的。"), {
    term: "Sounds good.",
    definition: "好的。",
  })
}

function testParsePhraseItemsMergesWrappedDefinitionLines() {
  const items = parsePhraseItems([
    "shoot me an email 发我邮件（这里的shoot 比 send更加有力，侧重于发",
    "送的动作)",
    "take a look看一下",
  ].join("\n"))

  assert.equal(items.length, 2)
  assert.equal(items[0].term, "shoot me an email")
  assert.equal(items[0].definition, "发我邮件（这里的shoot 比 send更加有力，侧重于发送的动作)")
  assert.equal(items[1].term, "take a look")
  assert.equal(items[1].definition, "看一下")
}

function testParsePhraseItemsStopsAtKnowledgeHeading() {
  const items = parsePhraseItems([
    "display box展示盒",
    "Chinglish Correction（中式英语纠错）",
    "这些是我们的老产品。",
  ].join("\n"))

  assert.equal(items.length, 1)
  assert.equal(items[0].term, "display box")
  assert.equal(items[0].definition, "展示盒")
}

function testParseCorrectionBlockGroupsExamples() {
  const block = parseCorrectionBlock([
    "Chinglish Correction（中式英语纠错）",
    "如果运气好，你明天就能收到报价单。",
    "【Chinglish】",
    "If you're lucky, you could receive the offer sheet tomorrow.",
    "【Native English】",
    "With any luck, I'll get the offer sheet to you tomorrow.",
  ].join("\n"))

  assert.equal(block.hasContent, true)
  assert.deepEqual(block.promptLines.map(line => line.text), [
    "如果运气好，你明天就能收到报价单。",
  ])
  assert.deepEqual(block.chinglishLines.map(line => line.text), [
    "If you're lucky, you could receive the offer sheet tomorrow.",
  ])
  assert.deepEqual(block.nativeLines.map(line => line.text), [
    "With any luck, I'll get the offer sheet to you tomorrow.",
  ])
}

function testFormatKnowledgeContentStripsHeadings() {
  const content = formatKnowledgeContent({
    background: "展会后电话跟进客户。",
    phrases: "get back to you 回复你",
    correction: "Chinglish Correction（中式英语纠错）\n现在进展如何？",
    notes: "毅冰补充：\n这里要用更自然的口语表达。",
  })

  assert.equal(content.hasKnowledgeContent, true)
  assert.deepEqual(content.backgroundParagraphs.map(line => line.text), ["展会后电话跟进客户。"])
  assert.equal(content.phraseItems[0].term, "get back to you")
  assert.deepEqual(content.correction.promptLines.map(line => line.text), ["现在进展如何？"])
  assert.deepEqual(content.noteParagraphs.map(line => line.text), ["这里要用更自然的口语表达。"])
}

testSplitPhraseLineSeparatesTermAndDefinition()
testParsePhraseItemsMergesWrappedDefinitionLines()
testParsePhraseItemsStopsAtKnowledgeHeading()
testParseCorrectionBlockGroupsExamples()
testFormatKnowledgeContentStripsHeadings()
console.log("knowledge format tests passed.")
