## [2026-07-12 12:20] | Task: 阶段 A 发布合规——business 主题定稿收尾 + 隐私权限流程

### Execution Context

- **Agent ID**: `Claude Code`
- **Base Model**: `Claude Fable 5`
- **Runtime**: `Claude Code CLI`

### User Query

> 你上面提到的都需要做。你做成计划，具体编码你可以调用 codex 来写。（主题定稿 business）

### Changes Overview

**Scope:** 发布合规计划代码侧（主题收尾 + 录音权限 + 头像压缩）；不含微信后台隐私指引配置（人工项）。

**Key Actions:**

- 主题定稿 business：删除 `styles/palettes/warm.less`，`theme.less` 简化为单 import；`course.wxml` slider `activeColor` 改走页面 data `themeAccent`（新增常量 `THEME_ACCENT_COLOR='#1e40af'`）；全站 8 个页面 navbar `background` `#FFF→#F5F7FB`；unlock 会员权益图标 `#6366f1→#1e40af`。
- 头像上传：`wx.compressImage`（400 宽 / quality 80，失败回退原图）+ 改 jpeg base64。
- 录音权限：新增 `pages/course/record-auth.ts`（`decideRecordAuthAction` 纯逻辑：已授权→start / 未询问→request / 曾拒绝→guide-setting）+ 页面 `handleToggleRecording` 接 getSetting→authorize→openSetting；`app.json` 声明 `permission.scope.record` 说明文案（强调本地对比、不保存不上传）。
- 文档：DESIGN.md 由双主题令牌对照表改为 business 单列；FRONTEND.md 去掉双主题/切换表述，补 wxml 内联色取值规则。
- 测试：`tests/record-auth.test.ts` 覆盖三种授权分支。

### Design Intent

主题定稿后消除双套维护成本与 wxml 里最后的旧品牌色。录音是敏感权限，把"授权决策"抽成纯函数便于测试，页面只做 wx API 编排；权限被拒时引导去设置而非静默失败。

### Verification

- `npm run typecheck`、`npm test`（含 record-auth）、`npm run release:check`、index.less lessc 编译通过。
- 待真机：录音首次授权/拒绝后引导、business 单主题全站配色、导航栏与页面底色一致。

### Files Modified

- `miniprogram/styles/theme.less`、删 `styles/palettes/warm.less`
- `miniprogram/pages/course/{course.ts,course.wxml,record-auth.ts(新建)}`
- `miniprogram/pages/index/index.ts`、`miniprogram/app.json`
- 8 页 `*.wxml` navbar 背景、`pages/unlock/unlock.wxml` 图标
- `tests/record-auth.test.ts`(新建)、`tests/run-all.ts`
- `docs/DESIGN.md`、`docs/FRONTEND.md`、两份 exec plan

### Notes

- 微信管理后台的隐私保护指引正文（头像/昵称/录音收集说明）无法在仓库内完成，留作上线前人工操作项，已在 release-compliance 计划标注。
