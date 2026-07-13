# 架构总览

本仓库承载“外贸英语影子跟读”微信小程序。实现策略是复制 `englishpod` 小程序主体，再按外贸版差异白名单修改。后端运行基础复用 `/Users/simon/Documents/code/englishpod-server/server`，但数据、接口和授权 namespace 与 EnglishPod 隔离。

## 顶层结构

- `miniprogram/`：微信小程序源码和编译后的 `.js` 文件。
- `miniprogram/app.json`：定义“课程 / 复习 / 我的”三个原生一级 Tab；课程详情、知识点、解锁等保持二级页面，不出现在 Tab Bar。
- `miniprogram/pages/index/`：课程 Tab，展示 7 章外贸场景小节，默认第一章展开，并在课程树上方提供纯前端场景搜索。
- `miniprogram/pages/course/`：课程详情，提供通听、精练、跟读三阶段，以及课程词典查词、英美发音和 AI 讲解。
- `miniprogram/pages/learning/`：“我的”Tab，用一个紧凑学习概览展示累计练习时长、连续天数和完成小节数，并承载会员、练习帮助与反馈入口；不展示占屏较大的四周日历，未登录时保留访客状态，不自动跳页。
- `miniprogram/pages/review/`：“复习”Tab，本地资料库合并自动沉淀的生词与用户标记的难句，支持从来源提示回到对应课程原句；生词可直接听发音，并显示加载、播放和暂停状态。
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
- 客户端观测入口：`POST /api/waimao-mini/metrics`；只接收音源回退、音频加载超时和 API 错误三类低基数事件，结构化写入服务端日志。
- 学习记录：`POST /api/waimao-mini/users/me/study-time` 同时接收本次学习秒数和精练次数；`GET /api/waimao-mini/users/me/study-records` 按日聚合并返回摘要。`waimao_mini_study_sessions.practice_count` 通过启动迁移兼容既有数据库。
- 课程词典：构建时从固定版本 ECDICT 中抽取当前 50 个场景实际出现的普通单词，叠加项目外贸术语覆盖，生成约 480 KB 的 `resources/waimao-mini/dictionary.json`；邮箱、网址和产品型号不进入词典，任何真实课程词缺失都会让生成失败；`GET /api/waimao-mini/dictionary/:word` 匿名、限流并返回中文释义、英美音标及英美发音地址。
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
7. API 5xx/网络失败、CDN 音频加载超时和实际切源先在客户端采样聚合，再直连 `/api/waimao-mini/metrics` 批量上报；该请求不经过通用请求封装，失败静默丢弃，避免递归和弱网流量放大。
8. 首页场景搜索只过滤已经加载的章节树，不产生额外请求；查词结果与难句正文写入本地 `waimao_review_library_v1`，不上传录音或复习正文。
9. 学习主页调用 `/api/waimao-mini/users/me/study-records?days=28` 刷新累计摘要；接口仍保留按日数据供后续使用，但当前页面不展示日历。累计资料数量从本地复习库读取，因此第一期不承诺跨设备同步。
10. 课程长按查词只调用自家课程词典接口；中文释义和英美音标来自构建产物，英音/美音播放按用户决策继续使用有道发音地址。邮箱、网址和产品型号在字幕中保持原样但不可长按查词，数字后的 `cm/mm/pcs` 等单位仍可查询。客户端不再请求有道 JSON 或为每个单词调用 AI。

## 约束

- 不随意重做 EnglishPod 布局；只有用户确认的差异点可以改。
- 七牛密钥和私有 URL 签名只存在于后端；小程序仅接收短期地址，并始终保留服务器源作为回退。
- 观测 payload 不包含完整音频 URL、query、token、用户资料或录音；匿名 metrics 端点必须保持事件白名单、批量上限、body 上限和 IP 限流。
- 录音仍是“听完即弃”，不会进入复习库；复习库只保存查词元数据、来源句和用户主动标记的难句。
- Web 账号打通和双音频源持续监控属于后续阶段；小程序不接微信支付，购买会员邀请码走添加微信人工交付。
