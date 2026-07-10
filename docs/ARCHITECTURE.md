# 架构总览

本仓库承载“外贸英语影子跟读”微信小程序。`main` 保留复制 EnglishPod 后按外贸差异修改的稳定版；`codex/scenario-speaking-coach` 在不改经典页的前提下新增“外贸场景口语教练”实验入口。后端运行基础继续复用 `englishpod-server/server`，但数据、接口和授权 namespace 与 EnglishPod 隔离。

## 顶层结构

- `miniprogram/`：微信小程序源码和编译后的 `.js` 文件。
- `miniprogram/pages/coach/`：实验版默认首页，承载学习、场景、复习和我的四个主视图；学习页提供下一步建议和用户训练清单，但不规定每天的学习数量。
- `miniprogram/pages/training/`：实验版五阶段训练页，独立管理场景原声、单句原声、本地录音和训练总结。
- `miniprogram/pages/index/`：首页，展示 7 章外贸场景小节，默认第一章展开。
- `miniprogram/pages/course/`：课程详情，保留 EnglishPod 的 Shadow/Echo/查词/AI 讲解交互。
- `miniprogram/pages/knowledge/`：外贸知识点新页面，展示 Web 数据中的背景、重点表达、纠错、备注和对话。
- `miniprogram/pages/unlock/`：小程序专用邀请码解锁页；进入前要求用户填写头像/昵称完成登录，页面内展示微信二维码、会员权益和邀请码兑换控件。
- `miniprogram/utils/api.ts`：外贸小程序 API 客户端，统一使用 `/api/waimao-mini/*`。
- `miniprogram/utils/coach-model.ts`：从现有课程字幕推导业务目标、学习者角色、关键表达和回应挑战。
- `miniprogram/utils/coach-progress.ts`：本机保存训练阶段、句子自评、复习计划和最近一次录音路径。
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

## 经典版数据流

1. 小程序首页调用 `/api/waimao-mini/courses` 获取章节树、锁定状态、进度和 app config。
2. 小节详情调用 `/api/waimao-mini/courses/:id` 获取场景字幕、整章音频地址、小节播放范围和知识点；字幕数据由后端生成脚本优先按外贸源数据的词级 SRT 切成短句 cue。
3. Shadow 模式使用整章音频，但前端用小节 `range.start/end` 和短句 cue `start/end` 限制播放范围。
4. 完成小节后调用 `/api/waimao-mini/users/me/progress`，前端上报 `sceneId`、`cueIndex` 和 `totalCues`，后端按小节保存 cue 进度并汇总章节进度。
5. 点击首页解锁提示或锁定小节时先强制微信登录，再进入解锁页。
6. 邀请码解锁调用 `/api/waimao-mini/invite/redeem`，写入小程序专用 entitlement；会员权益为全部章节 1 年访问权。

## 场景教练数据流

1. `pages/coach` 复用课程列表、后端进度、entitlement 和 app config，只从当前可访问场景中建议下一步；优先级依次为未完成训练、用户训练清单、后端当前进度和未学习场景，建议不限制用户自由选择。
2. `pages/training` 复用课程详情中的字幕、音频和 `range.start/end`，但使用独立轻量音频上下文，不修改经典课程页的复杂播放状态机。
3. `coach-model` 把学习者台词转成“先回应、后看参考”的挑战，并保留原字幕作为逐句表达真源；43 个对话场景优先识别 `Yibing` 为学习者，7 个“句子 N”表达库场景切换为整组表达训练。
4. 用户自评、复习到期时间、训练清单和录音路径保存在 `waimao_coach_progress_v1` 本地存储；旧缓存缺少训练清单字段时自动补空数组。录音通过 `wx.saveFile` 留在本机，新录音会替换并清理同句旧文件。
5. 已登录用户仍通过现有进度接口同步当前 cue 和场景完成状态；表达自评与录音当前不上传，也不宣称可以跨设备恢复。
6. 场景完成后从训练清单移除，用户可以继续选择其他场景或回到学习台；复习页只列出“需要巩固”或已到复习时间的表达。

## 约束

- `main` 的经典复刻版不随意重做 EnglishPod 布局；实验分支的新页面与经典页保持明确边界。
- 第一版不上 CDN，音频从服务端静态目录加载。
- Web 账号打通和 CDN 优化都是后续阶段；小程序不接微信支付，购买会员邀请码走添加微信人工交付。
- 第一版不上传训练录音、不做自动语音评分；引入云端语音能力前必须重新评估授权、隐私、成本和评价可信度。
