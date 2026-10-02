"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.freeCoursePagesTestDone = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_vm_1 = __importDefault(require("node:vm"));
const flags = __importStar(require("../miniprogram/config/feature-flags"));
const search = __importStar(require("../miniprogram/utils/scene-search"));
// Execute generated page code with isolated platform adapters. No shared wx,
// production requests, or user storage is used by these page regressions.
function fixture(pageName) {
    let page;
    let listener;
    let redirects = 0;
    let shareAudioEnabled;
    const state = {
        token: null, user: null, progress: null, fullAccess: false,
        appConfig: { interactiveFeaturesEnabled: true, allCoursesFree: true,
            home: { unlockPromptEnabled: true, practiceHelpEnabled: true, ads: [] },
            courseDetail: { shadowModeEnabled: true } },
    };
    const modules = {
        '../../config/feature-flags': flags,
        '../../utils/scene-search': search,
        '../../utils/storage': { debounce: (fn) => fn },
        '../../store/index': {
            getState: () => state,
            subscribe: (fn) => { listener = fn; fn(state); return () => { listener = undefined; }; },
            DEFAULT_HOME_AD: {},
        },
        '../../utils/share': { enablePageShareMenu: () => { } },
        '../../utils/share-card': {
            buildIndexShareCardModel: (input) => { shareAudioEnabled = input.audioPlaybackEnabled; return {}; },
        },
        '../../utils/share-poster': { renderSharePoster: async () => '' },
    };
    const app = { globalData: { readyPromise: Promise.resolve() } };
    node_vm_1.default.runInNewContext(node_fs_1.default.readFileSync(node_path_1.default.resolve(__dirname, `../miniprogram/pages/${pageName}/${pageName}.js`), 'utf8'), { exports: {}, require: (name) => modules[name] ?? {}, Page: (value) => { page = value; },
        getApp: () => app, console, wx: { switchTab: () => { redirects++; } } });
    page.setData = (value) => Object.assign(page.data, value);
    page.scheduleShareImage = () => { };
    return { page, state, changed: () => listener?.(state),
        redirects: () => redirects, shareAudioEnabled: () => shareAudioEnabled };
}
async function run() {
    const index = fixture('index');
    const chapters = [{ id: 'chapter-02', number: 2, label: '第二章', title: '课程',
            free: true, trialFree: false, scenes: [{ id: 'scene-2', title: '场景', free: true }] }];
    index.page.handleStoreUpdate(index.state, 1, chapters);
    strict_1.default.equal(index.page.data.chapters[0].locked, false);
    strict_1.default.equal(index.page.data.membershipUnlockEnabled, false);
    strict_1.default.equal(index.page.data.showUnlockPrompt, false);
    strict_1.default.equal(index.page.data.audioPlaybackEnabled, true);
    strict_1.default.equal(index.page.data.showPracticeHelp, true);
    await index.page.generateShareImage();
    strict_1.default.equal(index.shareAudioEnabled(), true, 'Free courses keep audio-enabled share copy');
    index.state.appConfig.allCoursesFree = false;
    index.page.handleStoreUpdate(index.state);
    strict_1.default.equal(index.page.data.chapters[0].locked, true, 'Returning to paid locks a previously free projection');
    strict_1.default.equal(index.page.data.showUnlockPrompt, true);
    index.state.fullAccess = true;
    index.page.handleStoreUpdate(index.state);
    strict_1.default.equal(index.page.data.chapters[0].locked, false, 'Members retain access when the free campaign ends');
    const learning = fixture('learning');
    learning.page.onLoad();
    strict_1.default.equal(learning.page.data.membershipUnlockEnabled, false);
    strict_1.default.equal(learning.page.data.audioPlaybackEnabled, true);
    learning.state.appConfig.allCoursesFree = false;
    learning.changed();
    strict_1.default.equal(learning.page.data.membershipUnlockEnabled, true, 'Visible learning page reacts to config refresh');
    learning.page.onUnload();
    const unlock = fixture('unlock');
    await unlock.page.onLoad();
    strict_1.default.equal(unlock.redirects(), 1, 'A free-mode unlock deep link returns to courses before asking for login');
    await unlock.page.handleRedeem();
    strict_1.default.equal(unlock.redirects(), 2, 'Free mode never sends an invite redemption request');
    console.log('free course page tests passed.');
}
exports.freeCoursePagesTestDone = run();
