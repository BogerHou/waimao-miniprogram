"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const audio_source_fallback_1 = require("../miniprogram/pages/course/audio-source-fallback");
function testBuildsDefaultAudioSourcesInPriorityOrder() {
    strict_1.default.deepEqual((0, audio_source_fallback_1.buildAudioSourceOptions)("https://englishecho.site/static/waimao-mini/audio/chapter-01.mp3", (0, audio_source_fallback_1.normalizeAudioSourceConfig)(undefined)), [
        {
            provider: "server",
            url: "https://englishecho.site/static/waimao-mini/audio/chapter-01.mp3",
        },
    ]);
}
function testCanDisableQiniuAndUseServer() {
    const config = (0, audio_source_fallback_1.normalizeAudioSourceConfig)({
        priority: ["qiniu", "mirror", "server"],
        enabled: {
            qiniu: false,
            mirror: true,
            server: true,
        },
    });
    strict_1.default.deepEqual((0, audio_source_fallback_1.buildAudioSourceOptions)("https://englishecho.site/static/waimao-mini/audio/chapter-02.mp3", config, [
        {
            provider: "qiniu",
            url: "https://waimao-audio.englishecho.site/audio/Chapter%202.mp3",
        },
    ]), [
        {
            provider: "server",
            url: "https://englishecho.site/static/waimao-mini/audio/chapter-02.mp3",
        },
    ]);
}
function testBuildsConfiguredSourcesFromApiResponse() {
    const serverUrl = "https://englishecho.site/api/waimao/media/chapter-01?signed=1";
    const qiniuUrl = "https://waimao-audio.englishecho.site/audio/Chapter%201.mp3?e=1&token=x";
    const config = (0, audio_source_fallback_1.normalizeAudioSourceConfig)({
        priority: ["qiniu", "server"],
        enabled: {
            qiniu: true,
            server: true,
        },
    });
    strict_1.default.deepEqual((0, audio_source_fallback_1.buildAudioSourceOptions)(serverUrl, config, [
        { provider: "qiniu", url: qiniuUrl },
        { provider: "server", url: serverUrl },
    ]), [
        { provider: "qiniu", url: qiniuUrl },
        { provider: "server", url: serverUrl },
    ]);
}
function testFallsBackFromQiniuToMirrorThenServer() {
    const audioSources = [
        {
            provider: "qiniu",
            url: "https://waimao-audio.englishecho.site/audio/Chapter%201.mp3",
        },
        {
            provider: "server",
            url: "https://englishecho.site/static/waimao-mini/audio/chapter-01.mp3",
        },
    ];
    strict_1.default.deepEqual((0, audio_source_fallback_1.getNextAudioSourceOption)({
        timedOutSource: "https://waimao-audio.englishecho.site/audio/Chapter%201.mp3",
        currentSource: "https://waimao-audio.englishecho.site/audio/Chapter%201.mp3",
        audioSources,
    }), {
        provider: "server",
        url: "https://englishecho.site/static/waimao-mini/audio/chapter-01.mp3",
    });
    strict_1.default.deepEqual((0, audio_source_fallback_1.getNextAudioSourceOption)({
        timedOutSource: "https://cdn.jsdmirror.com/gh/example/waimao-audio@main/chapter-01.mp3",
        currentSource: "https://cdn.jsdmirror.com/gh/example/waimao-audio@main/chapter-01.mp3",
        audioSources: [
            {
                provider: "mirror",
                url: "https://cdn.jsdmirror.com/gh/example/waimao-audio@main/chapter-01.mp3",
            },
            {
                provider: "server",
                url: "https://englishecho.site/static/waimao-mini/audio/chapter-01.mp3",
            },
        ],
    }), {
        provider: "server",
        url: "https://englishecho.site/static/waimao-mini/audio/chapter-01.mp3",
    });
}
function testDoesNotFallbackPastServerSource() {
    const serverUrl = "https://englishecho.site/api/waimao/media/chapter-01?signed=1";
    strict_1.default.equal((0, audio_source_fallback_1.getNextAudioSourceOption)({
        timedOutSource: serverUrl,
        currentSource: serverUrl,
        audioSources: [{ provider: "server", url: serverUrl }],
    }), null);
}
function testDoesNotFallbackWhenTimedOutSourceIsNotCurrent() {
    strict_1.default.equal((0, audio_source_fallback_1.getNextAudioSourceOption)({
        timedOutSource: "https://cdn.jsdmirror.com/gh/example/waimao-audio@main/chapter-01.mp3",
        currentSource: "https://englishecho.site/static/waimao-mini/audio/chapter-01.mp3",
        audioSources: (0, audio_source_fallback_1.buildAudioSourceOptions)("https://englishecho.site/static/waimao-mini/audio/chapter-01.mp3", (0, audio_source_fallback_1.normalizeAudioSourceConfig)(undefined)),
    }), null);
}
testBuildsDefaultAudioSourcesInPriorityOrder();
testCanDisableQiniuAndUseServer();
testBuildsConfiguredSourcesFromApiResponse();
testFallsBackFromQiniuToMirrorThenServer();
testDoesNotFallbackWhenTimedOutSourceIsNotCurrent();
testDoesNotFallbackPastServerSource();
console.log("audio source fallback tests passed.");
