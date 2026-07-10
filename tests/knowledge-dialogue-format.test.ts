import assert from "node:assert/strict"

import {
  buildTimedDialogueSentences,
  formatKnowledgeDialogue,
  formatKnowledgeDialogueFromSubtitles,
  resolveSpeakerToneClass,
  splitPairedDialogueSentences,
  splitDialogueSentences,
} from "../miniprogram/utils/dialogue-format"

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
  assert.deepEqual(dialogue[0].sentences.map(sentence => ({
    text: sentence.text,
    translation: sentence.translation,
  })), [
    { text: "I understand.", translation: "我明白。" },
    { text: "What if we split the shipment?", translation: "那我们分批发货怎么样？" },
  ])
}

function testSpeakerToneResolverKeepsSameSpeakerConsistent() {
  const toneIndexes = new Map<string, number>()
  const first = resolveSpeakerToneClass("Yibing", toneIndexes)
  const second = resolveSpeakerToneClass("Walter", toneIndexes)
  const third = resolveSpeakerToneClass("Yibing", toneIndexes)

  assert.equal(first, third)
  assert.notEqual(first, second)
}

function testSubtitleDialogueKeepsBackendTranslationPairs() {
  const dialogue = formatKnowledgeDialogueFromSubtitles([
    {
      id: '1',
      speaker: 'Carol',
      text: "Hi Yibing, I'm Carol, and I work closely with Bob.",
      translation: '你好，毅冰。我是 Carol，我和 Bob 一起工作。',
    },
    {
      id: '2',
      speaker: 'Carol',
      text: "He's been checking his emails while he's away.",
      translation: '他出差期间一直都会查收邮件。',
    },
    {
      id: '3',
      speaker: 'Yibing',
      text: 'Thanks, Carol!',
      translation: '谢谢你，Carol！',
    },
  ])

  assert.equal(dialogue.length, 2)
  assert.deepEqual(dialogue[0].sentences.map(sentence => ({
    text: sentence.text,
    translation: sentence.translation,
  })), [
    {
      text: "Hi Yibing, I'm Carol, and I work closely with Bob.",
      translation: '你好，毅冰。我是 Carol，我和 Bob 一起工作。',
    },
    {
      text: "He's been checking his emails while he's away.",
      translation: '他出差期间一直都会查收邮件。',
    },
  ])
}

function testSplitPairedDialogueSentencesKeepsTranslationUnderEnglish() {
  assert.deepEqual(
    splitPairedDialogueSentences(
      "Great, appreciate that! If you have any questions, feel free to call.",
      "太好了，十分感谢！如果你有任何问题，请随时联系我。",
    ),
    [
      {
        text: "Great, appreciate that!",
        translation: "太好了，十分感谢！",
      },
      {
        text: "If you have any questions, feel free to call.",
        translation: "如果你有任何问题，请随时联系我。",
      },
    ],
  )
}

function testTimedDialogueSentencesStayInsideOriginalCue() {
  const segments = buildTimedDialogueSentences({
    text: "Great, appreciate that! If you have any questions, feel free to call.",
    translation: "太好了，十分感谢！如果你有任何问题，请随时联系我。",
    start: 10,
    end: 16,
  })

  assert.equal(segments.length, 2)
  assert.equal(segments[0].start, 10)
  assert.equal(segments[1].end, 16)
  assert.ok(segments[0].end > segments[0].start)
  assert.equal(segments[0].end, segments[1].start)
}

testSplitDialogueSentencesByTerminalPunctuation()
testSplitKeepsDecimalsAndEmailFragmentsTogether()
testFormatDialogueKeepsSpeakerToneStable()
testSpeakerToneResolverKeepsSameSpeakerConsistent()
testSubtitleDialogueKeepsBackendTranslationPairs()
testSplitPairedDialogueSentencesKeepsTranslationUnderEnglish()
testTimedDialogueSentencesStayInsideOriginalCue()
console.log("knowledge dialogue format tests passed.")
