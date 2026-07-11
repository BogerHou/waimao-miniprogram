## [2026-07-11 19:58] | Task: 课程播放器重构启动——设计冻结与切片 A

### Execution Context

- **Agent ID**: `Claude Code`
- **Base Model**: `Claude Fable 5`
- **Runtime**: `Claude Code CLI`

### User Query

> 确认课程页重构设计的四个开放问题：不默认隐藏中文；留白跟读进第一期；录音听完即弃；需要首次引导并合并 practice-hint。

### Changes Overview

**Scope:** 冻结课程播放器统一重构的交互设计；完成里程碑 1 切片 A（纯逻辑抽离）。

**Key Actions:**

- `docs/exec-plans/active/2026-07-11-course-player-unification.md`：核心设计标记为已冻结，写入四项用户决策；里程碑 1 细化为 A/B/C 三个切片。
- 新建 `miniprogram/pages/course/player-core.ts`：从 `course.ts` 抽出范围钳制（`clampCourseTimeToScene`/`hasReachedSceneEnd`，含 0.1/0.08 秒容差常量化）与进度 cue 计算（`resolveProgressCueIndex`/`buildCompletionCuePayload`）四个纯函数；`course.ts` 对应方法改为薄委托，行为不变。
- 新增 `tests/player-core.test.ts` 覆盖容差边界（重启容差必须宽于完成容差）、空字幕兜底、cue 回退钳制；注册进 `tests/run-all.ts`。

### Design Intent

范围钳制的两个容差是"Shadow 不得串场景"这条关键路径的核心，却一直没有单元测试。切片 A 用最低风险的方式（纯函数抽离 + 薄委托）给后续引擎抽离打样：每个切片行为零变化、测试先行。

### Verification

- `npm run typecheck`、`npm test`（新增 player core tests）通过。

### Files Modified

- `miniprogram/pages/course/player-core.ts`（新建）、`miniprogram/pages/course/course.ts`
- `tests/player-core.test.ts`（新建）、`tests/run-all.ts`
- `docs/exec-plans/active/2026-07-11-course-player-unification.md`
