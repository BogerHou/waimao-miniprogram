"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const pdf_image_scan_1 = require("../miniprogram/pages/pdf-viewer/pdf-image-scan");
function testContinuesWhenPageExists() {
    strict_1.default.equal((0, pdf_image_scan_1.shouldContinuePdfImageScan)({ foundCount: 2, statusCode: 200 }), true);
}
function testStopsAfterFirstMissingPageOnceImagesFound() {
    strict_1.default.equal((0, pdf_image_scan_1.shouldContinuePdfImageScan)({ foundCount: 3, statusCode: 404 }), false);
}
function testAllowsInitialMissToFinishGracefully() {
    strict_1.default.equal((0, pdf_image_scan_1.shouldContinuePdfImageScan)({ foundCount: 0, statusCode: 404 }), false);
}
testContinuesWhenPageExists();
testStopsAfterFirstMissingPageOnceImagesFound();
testAllowsInitialMissToFinishGracefully();
console.log("pdf image scan tests passed.");
