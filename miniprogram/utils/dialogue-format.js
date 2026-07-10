"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SPEAKER_TONE_CLASSES = void 0;
exports.formatKnowledgeDialogue = formatKnowledgeDialogue;
exports.formatKnowledgeDialogueFromSubtitles = formatKnowledgeDialogueFromSubtitles;
exports.resolveSpeakerToneClass = resolveSpeakerToneClass;
exports.splitDialogueSentences = splitDialogueSentences;
exports.splitPairedDialogueSentences = splitPairedDialogueSentences;
exports.buildTimedDialogueSentences = buildTimedDialogueSentences;
exports.SPEAKER_TONE_CLASSES = [
    'dialogue-tone-0',
    'dialogue-tone-1',
    'dialogue-tone-2',
    'dialogue-tone-3',
    'dialogue-tone-4',
    'dialogue-tone-5',
];
const CLOSING_MARKS = new Set(['"', "'", '”', '’', ')', '）', ']', '】']);
const SENTENCE_PUNCTUATION = new Set(['.', '?', '!', '。', '？', '！', '…']);
const EXTRA_PUNCTUATION = new Set(['.', '?', '!', '。', '？', '！', '…', '·']);
function formatKnowledgeDialogue(items = []) {
    const speakerToneIndexes = new Map();
    return items
        .filter(item => item && String(item.text ?? '').trim())
        .map((item, itemIndex) => {
        const speaker = String(item.speaker || 'Speaker').trim() || 'Speaker';
        const speakerKey = normalizeSpeakerKey(speaker);
        const sentences = splitPairedDialogueSentences(item.text, item.translation ?? '')
            .map((sentence, sentenceIndex) => ({
            id: `${itemIndex}-sentence-${sentenceIndex}`,
            ...sentence,
        }));
        return {
            id: `${speakerKey}-${itemIndex}`,
            speaker,
            toneClass: resolveSpeakerToneClass(speaker, speakerToneIndexes),
            sentences,
            textSegments: buildSegments(item.text, `${itemIndex}-text`),
            translationSegments: buildSegments(item.translation ?? '', `${itemIndex}-translation`),
        };
    });
}
function formatKnowledgeDialogueFromSubtitles(items = []) {
    const speakerToneIndexes = new Map();
    const groups = [];
    items.forEach((item, itemIndex) => {
        const text = String(item?.text ?? '').trim();
        if (!text) {
            return;
        }
        const speaker = String(item.speaker || 'Speaker').trim() || 'Speaker';
        const speakerKey = normalizeSpeakerKey(speaker);
        const translation = String(item.translation ?? '').trim();
        const previous = groups[groups.length - 1];
        const group = previous && normalizeSpeakerKey(previous.speaker) === speakerKey
            ? previous
            : {
                id: `${speakerKey}-subtitle-group-${groups.length}`,
                speaker,
                toneClass: resolveSpeakerToneClass(speaker, speakerToneIndexes),
                sentences: [],
                textSegments: [],
                translationSegments: [],
            };
        if (group !== previous) {
            groups.push(group);
        }
        const segmentId = item.id || `${itemIndex}`;
        group.sentences.push({
            id: `subtitle-sentence-${segmentId}`,
            text,
            translation,
        });
        group.textSegments.push({
            id: `subtitle-text-${segmentId}`,
            text,
        });
        if (translation) {
            group.translationSegments.push({
                id: `subtitle-translation-${segmentId}`,
                text: translation,
            });
        }
    });
    return groups;
}
function resolveSpeakerToneClass(speaker, speakerToneIndexes) {
    const speakerKey = normalizeSpeakerKey(speaker);
    let toneIndex = speakerToneIndexes.get(speakerKey);
    if (toneIndex === undefined) {
        toneIndex = speakerToneIndexes.size % exports.SPEAKER_TONE_CLASSES.length;
        speakerToneIndexes.set(speakerKey, toneIndex);
    }
    return exports.SPEAKER_TONE_CLASSES[toneIndex];
}
function splitDialogueSentences(input) {
    const text = String(input ?? '').replace(/\s+/g, ' ').trim();
    if (!text) {
        return [];
    }
    const parts = [];
    let start = 0;
    let index = 0;
    while (index < text.length) {
        const char = text[index];
        if (SENTENCE_PUNCTUATION.has(char) && shouldSplitAt(text, index, start)) {
            let end = index + 1;
            while (end < text.length && EXTRA_PUNCTUATION.has(text[end])) {
                end += 1;
            }
            while (end < text.length && CLOSING_MARKS.has(text[end])) {
                end += 1;
            }
            const part = text.slice(start, end).trim();
            if (part) {
                parts.push(part);
            }
            start = end;
            while (start < text.length && /\s/.test(text[start])) {
                start += 1;
            }
            index = start;
            continue;
        }
        index += 1;
    }
    const tail = text.slice(start).trim();
    if (tail) {
        parts.push(tail);
    }
    return parts.length ? parts : [text];
}
function splitPairedDialogueSentences(text, translation = '') {
    const textParts = splitDialogueSentences(text);
    const translationParts = splitDialogueSentences(translation);
    if (!textParts.length && !translationParts.length) {
        return [];
    }
    if (!textParts.length) {
        return translationParts.map(item => ({
            text: '',
            translation: item,
        }));
    }
    const canPairTranslations = translationParts.length === textParts.length;
    return textParts.map((item, index) => ({
        text: item,
        translation: canPairTranslations
            ? translationParts[index] ?? ''
            : textParts.length === 1
                ? translationParts.join('')
                : translationParts[index] ?? '',
    }));
}
function buildTimedDialogueSentences(options) {
    const pairs = splitPairedDialogueSentences(options.text, options.translation ?? '');
    if (!pairs.length) {
        return [];
    }
    const start = Number.isFinite(options.start) ? options.start : 0;
    const end = Number.isFinite(options.end) ? options.end : start;
    const duration = Math.max(0, end - start);
    if (pairs.length === 1 || duration <= 0) {
        return pairs.map(pair => ({
            ...pair,
            start,
            end,
        }));
    }
    const weights = pairs.map(pair => getSentenceTimingWeight(pair.text || pair.translation));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || pairs.length;
    let consumedWeight = 0;
    return pairs.map((pair, index) => {
        const segmentStart = index === 0
            ? start
            : start + (duration * consumedWeight / totalWeight);
        consumedWeight += weights[index] || 1;
        const segmentEnd = index === pairs.length - 1
            ? end
            : start + (duration * consumedWeight / totalWeight);
        return {
            ...pair,
            start: roundTime(segmentStart),
            end: roundTime(Math.max(segmentEnd, segmentStart)),
        };
    });
}
function buildSegments(input, prefix) {
    return splitDialogueSentences(input).map((text, index) => ({
        id: `${prefix}-${index}`,
        text,
    }));
}
function normalizeSpeakerKey(speaker) {
    return String(speaker || 'Speaker').trim().toLowerCase() || 'speaker';
}
function getSentenceTimingWeight(input) {
    const compact = String(input || '').replace(/\s+/g, '');
    return Math.max(1, compact.length);
}
function roundTime(value) {
    return Math.round(value * 1000) / 1000;
}
function shouldSplitAt(text, index, segmentStart) {
    if (text[index] !== '.') {
        return true;
    }
    const prev = text[index - 1] ?? '';
    const next = text[index + 1] ?? '';
    if (isDigit(prev) && isDigit(next)) {
        return false;
    }
    const token = text.slice(findTokenStart(text, index, segmentStart), index + 1);
    if (token.includes('@')) {
        return false;
    }
    const nextVisible = findNextVisibleChar(text, index + 1);
    if (nextVisible && isAsciiLowercase(nextVisible) && isAsciiLetter(prev)) {
        return false;
    }
    return true;
}
function findTokenStart(text, index, fallback) {
    for (let cursor = index; cursor >= fallback; cursor -= 1) {
        if (/\s/.test(text[cursor])) {
            return cursor + 1;
        }
    }
    return fallback;
}
function findNextVisibleChar(text, start) {
    for (let index = start; index < text.length; index += 1) {
        if (!/\s/.test(text[index])) {
            return text[index];
        }
    }
    return '';
}
function isDigit(char) {
    return /^[0-9]$/.test(char);
}
function isAsciiLetter(char) {
    return /^[A-Za-z]$/.test(char);
}
function isAsciiLowercase(char) {
    return /^[a-z]$/.test(char);
}
