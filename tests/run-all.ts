import "./ai-popup-render-state.test"
import "./ai-popup-stream-renderer.test"
import "./app-config-store.test"
import { appConfigSyncTestDone } from "./app-config-sync.test"
import "./audio-source-fallback.test"
import "./course-mode-config.test"
import "./course-share-card.test"
import "./coach-model.test"
import "./coach-dashboard.test"
import "./coach-progress.test"
import "./env-config.test"
import "./knowledge-dialogue-format.test"
import "./knowledge-format.test"
import "./page-json-schema.test"
import "./pdf-image-scan.test"
import "./progress-payload.test"
import "./shadow-background-handoff.test"
import "./share-card.test"
import "./unlock-format.test"

appConfigSyncTestDone
  .then(() => {
    console.log("all miniprogram tests passed.")
  })
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
