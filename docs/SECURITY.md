# 安全默认约束

## 认证与授权

- 小程序登录沿用微信 `wx.login` 到后端换取 session 的模式。
- 外贸小程序必须使用 `/api/waimao-mini/*`，不能调用 EnglishPod 的 `/api/auth`、`/api/users`、`/api/courses`。
- 后端使用 `waimao_mini_sessions` 和 bearer token 校验用户。
- 收费模式下第一章可以匿名试学；`allCoursesFree=true` 时全部章节匿名可用，但写进度、上传头像仍需要登录。免费不等于授予会员，免费期不消耗邀请码，原有权益与到期时间不变。

## 数据隔离

- 外贸小程序用户、进度、邀请码、权益、学习时长全部写入 `waimao_mini_*` 表。
- 不复用 EnglishPod 用户表，也不和外贸 Web 版账号打通。
- 邀请码 entitlement 当前只代表小程序内完整课程 1 年访问权。

## 上传与静态资源

- 新听力音频只由管理员上传 MP3/M4A/WAV，最大 60 MB，校验文件名与格式头并流式写入私有 `$DATA_ROOT/waimao-mini/listening/audio`。公开目录不返回资产 ID/内部路径/签名源，未授权曲目也不返回完整原文；不拉取管理员输入的任意远端音频 URL。
- 播放队列由服务端按当前发布、总开关、全免费和会员权限签发。服务器课程/上传媒体签名固定约两小时；七牛按 `QINIU_URL_TTL_SECONDS` 配置（5 分钟至 24 小时，默认两小时）失效。队列 `expiresAt` 取最早期限，不提前撤销更长有效期的七牛地址；切回收费不承诺立即撤销已发地址。上传媒体端点另外检查交互开启和是否仍被发布内容引用；已开始传输不强行截断。
- 听力断点和累计秒数仅本机保存，不写课程练习记录；不会自动索取用户昵称、头像或新增剪贴板/麦克风权限。

- 头像上传入口为 `/api/waimao-mini/users/me/avatar`，文件写入 `static/waimao-mini/avatars`。
- 后端限制 base64 图片格式和大小，避免无界上传。
- 课程音频由后端脚本生成到 `static/waimao-mini/audio`，第一版不接第三方 CDN。

## 密钥

- EnglishPod 使用 `WECHAT_APPID` / `WECHAT_SECRET`；外贸小程序必须使用独立的 `WAIMAO_MINI_WECHAT_APPID` / `WAIMAO_MINI_WECHAT_SECRET`，避免不同小程序 appid 互相串用。
- AI provider key、邀请码种子必须走后端环境变量。
- 不要把真实 appid、secret、邀请码明文批量写入仓库。

## 客户端观测

- `/api/waimao-mini/metrics` 为匿名端点，只允许 `audio_fallback`、`audio_load_timeout`、`api_error` 三类事件；服务端必须限制单批数量、body 大小和每 IP 频率。
- 客户端只上报课程 ID、音源 provider、原因、超时阈值、归一化 API path、method 和 status。不得上报完整音频 URL、query、token、openid、头像昵称、录音或任意扩展字段。
- metrics 发送失败静默丢弃，不重试、不持久化队列，也不进入通用请求封装，避免递归上报和弱网流量放大。
