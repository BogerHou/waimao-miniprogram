# 稳定性与可运维性

## 关键路径

- 小程序首页能加载 `/api/waimao-mini/courses` 并展示 7 章。
- 匿名用户能进入第一章小节。
- 未解锁用户进入后 6 章小节时应看到锁定提示，完成头像/昵称登录后再跳转解锁页。
- 解锁页应展示添加微信二维码和会员权益，并允许登录用户输入会员邀请码解锁全部章节 1 年访问权。
- 登录用户能写入小节进度、学习时长和头像。
- 小节完成时进度上报必须包含 cue 位置和总 cue 数，避免只保存粗粒度完成状态。
- Shadow 模式播放必须停在当前小节 `range.end`，不能继续播放整章后续场景。

## 本地验证

小程序仓库：

```sh
npm run typecheck
npm test
npm run release:check
```

后端仓库：

```sh
npm run build
npm test
npm run waimao-mini:generate
npm run dev
```

或在小程序仓库运行：

```sh
npm run dev:backend
```

## 运行注意

- `npm run waimao-mini:generate` 会从外贸 Web 数据源生成章节、课程详情和静态音频。
- 微信开发者工具、体验版和正式版默认都请求线上 `https://englishecho.site`；需要本地联调时再临时切换 `DEVELOPMENT_API_BASE_URL`。
- 发布验收必须开启合法域名校验；微信后台 `request` 和 `downloadFile` 需包含 `https://englishecho.site` 与 `https://dict.youdao.com`，`downloadFile` 还需包含 `https://waimao-audio.englishecho.site`。
- 已缓存登录态刷新失败时，只要持久化 token 仍存在就保留本地用户与权益；只有请求层确认 401 并清除 token 后才重新登录。
- 线上音频优先使用两小时有效的七牛私有签名地址，失败时自动切换服务器签名源；进入课程会重新获取地址，不应持久化缓存。
- AI 讲解会在外贸知识点上下文存在时启用外贸沟通语境提示；普通 EnglishPod 接口不应受影响。

## 已知短板

- 暂无小程序端真机自动化测试。
- 暂无七牛与服务器音频源的持续可用性监控，也没有断点续播跨设备同步；商业化链路为添加微信购买邀请码，不接小程序支付。
- 线上接口 `/api/waimao-mini/*` 未部署前，小程序会出现 404；本地后端只作为临时联调用途。
