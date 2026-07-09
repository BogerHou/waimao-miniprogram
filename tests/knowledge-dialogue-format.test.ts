import assert from "node:assert/strict"

import {
  formatKnowledgeDialogue,
  splitDialogueSentences,
} from "../miniprogram/pages/knowledge/dialogue-format"

function testSplitDialogueSentencesByTerminalPunctuation() {
  assert.deepEqual(
    splitDialogueSentences("I understand. What if we split the shipment? Great!"),
    [
      "I understand.",
      "What if we split the shipment?",
      "Great!",
    ],
  )
  assert.deepEqual(
    splitDialogueSentences("我明白了。所以我们准备新样品。这样可以吗？"),
    [
      "我明白了。",
      "所以我们准备新样品。",
      "这样可以吗？",
    ],
  )
}

function testSplitKeepsDecimalsAndEmailFragmentsTogether() {
  assert.deepEqual(
    splitDialogueSentences("The result was over 0.1%. Email me at buyer@xxx. com. Oh, and call me Brenda."),
    [
      "The result was over 0.1%.",
      "Email me at buyer@xxx. com.",
      "Oh, and call me Brenda.",
    ],
  )
}

function testFormatDialogueKeepsSpeakerToneStable() {
  const dialogue = formatKnowledgeDialogue([
    {
      speaker: "Yibing",
      text: "I understand. What if we split the shipment?",
      translation: "我明白。那我们分批发货怎么样？",
    },
    {
      speaker: "Walter",
      text: "That sounds perfect!",
      translation: "听起来不错！",
    },
    {
      speaker: "Yibing",
      text: "Great. I'll arrange it.",
      translation: "太好了。我来安排。",
    },
  ])

  assert.equal(dialogue[0].toneClass, dialogue[2].toneClass)
  assert.notEqual(dialogue[0].toneClass, dialogue[1].toneClass)
  assert.deepEqual(dialogue[0].textSegments.map(segment => segment.text), [
    "I understand.",
    "What if we split the shipment?",
  ])
  assert.deepEqual(dialogue[0].translationSegments.map(segment => segment.text), [
    "我明白。",
    "那我们分批发货怎么样？",
  ])
}

testSplitDialogueSentencesByTerminalPunctuation()
testSplitKeepsDecimalsAndEmailFragmentsTogether()
testFormatDialogueKeepsSpeakerToneStable()
console.log("knowledge dialogue format tests passed.")
