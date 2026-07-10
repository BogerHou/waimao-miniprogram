import assert from 'node:assert/strict'

import {
  buildCoachScenePlan,
  resolveBusinessGoal,
  resolveCoachSceneRange,
} from '../miniprogram/utils/coach-model'

function testBuildsBusinessChallengesFromLearnerTurns() {
  const plan = buildCoachScenePlan({
    id: 'scene-1',
    title: '报价后的电话跟进',
    audio: '/audio.mp3',
    subtitles: [
      { id: '1', start: 0, end: 1, speaker: 'Yibing', text: 'Hi Bob, this is Yibing.', translation: '嗨，Bob。' },
      { id: '2', start: 1, end: 2, speaker: 'Bob', text: 'How can I help?', translation: '有什么事吗？' },
      { id: '3', start: 2, end: 3, speaker: 'Yibing', text: 'I wanted to follow up on my quotation.', translation: '我想跟进一下报价。' },
    ],
  })

  assert.equal(plan.learnerSpeaker, 'Yibing')
  assert.equal(plan.customerSpeaker, 'Bob')
  assert.equal(plan.mode, 'dialogue')
  assert.equal(plan.practiceCues.length, 2)
  assert.equal(plan.challenges[0].promptSpeaker, '情境')
  assert.equal(plan.challenges[1].promptText, 'How can I help?')
  assert.equal(plan.challenges[1].referenceText, 'I wanted to follow up on my quotation.')
  assert.match(plan.challenges[1].responseGoal, /跟进/)
  assert.deepEqual(plan.challenges[1].contextTurns.map(item => item.text), [
    'Hi Bob, this is Yibing.',
    'How can I help?',
  ])
  assert.equal(plan.challenges[1].contextTurns[0].isLearner, true)
  assert.equal(plan.challenges[1].contextTurns[1].isLearner, false)
  assert.equal(plan.challenges[1].thinkingTips.length, 3)
  assert.match(plan.businessGoal, /报价/)
}

function testPrefersLearnerRoleWhenCustomerSpeaksFirst() {
  const plan = buildCoachScenePlan({
    id: 'scene-customer-first',
    title: '接到客户的 Cold Call（陌生来电），这样应对',
    audio: '/audio.mp3',
    subtitles: [
      { id: '1', start: 0, end: 1, speaker: 'Nina', text: 'Hi, is this Yibing?', translation: '你好，是毅冰吗？' },
      { id: '2', start: 1, end: 2, speaker: 'Yibing', text: 'Yes, speaking.', translation: '是的，我就是。' },
    ],
  })

  assert.equal(plan.learnerSpeaker, 'Yibing')
  assert.equal(plan.customerSpeaker, 'Nina')
  assert.equal(plan.practiceCues.length, 1)
  assert.equal(plan.challenges[0].promptText, 'Hi, is this Yibing?')
}

function testTreatsSentenceLibraryAsPhraseDrill() {
  const plan = buildCoachScenePlan({
    id: 'scene-phrases',
    title: '在办公室：畅聊必备的地道英语表达',
    audio: '/audio.mp3',
    subtitles: [
      { id: '1', start: 0, end: 1, speaker: '句子 1', text: 'Same old, same grind.', translation: '还是老样子，忙忙碌碌的。' },
      { id: '2', start: 1, end: 2, speaker: '句子 2', text: 'How about grabbing a coffee?', translation: '一起去喝杯咖啡？' },
      { id: '3', start: 2, end: 3, speaker: '句子 3', text: 'I will keep you posted.', translation: '我会随时告诉你进展。' },
    ],
  })

  assert.equal(plan.mode, 'phrase-drill')
  assert.equal(plan.learnerSpeaker, '你')
  assert.equal(plan.practiceCues.length, 3)
  assert.equal(plan.totalPracticeCueCount, 3)
  assert.equal(plan.batchStart, 0)
  assert.equal(plan.batchEnd, 3)
  assert.equal(plan.hasNextBatch, false)
  assert.equal(plan.challenges[0].promptSpeaker, '表达任务')
  assert.equal(plan.challenges[0].promptText, '还是老样子，忙忙碌碌的。')
  assert.equal(plan.challenges[0].contextTurns.length, 0)
  assert.match(plan.challenges[0].responseGoal, /英文表达/)
  assert.equal(plan.challenges[0].thinkingTips.length, 3)
}

function testPrioritizesSubstantiveBusinessCues() {
  const plan = buildCoachScenePlan({
    id: 'scene-focus',
    title: '报价后的电话跟进',
    audio: '/audio.mp3',
    subtitles: [
      { id: '1', start: 0, end: 1, speaker: 'Yibing', text: 'Hi Bob.', translation: '嗨，Bob。' },
      { id: '2', start: 1, end: 2, speaker: 'Bob', text: 'Hi Yibing.', translation: '嗨，毅冰。' },
      { id: '3', start: 2, end: 3, speaker: 'Yibing', text: "How's it going?", translation: '最近好吗？' },
      { id: '4', start: 3, end: 4, speaker: 'Yibing', text: 'I wanted to follow up on the quotation I sent on Monday.', translation: '我想跟进周一发送的报价。' },
      { id: '5', start: 4, end: 5, speaker: 'Yibing', text: 'Did you have a chance to take a look?', translation: '您看过了吗？' },
      { id: '6', start: 5, end: 6, speaker: 'Bob', text: 'I need more time.', translation: '我还需要一点时间。' },
      { id: '7', start: 6, end: 7, speaker: 'Yibing', text: 'If you need more details, feel free to email me.', translation: '如果需要更多信息，请给我发邮件。' },
      { id: '8', start: 7, end: 8, speaker: 'Yibing', text: 'Great, appreciate that!', translation: '好的，感谢！' },
    ],
  })

  assert.deepEqual(plan.practiceCues.map(item => item.id), ['4', '5', '7'])
  assert.deepEqual(plan.keyExpressions, [
    'I wanted to follow up on the quotation I sent on Monday.',
    'Did you have a chance to take a look?',
    'If you need more details, feel free to email me.',
  ])
  assert.equal(plan.challenges[0].promptSpeaker, '你刚刚说')
  assert.equal(plan.challenges[2].promptSpeaker, 'Bob')
  assert.match(plan.challenges[0].situation, /继续把话题推进/)
  assert.match(plan.challenges[2].responseGoal, /补充信息|沟通渠道/)
  assert.deepEqual(plan.challenges[2].contextTurns.map(item => item.text), [
    "How's it going?",
    'I wanted to follow up on the quotation I sent on Monday.',
    'Did you have a chance to take a look?',
    'I need more time.',
  ])
}

function testSplitsPhraseLibraryIntoBatches() {
  const subtitles = Array.from({ length: 19 }, (_, index) => ({
    id: String(index + 1),
    start: index,
    end: index + 0.8,
    speaker: `句子 ${index + 1}`,
    text: `Expression ${index + 1}.`,
    translation: `表达 ${index + 1}。`,
  }))
  const plan = buildCoachScenePlan({
    id: 'scene-batches',
    title: '外贸高频表达',
    audio: '/audio.mp3',
    subtitles,
  }, { phraseBatchStart: 8 })

  assert.equal(plan.mode, 'phrase-drill')
  assert.equal(plan.batchStart, 8)
  assert.equal(plan.batchEnd, 16)
  assert.equal(plan.totalPracticeCueCount, 19)
  assert.equal(plan.practiceCues.length, 8)
  assert.equal(plan.practiceCues[0].id, '9')
  assert.equal(plan.practiceCues[7].id, '16')
  assert.equal(plan.challenges.length, 3)
  assert.equal(plan.hasNextBatch, true)
  assert.deepEqual(resolveCoachSceneRange({
    id: 'scene-batches',
    title: '外贸高频表达',
    audio: '/audio.mp3',
    subtitles,
    range: { start: 0, end: 18.8 },
  }, plan), { start: 8, end: 15.8 })

  const finalPlan = buildCoachScenePlan({
    id: 'scene-batches',
    title: '外贸高频表达',
    audio: '/audio.mp3',
    subtitles,
  }, { phraseBatchStart: 16 })
  assert.equal(finalPlan.practiceCues.length, 3)
  assert.equal(finalPlan.hasNextBatch, false)
}

function testFallsBackToBackgroundForUnknownScenario() {
  const goal = resolveBusinessGoal({
    title: '特别场景',
    knowledge: {
      background: '这是一个需要先确认客户信息，再提出下一步建议的场景。',
      phrases: '',
      correction: '',
      notes: '',
      dialogue: [],
    },
  })
  assert.match(goal, /确认客户信息/)
}

testBuildsBusinessChallengesFromLearnerTurns()
testPrefersLearnerRoleWhenCustomerSpeaksFirst()
testTreatsSentenceLibraryAsPhraseDrill()
testPrioritizesSubstantiveBusinessCues()
testSplitsPhraseLibraryIntoBatches()
testFallsBackToBackgroundForUnknownScenario()
console.log('coach model tests passed.')
