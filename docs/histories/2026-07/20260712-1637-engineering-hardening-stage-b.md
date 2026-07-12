## [2026-07-12 16:37] | Task: 完成阶段 B 观测与网络健壮性

### Execution Context

- **Agent ID**: `OpenAI Codex`
- **Base Model**: `GPT-5`
- **Runtime**: `Codex Desktop`

### User Query

> 接续上一次因 token 中断的实现，完成阶段 B（观测与网络健壮性）。

### Changes Overview

**Scope:** 外贸小程序与配套后端的客户端观测、请求超时、缓存降级和首页刷新策略。

**Key Actions:**

- 接续已有半成品，完成三事件 metrics 收集器：采样、批量、缓冲上限、定时与退后台 flush；前台逐句、后台连续播放都接入音频加载超时与实际音源回退，API 接入 5xx/网络失败分类。
- 通用请求统一 15 秒超时；课程列表强制刷新不再删除旧缓存，网络失败回退过期课程树。缓存读写统一转成匿名投影并在有 token 时绕过，避免顶层与 scene 级进度、解锁态或签名地址跨账号残留。
- 首页启动时先渲染缓存，再静默刷新，保留显式下拉刷新与无缓存错误态。
- 配套后端新增匿名 metrics 端点：事件与字段严格白名单、单批/body/IP 上限、路径脱敏和结构化 stdout；不记录完整 URL、认证信息、用户资料或录音。
- 新增网络健壮性测试并扩展音频超时、后台切源恢复状态和旧个性化缓存清洗测试，随后重新生成微信实际运行的 JavaScript 产物。

### Design Intent

弱网时优先保住用户已经能看到和继续学习的课程树，同时让真正影响学习的错误可被定位。观测层必须比业务层更容易失败：上报失败直接丢弃，不重试、不递归，也不携带签名地址和个人信息。

### Verification

- 小程序：`npm run typecheck`、`npm test`、`npm run release:check` 通过；线上健康、7 章 50 场景、双音频源、二维码和匿名权限门禁均通过。
- 配套后端：`npm run build`、`npm test`、metrics HTTP/校验专项测试通过。
- 待体验版：断网/弱网首页、七牛超时与服务器回退、部署平台 stdout 采集。

### Files Modified

- `miniprogram/utils/{metrics,request,storage,api}.ts`
- `miniprogram/pages/index/index.ts`
- `miniprogram/pages/course/{course,player-core}.ts`
- `miniprogram/app.ts`
- `tests/network-resilience.test.ts`、`tests/player-core.test.ts`、`tests/run-all.ts`
- `docs/ARCHITECTURE.md`、`docs/RELIABILITY.md`、`docs/SECURITY.md`、`docs/QUALITY_SCORE.md`、`docs/FRONTEND.md`
- `docs/exec-plans/active/2026-07-11-engineering-hardening.md`、`docs/exec-plans/active/2026-07-12-roadmap-overview.md`
- 配套后端的 metrics route、service、HTTP 测试与 app 接线
