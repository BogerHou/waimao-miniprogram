## [2026-07-13 12:52] | Task: 复习回到精练原句后自动播放

### 🤖 Execution Context

- **Agent ID**: Codex `/root`
- **Base Model**: GPT-5
- **Runtime**: Codex desktop

### 📥 User Query

> 从“复习”页面跳转到精练中的对应句子时，应直接播放该句。

### 🛠 Changes Overview

**Scope:** 复习页回源路由、课程页精练初始化、回归测试和相关文档。

**Key Actions:**

- **明确路由意图**：复习页回源地址增加 `autoplay=1`，与 `stage=practice`、`cueId` 一起传递；普通 `cueId` 深链不自动播放。
- **按就绪状态起播**：课程页定位目标句后，音频已就绪则立即走标准逐句播放；仍在加载则保存目标句，由 `onCanplay` 接续播放并设置句末停止。
- **保持复习筛选**：难句回源继续携带 `review=1`，不改变“只练难句”的星标筛选语义。
- **回归测试**：覆盖回源 URL、音频已就绪立即播放、加载中延后播放，以及普通深链只定位四种情况。

### 🧠 Design Intent (Why)

复习页的“回到原句”是继续练习而不是只查看位置。自动播放意图需要成为明确的路由契约，并复用播放器的音频就绪事件，避免依赖固定延时导致弱网下只定位不播放。

### 📁 Files Modified

- `miniprogram/pages/review/review.ts`
- `miniprogram/pages/course/course.ts`
- `tests/review-library.test.ts`
- `tests/course-mode-config.test.ts`
- `docs/ARCHITECTURE.md`
- `docs/FRONTEND.md`
