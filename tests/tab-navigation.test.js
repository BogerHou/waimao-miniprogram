"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const root = node_path_1.default.resolve(__dirname, '..');
const appJson = JSON.parse(node_fs_1.default.readFileSync(node_path_1.default.join(root, 'miniprogram/app.json'), 'utf8'));
const tabs = appJson.tabBar?.list ?? [];
strict_1.default.deepEqual(tabs.map(item => item.pagePath), [
    'pages/index/index',
    'pages/review/review',
    'pages/learning/learning',
]);
strict_1.default.deepEqual(tabs.map(item => item.text), ['课程', '复习', '我的']);
for (const tab of tabs) {
    for (const iconPath of [tab.iconPath, tab.selectedIconPath]) {
        strict_1.default.ok(iconPath, `${tab.text} tab should configure both icon states`);
        const absolutePath = node_path_1.default.join(root, 'miniprogram', iconPath);
        const buffer = node_fs_1.default.readFileSync(absolutePath);
        strict_1.default.equal(buffer.toString('hex', 1, 4), '504e47', `${iconPath} should be a PNG`);
        strict_1.default.ok(buffer.length < 40 * 1024, `${iconPath} should stay below the tab icon limit`);
    }
}
console.log('tab navigation tests passed.');
