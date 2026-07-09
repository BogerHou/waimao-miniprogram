# 外贸英语影子跟读小程序复刻计划

## 目标

在本仓库落地一个外贸版微信小程序，主体复刻 `englishpod` 小程序的页面布局、播放交互、AI 讲解、查词和微信登录体验，只在外贸产品明确差异处修改。后端复用 `englishpod-server` 的运行基础、微信登录、AI 和静态资源能力，但使用独立的 `waimao-mini` API 前缀、数据目录和 SQLite 表，避免影响 EnglishPod 项目。

## 范围

- 包含：
  - 复制 `englishpod` 小程序主体到本仓库。
  - 首页改为 7 章展开小节，默认第一章展开。
  - 第一章免费，后 6 章锁定；邀请码解锁全部章节 1 年访问权。
  - 微信登录逻辑与 EnglishPod 保持一致，允许第一章未登录试学。
  - 进度按小节保存，并记录到句子位置；章节进度由小节汇总。
  - 小节练习只播放当前小节音频范围，尤其 Shadow 模式不能串到下一小节。
  - 详情页原知识点悬浮入口替换为外贸知识点页。
  - 配色沿用 EnglishPod，产品名为“外贸英语影子跟读”。
  - 首页广告默认不显示，广告位置展示解锁提示 tab。
  - 后端新增 `waimao-mini` 课程、微信用户、进度、邀请码/权益、配置接口。
  - 补充必要测试、文档和 history。
- 不包含：
  - 和 `外贸口语` Web 版账号体系打通。
  - 微信支付；会员购买通过添加微信获取邀请码，小程序内只负责兑换。
  - 上 CDN/R2；第一版使用 server 静态资源。
  - 自由 redesign 或大幅布局调整。

## 背景

- 相关文档：
  - `docs/REPO_COLLAB_GUIDE.md`
  - `docs/ARCHITECTURE.md`
  - `docs/FRONTEND.md`
  - `docs/SECURITY.md`
  - `docs/HISTORY_GUIDE.md`
- 相关代码路径：
  - 目标小程序：`/Users/simon/Documents/code/waimao-miniprogram`
  - 复刻来源：`/Users/simon/Documents/code/englishpod/miniprogram`
  - 后端：`/Users/simon/Documents/code/englishpod-server/server`
  - 外贸数据：`/Users/simon/Documents/code/外贸口语/public/data/lessons.json`
- 已知约束：
  - 用户明确要求完整复刻 EnglishPod，只有差异白名单内可改。
  - 后端可以同服务复用，但业务数据不能互相影响。
  - 小程序包不能包含 59M 外贸音频，音频必须走服务端静态资源。

## 风险

- 风险：复制 EnglishPod 时引入 EnglishPod 品牌、CDN、课程数据硬编码。
  - 缓解方式：集中替换 API 前缀、产品名、静态资源路径和音频源策略，并增加测试覆盖。
- 风险：Shadow 模式播放整章音频时越过当前小节。
  - 缓解方式：课程详情携带小节 `playStart/playEnd`，前端进入小节时从起点播，到终点自动停止。
- 风险：外贸小程序用户数据污染 EnglishPod 用户数据。
  - 缓解方式：新增 `waimao_mini_*` 表和 `/api/waimao-mini/*` 接口，不复用 `/api/auth`、`/api/users`、`/api/courses`。
- 风险：目标仓库文档仍是模板占位，后续 Agent 难以继续协作。
  - 缓解方式：同步更新架构、前端、安全、可靠性、CI/CD、产品判断文档。

## 里程碑

1. 调研与方案收敛：确认复制边界、后端隔离方式和数据转换契约。
2. 后端实现：新增外贸小程序数据生成、接口、表结构、测试。
3. 小程序实现：复制 EnglishPod 并只修改差异白名单。
4. 验证与收尾：运行数据校验、后端测试、TypeScript 编译、小程序测试脚本，补文档和 history。

## 验证方式

- 命令：
  - `npm run data:validate`（外贸数据源）
  - `npm test`（后端）
  - `npm run build`（后端）
  - `npm test`（小程序可运行测试）
- 手工检查：
  - 首页 7 章展开小节，第一章默认展开，后 6 章锁定。
  - 详情页布局与 EnglishPod 保持一致，悬浮知识点按钮跳到外贸知识点页。
  - Shadow/Echo 播放只在当前小节范围内工作。
- 观测检查：
  - API 路径均使用 `/api/waimao-mini/*`。
  - SQLite 表均使用 `waimao_mini_*`。
  - 音频路径均使用 `/static/waimao-mini/audio/*`。

## 进度记录

- [x] 确认范围和约束。
- [x] 复制小程序主体。
- [x] 完成后端 `waimao-mini` 命名空间。
- [x] 完成小程序差异点。
- [x] 完成验证并记录结果。

## 决策记录

- 2026-07-09：采用“完整复刻 EnglishPod + 差异白名单修改”的方式，避免重写成熟的音频和 AI 交互。
- 2026-07-09：后端采用同服务、不同 API 前缀、不同 SQLite 表、不同数据目录，保证 EnglishPod 与外贸小程序数据隔离。
- 2026-07-09：第一版不上 CDN，音频走服务端静态资源，后续作为性能优化项提醒处理。
- 2026-07-09：`project.config.json` 已配置外贸小程序 appid；切换发布账号前需要再次确认。
- 2026-07-09：开发者工具、体验版和正式版默认都请求线上 `https://englishecho.site`；本地后端只作为临时联调开关。
- 2026-07-09：根据用户后续确认，外贸版不再参考 Web 版黑白灰配色，改回 EnglishPod 紫蓝/蓝色体系。

## 验证结果

- 2026-07-09：小程序 `npm run typecheck` 通过。
- 2026-07-09：小程序 `npm test` 通过。
- 2026-07-09：后端 `npm run build` 通过。
- 2026-07-09：后端 `npm test` 通过。
- 2026-07-09：修复微信开发者工具 page.json 分享字段校验报错，并补充小程序 `npm test` 回归。
