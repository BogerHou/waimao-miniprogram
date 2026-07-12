# 工程加固：观测、网络健壮性与债务清理

## 目标

补上线上观测的盲区，收紧网络层健壮性，清理已识别的死代码和重复实现，让后续功能迭代踩在更稳的地基上。

## 范围

- 包含：三事件线上上报（音源回退 / 音频加载超时 / API 错误）、请求超时与缓存降级、课程专用词典、编译产物一致性校验、死代码清理、海报绘制去重。
- 不包含：完整 APM/日志平台接入。

## 背景

- 相关文档：`docs/RELIABILITY.md`（已知短板：无持续音频源监控）、`docs/QUALITY_SCORE.md`（可观测性 C）。
- 相关代码路径：`miniprogram/utils/request.ts`（无 timeout）、`miniprogram/utils/api.ts`（有道 `dict.youdao.com/jsonapi` 前端直连、`LocalCache` 过期即弃）、`miniprogram/pages/course/course.ts`（`fallbackToNextAudioSource`、本地 debug 日志、与 `utils/share-poster.ts` 重复的 `drawShareRoundedRect/drawShareWrappedText`）、`miniprogram/pages/profile-edit/`（未注册死代码）、`miniprogram/pages/logs/`（模板遗留）、`miniprogram/pages/pdf-viewer/`（注释与实际用途不符，需确认是否保留）。
- 已知约束：上报与词典端点需后端配合（englishpod-server）；英美发音按用户决策继续使用有道音频，因此 `dict.youdao.com` 仍是 `downloadFile` 合法域名。

## 风险

- 风险：上报本身产生额外失败与流量。
- 缓解：采样 + 本地聚合批量上报 + 失败静默丢弃。

## 里程碑

1. 观测：后端极简 `/metrics` 收集端点，前端上报三事件（音源 fallback、音频加载超时、API 5xx/网络失败），采样可配。
2. 网络：`request.ts` 统一 15s 超时；课程列表请求失败时降级返回过期缓存；首页 `onShow` 改 stale-while-revalidate（先渲染缓存再静默刷新，去掉每次强刷闪骨架屏）。
3. 课程词典：后端从固定 ECDICT 版本生成当前课程子集，叠加外贸术语覆盖并提供匿名限流接口；前端 `fetchWordLookup` 只调自家 API。按用户决策保留英音/美音与有道发音地址，但不再调用有道 JSON 或逐词调用 AI。
4. 清理：删除 `profile-edit` 和 `logs`；`pdf-viewer` 缩为旧分享链接兼容跳转；完成海报抽离并删除遗留 warm canvas 配色。
5. 产物一致性：release-check 在临时目录执行 tsc，并逐个比较 `.js` 与 `.ts`，不通过构建污染当前工作区。

## 验证方式

- 命令：`npm run typecheck && npm test && npm run release:check`。
- 手工检查：断网/弱网下首页与课程页表现；查词走后端代理后的命中与降级；后台可看到三事件数据。

## 进度记录

- [x] 里程碑 1：三事件上报。小程序端完成采样、批量缓冲、退后台 flush 和三事件接线；配套后端完成匿名限流、严格白名单校验与结构化日志端点（2026-07-12）。
- [x] 里程碑 2：超时与缓存降级。请求统一 15s；课程列表强刷不再删除旧缓存，失败时回退课程树；首页先渲染缓存再静默刷新（2026-07-12）。
- [x] 里程碑 3：课程专用词典与单请求查词链路（2026-07-12）。
- [x] 里程碑 4：死代码、旧链接兼容与海报实现清理（2026-07-12）。
- [x] 里程碑 5：临时目录产物一致性校验（2026-07-12）。

## 决策记录

- 2026-07-11：建档。`course.ts` 整体拆分不单独立项，跟随课程播放器重构计划推进。
- 2026-07-12：阶段 B 代码完成。metrics 只记录 `courseId/provider/reason/path/method/status/timeoutMs` 等低基数字段，不上传完整音频 URL、query、token 或录音；后端单批最多 10 条、16KB、每 IP 每分钟 30 次，写结构化 stdout，不做客户端重试。
- 2026-07-12：`forceRefresh` 定义改为“跳过新鲜缓存读取”，不再物理清缓存。课程缓存读写统一转成匿名投影，移除顶层 `progress/entitlement`、scene 进度/状态、解锁态和签名音频地址；检测到 token 时不读写公共缓存。登录态降级继续用本地 store 的进度和权益，避免换账号或退出后串数据。
- 2026-07-12：前台逐句与默认后台连续播放通道都接入 10s CDN 加载超时、错误切源和相同的低基数 metrics；后台切源保留当前播放位置与 autoplay 意图，并防止重复错误触发二次切源。
- 2026-07-12：自动化验证已覆盖采样/批量/定时 flush、路径脱敏、15s 超时、5xx/timeout 分类、过期缓存保留与登录态降级。仍需在体验版做断网/弱网与音源回退 smoke，并在部署后确认平台采集 metrics stdout。
- 2026-07-12：调研后否决“后端继续代理未公开有道 JSON”的原方案。ECDICT 对现有 2,188 个唯一课程词直接覆盖 96.48%，按出现次数覆盖 99.00%；构建产物叠加外贸术语覆盖后达到 15,855/15,874 次（99.88%），剩余 17 个均为字幕粘连脏词。英美发音是用户明确要求的例外，暂保留有道发音域名。
- 2026-07-12：后端词典已部署到生产，线上健康、命中、400/404 边界和英美音标/发音地址验收通过；小程序 `npm run release:check` 全部通过。开发者工具与真机 smoke 留给用户执行。
