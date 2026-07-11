import assert from "node:assert/strict"

import {
  buildAudioSourceOptions,
  getNextAudioSourceOption,
  normalizeAudioSourceConfig,
} from "../miniprogram/pages/course/audio-source-fallback"

function testBuildsDefaultAudioSourcesInPriorityOrder() {
  assert.deepEqual(
    buildAudioSourceOptions(
      "https://englishecho.site/static/waimao-mini/audio/chapter-01.mp3",
      normalizeAudioSourceConfig(undefined),
    ),
    [
      {
        provider: "server",
        url: "https://englishecho.site/static/waimao-mini/audio/chapter-01.mp3",
      },
    ],
  )
}

function testCanDisableQiniuAndUseServer() {
  const config = normalizeAudioSourceConfig({
    priority: ["qiniu", "mirror", "server"],
    enabled: {
      qiniu: false,
      mirror: true,
      server: true,
    },
  })

  assert.deepEqual(
    buildAudioSourceOptions(
      "https://englishecho.site/static/waimao-mini/audio/chapter-02.mp3",
      config,
      [
        {
          provider: "qiniu",
          url: "https://waimao-audio.englishecho.site/audio/Chapter%202.mp3",
        },
      ],
    ),
    [
      {
        provider: "server",
        url: "https://englishecho.site/static/waimao-mini/audio/chapter-02.mp3",
      },
    ],
  )
}

function testBuildsConfiguredSourcesFromApiResponse() {
  const serverUrl = "https://englishecho.site/api/waimao/media/chapter-01?signed=1"
  const qiniuUrl = "https://waimao-audio.englishecho.site/audio/Chapter%201.mp3?e=1&token=x"
  const config = normalizeAudioSourceConfig({
    priority: ["qiniu", "server"],
    enabled: {
      qiniu: true,
      server: true,
    },
  })

  assert.deepEqual(
    buildAudioSourceOptions(serverUrl, config, [
      { provider: "qiniu", url: qiniuUrl },
      { provider: "server", url: serverUrl },
    ]),
    [
      { provider: "qiniu", url: qiniuUrl },
      { provider: "server", url: serverUrl },
    ],
  )
}

function testFallsBackFromQiniuToMirrorThenServer() {
  const audioSources = [
    {
      provider: "qiniu" as const,
      url: "https://waimao-audio.englishecho.site/audio/Chapter%201.mp3",
    },
    {
      provider: "server" as const,
      url: "https://englishecho.site/static/waimao-mini/audio/chapter-01.mp3",
    },
  ]

  assert.deepEqual(
    getNextAudioSourceOption({
      timedOutSource: "https://waimao-audio.englishecho.site/audio/Chapter%201.mp3",
      currentSource: "https://waimao-audio.englishecho.site/audio/Chapter%201.mp3",
      audioSources,
    }),
    {
      provider: "server",
      url: "https://englishecho.site/static/waimao-mini/audio/chapter-01.mp3",
    },
  )

  assert.deepEqual(
    getNextAudioSourceOption({
      timedOutSource: "https://cdn.jsdmirror.com/gh/example/waimao-audio@main/chapter-01.mp3",
      currentSource: "https://cdn.jsdmirror.com/gh/example/waimao-audio@main/chapter-01.mp3",
      audioSources: [
        {
          provider: "mirror" as const,
          url: "https://cdn.jsdmirror.com/gh/example/waimao-audio@main/chapter-01.mp3",
        },
        {
          provider: "server" as const,
          url: "https://englishecho.site/static/waimao-mini/audio/chapter-01.mp3",
        },
      ],
    }),
    {
      provider: "server",
      url: "https://englishecho.site/static/waimao-mini/audio/chapter-01.mp3",
    },
  )
}

function testDoesNotFallbackPastServerSource() {
  const serverUrl = "https://englishecho.site/api/waimao/media/chapter-01?signed=1"
  assert.equal(
    getNextAudioSourceOption({
      timedOutSource: serverUrl,
      currentSource: serverUrl,
      audioSources: [{ provider: "server", url: serverUrl }],
    }),
    null,
  )
}

function testDoesNotFallbackWhenTimedOutSourceIsNotCurrent() {
  assert.equal(
    getNextAudioSourceOption({
      timedOutSource: "https://cdn.jsdmirror.com/gh/example/waimao-audio@main/chapter-01.mp3",
      currentSource: "https://englishecho.site/static/waimao-mini/audio/chapter-01.mp3",
      audioSources: buildAudioSourceOptions(
        "https://englishecho.site/static/waimao-mini/audio/chapter-01.mp3",
        normalizeAudioSourceConfig(undefined),
      ),
    }),
    null,
  )
}

testBuildsDefaultAudioSourcesInPriorityOrder()
testCanDisableQiniuAndUseServer()
testBuildsConfiguredSourcesFromApiResponse()
testFallsBackFromQiniuToMirrorThenServer()
testDoesNotFallbackWhenTimedOutSourceIsNotCurrent()
testDoesNotFallbackPastServerSource()
console.log("audio source fallback tests passed.")
