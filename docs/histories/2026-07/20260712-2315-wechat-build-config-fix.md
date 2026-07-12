# [2026-07-12 23:15] | Task: 修复微信编译配置与辅助模块漏包

## 用户诉求

> 开发者工具提示 `permission["scope.record"]` 无效，课程页辅助模块未定义。

## 主要改动

- 删除 `app.json.permission.scope.record`；微信全局配置只支持官方列出的权限用途说明，录音继续通过课程页现有 `wx.getSetting`、`wx.authorize` 和 `wx.openSetting` 流程授权。
- 关闭开发期和上传期的“过滤无依赖文件”，避免 TypeScript 编译插件生成 `require` 后，辅助模块被依赖分析误删。
- 新增全局配置回归测试，阻止无效录音权限声明和未使用文件过滤重新进入公共配置。
- 同步修正发布合规执行计划；录音仍属于微信后台隐私保护指引的必填收集项。

## 设计动机

权限授权接口和 `app.json.permission` 是两套边界：`scope.record` 可在运行时申请，但不能作为全局权限用途字段声明。项目体积仍远低于主包上限，关闭脆弱的无依赖过滤比承担运行时缺模块风险更合适。

## 关键文件

- `miniprogram/app.json`
- `project.config.json`
- `tests/page-json-schema.test.ts`
- `docs/exec-plans/active/2026-07-11-release-compliance-theme-finalize.md`
