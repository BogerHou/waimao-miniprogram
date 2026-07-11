## [2026-07-11 21:38] | Task: 课程播放器里程碑 3——录音对比、难句标记、完成面板

### Execution Context

- **Agent ID**: `Claude Code`
- **Base Model**: `Claude Fable 5`
- **Runtime**: `Claude Code CLI`

### User Query

> 继续，全部完成。（课程播放器统一重构里程碑 3）

### Changes Overview

**Scope:** 精练阶段练习增强 + 小节完成动线；不改播放引擎与阶段模型。

**Key Actions:**

- 新增 `utils/practice-marks.ts`（难句星标本地存储模型：normalize/toggle/query 纯函数）与 `utils/next-scene.ts`（`resolveNextScene`：同章下一节优先，跨章跳过锁定小节），各配 `tests/practice-marks.test.ts`。
- `course.ts` 录音对比（`RecorderManager` aac/60s 上限）：录音→对比听（原句 onEnded 接自录音回放，走 `compareStep` 状态机）→听完即弃；换句/切阶段/切通道/退出页面均 `discardRecording`；对比回放不计练习次数。
- 难句星标：`handleToggleStar` 读写 `waimao_starred_cues_v1`，句卡 `starred` 局部 setData；加载课程时把星标灌进字幕视图。
- 完成面板：`finishScenePlayback` 与精练最后一句完成改为 `openCompletionPanel`（拉课程列表解析下一节），取代完成 toast；提供学下一节（redirectTo）、再听一遍（回通听重播）、分享（open-type=share）。
- 每句练习次数 `practiceCounts` 在 echo 起播时累计，完成面板展示"本次精练 N 句"。
- `course.wxml/less`：句卡行内操作行（星标/录音/对比）、右下角 ★ 指示、完成面板浮层。

### Design Intent

补上"输出"与"学后动线"两个缺口：录音对比让用户听到自己与原声差距（不打分、不留存，零隐私负担）；完成面板把全 app 情绪最高点转成"进下一节"的顺畅动线，解决此前学完必须退回首页的断点。

### Verification

- `npm run typecheck`、`npm test`（practice-marks/next-scene 纯逻辑测试）、course.less lessc 编译通过。
- 待真机回归：录音权限授予/拒绝、对比听时序、星标持久化、完成面板下一节跳转、分享按钮。

### Files Modified

- `miniprogram/utils/practice-marks.ts`、`miniprogram/utils/next-scene.ts`（新建）
- `miniprogram/pages/course/course.ts`、`course.wxml`、`course.less`
- `tests/practice-marks.test.ts`（新建）、`tests/run-all.ts`
- `docs/FRONTEND.md`、`docs/exec-plans/active/2026-07-11-course-player-unification.md`

### Notes

- 录音功能依赖 `scope.record`，隐私协议合规弹窗在 `2026-07-11-release-compliance-theme-finalize` 计划内处理。
