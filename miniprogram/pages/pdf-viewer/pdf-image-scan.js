"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldContinuePdfImageScan = shouldContinuePdfImageScan;
function shouldContinuePdfImageScan(options) {
    return options.statusCode === 200;
}
