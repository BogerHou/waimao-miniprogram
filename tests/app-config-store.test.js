"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const index_1 = require("../miniprogram/store/index");
function testInitializeStoreDefaultsShadowModeToInvisible() {
    ;
    globalThis.wx = {
        getStorageSync() {
            return "";
        },
    };
    (0, index_1.initializeStore)({ token: "" });
    strict_1.default.equal((0, index_1.getState)().appConfig.courseDetail.shadowModeEnabled, true);
    strict_1.default.deepEqual((0, index_1.getState)().appConfig.courseDetail.audioSource?.priority, ["server"]);
    strict_1.default.equal((0, index_1.getState)().appConfig.courseDetail.audioSource?.enabled.qiniu, false);
    strict_1.default.equal((0, index_1.getState)().appConfig.home.bannerEnabled, false);
    strict_1.default.equal((0, index_1.getState)().appConfig.home.practiceHelpEnabled, false);
    strict_1.default.equal((0, index_1.getState)().appConfig.home.unlockPromptEnabled, true);
    strict_1.default.equal((0, index_1.getState)().appConfig.home.activeAdId, "waimao-mini-unlock");
    strict_1.default.equal((0, index_1.getState)().appConfig.home.ads?.[0]?.id, "waimao-mini-unlock");
    strict_1.default.equal((0, index_1.getState)().appConfig.home.ads?.[0]?.contactQrUrl, "/static/images/community-qr.png");
}
function testSetAppConfigUpdatesShadowModeFlag() {
    (0, index_1.setAppConfig)({
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
    });
    strict_1.default.equal((0, index_1.getState)().appConfig.courseDetail.shadowModeEnabled, true);
    strict_1.default.deepEqual((0, index_1.getState)().appConfig.courseDetail.audioSource?.priority, ["mirror", "server"]);
    strict_1.default.equal((0, index_1.getState)().appConfig.courseDetail.audioSource?.enabled.qiniu, false);
    strict_1.default.equal((0, index_1.getState)().appConfig.home.bannerEnabled, false);
    strict_1.default.equal((0, index_1.getState)().appConfig.home.practiceHelpEnabled, true);
    strict_1.default.equal((0, index_1.getState)().appConfig.home.activeAdId, "custom-ad");
    strict_1.default.equal((0, index_1.getState)().appConfig.home.ads?.[0]?.id, "custom-ad");
}
testInitializeStoreDefaultsShadowModeToInvisible();
testSetAppConfigUpdatesShadowModeFlag();
console.log("app config store tests passed.");
