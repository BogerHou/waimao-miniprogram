"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("./ai-popup-render-state.test");
require("./ai-popup-stream-renderer.test");
require("./app-config-store.test");
const app_config_sync_test_1 = require("./app-config-sync.test");
require("./auth-session.test");
require("./audio-source-fallback.test");
require("./course-mode-config.test");
require("./course-share-card.test");
require("./course-completion-poster.test");
require("./env-config.test");
require("./knowledge-dialogue-format.test");
require("./knowledge-format.test");
const network_resilience_test_1 = require("./network-resilience.test");
require("./page-json-schema.test");
require("./player-core.test");
require("./practice-marks.test");
require("./progress-payload.test");
require("./record-auth.test");
require("./shadow-background-handoff.test");
require("./share-card.test");
require("./subtitle-tokenizer.test");
require("./unlock-format.test");
require("./review-library.test");
require("./scene-search.test");
require("./learning-records.test");
require("./tab-navigation.test");
require("./word-lookup.test");
Promise.all([app_config_sync_test_1.appConfigSyncTestDone, network_resilience_test_1.networkResilienceTestDone])
    .then(() => {
    console.log("all miniprogram tests passed.");
})
    .catch(error => {
    console.error(error);
    process.exit(1);
});
