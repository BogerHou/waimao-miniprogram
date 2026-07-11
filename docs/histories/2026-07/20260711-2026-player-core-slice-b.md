## [2026-07-11 20:26] | Task: 课程播放器重构切片 B——加载超时控制器与事件纯决策抽离

### Execution Context

- **Agent ID**: `Claude Code`
- **Base Model**: `Claude Fable 5`
- **Runtime**: `Claude Code CLI`

### User Query

> 开始推进（课程播放器统一重构里程碑 1）

### Changes Overview

**Scope:** 里程碑 1 切片 B，行为保持型抽离。

**Key Actions:**

- `player-core.ts` 新增 `createAudioLoadTimeoutController`：CDN 音源加载超时守卫（仅非 server 源计时、超时且存在下一源才回退），定时器可注入；`course.ts` 的 `scheduleAudioLoadTimeout/clearAudioLoadTimeout` 改为薄委托，控制器在 `onLoad` 接线。
- 播放事件里的纯决策抽出：`computeRepeatStopWindow`（重复模式备用停止窗口，0.5s 补偿常量化）、`resolveAudioErrorTip`（错误码文案映射）、`buildEchoSegmentUrl`（Echo 服务器切片地址）。
- 移除死状态 `pendingAudioLoadSource`（只写从不读）与页面级 `audioLoadTimeoutTimer` 字段（收编进控制器）。
- `tests/player-core.test.ts` 新增：超时→回退、源已切换不回退、clear/重复 schedule、server 源不计时、错误提示映射、停止窗口换算、切片地址拼接。

### Design Intent

"CDN 超时自动回退"是音频可用性的兜底路径，此前只有 `getNextAudioSourceOption` 纯函数有测试，计时器编排零覆盖。注入定时器后整条决策路径可在 Node 驱动。切片 A+B 都是行为保持型，切片 C（BackgroundAudioManager 抽离）前建议真机回归一次。

### Verification

- `npm run typecheck`、`npm test` 通过（player core tests 扩展至覆盖超时控制器）。

### Files Modified

- `miniprogram/pages/course/player-core.ts`、`miniprogram/pages/course/course.ts`
- `tests/player-core.test.ts`
- `docs/exec-plans/active/2026-07-11-course-player-unification.md`
