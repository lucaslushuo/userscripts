# GitLab 最近 MR 仓库快捷入口

一个适用于 HTTPS GitLab 实例的 userscript。它根据当前用户最近创建的 Merge Request（MR）整理常用项目，并将个人 Fork 与对应 Upstream 放在同一组中，同时提供全局项目搜索、收藏夹、活跃分支合入状态和常用项目操作入口。

- 安装地址：<https://lucaslushuo.github.io/userscripts/gitlab-recent-projects.user.js>
- 源码：[src/gitlab-recent-projects.user.js](src/gitlab-recent-projects.user.js)
- 测试：[test/gitlab-recent-projects.test.js](test/gitlab-recent-projects.test.js)
- 当前版本：以 [package.json](package.json) 中的 `version` 为准

## 解决什么问题

GitLab 的项目活跃度不能准确代表“我最近使用过哪些项目”。本脚本使用当前用户创建 MR 的时间作为主要依据，解决以下问题：

- 快速进入最近提交过 MR 的项目，而不是只看到全公司最活跃的项目。
- 自动将个人 Fork 和原始 Upstream 配对展示。
- 搜索整个 GitLab 中当前账号有权访问的项目。
- 只搜索自己的项目，并同时带出对应 Upstream。
- 收藏常用仓库，并从独立收藏夹快速访问。
- 检查 Fork 中最近活跃的业务分支是否已经合入 Upstream 的 `dev`、`test`、`blue`、`master`。
- 从项目菜单快速进入新建 MR、我的 MR 和 Pipelines 页面。

## 功能说明

### 最近 MR 项目

- 调用 GitLab API 查询当前用户创建的 MR。
- 按 MR 的 `created_at` 从新到旧排序，不使用项目活跃度作为最终排名。
- 最多展示 20 组项目。
- 同一 Upstream 下的个人 Fork 会合并到同一组。
- 每组展示最近 MR、近期 MR 数量及项目入口。

### GitLab 全局搜索

- 输入至少 2 个字符后开始搜索。
- 默认勾选“仅我的仓库及 Upstream”。
- 取消勾选后，搜索当前账号在整个 GitLab 中可访问的项目。
- 搜索结果最多展示 20 组，并尽可能将 Fork 与 Upstream 配对。

### 项目快捷操作

每个项目右侧直接提供星标收藏按钮；点击即可收藏或取消收藏当前 Fork / Upstream。星标按钮右侧的 `…` 菜单包含：

- **选择分支并创建 MR**：进入该项目的新建 MR 页面，不固定目标分支。
- **我的 MR**：进入该项目的 MR 列表，并仅显示当前登录用户创建的 MR。
- **查看 Pipelines**：进入该项目的 Pipelines 页面。
- **复制仓库地址**：复制当前条目的 GitLab 项目页地址；Fork 和 Upstream 分别复制各自的地址。

### 收藏夹

- 点击面板右上角的星标按钮进入收藏夹，再次点击返回最近 MR 仓库。
- Fork 和 Upstream 可以分别收藏；收藏夹中保留对应标签，新收藏的仓库显示在最前面。
- 收藏夹直接保存必要的项目入口信息，不依赖仓库继续出现在最近 MR 或搜索结果中。
- 收藏操作不发起额外网络请求，数据仅保存在当前 GitLab origin 的 `localStorage` 中。

### 分支状态

- 点击面板右上角的分支图标进入「分支状态」。
- 使用 GitLab `owned=true` 查询当前账号拥有的项目，按 `last_activity_at` 倒序筛选最近活跃的 10 个 Fork；没有 Upstream 的普通仓库不会进入此视图。
- 每个 Fork 按需点击右侧检查图标后才读取数据，避免页面后台扫描所有仓库；检查中图标会旋转，完成后同一图标可重新检查。
- 脚本从 Fork 读取业务分支，并自动对照对应 Upstream 的环境分支。
- GitLab Branches API 返回的分支会按最新提交时间重新排序，只展示不属于 `dev`、`test`、`blue`、`master` 的前 5 个业务分支。
- 状态标签只显示 `dev`、`test`、`blue`、`master`：绿色表示已合入，红色表示未合入，灰色表示目标不存在或状态未知；完整状态可通过标签的辅助说明查看。
- 合入状态按 Git 提交祖先关系判断。普通 merge 可以准确识别；使用 squash 或 rebase 合并后，即使代码等价，原业务分支仍可能显示“未合入”。
- 分支状态仅保存在当前页面内存中，刷新页面后需要重新检查。

### 多语言

- 默认根据浏览器首选语言选择中文或英文。
- 可在面板的设置页中手动选择中文或英文。
- 手动选择会保存在当前 GitLab 域名的浏览器本地存储中。

### 项目源码

- 设置页底部提供 GitHub 入口，可直接打开本仓库源码。

### 更新提示

- Tampermonkey 继续通过 `@updateURL` 和 `@downloadURL` 执行原生自动更新。
- 脚本默认每 6 小时检查一次 GitHub Pages 上已经部署的 `.user.js`。
- 远端 `@version` 高于当前安装版本时，设置按钮显示红点。
- 设置页可以立即检查更新并打开安装更新页面。打开安装页后，设置页只保留“重新加载”操作。
- 更新检查读取的是实际发布产物，不会因为代码已 push 但 Pages 尚未部署而提前提示。

## 安装要求

- Chrome、Edge、Firefox 或其他支持 userscript 管理器的浏览器。
- Tampermonkey、Violentmonkey 等 userscript 管理器。
- 可正常登录的 HTTPS GitLab 实例。
- 当前 GitLab 版本需要提供脚本使用的 GitLab v4 API。

## 安装与更新

1. 安装并启用 Tampermonkey 或兼容的 userscript 管理器。
2. 打开[脚本安装地址](https://lucaslushuo.github.io/userscripts/gitlab-recent-projects.user.js)。
3. 在 userscript 管理器的安装页面确认安装。
4. 打开公司的 HTTPS GitLab 页面。
5. 完成下方“首次启用”步骤。

脚本通过 metadata 中的 `@updateURL` 和 `@downloadURL` 获取更新。发布新版本时必须提升 [package.json](package.json) 的 `version`，否则 userscript 管理器不会将其识别为新版本。

如需手动更新，可在 Tampermonkey 管理面板中执行“检查用户脚本更新”，或重新打开安装地址。

脚本内红点的更新流程：

1. 打开脚本面板，点击右上角设置按钮。
2. 点击“安装更新”，在新标签页中确认 Tampermonkey 的更新提示。
3. 安装完成后，如果 GitLab 页面没有被 userscript 管理器自动刷新，返回后点击“重新加载”。刷新后会显示当前已是最新版本。

userscript 不能绕过 Tampermonkey 的安全确认静默替换自身。已打开的 GitLab 页面仍可能运行旧脚本，因此未自动刷新时需要重新加载一次；设置页不会同时展示“安装更新”和“重新加载”。

## 首次启用域名

脚本不内置任何公司 GitLab 域名。首次进入一个尚未启用的 GitLab 站点时：

1. 脚本先通过页面 metadata 判断当前页面是否为 GitLab。
2. 域名输入框通过 `window.location.origin` 自动填入当前 HTTPS origin。
3. 用户点击“启用此域名”。
4. 脚本校验填写值必须是有效 HTTPS origin，并且必须与当前页面完全一致。
5. 配置保存成功并刷新页面后，脚本才开始请求 GitLab API。

需要停用时，打开主面板右上角的设置按钮，点击“停用当前域名”。清除该站点的浏览器数据也会清除启用状态。

不同 GitLab 域名的数据和设置由浏览器的同源策略天然隔离；换到新的 GitLab 实例后，需要在新站点重新启用一次。

## 日常使用

### 查看最近项目

1. 登录 GitLab。
2. 点击页面右上方的“最近 MR 仓库”按钮。
3. 从列表中选择 Fork、Upstream 或最近 MR。
4. 需要绕过缓存时，点击面板右上角的刷新按钮。

### 搜索项目

1. 打开脚本面板。
2. 在搜索框输入至少 2 个字符。
3. 保持“仅我的仓库及 Upstream”勾选，只搜索自己的项目及其 Upstream。
4. 取消勾选，搜索整个 GitLab 中当前账号可访问的项目。

搜索使用 350ms debounce。开始新的搜索时会取消尚未完成的旧请求，避免旧结果覆盖新结果。

### 检查分支状态

1. 打开脚本面板并点击右上角的分支图标。
2. 找到需要检查的 Fork 仓库。
3. 点击仓库右侧的检查图标。
4. 查看每个活跃业务分支对应 Upstream `dev`、`test`、`blue`、`master` 的状态。

脚本每次只检查用户主动选择的项目。每个 Fork 最多读取 Branches API 返回的前 100 个分支、展示 5 个活跃业务分支，并按分支依次检查目标环境，避免同时发起过多请求。

## 权限、隐私与安全

### 为什么使用 `@match https://*/*`

userscript 管理器必须在脚本安装时确定允许脚本加载的网站。因为脚本需要适配尚不知道域名的自建 GitLab，只能声明匹配所有 HTTPS 页面。

宽泛匹配不代表脚本会在所有网站执行业务逻辑。运行时还有两道限制：

1. 页面必须包含可识别的 GitLab metadata。
2. 当前 HTTPS origin 必须由用户主动启用。

不满足条件时，脚本不会读取项目数据，也不会调用 GitLab API。

### 网络请求边界

- `GM_info` 仅用于读取当前安装版本。
- `GM_xmlhttpRequest` 仅用于匿名读取固定 GitHub Pages 安装地址的已发布脚本。
- `@connect` 仅允许 `lucaslushuo.github.io`。
- 不保存或要求用户填写 Personal Access Token。
- GitLab 业务 API 请求全部使用相对路径，并携带当前 GitLab 登录会话的同源凭据。
- 从 API 返回的项目、MR 和分支 URL 必须与当前页面同源，否则会被丢弃。
- 更新检查请求不包含项目、MR、GitLab 域名或用户配置。
- 运行时不会把 GitLab 业务数据发送到第三方服务。
- 自动更新由 userscript 管理器访问 GitHub Pages 完成，与 GitLab 业务数据请求分离。

### 本地存储

脚本在当前 GitLab origin 的 `localStorage` 中保存：

| Key | 内容 | 生命周期 |
| --- | --- | --- |
| `gitlab-recent-mr-repos:enabled-origin:v1` | 用户确认启用的 HTTPS origin | 直到停用或清除站点数据 |
| `gitlab-recent-mr-repos:language:v1` | 手动选择的界面语言 | 直到清除站点数据 |
| `gitlab-recent-mr-repos:cache:v3` | 标准化后的项目、MR 和抓取时间 | 默认有效 10 分钟 |
| `gitlab-recent-mr-repos:update:v1` | 最近检查时间和已发布版本 | 默认有效 6 小时 |
| `gitlab-recent-mr-repos:favorites:v1` | 收藏仓库的必要项目入口信息 | 直到取消收藏或清除站点数据 |

缓存用于减少重复 API 请求。缓存数据不会跨 origin 共享。

## GitLab API 使用

脚本使用以下同源 GitLab v4 API：

| 用途 | API | 主要参数 |
| --- | --- | --- |
| 最近 MR | `GET /api/v4/merge_requests` | `scope=created_by_me`、`state=all`、按 `created_at` 倒序 |
| 成员项目 | `GET /api/v4/projects` | `membership=true`、排除 archived |
| 自有项目 | `GET /api/v4/projects` | `owned=true`、排除 archived、按 `last_activity_at` 倒序 |
| 项目搜索 | `GET /api/v4/projects` | `search=<query>`，可选 `owned=true` |
| 搜索 fallback | `GET /api/v4/search` | `scope=projects`、`search=<query>` |
| 项目分支 | `GET /api/v4/projects/:id/repository/branches` | 每次最多 100 个分支 |
| Fork 合入判断 | `GET /api/v4/projects/:id/repository/compare` | Fork 项目作为 `:id`，`from=<环境分支>`、`to=<业务分支>`、`from_project_id=<Upstream ID>` |

最近 MR 最多读取 5 页，每页最多 100 条；获得足够的项目组后会提前停止。项目列表请求每类最多读取 100 个项目，分支状态从这批按活跃时间倒序的自有项目中选出前 10 个 Fork。这些限制用于控制请求量，不保证覆盖账号可访问的全部历史数据。

分支状态只在用户点击项目检查按钮后请求。单个项目最多展示 5 个业务分支，并依次处理这些分支；同一业务分支最多并行检查 4 个目标环境。

## 注意事项与限制

- 只支持 HTTPS GitLab，不支持 HTTP 实例。
- 必须先登录 GitLab；登录失效时 API 会返回错误。
- 搜索范围受当前账号权限和 GitLab API 行为限制。
- 某些较旧或经过深度定制的 GitLab 版本可能缺少对应 API 或 metadata。
- “最近项目”依据 MR 创建时间，不是访问记录、提交记录或项目活跃时间。
- 分支状态里的“最近 Fork”依据 GitLab 项目的 `last_activity_at`；该时间由 GitLab 项目活动更新，可能存在短暂延迟。
- “最近活跃分支”依据分支最新 commit 的 `committed_date` 排序。
- GitLab Branches API 按名称返回分支；如果 Fork 超过 100 个分支，脚本只会在首批 100 个分支中筛选活跃分支。
- 分支合入状态是 Git 祖先关系，不是代码内容相似度；squash / rebase 合并可能无法识别为已合入。
- 最多展示 20 组结果；它不是完整项目管理器。
- Fork/Upstream 配对依赖 GitLab API 返回的 `forked_from_project` 信息。
- “仅我的仓库”使用 GitLab 的 `owned=true` 语义，不等同于所有 membership 项目。
- 停用域名会阻止脚本继续初始化，但项目缓存仍属于该站点的本地数据；如需彻底删除，可清除该站点浏览器数据。

## 常见问题

### 页面上没有出现启用入口

依次检查：

1. 当前页面是否使用 HTTPS。
2. userscript 管理器和本脚本是否已启用。
3. 当前页面是否为 GitLab 页面，而不是跳转前的统一登录页或代理错误页。
4. 刷新页面后重试。

### 提示域名与当前页面不一致

输入值必须与地址栏的 origin 一致，包括协议、主机名和非默认端口。路径不参与 origin，例如：

```text
地址栏：https://gitlab.example.com/group/project
origin：https://gitlab.example.com
```

通常保留脚本自动填入的值即可。

### 最近项目或搜索加载失败

- 确认 GitLab 登录状态有效。
- 检查当前账号是否有 API 和项目访问权限。
- 使用刷新按钮绕过 10 分钟缓存重新请求。
- 打开浏览器开发者工具的 Network 面板，检查 `/api/v4/` 请求状态。
- 如果 `/api/v4/projects` 搜索不可用，脚本会尝试 `/api/v4/search?scope=projects`；两者都失败时会显示搜索错误。

### 更新后没有变化

- 检查安装脚本的版本是否低于 [package.json](package.json) 中的版本。
- 在 userscript 管理器中手动检查更新。
- 确认 GitHub Pages 发布工作流已经成功完成。
- 重新打开安装地址检查待安装版本。
- 如果通过脚本设置页安装且页面未自动刷新，返回 GitLab 后点击“重新加载”。

## 开发环境

### 前置要求

- Node.js 22 或更高版本。
- npm 11 或与 lockfile v3 兼容的 npm 版本。
- 在仓库根目录执行命令。

安装依赖：

```bash
npm install
```

仓库目前没有第三方运行时依赖，但仍应使用根目录的 `package-lock.json` 保持 CI 行为一致。

### 文件结构

```text
packages/gitlab-recent-projects/
├── AGENTS.md
├── README.md
├── package.json
├── src/
│   └── gitlab-recent-projects.user.js
└── test/
    └── gitlab-recent-projects.test.js
```

相关 monorepo 文件：

```text
scripts/build-userscripts.mjs       # 构建所有 userscript
scripts/build-userscripts.test.mjs  # 构建器测试
.github/workflows/publish.yml       # 检查、测试、构建和 Pages 发布
dist/                               # 本地生成，不提交 Git
```

### 开发命令

在仓库根目录运行全部检查：

```bash
npm run check
npm test
npm run build
```

只检查或测试当前脚本：

```bash
npm run check --workspace @userscripts/gitlab-recent-projects
npm test --workspace @userscripts/gitlab-recent-projects
```

查看本地构建产物：

```text
dist/gitlab-recent-projects.user.js
```

### 构建机制

源码 metadata 中使用版本占位符：

```javascript
// @version      __USERSCRIPT_VERSION__
```

`npm run build` 会：

1. 扫描 `packages/*/package.json` 中的 `userscript` 配置。
2. 校验 package 版本、源码路径和输出文件名。
3. 要求源码中恰好存在一个版本占位符。
4. 将当前 package 的 `version` 写入构建产物。
5. 输出 `.user.js` 文件和统一安装首页到 `dist/`。

不要直接修改 `dist/`；它会在下次构建时被删除并重新生成。

### 测试策略

测试直接加载源码文件暴露的纯函数，覆盖：

- MR 和项目 API 数据规范化。
- 非同源 URL 拒绝。
- Fork/Upstream 分组和排序。
- 搜索参数和 fallback。
- 新建 MR、我的 MR、Pipelines URL。
- 收藏数据的同源校验、去重、添加、移除和存储失败路径。
- 多语言选择和插值。
- GitLab 页面识别。
- HTTPS origin 校验、启用、停用和存储失败。

修改业务逻辑时应补充行为级回归测试，不要只断言实现细节。UI/CSS 改动还需要在实际 GitLab 或能模拟宿主页样式污染的页面上做视觉验证。

## 发布流程

1. 修改源码和测试。
2. 根据变更范围提升 [package.json](package.json) 的版本：
   - Patch：Bug 修复，例如 `3.2.0 → 3.2.1`。
   - Minor：向后兼容的新功能，例如 `3.2.0 → 3.3.0`。
   - Major：不兼容行为或安装身份变化，例如 `3.2.0 → 4.0.0`。
3. 运行 `npm run check`、`npm test` 和 `npm run build`。
4. 确认 `dist/gitlab-recent-projects.user.js` 中没有版本占位符，且 `@version` 正确。
5. 提交 Pull Request 并合并到 `main`。
6. GitHub Actions 自动构建并部署 `dist/` 到 GitHub Pages。
7. userscript 管理器通过固定更新地址发现更高版本。
8. 已安装的旧版本读取实际部署脚本的 `@version`，在设置按钮显示更新红点。

首次发布前，需要在 GitHub 仓库 **Settings → Pages** 中将 Source 设置为 **GitHub Actions**。

## AI 与维护者快速上下文

以下内容是修改本脚本时必须保持的关键不变量，也便于 AI 工具快速建立上下文：

1. **版本唯一来源**：`package.json#version`。源码保留 `__USERSCRIPT_VERSION__`，不要手写发布版本。
2. **不绑定组织**：源码、测试、文档和示例中不得加入公司专属域名、名称或内部品牌词。
3. **默认拒绝**：页面不是 GitLab、不是 HTTPS、或 origin 未启用时，不得请求 GitLab API 或检查更新。
4. **业务严格同源**：GitLab API 使用相对路径；API 返回 URL 必须通过 origin 校验。唯一跨域请求是对固定 GitHub Pages 安装地址的匿名版本检查。
5. **不引入 Token**：继续使用当前 GitLab 登录会话，不收集 Personal Access Token。
6. **排名语义稳定**：最近项目按当前用户创建 MR 的时间排序，不得退化为项目活跃度排序。
7. **Fork 配对稳定**：搜索和最近 MR 两条链路都要保持 Fork/Upstream 分组。
8. **搜索行为稳定**：默认仅我的仓库；全局搜索失败时保留 GitLab search API fallback。
9. **UI 隔离**：样式必须限定在 `#gitlab-recent-mr-repos`，尤其要防止宿主页覆盖 SVG 图标样式。
10. **失败可见**：API、解析、存储和搜索失败必须有用户可理解的状态，不得静默继续。
11. **更新来源唯一**：红点必须比较当前安装版本和已经部署的 `.user.js`，不得根据未部署的源码版本提前提示。

常见修改入口：

| 需求 | 主要位置 |
| --- | --- |
| API 查询或搜索 | `fetchMergeRequests`、`fetchProjects`、`fetchSearchProjects` |
| Fork/Upstream 分组 | `buildRecentMrGroups`、`buildSearchProjectGroups` |
| 域名安全 | `isGitLabPage`、`normalizeHttpsOrigin`、`isOriginEnabled` |
| 文案和多语言 | `TRANSLATIONS` |
| UI 渲染 | `createWidget`、`renderWidget`、`createOriginSetup` |
| 样式和图标 | `addStyles`、`createIcon` |
| 更新检查 | `checkForUserscriptUpdates`、`requestPublishedUserscript`、`compareUserscriptVersions` |
| 构建版本 | package `version`、根目录 `scripts/build-userscripts.mjs` |

AI 或维护者完成改动前，应核对源码、测试、版本号和本文档是否同步，并执行与风险相称的验证。
