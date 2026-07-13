"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const learning_records_1 = require("../miniprogram/utils/learning-records");
strict_1.default.equal((0, learning_records_1.formatStudyDuration)(59), '59 秒');
strict_1.default.equal((0, learning_records_1.formatStudyDuration)(60), '1 分钟');
strict_1.default.equal((0, learning_records_1.formatStudyDuration)(7260), '2 小时 1 分钟');
console.log('learning duration tests passed.');
