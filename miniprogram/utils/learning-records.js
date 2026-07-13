"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatStudyDuration = formatStudyDuration;
function formatStudyDuration(secondsInput) {
    const seconds = Math.max(0, Math.floor(Number(secondsInput) || 0));
    if (seconds < 60)
        return `${seconds} 秒`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60)
        return `${minutes} 分钟`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
}
