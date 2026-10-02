"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listeningPageTestDone = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_vm_1 = __importDefault(require("node:vm"));
const feature_flags_1 = require("../miniprogram/config/feature-flags");
function generated(relative) {
    return node_fs_1.default.readFileSync(node_path_1.default.resolve(__dirname, '../miniprogram', relative), 'utf8');
}
function checkTemplateExpressions() {
    // WXML does not decode HTML entities inside bindings. Keep text entities valid,
    // but catch escaped operators even when this machine has no WeChat compiler.
    const root = node_path_1.default.resolve(__dirname, '../miniprogram');
    function checkDirectory(directory) {
        for (const entry of node_fs_1.default.readdirSync(directory, { withFileTypes: true })) {
            const file = node_path_1.default.join(directory, entry.name);
            if (entry.isDirectory())
                checkDirectory(file);
            else if (entry.isFile() && entry.name.endsWith('.wxml')) {
                const source = node_fs_1.default.readFileSync(file, 'utf8');
                for (const binding of source.match(/\{\{[\s\S]*?\}\}/g) || []) {
                    strict_1.default.doesNotMatch(binding, /&(?:amp|lt|gt);/, `${node_path_1.default.relative(root, file)}: use raw operators in WXML expressions, not HTML entities`);
                }
            }
        }
    }
    checkDirectory(root);
}
const catalog = {
    data: [
        {
            id: 'course', title: '外贸口语课程全集', description: '连续听课程', category: '课程', coverUrl: '',
            duration: 1200, trackCount: 2,
            tracks: [
                { id: 'paid', title: '第二章', duration: 600, free: false, locked: true, transcript: 'locked text' },
                { id: 'free', title: '第一章', duration: 600, free: true, locked: false, transcript: 'Hello.' },
            ],
        },
        { id: 'phone', title: '商务电话', description: '', category: '电话', coverUrl: '', duration: 60, trackCount: 1,
            tracks: [{ id: 'call', title: '打招呼', duration: 60, free: true, locked: false }] },
    ],
    appConfig: { interactiveFeaturesEnabled: true, allCoursesFree: false, home: {}, courseDetail: { shadowModeEnabled: true } },
};
function playerFixture() {
    const state = {
        active: false, albumId: 'course', albumTitle: '外贸口语课程全集', trackId: 'free', trackTitle: '第一章',
        coverUrl: '', playing: false, loading: false, position: 75, duration: 600, error: null,
        mode: 'sequence', sleepEndsAt: null, queue: [], listenedSeconds: 120,
    };
    const calls = [];
    let listener;
    let unsubscribed = 0;
    const emit = () => listener?.(state);
    const player = {
        getListeningState: () => ({ ...state }),
        subscribeListening: (fn) => {
            listener = fn;
            fn(state);
            return () => { listener = undefined; unsubscribed++; };
        },
        playListeningAlbum: async (...args) => { calls.push(['play', ...args]); },
        toggleListeningPlayback: async () => { calls.push(['toggle']); },
        nextListeningTrack: async () => { calls.push(['next']); },
        previousListeningTrack: async () => { calls.push(['previous']); },
        seekListeningTo: (value) => { calls.push(['seek', value]); },
        setListeningRepeatMode: (value) => { state.mode = value; emit(); },
        setListeningSleepTimer: (value) => { calls.push(['timer', value]); },
        stopListeningPlayback: () => { calls.push(['stop']); },
    };
    return { state, calls, player, emit, unsubscribed: () => unsubscribed };
}
async function checkApiBoundary() {
    let reply = catalog;
    const requests = [];
    const exports = {};
    node_vm_1.default.runInNewContext(generated('utils/listening-api.js'), {
        exports,
        require: (name) => name === '../config/env' ? { API_BASE_URL: 'https://api.example.test' } : {
            request: async (options) => { requests.push(options); return reply; },
        },
    });
    reply = { ...catalog, data: [{ ...catalog.data[0], coverUrl: '/static/cover.jpg' }] };
    const response = await exports.fetchListeningAlbums();
    strict_1.default.equal(response.data[0].coverUrl, 'https://api.example.test/static/cover.jpg');
    reply = {
        album: { id: 'a/b', title: '课程', coverUrl: '//cdn.example.test/cover.jpg' },
        tracks: [{ id: 'track', title: '章节', duration: 30, audioSources: [
                    { provider: 'server', url: '/signed/audio?token=short-lived' },
                    { provider: 'qiniu', url: 'https://cdn.example.test/audio?signature=short-lived' },
                ] }], expiresAt: 123,
    };
    const playback = await exports.fetchListeningPlayback('a/b');
    strict_1.default.equal(requests[1].url, '/api/waimao-mini/listening/albums/a%2Fb/playback');
    strict_1.default.equal(playback.album.coverUrl, 'https://cdn.example.test/cover.jpg');
    strict_1.default.equal(playback.tracks[0].audioSources[0].url, 'https://api.example.test/signed/audio?token=short-lived');
    strict_1.default.equal(playback.tracks[0].audioSources[1].url, reply.tracks[0].audioSources[1].url);
    await exports.fetchListeningPlayback('a/b');
    strict_1.default.equal(requests.length, 3, 'Playback URLs are fetched again instead of being cached across permission changes');
    await strict_1.default.rejects(exports.fetchListeningPlayback(' '), /请选择听力专辑/);
    strict_1.default.equal(requests.length, 3);
}
async function checkPageActions() {
    const fixture = playerFixture();
    let page;
    let catalogFails = false;
    let storeUnsubscribed = 0;
    let unlockPrompts = 0;
    let navigated = '';
    const toastMessages = [];
    const exports = {};
    const store = { appConfig: catalog.appConfig };
    const modules = {
        '../../utils/listening-api': { fetchListeningAlbums: async () => {
                if (catalogFails)
                    throw new Error('offline');
                return catalog;
            } },
        '../../utils/listening-player': fixture.player,
        '../../config/feature-flags': { resolveInteractiveFeaturesEnabled: feature_flags_1.resolveInteractiveFeaturesEnabled },
        '../../store/index': {
            getState: () => store,
            setAppConfig: (config) => { store.appConfig = config; },
            subscribe: (fn) => { fn(store); return () => { storeUnsubscribed++; }; },
        },
    };
    node_vm_1.default.runInNewContext(generated('pages/listening/listening.js'), {
        exports, require: (name) => modules[name], Page: (value) => { page = value; },
        getApp: () => ({ globalData: {} }), console, setInterval, clearInterval,
        wx: {
            showToast: (options) => toastMessages.push(options.title),
            showModal: (options) => { unlockPrompts++; options.success({ confirm: true }); },
            navigateTo: (options) => { navigated = options.url; },
            showActionSheet: (options) => options.success({ tapIndex: 1 }),
        },
    });
    page.setData = (value) => Object.assign(page.data, value);
    strict_1.default.equal(exports.formatListeningDuration(75, true), '1:15');
    strict_1.default.equal(exports.formatListeningDuration(3601, true), '1:00:01');
    strict_1.default.equal(exports.formatListeningDuration(NaN), '0 秒');
    page.onLoad();
    await page.loadAlbums();
    strict_1.default.equal(page.data.albums[0].availableCount, 1);
    strict_1.default.equal(page.data.categories.length, 2);
    page.handleCategory({ currentTarget: { dataset: { category: '电话' } } });
    strict_1.default.equal(page.data.visibleAlbums[0].id, 'phone');
    page.handleOpenAlbum({ currentTarget: { dataset: { id: 'course' } } });
    await page.handlePlayTrack({ currentTarget: { dataset: { id: 'paid' } } });
    strict_1.default.equal(unlockPrompts, 1);
    strict_1.default.equal(navigated, '/pages/unlock/unlock');
    strict_1.default.equal(fixture.calls.length, 0, 'Locked rows never request playback');
    page.handleTranscript({ currentTarget: { dataset: { id: 'paid' } } });
    strict_1.default.equal(page.data.transcriptText, '', 'A locked row cannot reveal its transcript');
    await page.handlePlayAlbum();
    strict_1.default.deepEqual(fixture.calls.pop(), ['play', 'course', 'free'], 'Play all starts with the first available track');
    fixture.state.active = true;
    await page.handlePlayTrack({ currentTarget: { dataset: { id: 'free' } } });
    strict_1.default.deepEqual(fixture.calls.pop(), ['toggle']);
    await page.handleContinueListening();
    strict_1.default.deepEqual(fixture.calls.pop(), ['play', 'course', 'free', true], 'Continue uses the saved playback position');
    page.data.audioPlaybackEnabled = false;
    await page.handlePlayAlbum();
    await page.handlePlayTrack({ currentTarget: { dataset: { id: 'free' } } });
    await page.handleContinueListening();
    strict_1.default.equal(fixture.calls.length, 0, 'The audio master switch blocks every start action');
    page.data.audioPlaybackEnabled = true;
    fixture.state.error = '这张专辑暂无可播放音频';
    await page.handlePlayAlbum();
    fixture.calls.pop();
    strict_1.default.equal(toastMessages.pop(), '这张专辑暂无可播放音频', 'Player errors that are represented in state still give visible feedback');
    fixture.state.error = null;
    page.handleRepeatMode();
    strict_1.default.equal(page.data.modeLabel, '列表循环');
    page.handleRepeatMode();
    strict_1.default.equal(page.data.modeLabel, '单条循环');
    page.handleSleepTimer();
    strict_1.default.deepEqual(fixture.calls.pop(), ['timer', 30]);
    catalogFails = true;
    await page.loadAlbums();
    strict_1.default.match(page.data.error, /重试/);
    strict_1.default.equal(page.data.albums.length, 2, 'Catalog refresh failures keep the already loaded directory available');
    page.onUnload();
    strict_1.default.equal(fixture.unsubscribed(), 1);
    strict_1.default.equal(storeUnsubscribed, 1);
    strict_1.default.equal(fixture.calls.length, 0, 'Leaving the listening page never stops background audio');
}
async function checkMiniPlayerLifecycle() {
    const fixture = playerFixture();
    let definition;
    node_vm_1.default.runInNewContext(generated('components/listening-mini-player/listening-mini-player.js'), {
        exports: {}, require: () => fixture.player, Component: (value) => { definition = value; },
        wx: { switchTab: () => { }, showToast: () => { } },
    });
    const component = { ...definition.methods, data: definition.data,
        setData(value) { Object.assign(this.data, value); } };
    definition.lifetimes.attached.call(component);
    strict_1.default.equal(component.data.visible, false, 'A saved resume position alone does not open the mini-player');
    fixture.state.active = true;
    fixture.emit();
    strict_1.default.equal(component.data.visible, true);
    await component.togglePlayback();
    strict_1.default.deepEqual(fixture.calls.pop(), ['toggle']);
    definition.lifetimes.detached.call(component);
    strict_1.default.equal(fixture.unsubscribed(), 1);
    strict_1.default.equal(fixture.calls.length, 0, 'Removing a mini-player does not terminate playback');
}
exports.listeningPageTestDone = (async () => {
    checkTemplateExpressions();
    await checkApiBoundary();
    await checkPageActions();
    await checkMiniPlayerLifecycle();
    console.log('listening page tests passed.');
})();
