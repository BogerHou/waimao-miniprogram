## [2026-07-11 17:07] | Task: 调整小程序阅读字号

### Execution Context

- **Agent ID**: `Codex`
- **Base Model**: `GPT-5`
- **Runtime**: `Codex desktop`

### User Query

> 当前字号阅读困难；全局放大 1.5 倍后又过大且页面拥挤，需要重新调整。

### Changes Overview

**Scope:** 小程序通用字号、课程正文和知识点正文，不改变页面结构与交互。

**Key Actions:**

- 将通用页面和组件字号调整到原版约 `1.15` 倍，保留标题、正文、辅助文字和按钮之间的层级。
- 课程英文正文单独提高到 `38rpx`，中文翻译提高到 `32rpx`。
- 知识点正文使用 `31-33rpx`，导航标题收敛到 `18.5px`，减少长标题的压迫感。
- 固定按钮和状态位继续使用原有固定行高，避免文字放大后被裁切。

### Design Intent

学习内容需要明显比操作标签更易读；全局统一放大让所有元素同时变重，会破坏扫描层级并挤压移动端列表，因此改为分层字号体系。

### Files Modified

- `miniprogram/pages/*/*.less`
- `miniprogram/components/*/*.less`
- `docs/FRONTEND.md`
