"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenizeSubtitle = tokenizeSubtitle;
const TOKEN_PATTERN = /(?:https?:\/\/|www\.)[^\s]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|[A-Za-z]+(?:['’-][A-Za-z]+)*/gi;
function tokenizeSubtitle(text) {
    const tokens = [];
    let lastIndex = 0;
    let match;
    while ((match = TOKEN_PATTERN.exec(text))) {
        if (match.index > lastIndex) {
            appendNonWord(tokens, text.slice(lastIndex, match.index));
        }
        const raw = match[0];
        const nextCharacter = text[match.index + raw.length] ?? '';
        const isStructuredValue = raw.includes('@') || /^(?:https?:\/\/|www\.)/i.test(raw);
        const isModelPrefix = /\d/.test(nextCharacter);
        if (isStructuredValue || isModelPrefix) {
            appendNonWord(tokens, raw);
        }
        else {
            tokens.push({
                text: raw,
                word: raw.replace(/[’‘]/g, "'").toLowerCase(),
                isWord: true,
            });
        }
        lastIndex = match.index + raw.length;
    }
    if (lastIndex < text.length) {
        appendNonWord(tokens, text.slice(lastIndex));
    }
    return tokens;
}
function appendNonWord(tokens, text) {
    if (!text)
        return;
    const previous = tokens[tokens.length - 1];
    if (previous && !previous.isWord) {
        previous.text += text;
        return;
    }
    tokens.push({ text, isWord: false });
}
