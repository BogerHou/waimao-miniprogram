# 收尾与迭代总排期

> 这份文档是 2026-07-12 真机回归通过后的总调度：把 active 目录下四份计划按上线优先级串成执行顺序，并登记盘点中新发现、尚未归入子计划的改进点。子计划各自维护细节，这里只记顺序、依赖和状态。

## 已定稿决策

- 视觉主题定稿 **business（商务专业风）**：release-compliance 计划负责删除 `styles/palettes/warm.less`、切换入口简化、`share-poster.ts` 的 `ACTIVE_SHARE_POSTER_THEME` 固定 business、收尾 wxml 硬编码色、更新 DESIGN.md/FRONTEND.md 为单主题。
- 编码执行方式：具体实现可调用本地 `codex exec`（模型走其默认），Claude 负责拆解、接线校对、`npm run typecheck && npm test` 与真机验证把关。

## 执行顺序（按上线优先级）

### 阶段 A：扫清上线障碍（release-compliance）
1. 主题定稿 business 收尾（删 warm、清 wxml 硬编码色、文档改单主题）。
2. 微信隐私协议合规：头像/昵称 + 录音权限的隐私弹窗（`wx.requirePrivacyAuthorize` / 隐私接口），审核专用邀请码确认。
3. 头像上传前 `wx.compressImage` 压缩。
- 关口：`npm run release:check` 通过；低基础库隐私弹窗行为、倍速 slider 与导航栏配色一致性真机核对。

### 阶段 B：上线前装好仪表盘（engineering-hardening 里程碑 1-2）
1. 三事件线上上报（音源回退 / 音频加载超时 / API 5xx·超时），采样 + 本地聚合。
2. `request.ts` 15s 超时；课程列表失败降级过期缓存；首页 onShow 改 stale-while-revalidate。
- 依赖：三事件上报需后端 `/metrics` 端点（englishpod-server 配合）。

### 阶段 C：转化漏斗（conversion-funnel）
1. 锁定小节内容预览（前 3 句只读 + 底部解锁引导）。
2. 解锁成功回来源场景（`fromSceneId`）+ 复制微信号兜底。
3. 分享海报小程序码（后端 `wxacode.getUnlimited` 配合，scene 直达小节）。
4. 会员临期 7 天提醒。

### 阶段 D：留存闭环（learning-loop-features + 新增点）
1. 生词本（查词沉淀 + 列表 + 回源句）——与难句星标合并为统一"复习"入口（见下方新增点）。
2. 场景关键词搜索（首页纯前端过滤）。
3. 学习记录页（连续天数/时长/打卡日历，后端按日聚合）。

### 阶段 E：工程收尾（engineering-hardening 里程碑 3-5）
1. 词典查询收拢到后端代理，移除有道合法域名依赖。
2. 死代码清理（profile-edit / logs / pdf-viewer 定位确认）。
3. release-check 增加 tsc 产物一致性校验（`.ts`/`.js` 双份同步）。

## 盘点新增点（登记，随相关阶段落地）

- **难句星标目前只存不用**：星标缺后续动线。并入阶段 D 的"复习"入口——生词本 + 难句合并为一个复习页，支持"只播标记的句子"。（已补入 learning-loop-features）
- **每句练习次数仅在内存**：退出即丢，完成面板"本次精练 N 句"限单次会话。若要长期"每句练过几遍"需落存储或上报，作为学习记录页数据源之一。（已补入 learning-loop-features 备注）
- **完成成就底图只有一张**：可按章节做变体（imagegen 成本低），不同章节完成看到不同成就图，增强分享动力。（列为 conversion-funnel 可选增强）
- **留白跟读发现性低**：功能藏在跟读 tab 的小开关，真机需观察用户能否发现；必要时在三步引导的跟读段加一句更显式说明或首次高亮。（列为轻量优化，随阶段 C/D 顺带）

## 进度记录

- [x] 2026-07-12：真机回归通过，course-player-unification 归档至 completed。
- [x] 2026-07-12：主题定稿 business；建立总排期。
- [ ] 阶段 A：release-compliance。
- [ ] 阶段 B：observability + 网络健壮性。
- [ ] 阶段 C：转化漏斗。
- [ ] 阶段 D：留存闭环。
- [ ] 阶段 E：工程收尾。
