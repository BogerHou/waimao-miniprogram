# 设计原则

这份文档沉淀小程序的视觉设计体系。2026-07 改版脱离 EnglishPod 复刻配色，定稿主题为 **business 商务专业风**：冷调浅灰底 + 藏青主色 `#1e40af` + 金色点缀 `#b45309`，突出外贸商务定位（2026-07-12 定稿）。

## 主题结构

- 令牌定义在 `miniprogram/styles/palettes/business.less`，由 `miniprogram/styles/theme.less` 引用（共享语义色 `success`/`error` 在 `theme.less`）。
- 分享海报 canvas 颜色在 `miniprogram/utils/share-poster.ts` 的单一 `SHARE_POSTER_PALETTE`。
- 新增令牌先加进 `business.less` 再使用。

## 视觉原则

- 阅读优先：学习内容（字幕、知识点正文）永远比操作标签更醒目；字号体系分层放大，不做全局等比缩放（详见 `docs/FRONTEND.md`）。
- 布局克制：布局与交互沿用既有结构，视觉改动以换肤为主；不新增营销视觉、不加装饰性大图。
- 全部颜色走令牌：页面和组件一律 `@import "styles/theme.less"`，禁止新增独立变量块或硬编码主题色；带透明度的衍生色用 `fade(@token, N%)` 表达，保证换主题时自动跟随。

## 颜色令牌

唯一真源：`miniprogram/styles/theme.less`（共享语义色）+ `miniprogram/styles/palettes/business.less`（完整调色板）。

| 令牌 | business | 用途 |
|---|---|---|
| `@page-bg` | `#f5f7fb` | 页面底色 |
| `@page-bg-deep` | `#e9edf5` | 内嵌区域、分段控件底、骨架屏 |
| `@surface` / `@surface-alt` | `#ffffff` / `#fbfcfe` | 卡片表面 / 锁定卡、渐变末端 |
| `@popup-bg` | `#f3f5f9` | AI 弹层底 |
| `@text` / `@text-soft` | `#1e293b` / `#475569` | 主文字 / 强调正文 |
| `@muted` / `@faint` | `#64748b` / `#94a3b8` | 次要 / 辅助文字 |
| `@line` / `@handle` / `@disabled-bg` | 冷灰系 | 分隔线 / 弹层把手 / 禁用底 |
| `@primary` 系 | 藏青 `#1e40af/#1e3a8a/#1e3a8a/#e8edfb` | 主操作、强调 |
| `@accent` / `@accent-soft` | 金 `#b45309` / `#fdf3dc` | eyebrow、标签、徽章等小面积点缀 |
| `@selection` / `@selection-line` | `#eef3fd` / `#1e40af` | 课程页当前播放句 |
| `@tint-card-bg` / `@tint-card-border` | `#f7f9ff` / `#d9e2f5` | 场景背景卡、会员权益卡 |
| `@hero-gradient` | 藏青渐变 | 首页个人卡、主按钮渐变 |
| `@shadow-ink` / `@shadow-neutral` / `@mask` | 藏青/石板系 | 阴影基色（配 `fade()`）与遮罩 |
| `@success` / `@error` 系 | 共享 | 语义色，定义在 theme.less，不随主题变化 |
| `@tone-0..5`（含 `-deep/-soft/-edge/-light/-tint`） | teal/violet/orange/pink/gold/slate | 对话角色区分色 |

## 角色色规范

- 课程页字幕卡：左侧 8rpx 竖线用 `@tone-N`，卡片保持白底；当前句用 `@selection-line` 边框 + `@selection` 浅底，优先级高于角色色。
- 知识点页对话：说话人徽章用 `@tone-N-deep/-soft/-edge`，气泡用 `@tone-N-light/-tint`，不同说话人色相差异必须明显。
- 角色色刻意避开主色蓝色相，避免与选中态、主按钮混淆。

## 形状与阴影

- 圆角：卡片 `20rpx`（课程字幕卡 `18rpx`）、hero 大卡 `24rpx`、按钮和输入框 `16rpx`、底部弹层 `28rpx 28rpx 0 0`。
- 阴影：一律 `fade(@shadow-ink, N%)` / `fade(@shadow-neutral, N%)` / `@shadow-soft` / `@shadow-primary`，柔和低透明度；不硬编码阴影色。
- 解锁页会员通行证使用 `@hero-gradient` 和低透明度同心圆营造票证层次；正文流程回到 `@surface`，金色只用于小标签和步骤强调，避免整页同时出现多块高饱和视觉焦点。

## 例外（不跟随主题）

- 微信品牌绿：AI 弹层用户气泡 `#95ec69`、头像底 `#e1f3d8`、绿色标题 `#55a532`。
- 语义色：错误红、Chinglish 纠错的红/绿对照块、完成态绿色。
- `navigation-bar` 组件的 weui 变量。
