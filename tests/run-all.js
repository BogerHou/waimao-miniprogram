"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("./ai-popup-render-state.test");
require("./ai-popup-stream-renderer.test");
require("./app-config-store.test");
const app_config_sync_test_1 = require("./app-config-sync.test");
require("./audio-source-fallback.test");
require("./course-mode-config.test");
require("./course-share-card.test");
require("./coach-model.test");
require("./coach-dashboard.test");
require("./coach-progress.test");
require("./env-config.test");
require("./knowledge-dialogue-format.test");
require("./knowledge-format.test");
require("./page-json-schema.test");
require("./pdf-image-scan.test");
require("./progress-payload.test");
require("./shadow-background-handoff.test");
require("./share-card.test");
require("./unlock-format.test");
app_config_sync_test_1.appConfigSyncTestDone
    .then(() => {
    console.log("all miniprogram tests passed.");
})
    .catch(error => {
    console.error(error);
    process.exit(1);
});
