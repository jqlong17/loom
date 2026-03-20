# Release Automation (GitHub Actions + npm Trusted Publishing)

本项目支持基于 GitHub Actions 的 npm 自动发布，避免每次手动 OTP/网页登录。

## 触发方式

- 仅在 push tag `v*` 时触发发布（例如 `v0.1.1`）。
- 工作流文件：`.github/workflows/release-npm.yml`

## 一次性配置（npm 侧）

1. 打开 npm 包管理页（`loom-memory`） -> Settings -> Publishing。
2. 启用 Trusted Publishing（OIDC）。
3. 绑定 GitHub 仓库：`jqlong17/loom`。
4. 约束来源 workflow：`release-npm.yml`（建议）。

完成后，GitHub Action 可直接发布，无需在仓库存放 `NPM_TOKEN`。

## 本地发版命令

```bash
# patch 版本并自动推 tag
npm run release:patch

# 或 minor / major
npm run release:minor
npm run release:major
```

这些命令会：

- 更新 `package.json` 版本并创建 git tag
- `git push --follow-tags`
- 触发 GitHub Actions 自动发布到 npm

## 安全建议

- 不要在仓库或 CI Secret 中保存长期 npm token（优先 Trusted Publishing）。
- 如必须临时用 token 发布，发布后立即轮换 token。
