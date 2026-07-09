"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatKnowledgeDialogue = formatKnowledgeDialogue;
exports.splitDialogueSentences = splitDialogueSentences;
const SPEAKER_TONE_CLASSES = [
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
        const speakerKey = speaker.toLowerCase();
        let toneIndex = speakerToneIndexes.get(speakerKey);
        if (toneIndex === undefined) {
            toneIndex = speakerToneIndexes.size % SPEAKER_TONE_CLASSES.length;
            speakerToneIndexes.set(speakerKey, toneIndex);
        }
        return {
            id: `${speakerKey}-${itemIndex}`,
            speaker,
            toneClass: SPEAKER_TONE_CLASSES[toneIndex],
            textSegments: buildSegments(item.text, `${itemIndex}-text`),
            translationSegments: buildSegments(item.translation ?? '', `${itemIndex}-translation`),
        };
    });
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
function buildSegments(input, prefix) {
    return splitDialogueSentences(input).map((text, index) => ({
        id: `${prefix}-${index}`,
        text,
    }));
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
