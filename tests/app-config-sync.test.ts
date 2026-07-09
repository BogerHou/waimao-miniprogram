import assert from "node:assert/strict"

import { refreshAppConfig } from "../miniprogram/utils/app-config-sync"

async function testRefreshAppConfigFetchesAndStoresLatestConfigEveryTime() {
  let calls = 0
  let latestValue = false

  const fetcher = async () => {
    calls += 1
    return {
      home: {
        bannerEnabled: calls < 2,
        practiceHelpEnabled: calls > 1,
        activeAdId: "custom-ad",
        ads: [
          {
            id: "custom-ad",
            enabled: true,
            bannerUrl: "https://example.com/banner.webp",
            detailBannerEnabled: true,
            contentImageUrl: "https://example.com/cn-hero.jpg",
            title: "Custom Title",
            eyebrow: "Custom",
            description: "Custom description",
            features: [
              {
                title: "Feature",
                desc: "Feature description",
              },
            ],
            trialTitle: "Try",
            trialDescription: "Try it.",
            targetUrl: "https://example.com/",
            ctaText: "Copy",
            contactQrUrl: "https://example.com/qr.png",
            contactTitle: "Add WeChat",
            contactDescription: "Add this WeChat for purchase.",
            contactTip: "Long press to scan",
          },
        ],
      },
      courseDetail: {
        shadowModeEnabled: calls > 1,
      },
    }
  }

  const setter = (appConfig: { courseDetail: { shadowModeEnabled: boolean } }) => {
    latestValue = appConfig.courseDetail.shadowModeEnabled
  }

  await refreshAppConfig(fetcher, setter)
  assert.equal(calls, 1)
  assert.equal(latestValue, false)

  await refreshAppConfig(fetcher, setter)
  assert.equal(calls, 2)
  assert.equal(latestValue, true)
}

async function testRefreshAppConfigSwallowsErrorsAndKeepsRunning() {
  let calls = 0
  let latestValue = false

  const fetcher = async () => {
    calls += 1
    if (calls === 1) {
      throw new Error("network failed")
    }
    return {
      home: {
        bannerEnabled: true,
        practiceHelpEnabled: false,
        activeAdId: "custom-ad",
        ads: [
          {
            id: "custom-ad",
            enabled: true,
            bannerUrl: "https://example.com/banner.webp",
            detailBannerEnabled: true,
            contentImageUrl: "https://example.com/cn-hero.jpg",
            title: "Custom Title",
            eyebrow: "Custom",
            description: "Custom description",
            features: [
              {
                title: "Feature",
                desc: "Feature description",
              },
            ],
            trialTitle: "Try",
            trialDescription: "Try it.",
            targetUrl: "https://example.com/",
            ctaText: "Copy",
            contactQrUrl: "https://example.com/qr.png",
            contactTitle: "Add WeChat",
            contactDescription: "Add this WeChat for purchase.",
            contactTip: "Long press to scan",
          },
        ],
      },
      courseDetail: {
        shadowModeEnabled: true,
      },
    }
  }

  const setter = (appConfig: { courseDetail: { shadowModeEnabled: boolean } }) => {
    latestValue = appConfig.courseDetail.shadowModeEnabled
  }

  await refreshAppConfig(fetcher, setter)
  assert.equal(calls, 1)
  assert.equal(latestValue, false)

  await refreshAppConfig(fetcher, setter)
  assert.equal(calls, 2)
  assert.equal(latestValue, true)
}

async function run() {
  await testRefreshAppConfigFetchesAndStoresLatestConfigEveryTime()
  await testRefreshAppConfigSwallowsErrorsAndKeepsRunning()
  console.log("app config sync tests passed.")
}

export const appConfigSyncTestDone = run()

if (process.argv[1]?.endsWith("app-config-sync.test.js")) {
  appConfigSyncTestDone.catch(error => {
    console.error(error)
    process.exit(1)
  })
}
