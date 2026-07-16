# Userscripts

用于维护多个浏览器 userscript 的 monorepo。每个脚本独立管理版本、测试和发布，构建产物通过 GitHub Pages 提供安装及自动更新。

## 脚本

| 脚本 | 说明 | 文档 | 安装 |
| --- | --- | --- | --- |
| GitLab 最近 MR 仓库快捷入口 | 根据最近创建的 MR 或全局搜索，快速打开 Fork 与 Upstream 仓库。 | [使用与开发说明](packages/gitlab-recent-projects/README.md) | [安装](https://lucaslushuo.github.io/userscripts/gitlab-recent-projects.user.js) |

GitLab 脚本不会内置公司域名。首次打开一个 HTTPS GitLab 实例时，脚本会从 `window.location.origin` 自动填入当前域名，但仍需用户主动确认启用；未启用前不会访问 GitLab API。

发布到 GitHub Pages 后，Tampermonkey 会通过 metadata 自动检查更新；脚本也会检查已经部署的版本，并在设置按钮上用红点提示可用更新。

## 本地开发

需要 Node.js 22 或更高版本。

```bash
npm install
npm run check
npm test
npm run build
```

构建结果位于 `dist/`，该目录不提交到 Git，由 GitHub Actions 部署到 GitHub Pages。

## 添加新脚本

1. 在 `packages/` 下创建一个独立目录。
2. 添加该脚本的 `package.json`、`src/*.user.js` 和聚焦测试。
3. 在源码 metadata 中保留唯一的 `__USERSCRIPT_VERSION__` 占位符。
4. 在 package 的 `userscript` 配置中声明源码、构建文件名和展示标题。
5. 运行检查、测试和构建后提交 Pull Request。

每个脚本从自己的 `package.json` 读取版本。发布行为变更前必须提升对应版本号，Tampermonkey 才会识别更新。

## 发布

合并到 `main` 后，GitHub Actions 会执行检查、测试和构建，然后部署 `dist/` 到 GitHub Pages。首次使用前，需要在仓库的 **Settings → Pages** 中将 Source 设置为 **GitHub Actions**。
