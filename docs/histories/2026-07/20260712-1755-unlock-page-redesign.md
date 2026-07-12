## [2026-07-12 17:55] | Task: 重设计会员解锁页

### 🤖 Execution Context

- **Agent ID**: Codex
- **Base Model**: GPT-5
- **Runtime**: Codex Desktop

### 📥 User Query

> 解锁页面太丑了，重新设计一下。

### 🛠 Changes Overview

**Scope:** 微信小程序会员解锁页的视觉与信息层级；不修改登录、二维码配置或邀请码兑换协议。

**Key Actions:**

- **会员权益收口**：把原来的标题和三条同构权益卡合并为藏青“会员通行证”，集中展示 7 章、50 个场景、365 天和核心学习能力。
- **流程重排**：用同一白色流程容器组织“购买邀请码 → 已有邀请码兑换”，缩小二维码占比，增加点击放大、长按识别和流程提示。
- **表单与状态打磨**：重新设计邀请码输入、错误态、禁用态、按压反馈和会员已生效状态，保留原有接口与状态管理。
- **文档同步**：更新前端页面边界和解锁页视觉约束。

### 🧠 Design Intent (Why)

旧页面使用纯白通栏、三条同构权益卡和大尺寸二维码纵向堆叠，视觉像后台表单，首屏重点分散。新设计把权益压缩为一张商务会员通行证，让用户先理解“获得什么”，再清楚完成“获取邀请码”和“兑换邀请码”两步，同时保持项目既有的冷灰、藏青和小面积金色主题。

### 📁 Files Modified

- `miniprogram/pages/unlock/unlock.wxml`
- `miniprogram/pages/unlock/unlock.less`
- `docs/FRONTEND.md`
- `docs/DESIGN.md`
- `docs/histories/2026-07/20260712-1755-unlock-page-redesign.md`
