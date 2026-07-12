"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const course_completion_poster_1 = require("../miniprogram/pages/course/course-completion-poster");
strict_1.default.equal((0, course_completion_poster_1.buildCompletionStatsLabel)({ totalCues: 12, practicedCount: 3 }), '共 12 句 · 本次精练 3 句');
strict_1.default.equal((0, course_completion_poster_1.buildCompletionStatsLabel)({ totalCues: 12, practicedCount: 0 }), '共 12 句');
console.log('course completion poster tests passed.');
