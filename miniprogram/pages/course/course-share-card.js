"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCourseShareCardModel = buildCourseShareCardModel;
const DEFAULT_SNIPPET = '外贸英语影子跟读练习，打开继续学习。';
function normalizeText(value) {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .trim();
}
function truncateText(value, maxLength) {
    if (value.length <= maxLength) {
        return value;
    }
    if (maxLength <= 3) {
        return value.slice(0, maxLength);
    }
    return `${value.slice(0, maxLength - 3).trimEnd()}...`;
}
function buildCourseShareCardModel(options) {
    const maxSnippetLength = Math.max(12, options.maxSnippetLength ?? 64);
    const currentText = normalizeText(options.currentText);
    const leadText = normalizeText(options.leadText);
    const snippetSource = currentText || leadText || DEFAULT_SNIPPET;
    return {
        title: normalizeText(options.title) || '外贸英语影子跟读',
        tagLabel: normalizeText(options.tag) || '外贸英语',
        modeLabel: options.playMode === 'shadow' ? '影子跟读' : '逐句跟读',
        snippet: truncateText(snippetSource, maxSnippetLength),
    };
}
