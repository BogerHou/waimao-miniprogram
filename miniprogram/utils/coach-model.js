"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCoachScenePlan = buildCoachScenePlan;
exports.resolveBusinessGoal = resolveBusinessGoal;
exports.resolveCoachSceneRange = resolveCoachSceneRange;
const DEFAULT_PHRASE_BATCH_SIZE = 8;
const TITLE_GOALS = [
    { pattern: /报价|价格/, goal: '自然确认客户是否看过报价，并推动对方给出明确的下一步。' },
    { pattern: /催促|紧急|交期|延期/, goal: '在保持合作关系的同时，明确说明紧迫性并确认处理时间。' },
    { pattern: /展会|接待|拜访/, goal: '快速建立信任，问出客户真正关心的信息并约定后续动作。' },
    { pattern: /谈判|MOQ|数量|付款/, goal: '守住关键条件，同时给客户一个可以继续谈下去的方案。' },
    { pattern: /投诉|售后|质量|问题/, goal: '先承接客户情绪，再确认事实并给出清晰的解决步骤。' },
    { pattern: /开发|陌生|Cold Call/i, goal: '在最短时间内说明价值，争取让客户愿意继续听下去。' },
    { pattern: /邮件|邮箱/, goal: '清楚说明邮件事项，并让客户确认收到或给出下一步反馈。' },
    { pattern: /表达|金句|口语/, goal: '在常见外贸情境中快速调取并说出一组高频表达。' },
];
function buildCoachScenePlan(course, options = {}) {
    const subtitles = Array.isArray(course.subtitles) ? course.subtitles : [];
    const mode = resolveSceneMode(subtitles);
    const learnerSpeaker = mode === 'phrase-drill' ? '你' : resolveLearnerSpeaker(subtitles);
    const customerSpeaker = mode === 'phrase-drill'
        ? '高频表达'
        : resolveCustomerSpeaker(subtitles, learnerSpeaker);
    const allCues = subtitles.map((cue, cueIndex) => ({ ...cue, cueIndex }));
    const learnerCues = mode === 'phrase-drill'
        ? allCues
        : allCues.filter(cue => normalizeSpeaker(cue.speaker) === normalizeSpeaker(learnerSpeaker));
    const focusCues = mode === 'phrase-drill'
        ? learnerCues
        : selectDialogueFocusCues(learnerCues.length ? learnerCues : allCues);
    const phraseBatchSize = normalizePhraseBatchSize(options.phraseBatchSize);
    const batchStart = mode === 'phrase-drill'
        ? normalizePhraseBatchStart(options.phraseBatchStart, focusCues.length, phraseBatchSize)
        : 0;
    const practiceCues = mode === 'phrase-drill'
        ? focusCues.slice(batchStart, batchStart + phraseBatchSize)
        : focusCues;
    const batchEnd = batchStart + practiceCues.length;
    const businessGoal = resolveBusinessGoal(course);
    const challenges = practiceCues.slice(0, 3).map((cue, index) => buildCoachChallenge({
        courseId: course.id,
        mode,
        cue,
        challengeIndex: index,
        subtitles,
        learnerSpeaker,
        customerSpeaker,
        businessGoal,
    }));
    return {
        mode,
        businessGoal,
        learnerSpeaker,
        customerSpeaker,
        estimatedMinutes: mode === 'phrase-drill'
            ? Math.max(10, Math.min(30, Math.ceil(4 + practiceCues.length * 0.45)))
            : Math.max(6, Math.min(15, Math.ceil(4 + practiceCues.length * 0.75))),
        keyExpressions: practiceCues.slice(0, 3).map(cue => cue.text),
        challenges,
        practiceCues,
        batchStart,
        batchEnd,
        totalPracticeCueCount: focusCues.length,
        hasNextBatch: mode === 'phrase-drill' && batchEnd < focusCues.length,
    };
}
function buildCoachChallenge(params) {
    const { courseId, mode, cue, challengeIndex, subtitles, learnerSpeaker, customerSpeaker, businessGoal, } = params;
    const previous = subtitles[cue.cueIndex - 1];
    const hasPreviousCue = mode === 'dialogue' && Boolean(previous);
    const previousIsLearner = hasPreviousCue && normalizeSpeaker(previous.speaker) === normalizeSpeaker(learnerSpeaker);
    const contextTurns = mode === 'dialogue'
        ? buildContextTurns(subtitles, cue.cueIndex, learnerSpeaker)
        : [];
    return {
        id: `${courseId}:${cue.id}`,
        cueIndex: cue.cueIndex,
        situation: mode === 'phrase-drill'
            ? '这是一个高频表达训练。你只需要先看中文意思，试着把英文完整说出来。'
            : buildSituation(contextTurns, businessGoal, challengeIndex),
        responseGoal: mode === 'phrase-drill'
            ? '把中文意思转换成自然、完整的英文表达。'
            : buildResponseGoal(cue.text, businessGoal),
        thinkingTips: mode === 'phrase-drill'
            ? buildPhraseThinkingTips(cue)
            : buildDialogueThinkingTips(cue.text, previous, businessGoal),
        contextTurns,
        promptSpeaker: mode === 'phrase-drill'
            ? '表达任务'
            : hasPreviousCue
                ? previousIsLearner ? '你刚刚说' : previous.speaker || customerSpeaker
                : '情境',
        promptText: mode === 'phrase-drill'
            ? cue.translation || '请先用英语说出这条表达。'
            : hasPreviousCue
                ? previous.text
                : challengeIndex === 0
                    ? 'The customer has just answered your call.'
                    : 'The customer is waiting for your next point.',
        promptTranslation: mode === 'phrase-drill'
            ? '先用英语表达，再查看参考说法。'
            : hasPreviousCue
                ? previous.translation || ''
                : challengeIndex === 0
                    ? '客户刚刚接通电话，你准备怎样自然开场？'
                    : '客户正在等你继续推进，你会怎样表达？',
        referenceSpeaker: cue.speaker || learnerSpeaker,
        referenceText: cue.text,
        referenceTranslation: cue.translation || '',
    };
}
function buildContextTurns(subtitles, cueIndex, learnerSpeaker) {
    const learner = normalizeSpeaker(learnerSpeaker);
    return subtitles
        .slice(Math.max(0, cueIndex - 4), cueIndex)
        .filter(item => String(item.text || '').trim())
        .map(item => ({
        speaker: item.speaker || (normalizeSpeaker(item.speaker) === learner ? '你' : '对方'),
        text: item.text,
        translation: item.translation || '',
        isLearner: normalizeSpeaker(item.speaker) === learner,
    }));
}
function buildSituation(contextTurns, businessGoal, challengeIndex) {
    if (!contextTurns.length) {
        return challengeIndex === 0
            ? '对话刚开始，你需要自然开场，并尽快把话题带到业务目的上。'
            : '对方正在等你继续说明，你需要让沟通往下一步推进。';
    }
    const lastTurn = contextTurns[contextTurns.length - 1];
    if (lastTurn.isLearner) {
        return '你已经完成了铺垫，现在要继续把话题推进到更具体的业务动作。';
    }
    return `对方刚给出回应。你的任务不是翻译句子，而是围绕“${businessGoal}”接住话题。`;
}
function buildResponseGoal(referenceText, businessGoal) {
    const text = String(referenceText || '');
    if (/\?/.test(text)) {
        return '问出一个具体问题，让对方给出明确反馈。';
    }
    if (/\b(follow[ -]?up|quote|quotation|price|pricing)\b/i.test(text)) {
        return '说明你要跟进的事项，并把对话带到客户反馈上。';
    }
    if (/\b(email|details|information|send|share)\b/i.test(text)) {
        return '给对方一个清楚的沟通渠道或补充信息方式。';
    }
    if (/\b(confirm|check|review|take a look)\b/i.test(text)) {
        return '确认对方是否已经处理，并争取一个可执行的下一步。';
    }
    return truncateText(businessGoal, 54);
}
function buildDialogueThinkingTips(referenceText, previous, businessGoal) {
    const tips = [
        previous ? '先回应对方刚才的话，不要直接背答案。' : '先用自然开场建立对话关系。',
        '再说明你这一轮真正想推进的事情。',
    ];
    const reference = String(referenceText || '');
    if (/\?/.test(reference)) {
        tips.push('最后用一个问题把话语权交给对方。');
    }
    else if (/\b(email|details|information|send|share)\b/i.test(reference)) {
        tips.push('给出清楚的补充方式，让对方知道下一步怎么做。');
    }
    else if (/\b(follow[ -]?up|confirm|check|review|take a look)\b/i.test(reference)) {
        tips.push('把动作说具体，例如确认、查看、反馈或约定时间。');
    }
    else {
        tips.push(`说完后要能服务于目标：${truncateText(businessGoal, 34)}`);
    }
    return tips;
}
function buildPhraseThinkingTips(cue) {
    const tips = ['先抓中文里的动作和对象。', '用完整句说出来，不只说关键词。'];
    if (/[?？]/.test(cue.translation || cue.text)) {
        tips.push('注意这是疑问句，语气要自然上扬。');
    }
    else {
        tips.push('说完后再对照原声修正节奏。');
    }
    return tips;
}
function resolveBusinessGoal(course) {
    const title = String(course.title || '');
    const matched = TITLE_GOALS.find(item => item.pattern.test(title));
    if (matched) {
        return matched.goal;
    }
    const background = String(course.knowledge?.background || '').replace(/\s+/g, ' ').trim();
    if (background) {
        return truncateText(background, 76);
    }
    return '在真实外贸沟通中组织清楚的回应，并推动对话进入下一步。';
}
function resolveCoachSceneRange(course, plan) {
    const scopedCues = plan?.mode === 'phrase-drill' && plan.practiceCues.length
        ? plan.practiceCues
        : course.subtitles;
    const first = scopedCues[0];
    const last = scopedCues[scopedCues.length - 1];
    const start = Number(plan?.mode === 'phrase-drill' ? first?.start ?? 0 : course.range?.start ?? first?.start ?? 0);
    const end = Number(plan?.mode === 'phrase-drill' ? last?.end : course.range?.end ?? last?.end ?? start + 1);
    return { start, end: Math.max(start + 0.1, end) };
}
function resolveLearnerSpeaker(subtitles) {
    const preferred = subtitles.find(item => normalizeSpeaker(item.speaker) === 'yibing')?.speaker;
    if (preferred)
        return preferred;
    const firstNamed = subtitles.find(item => normalizeSpeaker(item.speaker))?.speaker;
    return firstNamed || '你';
}
function resolveSceneMode(subtitles) {
    if (!subtitles.length)
        return 'dialogue';
    const sentenceLabels = subtitles.filter(item => /^句子\s*\d+$/i.test(String(item.speaker || '').trim())).length;
    return sentenceLabels / subtitles.length >= 0.8 ? 'phrase-drill' : 'dialogue';
}
function resolveCustomerSpeaker(subtitles, learnerSpeaker) {
    const learner = normalizeSpeaker(learnerSpeaker);
    const other = subtitles.find(item => {
        const speaker = normalizeSpeaker(item.speaker);
        return speaker && speaker !== learner;
    })?.speaker;
    return other || '客户';
}
function normalizeSpeaker(value) {
    return String(value || '').trim().toLowerCase();
}
function selectDialogueFocusCues(cues) {
    if (cues.length <= 3)
        return cues;
    return cues
        .map(cue => ({ cue, score: scoreDialogueCue(cue.text) }))
        .sort((left, right) => right.score - left.score || left.cue.cueIndex - right.cue.cueIndex)
        .slice(0, 3)
        .map(item => item.cue)
        .sort((left, right) => left.cueIndex - right.cueIndex);
}
function scoreDialogueCue(value) {
    const text = String(value || '').trim();
    const words = text.match(/[A-Za-z0-9']+/g) ?? [];
    let score = Math.min(words.length, 18) * 0.2;
    if (/\b(quote|quotation|price|pricing|order|sample|delivery|shipment|payment|terms|schedule|feedback|confirm|follow[ -]?up|details|email|contract|quantity|moq|discount|deadline|production|issue|problem|solution|proposal|specification|requirement|next step|take a look)\b/i.test(text)) {
        score += 6;
    }
    if (/\b(can|could|would|will|shall|need|want|wanted|suggest|recommend|check|review|send|share|arrange|discuss|proceed|move forward|let me know|feel free)\b/i.test(text)) {
        score += 2.5;
    }
    if (text.includes('?'))
        score += 1;
    if (words.length >= 8)
        score += 1.5;
    if (words.length <= 4)
        score -= 3;
    if (isSocialOnlyCue(text))
        score -= 10;
    return score;
}
function isSocialOnlyCue(value) {
    const text = value.trim().toLowerCase();
    return /^(hi|hello|hey|good (morning|afternoon|evening)|how are you|how's it going|how is it going|nice to meet you|yes|no|okay|ok|sure|absolutely|will do)[\s,.!?'-]*$/.test(text)
        || /^(i'm|i am) (doing )?(good|well|fine|great)[\s,.!?'-]*$/.test(text)
        || /^(great,?\s*)?(thanks|thank you|appreciate (it|that))[\s,.!?'-]*$/.test(text);
}
function normalizePhraseBatchSize(value) {
    const size = Math.floor(Number(value) || DEFAULT_PHRASE_BATCH_SIZE);
    return Math.max(1, Math.min(20, size));
}
function normalizePhraseBatchStart(value, cueCount, batchSize) {
    if (!cueCount)
        return 0;
    const requested = Math.max(0, Math.floor(Number(value) || 0));
    const aligned = Math.floor(requested / batchSize) * batchSize;
    return Math.min(aligned, Math.floor((cueCount - 1) / batchSize) * batchSize);
}
function truncateText(value, maxLength) {
    if (value.length <= maxLength) {
        return value;
    }
    return `${value.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}
