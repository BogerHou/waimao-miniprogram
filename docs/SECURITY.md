# 安全默认约束

## 认证与授权

- 小程序登录沿用微信 `wx.login` 到后端换取 session 的模式。
- 外贸小程序必须使用 `/api/waimao-mini/*`，不能调用 EnglishPod 的 `/api/auth`、`/api/users`、`/api/courses`。
- 后端使用 `waimao_mini_sessions` 和 bearer token 校验用户。
- 第一章可以匿名试学；写进度、上传头像、兑换邀请码需要登录。

## 数据隔离

- 外贸小程序用户、进度、邀请码、权益、学习时长全部写入 `waimao_mini_*` 表。
- 不复用 EnglishPod 用户表，也不和外贸 Web 版账号打通。
- 邀请码 entitlement 当前只代表小程序内完整课程 1 年访问权。

## 上传与静态资源

- 头像上传入口为 `/api/waimao-mini/users/me/avatar`，文件写入 `static/waimao-mini/avatars`。
- 后端限制 base64 图片格式和大小，避免无界上传。
- 课程音频由后端脚本生成到 `static/waimao-mini/audio`，第一版不接第三方 CDN。

## 密钥

- EnglishPod 使用 `WECHAT_APPID` / `WECHAT_SECRET`；外贸小程序必须使用独立的 `WAIMAO_MINI_WECHAT_APPID` / `WAIMAO_MINI_WECHAT_SECRET`，避免不同小程序 appid 互相串用。
- AI provider key、邀请码种子必须走后端环境变量。
- 不要把真实 appid、secret、邀请码明文批量写入仓库。
