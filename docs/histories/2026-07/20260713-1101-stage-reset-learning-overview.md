## [2026-07-13 11:01] | Task: 修复阶段回首句并重做学习概览

### 🤖 Execution Context

- **Agent ID**: Codex `/root`
- **Base Model**: GPT-5
- **Runtime**: Codex desktop

### 📥 User Query

> 修复“精练 / 跟读”切换后没有定位到第一句，并优化学习统计卡片和含混文案。

### 🛠 Changes Overview

**Scope:** 课程详情页、“我的”学习概览及对应测试和文档。

**Key Actions:**

- **阶段定位修复**：阶段切换直接调用非节流字幕定位；播放过程仍使用 300ms 节流，避免高频滚动。
- **回归测试**：覆盖前台逐句和后台连续两种播放通道，证明切换阶段都会强制定位第一句。
- **学习概览重设计**：把三张割裂的统计卡收成一个有主次层级的概览；改为“累计练习时长”“连续学习 N 天”“已完成 N 节”。

### 🧠 Design Intent (Why)

用户主动切换阶段是明确导航动作，优先级高于播放过程的自动滚动，不能被节流丢弃。学习统计需要把数值、单位和含义放在同一阅读路径里，避免“连续学习 / 天”这类需要猜测的表达。

### 📁 Files Modified

- `miniprogram/pages/course/course.ts`
- `miniprogram/pages/learning/learning.wxml`
- `miniprogram/pages/learning/learning.less`
- `tests/course-mode-config.test.ts`
- `docs/FRONTEND.md`
