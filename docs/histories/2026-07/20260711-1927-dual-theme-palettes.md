## [2026-07-11 19:27] | Task: 增加商务专业风配色并支持双主题切换

### Execution Context

- **Agent ID**: `Claude Code`
- **Base Model**: `Claude Fable 5`
- **Runtime**: `Claude Code CLI`

### User Query

> 还不错，我想再看一下商务风的配色，切换看看效果，再决定留哪个。

### Changes Overview

**Scope:** 主题体系重构为可切换双配色；不改布局、交互和页面逻辑。

**Key Actions:**

- `miniprogram/styles/theme.less` 改为切换入口（一行 `@import` 二选一）+ 共享语义色；完整调色板拆到 `styles/palettes/warm.less`（温暖学习风，即上一轮定稿的橘色系）和 `styles/palettes/business.less`（新增商务专业风：冷灰底 `#f5f7fb` + 藏青主色 `#1e40af/#1e3a8a` + 金色点缀 `#b45309`）。
- 补充令牌使两套配色可完整互换：`@accent/@accent-soft`（小面积点缀，business 用金色）、`@surface-alt/@popup-bg/@handle/@disabled-bg/@mask/@shadow-ink/@shadow-neutral/@tint-card-*/@text-soft`、角色色子令牌 `@tone-N-deep/-soft/-edge/-light/-tint`。
- 各页面 less 中残留的调色板相关硬编码（暖色阴影/遮罩/浅底卡/角色配对色/渐变末端色等）全部替换为令牌或 `fade(@token, N%)` 表达式。
- 分享海报抽出 `SHARE_POSTER_PALETTES`（warm/business 两套）+ `ACTIVE_SHARE_POSTER_THEME` 开关（`utils/share-poster.ts`），`pages/course/course.ts` 复用同一调色板。
- business 主题角色色把 warm 的天蓝位换成橘色位，避开藏青主色色相。
- 当前默认启用 **business** 供预览对比；warm 一行注释即可切回。

### Design Intent

用户要在温暖学习风和商务专业风之间对比后定稿。把上一轮遗留的硬编码全部收进令牌后，主题切换收敛为两处开关（less 一行 + 海报一个常量），对比成本最低，定稿后删掉弃用的 palette 文件即可。

### Verification

- 两套配色分别用 lessc 全量编译 13 个 less 文件通过。
- `npm run typecheck`、`npm test` 通过。

### Files Modified

- `miniprogram/styles/theme.less`、`miniprogram/styles/palettes/warm.less`（新建）、`miniprogram/styles/palettes/business.less`（新建）
- `miniprogram/pages/*/*.less`、`miniprogram/components/ai-popup/ai-popup.less`
- `miniprogram/utils/share-poster.ts`、`miniprogram/pages/course/course.ts`
- `docs/FRONTEND.md`、`docs/DESIGN.md`
