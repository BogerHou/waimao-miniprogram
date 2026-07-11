## [2026-07-11 21:12] | Task: 课程播放器里程碑 2——学习阶段预设替代双模式

### Execution Context

- **Agent ID**: `Claude Code`
- **Base Model**: `Claude Fable 5`
- **Runtime**: `Claude Code CLI`

### User Query

> 继续，全部完成。（课程播放器统一重构里程碑 2）

### Changes Overview

**Scope:** 课程详情页顶层交互从 shadow/echo 双模式改为通听/精练/跟读三阶段预设；新增句末策略与留白跟读；三阶段首次引导。

**Key Actions:**

- `player-core.ts`：`LearningStage/CueEndPolicy/resolveStagePlan`（阶段→通道+句末策略）、`computeGapMs`（留白≈句长/倍速，600ms 保底）、`findNextCue`。
- `course-mode-config.ts`：新增 `resolveStagePresentation`（shadow 配置关闭时页面只读、阶段回退精练，与旧语义一致）；旧 `resolveCourseModePresentation` 保留。
- `course.ts`：`playMode` 降级为内部"播放通道"，顶层由 `stage/gapEnabled` 驱动；`handleModeChange` 重构为 `applyPlayModeChange(channel)`；新增 `handleStageChange/handleGapToggle/handleCueEnded/selectCueForPractice/clearGapTimer/dismissStageGuide`；echo 两个句末点（full-audio stopTimer 与切片 onEnded）接入"重复优先、其次句末策略"；默认阶段=通听（进入课程自动开始连续播放，首次引导展示时推迟到引导关闭后）。
- 行为对齐：full-audio 逐句路径句末补调 `markEchoCompletionProgress('stop-timer')`，与切片路径一致（此前只有切片路径记录句末进度/最后一句完成）。
- `course.wxml/less`：三阶段 chips、留白跟读开关（含留白中提示文案）、三步学习法引导浮层（合并原 practice-hint 文案，新 storage key `waimao_course_stage_guide_seen_v1`）；移除 practice-hint。
- 分享卡：`buildCourseShareCardModel` 改收 `stage`，标签 通听/逐句精练/影子跟读。
- 测试：player-core 阶段模型、course-mode-config 阶段呈现、分享卡标签全部更新/新增。

### Design Intent

shadow/echo 只差"播完一句之后做什么"，把它抬成页面模式割裂了 通听→精练→跟读 的自然流程。阶段是可自由离开的预设而非硬模式；底层通道划分（后台连续 vs 前台逐句）保持不变以保住锁屏播放与后台接力。

### Verification

- `npm run typecheck`、`npm test`、course.less lessc 编译通过。
- 待真机回归：三阶段切换、留白跟读节奏、通听自动播放、引导只出现一次、锁屏/后台接力不回归。

### Files Modified

- `miniprogram/pages/course/{player-core,course-mode-config,course-share-card,course}.ts`
- `miniprogram/pages/course/course.wxml`、`course.less`
- `tests/{player-core,course-mode-config,course-share-card}.test.ts`
- `docs/FRONTEND.md`、`docs/exec-plans/active/2026-07-11-course-player-unification.md`
