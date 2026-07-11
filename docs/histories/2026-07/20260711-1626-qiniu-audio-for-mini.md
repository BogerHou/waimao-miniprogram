## [2026-07-11 16:26] | Task: 小程序接入七牛私有音频

### Execution Context

- **Agent ID**: `Codex`
- **Base Model**: `GPT-5`
- **Runtime**: `Codex desktop`

### User Query

> 让小程序跟进 Web 版已经使用的七牛私有 CDN，并缩短自动测试流程，由用户完成小程序真机验收。

### Changes Overview

**Scope:** 外贸小程序音频协议、七牛优先策略、服务器回退和发布配置。

**Key Actions:**

- 小程序课程接口新增 `audioSources`，返回七牛私有签名源和服务器签名备用源。
- 保留旧 `audio` 字段为服务器地址，避免后端先部署时影响旧版小程序。
- 小程序播放器读取真实音频源数组，并按明确的 `provider` 回退，不再依赖 CDN 域名猜测。
- 数据生成器和小程序 app config 默认启用 `qiniu -> server`。
- 发布门禁补充七牛主源检查，文档补充合法域名和短期签名约束。
- 后端完成生产部署；线上接口确认七牛优先、服务器备用，七牛响应支持音频 Range 请求。

### Design Intent

复用 Web 版已经稳定运行的七牛签名服务，减少源站音频带宽，同时保持旧客户端兼容和服务器兜底。播放器、字幕时间轴与小节播放范围均不改动。

### Files Modified

- 后端外贸小程序课程路由、音频配置、数据生成器和接口测试。
- `miniprogram/utils/api.ts`
- `miniprogram/pages/course/audio-source-fallback.ts`
- `miniprogram/pages/course/course.ts`
- `scripts/release-check.mjs`
- 发布、架构和稳定性文档。
