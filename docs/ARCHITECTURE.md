# 架构总览

本仓库承载“外贸英语影子跟读”微信小程序。实现策略是复制 `englishpod` 小程序主体，再按外贸版差异白名单修改。后端运行基础复用 `/Users/simon/Documents/code/englishpod-server/server`，但数据、接口和授权 namespace 与 EnglishPod 隔离。

## 顶层结构

- `miniprogram/`：微信小程序源码和编译后的 `.js` 文件。
- `miniprogram/pages/index/`：首页，展示 7 章外贸场景小节，默认第一章展开。
- `miniprogram/pages/course/`：课程详情，保留 EnglishPod 的 Shadow/Echo/查词/AI 讲解交互。
- `miniprogram/pages/knowledge/`：外贸知识点新页面，展示 Web 数据中的背景、重点表达、纠错、备注和对话。
- `miniprogram/pages/unlock/`：小程序专用邀请码解锁页；进入前要求用户填写头像/昵称完成登录，页面内展示微信二维码、会员权益和邀请码兑换控件。
- `miniprogram/utils/api.ts`：外贸小程序 API 客户端，统一使用 `/api/waimao-mini/*`。
- `miniprogram/store/`：轻量全局状态，保存登录用户、进度、app config 和 full access entitlement。
- `tests/`：可在 Node 环境运行的小程序纯逻辑测试。
- `docs/`：协作、架构、质量和变更历史。

## 后端边界

后端代码不在本仓库内，当前落在 `englishpod-server/server`：

- 路由前缀：`/api/waimao-mini`
- 数据表：`waimao_mini_users`、`waimao_mini_sessions`、`waimao_mini_invite_codes`、`waimao_mini_invite_labels`、`waimao_mini_entitlements`、`waimao_mini_progress`、`waimao_mini_study_sessions`
- 数据目录：`server/data/waimao-mini`
- 静态音频：`server/static/waimao-mini/audio`
- 数据生成脚本：`npm run waimao-mini:generate`
- 邀请码脚本：`npm run waimao-mini:invite -- <code>`

这个边界保证外贸小程序不读写 EnglishPod 的用户、进度、课程表，也不影响外贸 Web 版账号。

## 数据流

1. 小程序首页调用 `/api/waimao-mini/courses` 获取章节树、锁定状态、进度和 app config。
2. 小节详情调用 `/api/waimao-mini/courses/:id` 获取场景字幕、整章音频源、小节播放范围和知识点；新版接口通过 `audioSources` 返回七牛私有签名地址和服务器签名备用源，旧 `audio` 字段保持服务器地址以兼容旧版客户端。
3. Shadow 模式优先使用七牛整章音频，加载失败时按 `provider` 回退服务器源；前端继续用小节 `range.start/end` 和短句 cue `start/end` 限制播放范围。
4. 完成小节后调用 `/api/waimao-mini/users/me/progress`，前端上报 `sceneId`、`cueIndex` 和 `totalCues`，后端按小节保存 cue 进度并汇总章节进度。
5. 点击首页解锁提示或锁定小节时先强制微信登录，再进入解锁页。
6. 邀请码解锁调用 `/api/waimao-mini/invite/redeem`，写入小程序专用 entitlement；会员权益为全部章节 1 年访问权。

## 约束

- 不随意重做 EnglishPod 布局；只有用户确认的差异点可以改。
- 七牛密钥和私有 URL 签名只存在于后端；小程序仅接收短期地址，并始终保留服务器源作为回退。
- Web 账号打通和双音频源持续监控属于后续阶段；小程序不接微信支付，购买会员邀请码走添加微信人工交付。
