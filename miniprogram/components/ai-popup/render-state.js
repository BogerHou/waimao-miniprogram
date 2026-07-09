"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAssistantDisplayState = getAssistantDisplayState;
function getAssistantDisplayState(message) {
    const parsedNodes = Array.isArray(message?.parsedNodes) ? message.parsedNodes : [];
    const hasParsedNodes = parsedNodes.length > 0;
    const text = String(message?.displayText || message?.content || '');
    const showParsedNodes = !!message && message.role === 'assistant' && !message.isStreaming && hasParsedNodes;
    const showStreamingText = !!message && message.role === 'assistant' && !showParsedNodes;
    return {
        text,
        showParsedNodes,
        showStreamingText,
    };
}
