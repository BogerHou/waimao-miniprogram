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
strict_1.default.equal((0, learning_records_1.resolveIntensity)(0), 0);
strict_1.default.equal((0, learning_records_1.resolveIntensity)(300), 2);
const calendar = (0, learning_records_1.buildRecentCalendar)([
    { date: '2026-07-11', studySeconds: 600, practiceCount: 4, sessionCount: 2 },
], { totalDays: 3, today: new Date(2026, 6, 12) });
strict_1.default.equal(calendar.length, 7);
strict_1.default.deepEqual(calendar.slice(-3).map(item => item.date), ['2026-07-10', '2026-07-11', '2026-07-12']);
strict_1.default.equal(calendar[5]?.intensity, 2);
strict_1.default.equal(calendar[6]?.isToday, true);
console.log('learning records tests passed.');
