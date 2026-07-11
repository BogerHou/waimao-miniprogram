# 工程加固：观测、网络健壮性与债务清理

## 目标

补上线上观测的盲区，收紧网络层健壮性，清理已识别的死代码和重复实现，让后续功能迭代踩在更稳的地基上。

## 范围

- 包含：三事件线上上报（音源回退 / 音频加载超时 / API 错误）、请求超时与缓存降级、词典查询收拢到后端代理、编译产物一致性校验、死代码清理、海报绘制去重。
- 不包含：完整 APM/日志平台接入。

## 背景

- 相关文档：`docs/RELIABILITY.md`（已知短板：无持续音频源监控）、`docs/QUALITY_SCORE.md`（可观测性 C）。
- 相关代码路径：`miniprogram/utils/request.ts`（无 timeout）、`miniprogram/utils/api.ts`（有道 `dict.youdao.com/jsonapi` 前端直连、`LocalCache` 过期即弃）、`miniprogram/pages/course/course.ts`（`fallbackToNextAudioSource`、本地 debug 日志、与 `utils/share-poster.ts` 重复的 `drawShareRoundedRect/drawShareWrappedText`）、`miniprogram/pages/profile-edit/`（未注册死代码）、`miniprogram/pages/logs/`（模板遗留）、`miniprogram/pages/pdf-viewer/`（注释与实际用途不符，需确认是否保留）。
- 已知约束：上报端点需后端配合（englishpod-server）；有道域名从合法域名移除前必须先上线后端代理。

## 风险

- 风险：上报本身产生额外失败与流量。
- 缓解：采样 + 本地聚合批量上报 + 失败静默丢弃。

## 里程碑

1. 观测：后端极简 `/metrics` 收集端点，前端上报三事件（音源 fallback、音频加载超时、API 5xx/网络失败），采样可配。
2. 网络：`request.ts` 统一 15s 超时；课程列表请求失败时降级返回过期缓存；首页 `onShow` 改 stale-while-revalidate（先渲染缓存再静默刷新，去掉每次强刷闪骨架屏）。
3. 词典代理：后端提供查词接口（内部走有道/可替换供应商 + 服务端缓存限流），前端 `fetchWordLookup` 只调自家 API，移除有道合法域名依赖。
4. 清理：删除 `profile-edit`；`logs` 从 `app.json` 移除或删除；确认 `pdf-viewer` 去留并修正注释；`course.ts` 海报绘制合并到 `utils/share-poster.ts` 统一 renderer。
5. 产物一致性：CI/release-check 增加"tsc build 后 `git diff --exit-code`"校验 `.js` 与 `.ts` 同步。

## 验证方式

- 命令：`npm run typecheck && npm test && npm run release:check`。
- 手工检查：断网/弱网下首页与课程页表现；查词走后端代理后的命中与降级；后台可看到三事件数据。

## 进度记录

- [ ] 里程碑 1：三事件上报。
- [ ] 里程碑 2：超时与缓存降级。
- [ ] 里程碑 3：词典后端代理。
- [ ] 里程碑 4：死代码与重复实现清理。
- [ ] 里程碑 5：产物一致性校验。

## 决策记录

- 2026-07-11：建档。`course.ts` 整体拆分不单独立项，跟随课程播放器重构计划推进。
