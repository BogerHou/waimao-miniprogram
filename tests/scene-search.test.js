"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const scene_search_1 = require("../miniprogram/utils/scene-search");
const chapters = [
    {
        id: 'chapter-1', number: 1, label: '第一章', title: '电话沟通', audio: '', duration: 0, free: true,
        scenes: [
            { id: 'scene-1', index: 1, title: '报价后的电话跟进', cueCount: 1, duration: 1, free: true },
            { id: 'scene-2', index: 2, title: '催促紧急事宜', cueCount: 1, duration: 1, free: true },
        ],
    },
    {
        id: 'chapter-2', number: 2, label: '第二章', title: '展会接待', audio: '', duration: 0, free: false,
        scenes: [{ id: 'scene-3', index: 1, title: '介绍新产品', cueCount: 1, duration: 1, free: false }],
    },
];
strict_1.default.equal((0, scene_search_1.countChapterScenes)((0, scene_search_1.filterChaptersBySceneQuery)(chapters, '电话')), 2);
strict_1.default.equal((0, scene_search_1.filterChaptersBySceneQuery)(chapters, '报价')[0]?.scenes[0]?.id, 'scene-1');
strict_1.default.equal((0, scene_search_1.filterChaptersBySceneQuery)(chapters, '展会')[0]?.id, 'chapter-2');
strict_1.default.equal((0, scene_search_1.filterChaptersBySceneQuery)(chapters, '不存在').length, 0);
console.log('scene search tests passed.');
