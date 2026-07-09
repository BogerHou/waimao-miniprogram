"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatKnowledgeContent = formatKnowledgeContent;
exports.splitKnowledgeLines = splitKnowledgeLines;
exports.parsePhraseItems = parsePhraseItems;
exports.splitPhraseLine = splitPhraseLine;
exports.parseCorrectionBlock = parseCorrectionBlock;
exports.stripKnowledgeHeading = stripKnowledgeHeading;
function formatKnowledgeContent(content = {}) {
    const backgroundParagraphs = toTextLines(splitKnowledgeLines(content.background), 'background');
    const phraseItems = parsePhraseItems(content.phrases);
    const correction = parseCorrectionBlock(content.correction);
    const noteParagraphs = toTextLines(stripKnowledgeHeading(content.notes, /^毅冰补充[:：]?/), 'note');
    return {
        backgroundParagraphs,
        phraseItems,
        correction,
        noteParagraphs,
        hasKnowledgeContent: Boolean(backgroundParagraphs.length
            || phraseItems.length
            || correction.hasContent
            || noteParagraphs.length),
    };
}
function splitKnowledgeLines(text) {
    return String(text || '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);
}
function parsePhraseItems(text) {
    const items = [];
    let current = null;
    for (const line of splitKnowledgeLines(text)) {
        if (isKnowledgeHeadingLine(line)) {
            break;
        }
        if (isPhraseStartLine(line)) {
            if (current) {
                items.push(current);
            }
            current = splitPhraseLine(line);
            continue;
        }
        if (current) {
            current.definition = `${current.definition}${line}`.trim();
        }
        else {
            current = {
                term: '',
                definition: line,
            };
        }
    }
    if (current) {
        items.push(current);
    }
    return items
        .filter(item => item.term || item.definition)
        .map((item, index) => ({
        id: `phrase-${index}`,
        term: item.term,
        definition: item.definition,
    }));
}
function splitPhraseLine(line) {
    const value = String(line || '').trim();
    const chineseIndex = value.search(/[\u3400-\u9fff]/);
    if (chineseIndex > 0) {
        return {
            term: value.slice(0, chineseIndex).trim(),
            definition: value.slice(chineseIndex).trim(),
        };
    }
    const [term = value, ...rest] = value.split(/\s+/);
    return {
        term: chineseIndex === 0 ? '' : term.trim(),
        definition: chineseIndex === 0 ? value : rest.join(' ').trim(),
    };
}
function parseCorrectionBlock(text) {
    const grouped = {
        prompt: [],
        chinglish: [],
        native: [],
        extra: [],
    };
    let mode = 'prompt';
    splitKnowledgeLines(text).forEach(line => {
        if (/^Chinglish Correction/.test(line)) {
            return;
        }
        if (/^【Chinglish】$/i.test(line)) {
            mode = 'chinglish';
            return;
        }
        if (/^【Native English】$/i.test(line)) {
            mode = 'native';
            return;
        }
        grouped[mode].push(line);
    });
    const promptLines = toTextLines(mergeWrappedLines(grouped.prompt), 'correction-prompt');
    const chinglishLines = toTextLines(mergeWrappedLines(grouped.chinglish), 'correction-chinglish');
    const nativeLines = toTextLines(mergeWrappedLines(grouped.native), 'correction-native');
    const extraLines = toTextLines(mergeWrappedLines(grouped.extra), 'correction-extra');
    return {
        hasContent: Boolean(promptLines.length || chinglishLines.length || nativeLines.length || extraLines.length),
        promptLines,
        chinglishLines,
        nativeLines,
        extraLines,
    };
}
function stripKnowledgeHeading(text, heading) {
    return splitKnowledgeLines(text).filter(line => !heading.test(line));
}
function toTextLines(lines, prefix) {
    return lines
        .map(line => line.trim())
        .filter(Boolean)
        .map((text, index) => ({
        id: `${prefix}-${index}`,
        text,
    }));
}
function isKnowledgeHeadingLine(line) {
    return /^Chinglish Correction/.test(line)
        || /^毅冰补充[:：]?/.test(line)
        || /^【(?:Chinglish|Native English)】$/i.test(line);
}
function isPhraseStartLine(line) {
    return /^[A-Za-z0-9]/.test(line);
}
function mergeWrappedLines(lines) {
    return lines.length ? [lines.join(' ').replace(/\s+/g, ' ').trim()] : [];
}
