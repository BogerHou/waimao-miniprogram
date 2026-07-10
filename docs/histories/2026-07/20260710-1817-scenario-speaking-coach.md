## [2026-07-10 18:17] | Task: 开发外贸场景口语教练实验版

### 🤖 Execution Context

- **Agent ID**: `Codex`
- **Base Model**: `GPT-5`
- **Runtime**: `Codex desktop`

### 📥 User Query

> 保留当前外贸影子跟读版本，在独立分支尝试一个更聚焦外贸特定场景思考与表达的完整产品版本，完成后再决定是否采用。

### 🛠 Changes Overview

**Scope:** 外贸小程序实验分支，不修改或合并稳定版 `main`。

**Key Actions:**

- **新增场景教练首页**：实现今日、场景、复习和我的四个主视图，保留 7 章锁定、登录、会员和经典版入口。
- **新增五阶段训练**：按场景任务、完整听力、思考回应、逐句表达和连续跟读组织练习，并提供训练总结。
- **建立本地训练闭环**：保存训练阶段、句子掌握状态、复习时间和最近一次录音；重新录音时清理旧文件。
- **适配两类课程数据**：43 个对话场景优先识别 `Yibing` 为学习者；7 个“句子 N”表达库改为整组表达训练，避免客户先开口时角色颠倒或表达库漏句。
- **复用既有能力**：继续使用 `waimao-mini` 课程、精确字幕、音频范围、后端课程进度、邀请码和会员数据，不触碰 EnglishPod 数据。
- **补测试和验收**：新增教练模型与本地进度测试；在微信开发者工具走通完整流程，修复音频上下文退出报错，并压缩品牌图标包体。

### 🧠 Design Intent (Why)

实验版不再把“播放课程”当作核心目标，而是让用户先判断客户意图、独立组织回应，再用参考表达和原声修正。第一版刻意不做不透明的自动口语分数，先用业务目标、录音对比、自评和复习队列验证训练价值；经典版保持独立，产品方向随时可以回退或对照。

### 📁 Files Modified

- `miniprogram/pages/coach/coach.ts`
- `miniprogram/pages/coach/coach.wxml`
- `miniprogram/pages/training/training.ts`
- `miniprogram/pages/training/training.wxml`
- `miniprogram/utils/coach-model.ts`
- `miniprogram/utils/coach-progress.ts`
- `tests/coach-model.test.ts`
- `tests/coach-progress.test.ts`
- `docs/PRODUCT_SENSE.md`
- `docs/ARCHITECTURE.md`
- `docs/FRONTEND.md`
- `docs/SECURITY.md`
- `docs/RELIABILITY.md`
