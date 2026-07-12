# CI/CD 说明

当前仓库还没有 GitHub Actions 或发布流水线。先以本地真实验证命令作为最小 gate。

## 当前验证命令

```sh
npm run typecheck
npm run generated:check
npm test
npm run release:check
```

后端变更在 `englishpod-server/server` 中验证：

```sh
npm run build
npm test
```

## 推荐接入顺序

1. PR gate 先运行小程序 `npm run generated:check && npm test`；前者在临时目录编译并逐个比较 `.ts` 对应的 `.js`，不修改工作区。
2. 若同一 PR 修改后端，同步运行后端 `npm run build && npm test`。
3. 增加外贸数据生成 smoke check，确保 `waimao-mini` 数据和音频路径存在。
4. 有真实发布流程后，再接入小程序上传、版本标记、SBOM 和 provenance。

## 发布前手工检查

- `project.config.json` 使用真实外贸小程序 appid。
- 后端环境变量中配置外贸小程序专用 `WAIMAO_MINI_WECHAT_APPID` / `WAIMAO_MINI_WECHAT_SECRET`。
- 微信后台 `request` 合法域名包含 `https://englishecho.site`；`downloadFile` 合法域名包含 `https://englishecho.site`、`https://dict.youdao.com` 和 `https://waimao-audio.englishecho.site`，并在开启合法域名校验时重新编译。
- 邀请码解锁策略已确认：用户添加微信购买会员邀请码，小程序内不接微信支付。
- 七牛私有音频和服务器备用源均已部署，后续补双源持续监控。
