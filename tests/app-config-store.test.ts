import assert from "node:assert/strict"

import { getState, initializeStore, setAppConfig } from "../miniprogram/store/index"

function testInitializeStoreDefaultsShadowModeToInvisible() {
  ;(globalThis as { wx?: { getStorageSync: (key: string) => string } }).wx = {
    getStorageSync() {
      return ""
    },
  }

  initializeStore({ token: "" })

  assert.equal(getState().appConfig.courseDetail.shadowModeEnabled, true)
  assert.deepEqual(getState().appConfig.courseDetail.audioSource?.priority, ["server"])
  assert.equal(getState().appConfig.courseDetail.audioSource?.enabled.qiniu, false)
  assert.equal(getState().appConfig.home.bannerEnabled, false)
  assert.equal(getState().appConfig.home.practiceHelpEnabled, false)
  assert.equal(getState().appConfig.home.unlockPromptEnabled, true)
  assert.equal(getState().appConfig.home.activeAdId, "waimao-mini-unlock")
  assert.equal(getState().appConfig.home.ads?.[0]?.id, "waimao-mini-unlock")
  assert.equal(getState().appConfig.home.ads?.[0]?.contactQrUrl, "/static/images/waimao-purchase-wechat-qr.jpg")
}

function testSetAppConfigUpdatesShadowModeFlag() {
  setAppConfig({
    home: {
      bannerEnabled: false,
      practiceHelpEnabled: true,
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
      audioSource: {
        priority: ["mirror", "server"],
        enabled: {
          qiniu: false,
          mirror: true,
          server: true,
        },
      },
    },
  })

  assert.equal(getState().appConfig.courseDetail.shadowModeEnabled, true)
  assert.deepEqual(getState().appConfig.courseDetail.audioSource?.priority, ["mirror", "server"])
  assert.equal(getState().appConfig.courseDetail.audioSource?.enabled.qiniu, false)
  assert.equal(getState().appConfig.home.bannerEnabled, false)
  assert.equal(getState().appConfig.home.practiceHelpEnabled, true)
  assert.equal(getState().appConfig.home.activeAdId, "custom-ad")
  assert.equal(getState().appConfig.home.ads?.[0]?.id, "custom-ad")
}

function testInitializeStoreDerivesAccessFromEntitlement() {
  initializeStore({
    token: "",
    fullAccess: false,
    entitlement: {
      fullAccess: true,
      expiresAt: Date.now() + 86_400_000,
    },
  })

  assert.equal(getState().fullAccess, true)
}

testInitializeStoreDefaultsShadowModeToInvisible()
testSetAppConfigUpdatesShadowModeFlag()
testInitializeStoreDerivesAccessFromEntitlement()
console.log("app config store tests passed.")
