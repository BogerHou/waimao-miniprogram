## [2026-07-11 15:46] | Task: 准备 main 经典版上线

### 🤖 Execution Context

- **Agent ID**: `Codex`
- **Base Model**: `GPT-5`
- **Runtime**: `Codex desktop`

### 📥 User Query

> 实验支线暂不采用，切回主线并准备尽快上线 `main` 版本。

### 🛠 Changes Overview

**Scope:** 小程序发布门禁、微信开发者工具兼容、发布文档与线上冒烟，不合并实验分支。

**Key Actions:**

- **切回稳定主线**：确认 `main` 与远端一致，实验分支保留且未合并。
- **新增一键发布门禁**：`npm run release:check` 串联类型检查、全量测试、正式 appid、包体、生产健康、课程、音频、二维码、外部词典和匿名权限边界检查。
- **完成生产冒烟**：验证 7 章 50 个场景、第一课词级字幕与音频、购买/交流群二维码、外贸图标、微信密钥、AI、七牛回退和非 mock 登录配置。
- **完成开发者工具验收**：走通首页、第一课、音频、知识点固定导航和已登录会员解锁状态；将较新的内联 type import 改为旧版编辑器兼容写法，问题列表归零。
- **解除合法域名阻断**：用户补充生产与词典 request/downloadFile 域名后，重新打开项目刷新配置；开启校验时首页正常加载 7 章，控制台错误为 0。
- **保护缓存登录态**：临时网络失败不再清空本地微信用户和权益；只有请求层确认 401 并清除 token 后才触发重新登录。
- **整理审核资料**：新增首发版本号、版本描述、体验版验收、审核备注、审核邀请码和回滚清单。

### 🧠 Design Intent (Why)

用户需要尽快上线稳定版，因此本轮不继续扩大产品改动，而是把发布风险转换为可重复执行的门禁，并用真实生产服务和微信开发者工具验证关键路径。合法域名属于账号后台配置，必须明确作为发布阻断项，不能依靠关闭校验掩盖。

### 📁 Files Modified

- `package.json`
- `scripts/release-check.mjs`
- `miniprogram/app.ts`
- `miniprogram/utils/auth-session.ts`
- `miniprogram/pages/knowledge/knowledge.ts`
- `miniprogram/pages/unlock/unlock.ts`
- `tests/auth-session.test.ts`
- `tests/run-all.ts`
- `docs/releases/2026-07-11-main-launch-checklist.md`
- `docs/releases/feature-release-notes.md`
- `docs/CICD.md`
- `docs/RELIABILITY.md`
- `docs/QUALITY_SCORE.md`
- `README.md`
