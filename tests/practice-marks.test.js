"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const practice_marks_1 = require("../miniprogram/utils/practice-marks");
const next_scene_1 = require("../miniprogram/utils/next-scene");
// ==================== 星标存储模型 ====================
// normalize：非法输入回退空表，去重、剔除非字符串
strict_1.default.deepEqual((0, practice_marks_1.normalizeStarredCueMap)(null), {});
strict_1.default.deepEqual((0, practice_marks_1.normalizeStarredCueMap)("junk"), {});
strict_1.default.deepEqual((0, practice_marks_1.normalizeStarredCueMap)([1, 2]), {});
strict_1.default.deepEqual((0, practice_marks_1.normalizeStarredCueMap)({ "scene-01": ["s1", "s1", "", 3, "s2"], "scene-02": "junk", "scene-03": [] }), { "scene-01": ["s1", "s2"] });
// toggle：加星、去星、清空后删除课程键
{
    let map = {};
    map = (0, practice_marks_1.toggleStarredCue)(map, "scene-01", "s1");
    strict_1.default.deepEqual((0, practice_marks_1.getStarredCueIds)(map, "scene-01"), ["s1"]);
    strict_1.default.equal((0, practice_marks_1.isCueStarred)(map, "scene-01", "s1"), true);
    map = (0, practice_marks_1.toggleStarredCue)(map, "scene-01", "s2");
    strict_1.default.deepEqual((0, practice_marks_1.getStarredCueIds)(map, "scene-01"), ["s1", "s2"]);
    map = (0, practice_marks_1.toggleStarredCue)(map, "scene-01", "s1");
    strict_1.default.deepEqual((0, practice_marks_1.getStarredCueIds)(map, "scene-01"), ["s2"]);
    map = (0, practice_marks_1.toggleStarredCue)(map, "scene-01", "s2");
    strict_1.default.deepEqual(map, {});
    strict_1.default.equal((0, practice_marks_1.isCueStarred)(map, "scene-01", "s2"), false);
}
// ==================== 下一节解析 ====================
const chapters = [
    {
        id: "chapter-01",
        number: 1,
        label: "第 1 章",
        title: "开发客户",
        audio: "",
        duration: 0,
        free: true,
        scenes: [
            { id: "scene-01", index: 1, title: "初次联系", cueCount: 10, duration: 60, free: true },
            { id: "scene-02", index: 2, title: "跟进报价", cueCount: 12, duration: 70, free: true },
        ],
    },
    {
        id: "chapter-02",
        number: 2,
        label: "第 2 章",
        title: "价格谈判",
        audio: "",
        duration: 0,
        free: false,
        locked: true,
        scenes: [
            { id: "scene-03", index: 1, title: "还价", cueCount: 9, duration: 55, free: false, locked: true },
            { id: "scene-04", index: 2, title: "让步", cueCount: 8, duration: 50, free: false, locked: false },
        ],
    },
];
// 同章下一节
strict_1.default.deepEqual((0, next_scene_1.resolveNextScene)(chapters, "scene-01"), {
    id: "scene-02",
    title: "跟进报价",
    chapterLabel: "第 1 章",
});
// 跨章时跳过锁定小节，取第一个未锁定的
strict_1.default.deepEqual((0, next_scene_1.resolveNextScene)(chapters, "scene-02"), {
    id: "scene-04",
    title: "让步",
    chapterLabel: "第 2 章",
});
// 最后一节 / 未知小节返回 null
strict_1.default.equal((0, next_scene_1.resolveNextScene)(chapters, "scene-04"), null);
strict_1.default.equal((0, next_scene_1.resolveNextScene)(chapters, "missing"), null);
console.log("practice marks and next scene tests passed.");
