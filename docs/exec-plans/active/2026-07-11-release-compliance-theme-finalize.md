# 发布合规与主题定稿收尾

## 目标

清掉直接影响审核与发布的两件事：微信隐私协议合规，以及双主题择一定稿后的视觉收尾。

## 范围

- 包含：隐私保护指引与 PrivacyContract 授权流程核对、双主题定稿（删除弃用 palette、wxml 硬编码收尾、海报常量对齐）、头像上传压缩。
- 不包含：新功能。

## 背景

- 相关文档：`docs/QUALITY_SCORE.md`（安全行待办"确认隐私保护指引"）、`docs/DESIGN.md`（双主题切换机制）。
- 相关代码路径：`miniprogram/styles/theme.less`、`miniprogram/styles/palettes/`、`miniprogram/pages/course/course.wxml:207`（slider `activeColor="#6366F1"` 旧紫色硬编码）、`course.wxml:16`（navigation-bar `background="#FFF"`）、`miniprogram/utils/share-poster.ts`（`ACTIVE_SHARE_POSTER_THEME`）、`miniprogram/pages/index/index.ts`（头像 base64 直传）。
- 已知约束：wxml 内联属性吃不到 less 变量，定稿色需写死或从 ts data 注入。

## 风险

- 风险：隐私弹窗缺失导致审核被拒。
- 缓解：按微信《小程序用户隐私保护指引》核对收集项（头像、昵称），必要时接入 `wx.requirePrivacyAuthorize`。

## 里程碑

1. 用户在真机/开发者工具对比两套主题后定稿。
2. 删除弃用 palette 与海报配色分支，收尾 wxml 硬编码色，更新 DESIGN.md/FRONTEND.md 为单主题表述。
3. 隐私指引核对 + 授权流程验证 + 头像上传前压缩（`wx.compressImage`）。

## 验证方式

- 命令：`npm run typecheck && npm test && npm run release:check`。
- 手工检查：低版本基础库上的隐私弹窗行为；倍速弹层 slider 颜色与主题一致；课程页导航栏与页面底色无色差。

## 进度记录

- [ ] 主题定稿（用户决策）。
- [ ] 视觉收尾与文档更新。
- [ ] 隐私合规核对与验证。

## 决策记录

- 2026-07-11：建档。主题当前保留双套供对比，收尾动作在定稿后执行。
