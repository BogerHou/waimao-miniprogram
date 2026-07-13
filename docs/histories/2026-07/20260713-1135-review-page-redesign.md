## [2026-07-13 11:35] | Task: 重构复习页为页内听音流程

### 🤖 Execution Context

- **Agent ID**: Codex `/root`
- **Base Model**: GPT-5
- **Runtime**: Codex desktop

### 📥 User Query

> 优化“复习”页 UI 和文案；播放按钮需要状态反馈，移除操作需要图标，并重新判断回到原句是否符合真实使用场景。

### 🛠 Changes Overview

**Scope:** 复习页界面、音频交互、回归测试及相关产品文档。

**Key Actions:**

- **连续复习路径**：移除整卡回原句的隐式跳转，来源课程仅作为上下文；生词和难句均在当前页播放。
- **播放状态**：统一加载、播放、暂停、继续和取消状态；难句按课程 cue 时间范围只播放当前句，切换条目或离页立即停止；用“课程 ID + cue ID”复合键隔离不同课程中的重复字幕 ID。
- **界面收敛**：删除冗余 hero，Tab 直接显示数量；卡片只保留内容、来源、听音和移除，移除改为垃圾桶图标。
- **回归测试**：覆盖不同条目开始播放、当前条目暂停/继续及加载中取消。

### 🧠 Design Intent (Why)

复习的高频任务是连续看、听和筛掉已经掌握的内容。整卡隐式跳转会打断节奏，也让用户难以预判点击结果；需要深度练习时应使用明确的次级入口，而不是把来源信息伪装成主操作。

### 📁 Files Modified

- `miniprogram/pages/review/review.ts`
- `miniprogram/pages/review/review.wxml`
- `miniprogram/pages/review/review.less`
- `miniprogram/assets/icons/trash-2.svg`
- `tests/review-library.test.ts`
- `docs/ARCHITECTURE.md`
- `docs/FRONTEND.md`
