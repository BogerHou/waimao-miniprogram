# 外贸英语影子跟读小程序

这是一个复刻 `englishpod` 小程序交互的外贸英语影子跟读项目。小程序主体保留 EnglishPod 的首页、课程详情、影子跟读、Echo、AI 讲解、查词、微信登录等成熟逻辑，只在外贸版明确差异处做改动。

## 当前形态

- 首页按 7 章展示外贸场景小节，默认展开第一章。
- 第一章免费试学，后 6 章锁定。
- 解锁走小程序专用邀请码 entitlement；用户先填写头像/昵称登录，再扫码添加微信购买会员邀请码，兑换后获得全部章节 1 年访问权，暂不和 Web 版账号打通。
- 详情页保留 EnglishPod 跟读布局，悬浮“知识点”按钮跳转新知识点页。
- Shadow 模式按当前小节时间范围播放，不串到下一小节。
- 后端复用 `englishpod-server`，但走独立 `/api/waimao-mini/*` 前缀、`waimao_mini_*` 表和 `data/waimao-mini` 数据目录。

## 本地验证

先启动复用后端：

```sh
cd /Users/simon/Documents/code/englishpod-server/server
npm run dev
```

也可以在本仓库直接运行：

```sh
npm run dev:backend
```

微信开发者工具、体验版和正式版默认都请求线上 `https://englishecho.site`，避免开发者工具误连本地接口。

```sh
npm run typecheck
npm test
npm run release:check
```

`npm test` 会先运行 `tsc`，同步生成小程序 `.js` 文件，再运行本仓库的单元测试。

后端需要在 `/Users/simon/Documents/code/englishpod-server/server` 中验证：

```sh
npm run build
npm test
npm run waimao-mini:generate
```

## 发布前注意

- `project.config.json` 已配置外贸小程序 appid；切换发布账号前需要再次确认。
- 微信后台需要把 `https://englishecho.site` 和 `https://dict.youdao.com` 配置到 `request` 与 `downloadFile` 合法域名，并在开启合法域名校验时复验。
- 后端正式环境需要配置 `WAIMAO_MINI_WECHAT_APPID` / `WAIMAO_MINI_WECHAT_SECRET`，不要复用 EnglishPod 的微信密钥。
- 线上发布前需要先部署后端 `/api/waimao-mini/*`，否则小程序会请求线上接口并返回 404。
- 第一版音频走服务端静态资源 `/static/waimao-mini/audio/*`，未上 CDN；上线后需要评估 CDN/R2 优化。
- 不接微信支付；会员购买通过添加微信完成，小程序内只负责展示二维码和兑换会员邀请码，邀请码权益为全部章节 1 年访问权。
