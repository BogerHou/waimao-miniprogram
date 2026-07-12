## [2026-07-12 18:20] | Task: 完成阶段 D 留存闭环

### 🤖 Execution Context

- **Agent ID**: Codex
- **Base Model**: GPT-5
- **Runtime**: Codex Desktop

### 📥 User Query

> 阶段 C 先不做，开始阶段 D。

### 🛠 Changes Overview

**Scope:** 微信小程序、外贸小程序专用后端、协作文档

**Key Actions:**

- **统一复习入口**：课程查词自动沉淀生词，难句星标同步保存正文；新增生词/难句复习页、来源句跳转和课程“只练难句”模式。
- **场景搜索**：首页新增轻量关键词搜索，按章节标题、标签与小节中英文内容过滤，命中结果可沿用原有锁定与解锁流程。
- **学习记录**：新增独立学习主页、最近 4 周日历、累计精练次数；后端学习时长记录增加练习次数并提供按日聚合接口。
- **验证与文档**：新增复习资料、场景搜索、学习日历纯逻辑测试，补后端 API flow，并同步架构、前端、可靠性、质量和执行计划。

### 🧠 Design Intent (Why)

把“练习中产生的数据”收敛成可再次使用的资产，同时不让首页变成统计仪表盘。生词和难句第一期保留在本机以控制后端复杂度；只有学习时长、练习次数和按日统计进入用户后端。录音继续听完即弃，不保存也不上传。

### 📁 Files Modified

- `miniprogram/pages/index/*`
- `miniprogram/pages/course/*`
- `miniprogram/pages/learning/*`
- `miniprogram/pages/review/*`
- `miniprogram/utils/review-library.ts`
- `miniprogram/utils/scene-search.ts`
- `miniprogram/utils/learning-records.ts`
- `miniprogram/utils/api.ts`
- `tests/*`
- `docs/ARCHITECTURE.md`
- `docs/FRONTEND.md`
- `docs/RELIABILITY.md`
- `docs/QUALITY_SCORE.md`
- `docs/exec-plans/active/2026-07-11-learning-loop-features.md`
- `docs/exec-plans/active/2026-07-12-roadmap-overview.md`
- `server/src/database/*`
- `server/src/routes/waimao-mini.ts`
- `server/src/services/waimaoMiniService.ts`
- `server/tests/run-tests.ts`
