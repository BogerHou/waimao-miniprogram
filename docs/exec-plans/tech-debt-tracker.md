# 技术债追踪

这里记录那些暂时不阻塞当前任务、但已经值得留档的技术债。

| 日期 | 区域 | 债务描述 | 为什么会存在 | 计划中的后续动作 |
| --- | --- | --- | --- | --- |
| 2026-07-11 | 课程页 | `pages/course/course.ts` 3501 行单文件承载播放状态机、查词、AI、海报、手势、时长统计 | 复刻期以跑通为先，功能持续往同一文件叠加 | 跟随 `2026-07-11-course-player-unification` 计划分三步拆分，不单独立项 |
| 2026-07-11 | 构建 | `.ts` 与 tsc 产物 `.js`（含 tests）成对入库，靠约定保持同步 | 微信开发者工具直接消费 `.js`，历史上未做产物隔离 | `2026-07-11-engineering-hardening` 里程碑 5：release-check 增加 build 后 `git diff --exit-code` 校验 |
| 2026-07-11 | 分享海报 | `drawShareRoundedRect/drawShareWrappedText` 在 `course.ts` 与 `utils/share-poster.ts` 重复实现，课程海报与通用海报布局雷同 | 课程海报后做时复制了工具函数 | `2026-07-11-engineering-hardening` 里程碑 4：合并为统一 renderer |
| 2026-07-11 | 页面 | `pages/profile-edit`（未注册、wxss）与 `pages/logs`（模板遗留）为死代码；`pdf-viewer` 文件头注释仍写"知识点页面"但知识点已迁至 `pages/knowledge` | 复刻与迁移过程中的遗留 | `2026-07-11-engineering-hardening` 里程碑 4：删除/移除注册/修正注释 |
