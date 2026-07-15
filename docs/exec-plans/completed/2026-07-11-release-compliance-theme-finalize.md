# 发布合规与主题定稿收尾

> 状态：已完成并归档（2026-07-13）。代码侧主题、隐私授权与头像压缩已经落地，微信后台合规配置和当前关闭态真机验收均已完成。

## 目标

清掉直接影响审核与发布的两件事：微信隐私协议合规，以及双主题择一定稿后的视觉收尾。

## 范围

- 包含：微信隐私保护指引与授权流程核对（头像/昵称 + **录音**）、双主题定稿为 business 的视觉收尾（删除 warm palette、wxml 硬编码收尾、海报常量对齐）、头像上传压缩。
- 不包含：新功能。

## 背景

- 相关文档：`docs/QUALITY_SCORE.md`、`docs/DESIGN.md`（双主题切换机制）。
- 相关代码路径：`miniprogram/styles/theme.less`、`miniprogram/styles/palettes/`、`miniprogram/pages/course/course.wxml`、`miniprogram/utils/share-poster.ts`、`miniprogram/pages/index/index.ts`（头像上传）、`miniprogram/pages/course/course.ts`（录音权限）。
- 已知约束：wxml 内联属性吃不到 less 变量，定稿色需写死或从 ts data 注入。

## 风险

- 风险：隐私弹窗缺失导致审核被拒（尤其录音属敏感权限）。
- 缓解：按微信《小程序用户隐私保护指引》核对收集项（头像、昵称、录音），接入 `wx.requirePrivacyAuthorize` / 隐私协议签署流程。

## 里程碑

1. ~~主题择一定稿~~（已定：**business 商务专业风**，2026-07-12）。
2. 删除 `styles/palettes/warm.less`、简化 `theme.less` 为单 import、`share-poster.ts` 只保留 business 调色板，收尾 course.wxml 两处硬编码色并更新 DESIGN.md/FRONTEND.md。
3. 隐私指引核对（头像/昵称/录音三项收集说明）+ 授权流程验证 + 头像上传前压缩（`wx.compressImage`）。

## 验证方式

- 命令：`npm run typecheck && npm test && npm run release:check`。
- 手工检查：低版本基础库上的隐私弹窗行为；录音首次触发的授权流程；倍速弹层 slider 颜色与 business 主题一致；课程页导航栏与页面底色无色差。

## 进度记录

- [x] 主题定稿：business（2026-07-12 用户决策）。
- [x] 视觉收尾与文档更新（删 warm palette、theme.less 单 import、course.wxml slider activeColor 走 `themeAccent`/navbar 与全站 navbar 背景改 `#F5F7FB`、unlock 图标改主色、DESIGN.md/FRONTEND.md 改单主题）（2026-07-12）。
- [x] 头像上传前 `wx.compressImage`（400 宽/quality 80，失败回退原图）、改 jpeg base64（2026-07-12）。
- [x] 录音权限流程：`decideRecordAuthAction` 纯逻辑判定 + 页面 getSetting/authorize/openSetting 接线；`scope.record` 由运行时授权，不能写入仅支持位置用途说明的 `app.json.permission`（2026-07-12 修正）。
- [x] 微信管理后台：隐私保护指引、相关发布合规配置和当前关闭态真机验收完成（2026-07-13 用户确认）。当前版本不展示邀请码入口，因此审核说明不再要求审核专用邀请码。

## 决策记录

- 2026-07-11：建档。主题当前保留双套供对比，收尾动作在定稿后执行。
- 2026-07-12：主题定稿 business；里程碑 1 关闭。录音权限（里程碑 3 期间新增的功能）纳入隐私合规范围。
- 2026-07-12：代码侧合规完成（运行时录音授权流程、头像压缩）。隐私保护指引正文属微信管理后台配置项，无法在仓库内完成，留作上线前人工操作项。
- 2026-07-12：真机前编译暴露 `app.json permission["scope.record"]` 无效；按官方配置结构删除该声明，录音仍通过 `wx.authorize` 授权并继续纳入隐私保护指引。
- 2026-07-13：用户确认微信后台合规项和真机验收已经完成。当前发布级总开关关闭，审核材料按 7 章正文全部开放、会员与音频能力暂不展示的实际体验编写，本计划完成并归档。
