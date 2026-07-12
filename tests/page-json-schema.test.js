"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const INVALID_PAGE_JSON_KEYS = ["enableShareAppMessage", "enableShareTimeline"];
function listPageJsonFiles() {
    const pagesDir = node_path_1.default.join(process.cwd(), "miniprogram", "pages");
    return (0, node_fs_1.readdirSync)(pagesDir, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => node_path_1.default.join(pagesDir, entry.name, `${entry.name}.json`))
        .filter(filePath => (0, node_fs_1.existsSync)(filePath));
}
function testPageJsonDoesNotUseUnsupportedShareKeys() {
    for (const filePath of listPageJsonFiles()) {
        const pageConfig = JSON.parse((0, node_fs_1.readFileSync)(filePath, "utf8"));
        for (const key of INVALID_PAGE_JSON_KEYS) {
            strict_1.default.equal(pageConfig[key], undefined, `${filePath} should not contain ${key}`);
        }
    }
}
function testGlobalConfigurationDoesNotUseUnsupportedRecordPermission() {
    const appConfig = JSON.parse((0, node_fs_1.readFileSync)(node_path_1.default.join(process.cwd(), "miniprogram", "app.json"), "utf8"));
    strict_1.default.equal(appConfig.permission?.["scope.record"], undefined, "app.json permission only supports documented permission keys; recording is authorized at runtime");
}
function testProjectConfigurationKeepsImportedModulesInBuilds() {
    const projectConfig = JSON.parse((0, node_fs_1.readFileSync)(node_path_1.default.join(process.cwd(), "project.config.json"), "utf8"));
    strict_1.default.equal(projectConfig.setting?.ignoreDevUnusedFiles, false);
    strict_1.default.equal(projectConfig.setting?.ignoreUploadUnusedFiles, false);
}
testPageJsonDoesNotUseUnsupportedShareKeys();
testGlobalConfigurationDoesNotUseUnsupportedRecordPermission();
testProjectConfigurationKeepsImportedModulesInBuilds();
console.log("page json schema tests passed.");
