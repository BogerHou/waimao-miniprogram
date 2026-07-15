## [2026-07-13 13:30] | Task: 暂时隐藏会员与音频能力

### 🤖 Execution Context

- **Agent ID**: Codex `/root`
- **Base Model**: GPT-5
- **Runtime**: Codex desktop

### 📥 User Query

> 移除首页交流悬浮框，并提供一个开关，暂时隐藏会员解锁、语音播放等功能和文案。

### 🛠 Changes Overview

**Scope:** 发布级功能开关、首页、课程、复习、“我的”页、旧深链防护、测试与文档。

**Key Actions:**

- **服务器单一总开关**：以服务器 `data/waimao-mini/app-config.json` 的 `interactiveFeaturesEnabled` 为真源，同时控制会员访问策略与客户端会员/音频呈现，默认关闭。
- **全部章节只读**：关闭时服务器放开全部章节正文，客户端展示 7 章并隐藏会员、练习方法、课程播放/录音和单词发音入口；复习回源只定位原句，不再自动播放。
- **收藏登录保全**：登录或 401 重新认证前快照本机词汇库与难句星标，认证后只恢复缺失 key，不覆盖新数据。
- **线上部署**：使用专用部署密钥同步后端源码，备份线上源码与配置后完成构建和 PM2 重启；线上接口确认开关为 `false`、7 章均未锁定且第二章详情匿名返回 200。
- **上线前配置复核**：2026-07-15 推送前探测发现生产配置曾漂移回 `true`；备份配置后恢复为 `false`，无需重启，随后确认 7 章、50 个场景锁定数均为 0，第二章首节匿名返回 200。
- **移除首页悬浮框**：删除交流反馈悬浮按钮、事件方法和对应样式；“我的”页交流入口保留。
- **旧链接防护**：关闭时访问解锁页或练习帮助页会回到课程 Tab，避免旧分享链接暴露暂时关闭的内容。
- **回归覆盖**：增加总开关一致性测试和关闭音频后的复习回源路由测试。
- **发布收口**：微信后台合规配置和当前关闭态真机验收已由用户确认完成；发布说明改为 7 章正文全开放，不再要求审核邀请码或引导隐藏的音频能力。
- **上传质量提示**：开发者工具指出品牌图标超过 200 K，以及代码包存在无依赖文件。已确认 261,045 字节的品牌图标仍被联系页和分享功能使用；无依赖过滤保持关闭是为了避免 TypeScript 辅助模块被误删。本轮遵循用户要求只更新文档，不修改代码、资源或项目配置。

### 🧠 Design Intent (Why)

会员与音频能力需要一起快速下线和恢复。把决策收口到服务器配置并复用课程页已有只读模式，可以避免前后端判断分叉；关闭时服务器同步放开正文访问，因此 7 章均可见可读且不会被 403 拒绝。

### 📁 Files Modified

- `miniprogram/config/feature-flags.ts`
- `miniprogram/utils/review-storage-guard.ts`
- `englishpod-server/server/data/waimao-mini/app-config.json`
- `englishpod-server/server/src/routes/waimao-mini.ts`
- `miniprogram/pages/index/`
- `miniprogram/pages/course/`
- `miniprogram/pages/review/`
- `miniprogram/pages/learning/`
- `miniprogram/pages/unlock/unlock.ts`
- `miniprogram/pages/practice-help/practice-help.ts`
- `tests/`
- `docs/`
