import "./ai-popup-render-state.test"
import "./ai-popup-stream-renderer.test"
import "./app-config-store.test"
import { appConfigSyncTestDone } from "./app-config-sync.test"
import "./auth-session.test"
import "./audio-source-fallback.test"
import "./course-mode-config.test"
import "./course-share-card.test"
import "./env-config.test"
import "./knowledge-dialogue-format.test"
import "./knowledge-format.test"
import "./page-json-schema.test"
import "./pdf-image-scan.test"
import "./player-core.test"
import "./practice-marks.test"
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
