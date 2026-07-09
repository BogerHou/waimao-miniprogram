import assert from "node:assert/strict"

import {
  buildAudioSourceOptions,
  getNextAudioSourceOption,
  isCdnAudioUrl,
  normalizeAudioSourceConfig,
} from "../miniprogram/pages/course/audio-source-fallback"

function testRecognizesCdnAudioUrl() {
  assert.equal(
    isCdnAudioUrl("https://cdn.jsdmirror.com/gh/example/waimao-audio@main/chapter-01.mp3"),
    true,
  )
  assert.equal(
    isCdnAudioUrl("https://audio.example.com/audio/chapter-01.mp3"),
    true,
  )
  assert.equal(
    isCdnAudioUrl("https://media.example.com/audio/chapter-01.mp3"),
    false,
  )
  assert.equal(isCdnAudioUrl("https://englishecho.site/static/waimao-mini/audio/chapter-01.mp3"), false)
}

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

function testCanDisableQiniuAndUseMirrorFirst() {
  const config = normalizeAudioSourceConfig({
    priority: ["qiniu", "mirror", "server"],
    enabled: {
      qiniu: false,
      mirror: true,
      server: true,
    },
  })

  assert.deepEqual(
    buildAudioSourceOptions("https://englishecho.site/static/waimao-mini/audio/chapter-02.mp3", config),
    [
      {
        provider: "server",
        url: "https://englishecho.site/static/waimao-mini/audio/chapter-02.mp3",
      },
    ],
  )
}

function testFallsBackFromQiniuToMirrorThenServer() {
  const audioSources = [
    {
      provider: "qiniu" as const,
      url: "https://audio.example.com/audio/chapter-01.mp3",
    },
    {
      provider: "server" as const,
      url: "https://englishecho.site/static/waimao-mini/audio/chapter-01.mp3",
    },
  ]

  assert.deepEqual(
    getNextAudioSourceOption({
      timedOutSource: "https://audio.example.com/audio/chapter-01.mp3",
      currentSource: "https://audio.example.com/audio/chapter-01.mp3",
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

testRecognizesCdnAudioUrl()
testBuildsDefaultAudioSourcesInPriorityOrder()
testCanDisableQiniuAndUseMirrorFirst()
testFallsBackFromQiniuToMirrorThenServer()
testDoesNotFallbackWhenTimedOutSourceIsNotCurrent()
console.log("audio source fallback tests passed.")
