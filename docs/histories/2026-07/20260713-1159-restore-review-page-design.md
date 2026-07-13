## [2026-07-13 11:59] | Task: 恢复复习页原版设计并收窄音频改动

### 🤖 Execution Context

- **Agent ID**: Codex `/root`
- **Base Model**: GPT-5
- **Runtime**: Codex desktop

### 📥 User Query

> 恢复原来的复习页设计，只修改难词发音状态和删除按钮。

### 🛠 Changes Overview

**Scope:** 复习页界面、音频交互、回归测试及相关产品文档。

**Key Actions:**

- **恢复原版页面**：恢复顶部资料库说明、原有 Tab、卡片样式、文案和点击来源返回课程原句的路径。
- **收窄音频范围**：撤回难句页内播放，只为生词发音保留加载、播放、暂停、继续和结束复位状态；切换 Tab、删除当前生词或离页时停止。
- **删除按钮**：生词和难句均用垃圾桶图标替代“移除”文字，同时保留无障碍说明和按压反馈。
- **回归测试**：测试生词发音的开始、暂停、继续、取消以及音频生命周期状态复位。

### 🧠 Design Intent (Why)

用户确认原版页面的信息密度、文案和回原句路径更符合预期。本轮只解决已经明确的问题，不再扩大难句播放和页面结构调整的范围。

### 📁 Files Modified

- `miniprogram/pages/review/review.ts`
- `miniprogram/pages/review/review.wxml`
- `miniprogram/pages/review/review.less`
- `tests/review-library.test.ts`
- `docs/ARCHITECTURE.md`
- `docs/FRONTEND.md`
