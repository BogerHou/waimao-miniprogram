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

## [2026-07-10 20:40] | Task: 复审并优化场景口语教练闭环

### 🤖 Execution Context

- **Agent ID**: `Codex`
- **Base Model**: `GPT-5`
- **Runtime**: `Codex desktop`

### 📥 User Query

> 重新审视页面和功能，确认是否达到预期，并继续优化实验版。

### 🛠 Changes Overview

**Scope:** 场景教练首页、训练页、教练模型、本地进度与测试。

**Key Actions:**

- **业务表达筛选**：对话课只选择少量高价值学习者表达，降低寒暄句、短句和纯社交句进入核心训练的概率。
- **完整训练约束**：听力必须完整播放后才能进入回应；连续跟读必须播放完整场景范围后才能完成训练。
- **可信自评**：历史掌握状态不再自动解锁当前训练，用户每轮都要基于本次表现重新自评。
- **表达库分组**：第 7 章表达库按 8 条一组训练，完成当前组后保存下一组入口，最后一组才完成整课。
- **单条复习**：复习页打开某条表达后进入专用单条复习流程，完成后回到复习列表。
- **页面提示优化**：今日进度、听力文字门槛、回应业务目标、跟读状态、总结文案和会员提示都更聚焦当前动作。

### 🧠 Design Intent (Why)

这轮复审的重点是防止实验版看起来像新产品，但实际仍然允许用户跳过听力、沿用旧判断、一次塞进太多表达。优化后，训练闭环更接近“外贸场景中先思考、再表达、再对照”的产品目标，复习也变成针对具体表达的轻量回访。

### 📁 Files Modified

- `miniprogram/pages/coach/coach.ts`
- `miniprogram/pages/coach/coach.wxml`
- `miniprogram/pages/training/training.ts`
- `miniprogram/pages/training/training.wxml`
- `miniprogram/utils/coach-model.ts`
- `miniprogram/utils/coach-progress.ts`
- `tests/coach-model.test.ts`
- `tests/coach-progress.test.ts`
- `docs/DESIGN.md`
- `docs/exec-plans/completed/2026-07-10-scenario-coach-product-review.md`

## [2026-07-10 21:28] | Task: 增强思考回应上下文

### 🤖 Execution Context

- **Agent ID**: `Codex`
- **Base Model**: `GPT-5`
- **Runtime**: `Codex desktop`

### 📥 User Query

> 当前流程虽然在模拟对话，但思考回应缺少思路提示，只显示一句对话，上下文不清楚。

### 🛠 Changes Overview

**Scope:** 场景教练模型与训练页回应阶段。

**Key Actions:**

- **扩展回应模型**：每个 `CoachChallenge` 增加场景局面、本轮目标、三条思路提示和前 4 句上下文片段。
- **重排回应页面**：回应阶段先显示本轮目标，再展示场景脉络和上下文，随后提示当前轮到用户回应。
- **保留先开口原则**：思路提示只给结构化方向，不提前展示参考英文答案。
- **补模型测试**：验证对话课上下文、角色归属、回应目标和表达库提示不会退回到单句提示。

### 🧠 Design Intent (Why)

用户练外贸口语时缺的不是“翻译下一句”，而是理解客户意图、判断自己要推动什么、再组织表达。回应阶段如果只给一句话，会把练习变成盲猜；加入上下文和思路提示后，训练更接近真实业务对话。

### 📁 Files Modified

- `miniprogram/utils/coach-model.ts`
- `miniprogram/pages/training/training.wxml`
- `miniprogram/pages/training/training.less`
- `tests/coach-model.test.ts`
- `docs/DESIGN.md`
