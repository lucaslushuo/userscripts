# GitLab Recent Projects Agent Guide

本文件适用于 `packages/gitlab-recent-projects/` 下的全部修改。用户要求优先于本文件。

## 先读内容

修改前先阅读：

1. `README.md`：用户行为、API、隐私、构建和发布说明。
2. `package.json`：脚本版本和构建声明。
3. `src/gitlab-recent-projects.user.js`：实际实现。
4. `test/gitlab-recent-projects.test.js`：已有行为契约。

## 关键不变量

- 不得加入公司专属域名、公司名称、内部品牌词、Token 或凭据。
- 只支持 HTTPS origin；未识别为 GitLab 或未启用 origin 时不得调用 API。
- 所有 GitLab 业务 API 必须使用当前 GitLab 的相对路径和同源凭据。
- 唯一允许的跨域运行时请求是匿名检查固定 GitHub Pages 安装地址的已发布版本，不得携带 GitLab 业务数据或配置。
- API 返回的项目、MR URL 必须经过当前 origin 校验。
- 最近项目按当前用户创建 MR 的 `created_at` 排序，不按项目活跃度排序。
- Fork 和 Upstream 在最近 MR、全局搜索两条链路中都要配对。
- “仅我的仓库及 Upstream”默认保持启用。
- 新建 MR URL 必须允许用户自行选择分支，不得固定 target branch。
- UI/CSS 必须限制在脚本 widget 范围，避免污染 GitLab，也避免被 GitLab 全局 SVG 样式污染。
- 用户可见失败必须明确展示；不要吞掉 API、解析或存储错误。
- 更新红点必须以实际部署的 `.user.js` 版本为准，不能以尚未部署的仓库源码为准。

## 修改规则

- 发布版本只修改 `package.json#version`。
- 源码 metadata 必须保留唯一的 `__USERSCRIPT_VERSION__`。
- 不要直接编辑或提交 `dist/`。
- 新增或修改核心行为时，在 `test/gitlab-recent-projects.test.js` 添加行为级测试。
- 修改 API contract 时同步更新 `README.md` 的 API 和注意事项。
- 修改 UI 文案时同步维护中文、英文翻译。
- 修改本地存储结构时使用新版本 Key，并说明迁移或失效影响。
- 修改更新流程时必须保留 Tampermonkey 原生 `@updateURL` / `@downloadURL`，并明确安装确认与页面重载的边界。

## 验证命令

在仓库根目录执行：

```bash
npm run check
npm test
npm run build
```

只验证本 package：

```bash
npm run check --workspace @userscripts/gitlab-recent-projects
npm test --workspace @userscripts/gitlab-recent-projects
```

构建后确认：

- `dist/gitlab-recent-projects.user.js` 的 `@version` 与 package 版本一致。
- 构建产物不存在 `__USERSCRIPT_VERSION__`。
- 仓库和产物不存在组织专属词汇或域名。
- UI/CSS 变更已在 GitLab 宿主页或等效样式污染场景中验证。
