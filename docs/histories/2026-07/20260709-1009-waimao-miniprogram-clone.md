## [2026-07-09 10:09] | Task: 复刻外贸小程序

### 🤖 Execution Context

- **Agent ID**: `Codex`
- **Base Model**: `GPT-5`
- **Runtime**: `Codex desktop`

### 📥 User Query

> 复刻一个外贸版影子跟读小程序：小程序部分尽量直接复制 EnglishPod，只修改外贸数据、7章首页、第一章免费/后续锁定、邀请码/付费解锁、知识点新页、播放范围、外贸配色和后端数据隔离等明确差异。

### 🛠 Changes Overview

**Scope:** 小程序仓库 `waimao-miniprogram`，以及复用后端 `englishpod-server/server` 的 `waimao-mini` namespace。

**Key Actions:**

- **复制小程序主体**：从 EnglishPod 复制小程序结构、练习页、AI 弹层、查词、分享和测试基础。
- **新增外贸小程序后端隔离层**：添加 `/api/waimao-mini/*` 路由、`waimao_mini_*` 表、邀请码 entitlement、小节进度、学习时长、头像上传。
- **生成外贸课程数据**：从外贸 Web 数据生成 7 章、50 个小节、课程详情 JSON 和服务端静态音频。
- **实现小程序差异**：首页改为 7 章展开小节，默认第一章展开；后 6 章锁定；新增解锁页和知识点页；课程 Shadow 播放限制在当前小节范围。
- **更新品牌和配色**：名称改为“外贸英语影子跟读”；配色按后续确认改回 EnglishPod 紫蓝/蓝色体系。
- **补验证和文档**：添加小程序测试入口，更新架构、前端、安全、稳定性、CI/CD、产品和质量文档。

### 🧠 Design Intent (Why)

用户明确要求“完整复刻 EnglishPod，只有差异白名单内可改”。因此实现上保留 EnglishPod 的成熟练习体验，把风险集中在数据适配、播放范围、解锁和后端隔离四个点；后端采用同服务不同 namespace，复用部署和 AI 能力，同时避免污染 EnglishPod 用户和进度数据。

### 📁 Files Modified

- `miniprogram/pages/index/index.ts`
- `miniprogram/pages/index/index.wxml`
- `miniprogram/pages/course/course.ts`
- `miniprogram/pages/knowledge/knowledge.ts`
- `miniprogram/pages/unlock/unlock.ts`
- `miniprogram/utils/api.ts`
- `miniprogram/store/index.ts`
- `package.json`
- `docs/ARCHITECTURE.md`
- `docs/FRONTEND.md`
- `docs/SECURITY.md`
- `docs/RELIABILITY.md`
- `docs/CICD.md`
- `docs/PRODUCT_SENSE.md`

### 🔧 Follow-up: 小程序开发者工具报错修复

- 移除各页面 `.json` 中当前开发者工具不支持的 `enableShareAppMessage` 和 `enableShareTimeline` 字段，保留页面 TS 内的分享回调逻辑。
- 将 API 基址改为按小程序环境选择：`develop` 请求本地 `http://127.0.0.1:4000`，体验版/正式版请求线上域名。
- 新增页面 JSON 配置扫描和 API 环境选择测试，避免后续复制页面时再次引入同类报错。

### 🔧 Follow-up: 本地联调与控制台警告收敛

- 确认 `ERR_CONNECTION_REFUSED` 的根因是开发者工具已请求本地 `127.0.0.1:4000`，但复用后端未运行。
- 新增 `npm run dev:backend`，可从小程序仓库直接启动 `englishpod-server`。
- 导航栏组件改用 `getWindowInfo` / `getDeviceInfo` 主路径，避免新版基础库提示 `getSystemInfo` 废弃。
- 导航栏样式移除组件 WXSS 中的标签选择器，避免开发者工具的 selector 警告。
- 开发者工具不支持 `setInnerAudioOption` 时不再打印失败警告；真机上的失败仍会保留日志。

### 🔧 Follow-up: 配色回到 EnglishPod

- 根据用户确认，外贸版小程序不再沿用外贸 Web 版黑白灰配色，恢复 EnglishPod 的紫蓝首页、蓝色练习页和浅蓝灰背景/文字体系。
- 新增的知识点页、解锁页使用同一套 EnglishPod 颜色变量，不改变页面结构。

### 🔧 Follow-up: 进度 cue 信息补齐

- 审计发现后端已支持 `cueIndex`、`totalCues` 和 `completedCueIndexes`，但小程序完成上报只传了 `sceneId + status`。
- 扩展小程序进度请求 payload，完成小节时同步上报最后 cue 位置和总 cue 数，保持“小节粒度 + cue 位置”的进度模型。
- 新增 `progress-payload` 单元测试，防止进度请求体退化。

### 🔧 Follow-up: 外贸小程序微信登录配置隔离

- 审计发现外贸小程序登录路由复用了通用 `WECHAT_APPID` / `WECHAT_SECRET`，在外贸小程序 appid 与 EnglishPod 不同时会导致正式微信登录换 session 失败。
- 后端 `waimao-mini` 登录改为读取 `WAIMAO_MINI_WECHAT_APPID` / `WAIMAO_MINI_WECHAT_SECRET`，EnglishPod 原登录配置不受影响。

### 🔧 Follow-up: 解锁页和知识点页口径收敛

- 根据用户确认，小程序不接微信支付；商业化路径改为用户扫码添加微信购买会员邀请码，小程序内只负责兑换邀请码并解锁全部权益。
- 解锁页移除付费占位，新增微信二维码展示、预览和会员邀请码兑换的一页式流程；首页解锁 tab 仍由 `unlockPromptEnabled` 控制且默认展示。
- 知识点页面内容区移除章节和小节标题信息，仅保留知识点正文和对话内容，标题信息由页面导航栏承担。

### 🔧 Follow-up: 解锁入口登录和页面瘦身

- 首页解锁提示和锁定小节跳转解锁页前，先调用现有微信登录流程；登录失败则停留在当前页。
- 解锁页支持直达兜底登录，未登录无法直接填邀请码兑换权益。
- 解锁页删掉网页式标题说明和次级登录按钮，保留二维码、简短提示、邀请码输入和解锁按钮。

### 🔧 Follow-up: 解锁登录资料和一年会员权益

- 修正“去解锁”静默调用 `ensureAuth()` 导致创建默认 `Learner` 用户的问题；未登录或当前仍是默认 `Learner` 昵称时，改为打开首页头像/昵称登录弹窗，用户确认后再进入解锁页。
- 解锁页直达时不再静默创建用户，未登录会返回首页。
- 后端 `waimao-mini` entitlement 新增 `expires_at`，邀请码兑换授予全部章节 1 年访问权，并按到期时间判断后 6 章是否解锁。
- 解锁页增加简短会员权益说明：全部 7 章、1 年访问权限。

### 🔧 Follow-up: 首页目录信息瘦身

- 根据用户确认，主页定位为课程章节目录，不再展示“已完成 / 小节 / 进度 / 时间”等学习统计卡片。
- 章节卡片移除小节数量和章节进度条，小节条目移除“几句 / 多少秒”等训练元信息，只保留标题、锁定/完成状态和进入动作。
- 同步清理主页不再使用的完成率、学习时长和时长格式化派生字段；完成状态和进度数据仍保留用于小节状态、登录同步和分享卡片。
- 首页头像区域隐藏连续学习天数 badge，避免新用户看到 `0 day streak` 的负反馈；streak 数据仍保留给后续激励设计和分享卡片。
- 首页解锁提示改成更轻的小程序会员入口：使用“会员权益 / 全部章节开放 1 年 / 添加微信购买邀请码，解锁后 6 章。”文案，并收窄按钮、降低横幅感。
- 更新前端文档，明确首页不是学习统计仪表盘，避免后续复刻旧结构时把冗余信息带回。

### 🔧 Follow-up: 学习进度和继续学习入口

- 修复用户进入课程但未标记完成时不会记录当前位置的问题；课程页加载、切换句子、隐藏和卸载时会轻量同步当前小节与 cue 位置。
- 首页新增“继续学习”入口，展示后端 `currentSceneId` 对应的小节，并可直接回到上次学习位置。
- 小节列表保留轻量进度状态：当前小节显示“上次学到”，已完成小节保留勾选状态；仍不恢复四个统计卡片。

### 🔧 Follow-up: 移除详情页手动完成按钮

- 详情页移除底部“完成课程”按钮和“已完成”卡片，避免用户在练习流之外手动维护进度。
- Shadow 播放到当前小节末尾、或 Echo 播完最后一句时自动同步完成状态；首页继续负责展示“已完成”结果。

### 🔧 Follow-up: 配置购买与交流群二维码

- 解锁页购买二维码改为读取服务端静态路径 `/static/images/waimao-purchase-wechat-qr.jpg`，避免和 EnglishPod 图片互相覆盖。
- 交流与反馈页二维码改为读取服务端静态路径 `/static/images/waimao-community-qr.jpg`。
- 二维码展示改为按长图比例渲染，支持点击预览和长按菜单，避免微信截图式二维码被压进正方形后难以识别。

### 🔧 Follow-up: 知识点对话拆句和说话人配色

- 知识点页“对话原文”改为按中英文句末标点拆分长句，降低单段阅读压力。
- 为说话人分配稳定色彩，同一说话人的英文和中文段落使用同一套颜色，方便快速区分轮次。
- 新增对话拆句测试，覆盖英文、中文、百分比小数和邮箱片段等边界。

### 🔧 Follow-up: 课程详情字幕同步拆句

- 将同一套对话拆句和说话人配色应用到课程详情页字幕卡片，解决练习页长句没有变化的问题。
- 字幕拆句只改变展示层，原始 subtitle cue、播放定位、查词 token 和进度同步逻辑保持不变。

### 🔧 Follow-up: 课程详情字幕拆成可播放短句

- 修正上一版只在单个字幕卡片内分段的问题，改为把长 subtitle cue 拆成多个短字幕条目。
- 每个短字幕条目保持“英文在上、对应中文在下”的原布局，并沿用同一说话人的颜色区分。
- 每个短字幕条目在原 cue 时间范围内按句子长度估算独立 start/end，Echo 点击播放和 Shadow 高亮会跟随短句范围。

### 🔧 Follow-up: 课程详情字幕角色分色与行距

- 增强详情页字幕卡片的角色分色，不再只依赖左侧细边线；普通态和播放态都会保留同一说话人的稳定边框与浅底色。
- 收紧英文短句行距，避免长句拆短后换行间距过大，影响跟读时的视觉连续性。

### 🔧 Follow-up: 词级 SRT 驱动短句播放时间

- 后端 `waimao-mini` 数据生成脚本接入外贸源数据的词级 SRT，长字幕拆短句时优先用短句首尾词确定真实 `start/end`，减少前后多余语音。
- 生成数据为短句标记 `timingSource`、`sourceSubtitleId` 和分段信息；小程序详情页识别这些字段后直接使用后端时间，只在旧数据缺失时保留前端估算兜底。
- 重新生成 50 个小节课程 JSON，第一小节示例从 6 条原始 cue 扩展为 13 条短句 cue。

### 🔧 Follow-up: 词级 SRT 匹配异常收敛

- 修复 `a. m.` / `p. m.` 被拆成 `m.` 残片的问题，并清理 `Soundgood`、`lunderstand`、尾随 `...1` 等确定性源文本瑕疵。
- 为 `Yibing` 的词级识别变体、`ok/okay` 和型号编号加归一化匹配，避免短寒暄句和型号句回退到估算时间。
- 重新生成 50 个小节课程 JSON，短句 `timingSource` 从 26 条 `estimated` 收敛到 0 条。

### 🔧 Follow-up: 短句中英文配对修复

- 修复长 cue 拆短句后英文与中文错位的问题；当英文句数多于中文硬句数时，后端会结合英文句长比例和中文逗号、分号、破折号、顿号等软标点切分中文。
- 对没有软标点但源中文压缩成一句的场景，按英文句长比例在中文字符边界兜底切分，避免第二句出现空中文。
- 重新生成 50 个小节课程 JSON，全量检查分段后空中文数量为 0，短句时间仍全部来自 `word-srt` 或 `source-cue`。

### 🔧 Follow-up: 知识点页面结构化展示

- 修复知识点页仍把 Web 版知识点当纯文本整块展示的问题；小程序现在会把背景、词汇和句型、Chinglish Correction、毅冰补充和对话原文拆成独立内容块。
- 词汇和句型解析成“术语 + 释义”列表，并合并源数据中被换行打断的释义；Chinglish Correction 拆成题干、Chinglish 和 Native English 对照卡片。
- 新增知识点格式化测试，并确保 `npm test` 会重新编译 `knowledge.js`，避免 TS 改动后开发者工具页面无变化。

### 🔧 Follow-up: 知识点页标题和角色颜色微调

- 移除知识点页各内容块标题上方的英文小字，只保留中文分区标题。
- 对话原文的说话人配色改为更明显的角色色板，不同角色的姓名标签、英文句子和中文句子使用同一套稳定颜色。

### 🔧 Follow-up: 知识点页导航和计数微调

- 移除“词汇和句型”标题右侧的词条数量徽标。
- 知识点页改为顶部导航栏固定可见、正文区域独立滚动，避免拖到底后返回键和标题栏一起滚出屏幕。

### 🔧 Follow-up: 小程序图标接入

- 将用户提供的外贸英语小程序图标压缩为 512px PNG，并替换小程序本地 `assets/images/icon.png`。
- 分享海报底部新增品牌图标，首页、练习页、交流页等生成的分享图统一显示“外贸英语影子跟读”图标。
- 交流与反馈页顶部临时 emoji 替换为正式图标；服务端同步新增 `/static/images/icon.png`，用于后台播放封面和默认分享图。
