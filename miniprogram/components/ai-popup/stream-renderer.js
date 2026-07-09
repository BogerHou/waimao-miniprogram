"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.drainStreamingBuffer = drainStreamingBuffer;
function drainStreamingBuffer(options) {
    const pendingText = String(options.pendingText || '');
    if (!pendingText) {
        return {
            displayedText: options.displayedText,
            pendingText: '',
        };
    }
    const charsPerTick = options.flushAll
        ? pendingText.length
        : Math.max(1, Math.floor(options.charsPerTick || 1));
    const nextChunk = pendingText.slice(0, charsPerTick);
    return {
        displayedText: `${options.displayedText || ''}${nextChunk}`,
        pendingText: pendingText.slice(nextChunk.length),
    };
}
