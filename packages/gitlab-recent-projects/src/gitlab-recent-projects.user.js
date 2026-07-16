// ==UserScript==
// @name         GitLab 最近 MR 仓库快捷入口
// @namespace    https://github.com/lucaslushuo/userscripts
// @version      __USERSCRIPT_VERSION__
// @description  根据最近创建的 MR 或全局搜索，快速打开 Fork 与 Upstream 仓库，支持中英文切换。
// @author       lucaslushuo
// @match        https://*/*
// @updateURL    https://lucaslushuo.github.io/userscripts/gitlab-recent-projects.user.js
// @downloadURL  https://lucaslushuo.github.io/userscripts/gitlab-recent-projects.user.js
// @homepageURL  https://github.com/lucaslushuo/userscripts
// @supportURL   https://github.com/lucaslushuo/userscripts/issues
// @grant        GM_info
// @grant        GM_xmlhttpRequest
// @connect      lucaslushuo.github.io
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const MAX_GROUPS = 20;
  const MAX_MERGE_REQUESTS = 100;
  const MAX_MERGE_REQUEST_PAGES = 5;
  const MAX_PROJECTS_PER_QUERY = 100;
  const MAX_SEARCH_PROJECTS_PER_QUERY = 20;
  const MAX_SEARCH_GROUPS = 20;
  const MIN_SEARCH_QUERY_LENGTH = 2;
  const SEARCH_DEBOUNCE_MS = 350;
  const COPY_FEEDBACK_DURATION_MS = 1600;
  const DEFAULT_OWNED_ONLY_SEARCH = true;
  const CACHE_TTL_MS = 10 * 60 * 1000;
  const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
  const UPDATE_REQUEST_TIMEOUT_MS = 10 * 1000;
  const PUBLISHED_SCRIPT_URL = 'https://lucaslushuo.github.io/userscripts/gitlab-recent-projects.user.js';
  const CACHE_STORAGE_KEY = 'gitlab-recent-mr-repos:cache:v3';
  const LANGUAGE_STORAGE_KEY = 'gitlab-recent-mr-repos:language:v1';
  const ENABLED_ORIGIN_STORAGE_KEY = 'gitlab-recent-mr-repos:enabled-origin:v1';
  const UPDATE_CACHE_STORAGE_KEY = 'gitlab-recent-mr-repos:update:v1';
  const WIDGET_ID = 'gitlab-recent-mr-repos';
  const STYLE_ID = `${WIDGET_ID}-style`;
  const LANGUAGE_ZH_CN = 'zh-CN';
  const LANGUAGE_EN = 'en';
  const SUPPORTED_LANGUAGES = new Set([LANGUAGE_ZH_CN, LANGUAGE_EN]);
  const GITLAB_META_SELECTORS = [
    'meta[name="application-name"]',
    'meta[name="generator"]',
    'meta[property="og:site_name"]',
  ];

  const TRANSLATIONS = {
    [LANGUAGE_ZH_CN]: {
      toggleLabel: '最近 MR 仓库',
      panelAriaLabel: '最近提交 MR 的仓库和 GitLab 仓库搜索',
      title: '最近提交 MR 的仓库',
      recentSubtitle: '按 MR 创建时间排列 · 最多 20 组',
      globalSearchSubtitle: '搜索整个 GitLab · 同组展示 Fork / Upstream',
      ownedSearchSubtitle: '仅我的仓库 · 同组展示对应 Upstream',
      refreshRecent: '刷新最近 MR',
      refreshing: '正在刷新',
      searchPlaceholder: '搜索整个 GitLab 的仓库',
      ownedSearchPlaceholder: '搜索我的仓库和对应 Upstream',
      searchAriaLabel: '搜索 GitLab 仓库',
      clearSearch: '清空搜索',
      ownedFilter: '仅我的仓库及 Upstream',
      ownedHint: '包含个人私有仓库',
      switchLanguage: '切换为英文',
      loadingRecent: '正在读取我最近创建的 MR…',
      searchingGitLab: '正在搜索整个 GitLab…',
      preparingSearch: '准备搜索…',
      minSearchCharacters: '请至少输入 {count} 个字符',
      noRecentMergeRequests: '没有找到你创建的 MR',
      noSearchResults: '没有找到“{query}”相关的可访问仓库',
      apiRequestFailed: 'GitLab API 请求失败（HTTP {status}）',
      apiParseFailed: 'GitLab API 返回了无法解析的数据',
      apiShapeInvalid: 'GitLab API 返回了无法识别的数据',
      loadFailed: '读取失败，请确认已登录 GitLab',
      searchFailed: '搜索失败，请稍后重试',
      searchNetworkFailed: 'GitLab 搜索连接中断，请稍后重试',
      pairedRepositories: '已匹配 Fork 与 Upstream',
      myRepository: '我的仓库',
      globalSearchResult: 'GitLab 全局搜索结果',
      createdOn: '创建于 {date} · ',
      latestMergeRequest: '最近 MR !{iid}',
      recentMergeRequestCount: ' · 共 {count} 个近期 MR',
      showMoreActions: '{project} 更多操作',
      createMergeRequest: '选择分支并创建 MR',
      viewPipelines: '查看 Pipelines',
      copyRepositoryUrl: '复制仓库地址',
      repositoryUrlCopied: '已复制仓库地址',
      copyRepositoryUrlFailed: '复制失败，请检查浏览器权限',
      settings: '域名设置',
      settingsUpdateAvailable: '域名设置，有脚本更新可用',
      settingsTitle: '当前 GitLab 站点已启用',
      settingsDescription: '脚本仅在这个 GitLab 域名下读取同源数据。',
      disableCurrentOrigin: '停用当前域名',
      disableCurrentOriginConfirm: '停用后，必须重新配置域名才能使用。确定继续吗？',
      enableTitle: '启用 GitLab 快捷工具',
      enableDescription: '请手动填写当前 GitLab 的 HTTPS 域名。启用后仅访问该域名的同源 API，配置只保存在本机。',
      originInputLabel: 'GitLab 域名',
      originInputPlaceholder: 'https://gitlab.example.com',
      enableConfiguredOrigin: '启用此域名',
      invalidHttpsOrigin: '请输入完整、有效的 HTTPS 域名。',
      originMismatch: '填写的域名必须与当前 GitLab 页面一致。',
      originStorageFailed: '无法保存域名设置，请检查浏览器是否允许本站使用本地存储。',
      updateTitle: '脚本更新',
      updateIdle: '当前版本 v{version}，尚未检查更新。',
      updateChecking: '正在检查新版本…',
      updateAvailable: '发现新版本 v{version}。',
      updateCurrent: '当前已是最新版本 v{version}。',
      updateCheckFailed: '更新检查失败，可稍后重试。',
      checkForUpdates: '检查更新',
      installUpdate: '安装更新',
      reloadAfterUpdate: '安装后重新加载',
      updateInstallHint: 'Tampermonkey 会在新标签页中要求确认更新。安装完成后返回这里重新加载。',
    },
    [LANGUAGE_EN]: {
      toggleLabel: 'Recent MR repos',
      panelAriaLabel: 'Recent MR repositories and GitLab repository search',
      title: 'Recently submitted MR repositories',
      recentSubtitle: 'Sorted by MR creation time · Up to 20 groups',
      globalSearchSubtitle: 'Search all GitLab · Fork / Upstream grouped together',
      ownedSearchSubtitle: 'My repositories only · Include their Upstream',
      refreshRecent: 'Refresh recent MRs',
      refreshing: 'Refreshing',
      searchPlaceholder: 'Search repositories across GitLab',
      ownedSearchPlaceholder: 'Search my repositories and their Upstream',
      searchAriaLabel: 'Search GitLab repositories',
      clearSearch: 'Clear search',
      ownedFilter: 'My repositories & Upstream only',
      ownedHint: 'Includes personal private repositories',
      switchLanguage: 'Switch to Chinese',
      loadingRecent: 'Loading my recently created MRs…',
      searchingGitLab: 'Searching across GitLab…',
      preparingSearch: 'Preparing search…',
      minSearchCharacters: 'Enter at least {count} characters',
      noRecentMergeRequests: 'No merge requests created by you were found',
      noSearchResults: 'No accessible repositories found for “{query}”',
      apiRequestFailed: 'GitLab API request failed (HTTP {status})',
      apiParseFailed: 'GitLab API returned data that could not be parsed',
      apiShapeInvalid: 'GitLab API returned an unrecognized response',
      loadFailed: 'Could not load data. Make sure you are signed in to GitLab',
      searchFailed: 'Search failed. Please try again',
      searchNetworkFailed: 'The GitLab search connection was interrupted. Please try again',
      pairedRepositories: 'Fork and Upstream matched',
      myRepository: 'My repository',
      globalSearchResult: 'Global GitLab search result',
      createdOn: 'Created on {date} · ',
      latestMergeRequest: 'Latest MR !{iid}',
      recentMergeRequestCount: ' · {count} recent MRs',
      showMoreActions: 'More actions for {project}',
      createMergeRequest: 'Choose branches & create MR',
      viewPipelines: 'View pipelines',
      copyRepositoryUrl: 'Copy repository URL',
      repositoryUrlCopied: 'Repository URL copied',
      copyRepositoryUrlFailed: 'Copy failed. Check your browser permissions',
      settings: 'Domain settings',
      settingsUpdateAvailable: 'Domain settings, script update available',
      settingsTitle: 'This GitLab site is enabled',
      settingsDescription: 'The script only reads same-origin data from this GitLab domain.',
      disableCurrentOrigin: 'Disable this domain',
      disableCurrentOriginConfirm: 'After disabling it, you must configure the domain again to use the script. Continue?',
      enableTitle: 'Enable GitLab shortcuts',
      enableDescription: 'Enter the HTTPS domain of the current GitLab site. Once enabled, the script only calls same-origin APIs, and the setting stays in your browser.',
      originInputLabel: 'GitLab domain',
      originInputPlaceholder: 'https://gitlab.example.com',
      enableConfiguredOrigin: 'Enable this domain',
      invalidHttpsOrigin: 'Enter a complete, valid HTTPS domain.',
      originMismatch: 'The domain must match the current GitLab page.',
      originStorageFailed: 'Could not save the domain setting. Check whether local storage is allowed for this site.',
      updateTitle: 'Script update',
      updateIdle: 'Current version v{version}. Updates have not been checked yet.',
      updateChecking: 'Checking for updates…',
      updateAvailable: 'Version v{version} is available.',
      updateCurrent: 'You are using the latest version, v{version}.',
      updateCheckFailed: 'The update check failed. Try again later.',
      checkForUpdates: 'Check for updates',
      installUpdate: 'Install update',
      reloadAfterUpdate: 'Reload after installing',
      updateInstallHint: 'Tampermonkey will ask you to confirm the update in a new tab. Return here and reload after installation.',
    },
  };

  function resolvePreferredLanguage(storedLanguage, browserLanguages) {
    if (SUPPORTED_LANGUAGES.has(storedLanguage)) return storedLanguage;
    const primaryLanguage = Array.isArray(browserLanguages)
      ? browserLanguages.find((language) => typeof language === 'string' && language.trim())
      : null;
    return primaryLanguage?.toLowerCase().startsWith('zh') ? LANGUAGE_ZH_CN : LANGUAGE_EN;
  }

  function translate(language, key, parameters = {}) {
    const template = TRANSLATIONS[language]?.[key] || TRANSLATIONS[LANGUAGE_EN][key] || key;
    return Object.entries(parameters).reduce(
      (message, [name, value]) => message.split(`{${name}}`).join(String(value)),
      template,
    );
  }

  function parseUserscriptVersion(value) {
    if (typeof value !== 'string') return null;
    const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(value.trim());
    if (!match) return null;
    const core = match.slice(1, 4).map(Number);
    if (core.some((part) => !Number.isSafeInteger(part))) return null;
    return {
      core,
      prerelease: match[4] ? match[4].split('.') : [],
    };
  }

  function comparePrereleaseIdentifiers(leftIdentifiers, rightIdentifiers) {
    if (leftIdentifiers.length === 0 || rightIdentifiers.length === 0) {
      return Number(leftIdentifiers.length === 0) - Number(rightIdentifiers.length === 0);
    }
    const length = Math.max(leftIdentifiers.length, rightIdentifiers.length);
    for (let index = 0; index < length; index += 1) {
      const left = leftIdentifiers[index];
      const right = rightIdentifiers[index];
      if (left === undefined) return -1;
      if (right === undefined) return 1;
      if (left === right) continue;
      const leftIsNumeric = /^\d+$/.test(left);
      const rightIsNumeric = /^\d+$/.test(right);
      if (leftIsNumeric && rightIsNumeric) return Number(left) < Number(right) ? -1 : 1;
      if (leftIsNumeric !== rightIsNumeric) return leftIsNumeric ? -1 : 1;
      return left < right ? -1 : 1;
    }
    return 0;
  }

  function compareUserscriptVersions(leftVersion, rightVersion) {
    const left = parseUserscriptVersion(leftVersion);
    const right = parseUserscriptVersion(rightVersion);
    if (!left || !right) return null;
    for (let index = 0; index < left.core.length; index += 1) {
      if (left.core[index] === right.core[index]) continue;
      return left.core[index] < right.core[index] ? -1 : 1;
    }
    return comparePrereleaseIdentifiers(left.prerelease, right.prerelease);
  }

  function extractPublishedUserscriptVersion(sourceCode) {
    if (typeof sourceCode !== 'string') return null;
    const match = /^\/\/\s*@version\s+([^\s]+)\s*$/m.exec(sourceCode);
    return match && parseUserscriptVersion(match[1]) ? match[1] : null;
  }

  function isGitLabPage(documentObject) {
    return GITLAB_META_SELECTORS.some((selector) => {
      const content = documentObject.querySelector(selector)?.getAttribute('content');
      return typeof content === 'string' && content.trim().toLowerCase() === 'gitlab';
    });
  }

  function normalizeHttpsOrigin(value) {
    if (typeof value !== 'string' || value.trim() === '') return null;
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password) return null;
      return url.origin;
    } catch {
      return null;
    }
  }

  function isOriginEnabled(storage, currentOrigin) {
    const normalizedCurrentOrigin = normalizeHttpsOrigin(currentOrigin);
    if (!normalizedCurrentOrigin) return false;
    try {
      return normalizeHttpsOrigin(storage.getItem(ENABLED_ORIGIN_STORAGE_KEY))
        === normalizedCurrentOrigin;
    } catch {
      return false;
    }
  }

  function getOriginConfigurationError(configuredOrigin, currentOrigin) {
    const normalizedConfiguredOrigin = normalizeHttpsOrigin(configuredOrigin);
    if (!normalizedConfiguredOrigin) return 'invalidHttpsOrigin';
    const normalizedCurrentOrigin = normalizeHttpsOrigin(currentOrigin);
    if (!normalizedCurrentOrigin || normalizedConfiguredOrigin !== normalizedCurrentOrigin) {
      return 'originMismatch';
    }
    return null;
  }

  function enableOrigin(storage, configuredOrigin, currentOrigin) {
    if (getOriginConfigurationError(configuredOrigin, currentOrigin)) return false;
    try {
      storage.setItem(ENABLED_ORIGIN_STORAGE_KEY, normalizeHttpsOrigin(configuredOrigin));
      return true;
    } catch {
      return false;
    }
  }

  function disableOrigin(storage) {
    try {
      storage.removeItem(ENABLED_ORIGIN_STORAGE_KEY);
      return true;
    } catch {
      return false;
    }
  }

  function getInstalledUserscriptVersion() {
    if (typeof GM_info !== 'object' || GM_info === null) return null;
    const version = GM_info.script?.version;
    return parseUserscriptVersion(version) ? version : null;
  }

  function readUpdateCache(storage) {
    try {
      const value = JSON.parse(storage.getItem(UPDATE_CACHE_STORAGE_KEY));
      if (!isRecord(value)
        || !Number.isFinite(value.checkedAt)
        || !parseUserscriptVersion(value.latestVersion)) {
        return null;
      }
      return { checkedAt: value.checkedAt, latestVersion: value.latestVersion };
    } catch {
      return null;
    }
  }

  function saveUpdateCache(storage, latestVersion) {
    try {
      storage.setItem(UPDATE_CACHE_STORAGE_KEY, JSON.stringify({
        checkedAt: Date.now(),
        latestVersion,
      }));
      return true;
    } catch {
      return false;
    }
  }

  function requestPublishedUserscript() {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== 'function') {
        reject(new Error('GM_xmlhttpRequest is unavailable'));
        return;
      }
      const url = new URL(PUBLISHED_SCRIPT_URL);
      url.searchParams.set('update-check', String(Date.now()));
      GM_xmlhttpRequest({
        method: 'GET',
        url: url.href,
        headers: { Accept: 'text/plain' },
        anonymous: true,
        timeout: UPDATE_REQUEST_TIMEOUT_MS,
        onload(response) {
          if (response.status < 200 || response.status >= 300) {
            reject(new Error(`Update request failed with HTTP ${response.status}`));
            return;
          }
          resolve(response.responseText);
        },
        onerror() {
          reject(new Error('Update request failed'));
        },
        ontimeout() {
          reject(new Error('Update request timed out'));
        },
      });
    });
  }

  function createStatus(key, parameters = {}) {
    return { key, parameters };
  }

  function readStoredLanguage(storage) {
    try {
      return storage.getItem(LANGUAGE_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  class LocalizedError extends Error {
    constructor(translationKey, translationParameters = {}) {
      super(translationKey);
      this.name = 'LocalizedError';
      this.translationKey = translationKey;
      this.translationParameters = translationParameters;
    }
  }

  function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function normalizeWebUrl(value, allowedOrigin) {
    if (typeof value !== 'string') return null;
    try {
      const url = new URL(value, allowedOrigin);
      return url.origin === allowedOrigin ? url.href.replace(/\/$/, '') : null;
    } catch {
      return null;
    }
  }

  function normalizeProject(value, allowedOrigin, includeUpstream = true) {
    if (!isRecord(value) || !Number.isInteger(value.id) || value.id <= 0) return null;

    const webUrl = normalizeWebUrl(value.web_url, allowedOrigin);
    const nameWithNamespace = typeof value.name_with_namespace === 'string'
      ? value.name_with_namespace.trim()
      : '';
    const pathWithNamespace = typeof value.path_with_namespace === 'string'
      ? value.path_with_namespace.trim()
      : '';
    if (!webUrl || (!nameWithNamespace && !pathWithNamespace)) return null;

    return {
      id: value.id,
      nameWithNamespace: nameWithNamespace || pathWithNamespace,
      pathWithNamespace: pathWithNamespace || nameWithNamespace,
      webUrl,
      upstream: includeUpstream && isRecord(value.forked_from_project)
        ? normalizeProject(value.forked_from_project, allowedOrigin, false)
        : null,
    };
  }

  function inferTargetProject(mergeRequest, allowedOrigin) {
    const webUrl = normalizeWebUrl(mergeRequest.web_url, allowedOrigin);
    if (!webUrl) return null;

    const projectWebUrl = webUrl.replace(/\/-\/merge_requests\/\d+$/, '');
    if (projectWebUrl === webUrl) return null;

    let pathWithNamespace;
    try {
      pathWithNamespace = decodeURIComponent(new URL(projectWebUrl).pathname.replace(/^\//, ''));
    } catch {
      return null;
    }

    return {
      id: mergeRequest.target_project_id,
      nameWithNamespace: pathWithNamespace,
      pathWithNamespace,
      webUrl: projectWebUrl,
      upstream: null,
    };
  }

  function normalizeMergeRequest(value, allowedOrigin) {
    if (!isRecord(value)
      || !Number.isInteger(value.id)
      || !Number.isInteger(value.iid)
      || !Number.isInteger(value.source_project_id)
      || !Number.isInteger(value.target_project_id)) {
      return null;
    }

    const webUrl = normalizeWebUrl(value.web_url, allowedOrigin);
    const createdAt = Date.parse(typeof value.created_at === 'string' ? value.created_at : '');
    const targetProject = inferTargetProject(value, allowedOrigin);
    if (!webUrl || !Number.isFinite(createdAt) || !targetProject) return null;

    return {
      id: value.id,
      iid: value.iid,
      sourceProjectId: value.source_project_id,
      targetProjectId: value.target_project_id,
      createdAt,
      webUrl,
      targetProject,
    };
  }

  function buildRecentMrGroups(projects, mergeRequests, limit = MAX_GROUPS) {
    const projectsById = new Map();
    for (const project of projects) {
      projectsById.set(project.id, project);
      if (project.upstream && !projectsById.has(project.upstream.id)) {
        projectsById.set(project.upstream.id, project.upstream);
      }
    }

    const groups = new Map();
    for (const mergeRequest of mergeRequests) {
      const source = projectsById.get(mergeRequest.sourceProjectId) || null;
      const target = projectsById.get(mergeRequest.targetProjectId)
        || (source?.upstream?.id === mergeRequest.targetProjectId ? source.upstream : null)
        || mergeRequest.targetProject;
      const group = groups.get(target.id) || {
        upstream: target,
        forks: [],
        mergeRequestCount: 0,
        latestMergeRequest: mergeRequest,
      };

      group.mergeRequestCount += 1;
      if (mergeRequest.createdAt > group.latestMergeRequest.createdAt) {
        group.latestMergeRequest = mergeRequest;
      }
      if (source && source.id !== target.id && !group.forks.some(({ id }) => id === source.id)) {
        group.forks.push(source);
      }
      groups.set(target.id, group);
    }

    return [...groups.values()]
      .sort((left, right) => (
        right.latestMergeRequest.createdAt - left.latestMergeRequest.createdAt
        || left.upstream.nameWithNamespace.localeCompare(right.upstream.nameWithNamespace)
      ))
      .slice(0, limit);
  }

  function buildSearchProjectGroups(searchProjects, limit = MAX_SEARCH_GROUPS) {
    const projectsById = new Map();
    for (const project of searchProjects) {
      projectsById.set(project.id, project);
      if (project.upstream && !projectsById.has(project.upstream.id)) {
        projectsById.set(project.upstream.id, project.upstream);
      }
    }

    const groups = new Map();
    for (const project of searchProjects) {
      const upstream = project.upstream
        ? (projectsById.get(project.upstream.id) || project.upstream)
        : project;
      const group = groups.get(upstream.id) || { upstream, forks: [] };
      if (project.upstream && !group.forks.some(({ id }) => id === project.id)) {
        group.forks.push(project);
      } else if (!project.upstream) {
        group.upstream = project;
      }
      groups.set(upstream.id, group);
    }

    return [...groups.values()].slice(0, limit);
  }

  function buildProjectSearchPath(query, ownedOnly) {
    const parameters = {
      search: query,
      archived: 'false',
      simple: 'false',
      per_page: String(MAX_SEARCH_PROJECTS_PER_QUERY),
    };
    if (ownedOnly) parameters.owned = 'true';
    return `/api/v4/projects?${new URLSearchParams(parameters)}`;
  }

  function buildGlobalSearchFallbackPath(query) {
    return `/api/v4/search?${new URLSearchParams({
      scope: 'projects',
      search: query,
      per_page: String(MAX_SEARCH_PROJECTS_PER_QUERY),
    })}`;
  }

  function buildNewMergeRequestUrl(project) {
    const url = new URL(`${project.webUrl.replace(/\/$/, '')}/-/merge_requests/new`);
    url.searchParams.set('change_branches', 'true');
    return url.href;
  }

  function buildPipelinesUrl(project) {
    return `${project.webUrl.replace(/\/$/, '')}/-/pipelines`;
  }

  async function copyTextToClipboard(text, clipboard) {
    if (typeof text !== 'string'
      || text.length === 0
      || !clipboard
      || typeof clipboard.writeText !== 'function') {
      return false;
    }
    try {
      await clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  function readCache(storage, allowedOrigin) {
    try {
      const raw = storage.getItem(CACHE_STORAGE_KEY);
      if (raw === null) return null;
      const value = JSON.parse(raw);
      if (!isRecord(value)
        || !Number.isFinite(value.fetchedAt)
        || !Array.isArray(value.projects)
        || !Array.isArray(value.mergeRequests)) {
        return null;
      }

      return {
        fetchedAt: value.fetchedAt,
        projects: value.projects.map((project) => normalizeProject(project, allowedOrigin)).filter(Boolean),
        mergeRequests: value.mergeRequests
          .map((mergeRequest) => normalizeMergeRequest(mergeRequest, allowedOrigin))
          .filter(Boolean),
      };
    } catch {
      return null;
    }
  }

  function serializeProject(project) {
    return {
      id: project.id,
      name_with_namespace: project.nameWithNamespace,
      path_with_namespace: project.pathWithNamespace,
      web_url: project.webUrl,
      forked_from_project: project.upstream ? serializeProject(project.upstream) : null,
    };
  }

  function serializeMergeRequest(mergeRequest) {
    return {
      id: mergeRequest.id,
      iid: mergeRequest.iid,
      source_project_id: mergeRequest.sourceProjectId,
      target_project_id: mergeRequest.targetProjectId,
      created_at: new Date(mergeRequest.createdAt).toISOString(),
      web_url: mergeRequest.webUrl,
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      buildRecentMrGroups,
      buildGlobalSearchFallbackPath,
      buildNewMergeRequestUrl,
      buildPipelinesUrl,
      buildProjectSearchPath,
      buildSearchProjectGroups,
      compareUserscriptVersions,
      copyTextToClipboard,
      disableOrigin,
      enableOrigin,
      extractPublishedUserscriptVersion,
      getOriginConfigurationError,
      inferTargetProject,
      isGitLabPage,
      isOriginEnabled,
      normalizeHttpsOrigin,
      normalizeMergeRequest,
      normalizeProject,
      resolvePreferredLanguage,
      translate,
    };
    return;
  }

  const browserLanguages = navigator.languages?.length
    ? [...navigator.languages]
    : [navigator.language];
  let currentLanguage = resolvePreferredLanguage(
    readStoredLanguage(window.localStorage),
    browserLanguages,
  );

  if (!isGitLabPage(document)) return;
  if (!isOriginEnabled(window.localStorage, window.location.origin)) {
    createOriginSetup();
    return;
  }

  let projects = [];
  let mergeRequests = [];
  let recentStatus = createStatus('loadingRecent');
  let isRefreshing = false;
  let searchQuery = '';
  let searchProjects = [];
  let searchStatus = null;
  let isSearching = false;
  let onlyOwnedSearch = DEFAULT_OWNED_ONLY_SEARCH;
  let searchDebounceTimer = null;
  let searchRequestController = null;
  const installedUserscriptVersion = getInstalledUserscriptVersion();
  let updateState = { status: 'idle', latestVersion: null };
  let updateInstallOpened = false;

  function t(key, parameters) {
    return translate(currentLanguage, key, parameters);
  }

  function statusText(status) {
    return status ? t(status.key, status.parameters) : '';
  }

  function statusFromError(error, fallbackKey) {
    return error instanceof LocalizedError
      ? createStatus(error.translationKey, error.translationParameters)
      : createStatus(fallbackKey);
  }

  function applyPublishedVersion(latestVersion) {
    const comparison = compareUserscriptVersions(installedUserscriptVersion, latestVersion);
    if (comparison === null) throw new Error('Invalid installed or published userscript version');
    updateState = {
      status: comparison < 0 ? 'available' : 'current',
      latestVersion,
    };
  }

  function updateStatusText() {
    if (updateState.status === 'checking') return t('updateChecking');
    if (updateState.status === 'available') {
      return t('updateAvailable', { version: updateState.latestVersion });
    }
    if (updateState.status === 'current') {
      return t('updateCurrent', { version: installedUserscriptVersion });
    }
    if (updateState.status === 'error') return t('updateCheckFailed');
    return t('updateIdle', { version: installedUserscriptVersion || 'unknown' });
  }

  async function checkForUserscriptUpdates({ force = false } = {}) {
    if (updateState.status === 'checking') return;
    if (!installedUserscriptVersion) {
      updateState = { status: 'error', latestVersion: null };
      renderWidget();
      return;
    }

    const cachedUpdate = readUpdateCache(window.localStorage);
    if (!force
      && cachedUpdate
      && Date.now() - cachedUpdate.checkedAt < UPDATE_CHECK_INTERVAL_MS) {
      applyPublishedVersion(cachedUpdate.latestVersion);
      renderWidget();
      return;
    }

    updateState = { status: 'checking', latestVersion: updateState.latestVersion };
    renderWidget();
    try {
      const sourceCode = await requestPublishedUserscript();
      const latestVersion = extractPublishedUserscriptVersion(sourceCode);
      if (!latestVersion) throw new Error('Published userscript version is missing or invalid');
      applyPublishedVersion(latestVersion);
      // A failed cache write must not hide a successfully retrieved update result.
      saveUpdateCache(window.localStorage, latestVersion);
    } catch {
      updateState = { status: 'error', latestVersion: null };
    }
    renderWidget();
  }

  function switchLanguage() {
    currentLanguage = currentLanguage === LANGUAGE_ZH_CN ? LANGUAGE_EN : LANGUAGE_ZH_CN;
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
    } catch {
      // The current session still switches language when browser storage is unavailable.
    }
    renderWidget();
  }

  async function fetchJson(path, { signal } = {}) {
    const response = await window.fetch(path, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      signal,
    });
    if (!response.ok) throw new LocalizedError('apiRequestFailed', { status: response.status });
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new LocalizedError('apiParseFailed');
    }
    if (!Array.isArray(payload)) throw new LocalizedError('apiShapeInvalid');
    return payload;
  }

  async function fetchMergeRequests() {
    const mergeRequests = [];
    const targetProjectIds = new Set();

    for (let page = 1; page <= MAX_MERGE_REQUEST_PAGES; page += 1) {
      const query = new URLSearchParams({
        scope: 'created_by_me',
        state: 'all',
        order_by: 'created_at',
        sort: 'desc',
        per_page: String(MAX_MERGE_REQUESTS),
        page: String(page),
      });
      const payload = await fetchJson(`/api/v4/merge_requests?${query}`);
      const normalizedPage = payload
        .map((mergeRequest) => normalizeMergeRequest(mergeRequest, window.location.origin))
        .filter(Boolean);
      mergeRequests.push(...normalizedPage);
      for (const mergeRequest of normalizedPage) targetProjectIds.add(mergeRequest.targetProjectId);

      if (targetProjectIds.size >= MAX_GROUPS || payload.length < MAX_MERGE_REQUESTS) break;
    }

    return mergeRequests;
  }

  async function fetchProjects(filterName) {
    const query = new URLSearchParams({
      [filterName]: 'true',
      order_by: 'last_activity_at',
      sort: 'desc',
      archived: 'false',
      simple: 'false',
      per_page: String(MAX_PROJECTS_PER_QUERY),
    });
    const payload = await fetchJson(`/api/v4/projects?${query}`);
    return payload
      .map((project) => normalizeProject(project, window.location.origin))
      .filter(Boolean);
  }

  function deduplicateProjects(projectLists) {
    return [...new Map(projectLists.flat().map((project) => [project.id, project])).values()];
  }

  async function fetchSearchProjects(query, ownedOnly, signal) {
    let visibleProjectsPayload = [];
    let ownedProjectsPayload;
    if (ownedOnly) {
      ownedProjectsPayload = await fetchJson(buildProjectSearchPath(query, true), { signal });
    } else {
      [visibleProjectsPayload, ownedProjectsPayload] = await Promise.all([
        fetchVisibleSearchProjects(query, signal),
        fetchJson(buildProjectSearchPath(query, true), { signal }),
      ]);
    }
    const normalizeProjects = (payload) => payload
      .map((project) => normalizeProject(project, window.location.origin))
      .filter(Boolean);
    const matchedProjects = deduplicateProjects([
      normalizeProjects(visibleProjectsPayload),
      normalizeProjects(ownedProjectsPayload),
    ]);
    if (ownedOnly) return matchedProjects;

    const matchedProjectIds = new Set(matchedProjects.flatMap((project) => (
      project.upstream ? [project.id, project.upstream.id] : [project.id]
    )));
    const knownRelatedForks = projects.filter((project) => (
      project.upstream && matchedProjectIds.has(project.upstream.id)
    ));
    return deduplicateProjects([matchedProjects, knownRelatedForks]);
  }

  async function fetchVisibleSearchProjects(query, signal) {
    try {
      return await fetchJson(buildProjectSearchPath(query, false), { signal });
    } catch (error) {
      if (isRecord(error) && error.name === 'AbortError') throw error;
      return fetchJson(buildGlobalSearchFallbackPath(query), { signal });
    }
  }

  async function performSearch(query, ownedOnly) {
    const controller = new AbortController();
    searchRequestController = controller;
    isSearching = true;
    searchStatus = createStatus('searchingGitLab');
    renderWidget();

    try {
      const nextSearchProjects = await fetchSearchProjects(query, ownedOnly, controller.signal);
      if (searchQuery === query && onlyOwnedSearch === ownedOnly) {
        searchProjects = nextSearchProjects;
        searchStatus = null;
      }
    } catch (error) {
      if (isRecord(error) && error.name === 'AbortError') return;
      if (searchQuery === query && onlyOwnedSearch === ownedOnly) {
        searchProjects = [];
        searchStatus = error instanceof TypeError
          ? createStatus('searchNetworkFailed')
          : statusFromError(error, 'searchFailed');
      }
    } finally {
      if (searchRequestController === controller) {
        searchRequestController = null;
        isSearching = false;
        renderWidget();
      }
    }
  }

  function updateSearch(rawQuery) {
    searchQuery = rawQuery.trim();
    searchProjects = [];
    window.clearTimeout(searchDebounceTimer);
    searchRequestController?.abort();
    searchRequestController = null;
    isSearching = false;

    if (searchQuery.length === 0) {
      searchStatus = null;
    } else if (searchQuery.length < MIN_SEARCH_QUERY_LENGTH) {
      searchStatus = createStatus('minSearchCharacters', { count: MIN_SEARCH_QUERY_LENGTH });
    } else {
      searchStatus = createStatus('preparingSearch');
      const scheduledQuery = searchQuery;
      const scheduledOwnedOnly = onlyOwnedSearch;
      searchDebounceTimer = window.setTimeout(
        () => performSearch(scheduledQuery, scheduledOwnedOnly),
        SEARCH_DEBOUNCE_MS,
      );
    }
    renderWidget();
  }

  function saveCache() {
    window.localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify({
      fetchedAt: Date.now(),
      projects: projects.map(serializeProject),
      mergeRequests: mergeRequests.map(serializeMergeRequest),
    }));
  }

  function formatDate(timestamp) {
    return new Intl.DateTimeFormat(currentLanguage === LANGUAGE_ZH_CN ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(timestamp));
  }

  function createElement(tagName, className, textContent) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (textContent) element.textContent = textContent;
    return element;
  }

  function createIcon(name, className = 'qgqr-icon') {
    const svgNamespace = 'http://www.w3.org/2000/svg';
    const icon = document.createElementNS(svgNamespace, 'svg');
    icon.setAttribute('class', className);
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('stroke-width', '1.75');
    icon.setAttribute('stroke-linecap', 'round');
    icon.setAttribute('stroke-linejoin', 'round');
    icon.setAttribute('aria-hidden', 'true');

    const definitions = {
      merge: [
        ['circle', { cx: '6', cy: '6', r: '3' }],
        ['circle', { cx: '18', cy: '18', r: '3' }],
        ['path', { d: 'M6 21V9a9 9 0 0 0 9 9' }],
      ],
      refresh: [
        ['path', { d: 'M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5' }],
        ['path', { d: 'M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5' }],
      ],
      arrow: [
        ['path', { d: 'M5 12h14' }],
        ['path', { d: 'm13 6 6 6-6 6' }],
      ],
      search: [
        ['circle', { cx: '11', cy: '11', r: '8' }],
        ['path', { d: 'm21 21-4.3-4.3' }],
      ],
      close: [
        ['path', { d: 'M18 6 6 18' }],
        ['path', { d: 'm6 6 12 12' }],
      ],
      more: [
        ['circle', { cx: '5', cy: '12', r: '1' }],
        ['circle', { cx: '12', cy: '12', r: '1' }],
        ['circle', { cx: '19', cy: '12', r: '1' }],
      ],
      pipeline: [
        ['circle', { cx: '12', cy: '12', r: '9' }],
        ['polygon', { points: '10 8 16 12 10 16' }],
      ],
      copy: [
        ['rect', { x: '9', y: '9', width: '13', height: '13', rx: '2' }],
        ['path', { d: 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' }],
      ],
      settings: [
        ['path', { d: 'M4 7h8' }],
        ['circle', { cx: '15', cy: '7', r: '2' }],
        ['path', { d: 'M18 7h2' }],
        ['path', { d: 'M4 17h2' }],
        ['circle', { cx: '9', cy: '17', r: '2' }],
        ['path', { d: 'M12 17h8' }],
      ],
    };

    for (const [tagName, attributes] of definitions[name] || []) {
      const child = document.createElementNS(svgNamespace, tagName);
      for (const [attribute, value] of Object.entries(attributes)) child.setAttribute(attribute, value);
      icon.append(child);
    }
    return icon;
  }

  function createProjectLink(project, type) {
    const link = createElement('a', `qgqr-project-link${type ? '' : ' qgqr-project-only'}`);
    link.href = project.webUrl;
    link.title = project.nameWithNamespace;
    if (type) {
      link.append(createElement(
        'span',
        `qgqr-type qgqr-type-${type}`,
        type === 'fork' ? 'Fork' : 'Upstream',
      ));
    }
    link.append(createElement('span', 'qgqr-project-name', project.nameWithNamespace));
    return link;
  }

  function closeProjectMenus(widget) {
    for (const menu of widget.querySelectorAll('.qgqr-project-menu')) menu.hidden = true;
    for (const button of widget.querySelectorAll('.qgqr-more-button')) {
      button.setAttribute('aria-expanded', 'false');
    }
  }

  function createProjectMenuAction(href, iconName, translationKey) {
    const action = createElement('a', 'qgqr-menu-action');
    action.href = href;
    action.setAttribute('role', 'menuitem');
    action.append(createIcon(iconName), createElement('span', '', t(translationKey)));
    return action;
  }

  function createProjectEntry(project, type) {
    const entry = createElement('div', 'qgqr-project-entry');
    const row = createElement('div', 'qgqr-project-row');
    row.append(createProjectLink(project, type));

    const menuId = `${WIDGET_ID}-project-menu-${project.id}`;
    const moreButton = createElement('button', 'qgqr-more-button');
    moreButton.type = 'button';
    moreButton.title = t('showMoreActions', { project: project.nameWithNamespace });
    moreButton.setAttribute('aria-label', t('showMoreActions', { project: project.nameWithNamespace }));
    moreButton.setAttribute('aria-haspopup', 'menu');
    moreButton.setAttribute('aria-expanded', 'false');
    moreButton.setAttribute('aria-controls', menuId);
    moreButton.append(createIcon('more'));
    row.append(moreButton);

    const menu = createElement('div', 'qgqr-project-menu');
    menu.id = menuId;
    menu.hidden = true;
    menu.setAttribute('role', 'menu');
    const copyUrlButton = createElement('button', 'qgqr-menu-action');
    copyUrlButton.type = 'button';
    copyUrlButton.setAttribute('role', 'menuitem');
    const copyUrlLabel = createElement('span', '', t('copyRepositoryUrl'));
    copyUrlLabel.setAttribute('aria-live', 'polite');
    copyUrlButton.append(createIcon('copy'), copyUrlLabel);
    menu.append(
      createProjectMenuAction(buildNewMergeRequestUrl(project), 'merge', 'createMergeRequest'),
      createProjectMenuAction(buildPipelinesUrl(project), 'pipeline', 'viewPipelines'),
      copyUrlButton,
    );
    entry.append(row, menu);

    let copyFeedbackTimer = null;
    copyUrlButton.addEventListener('click', async () => {
      copyUrlButton.disabled = true;
      const copied = await copyTextToClipboard(project.webUrl, navigator.clipboard);
      copyUrlLabel.textContent = t(copied ? 'repositoryUrlCopied' : 'copyRepositoryUrlFailed');
      copyUrlButton.classList.toggle('qgqr-menu-action-success', copied);
      copyUrlButton.classList.toggle('qgqr-menu-action-error', !copied);
      copyUrlButton.disabled = false;
      window.clearTimeout(copyFeedbackTimer);
      copyFeedbackTimer = window.setTimeout(() => {
        if (!copyUrlButton.isConnected) return;
        copyUrlLabel.textContent = t('copyRepositoryUrl');
        copyUrlButton.classList.remove('qgqr-menu-action-success', 'qgqr-menu-action-error');
      }, COPY_FEEDBACK_DURATION_MS);
    });

    moreButton.addEventListener('click', () => {
      const shouldOpen = menu.hidden;
      const widget = document.getElementById(WIDGET_ID);
      if (widget) closeProjectMenus(widget);
      menu.hidden = !shouldOpen;
      moreButton.setAttribute('aria-expanded', String(shouldOpen));
    });
    return entry;
  }

  function appendProjectLinks(content, group) {
    for (const fork of group.forks) content.append(createProjectEntry(fork, 'fork'));
    if (group.forks.length > 0) {
      content.append(createProjectEntry(group.upstream, 'upstream'));
      return;
    }
    content.append(createProjectEntry(group.upstream, null));
  }

  function renderGroup(group, index) {
    const item = createElement('li', 'qgqr-item');
    item.append(createElement('span', 'qgqr-rank', String(index + 1)));
    const content = createElement('div', 'qgqr-item-content');

    appendProjectLinks(content, group);

    const details = createElement('span', 'qgqr-detail');
    details.append(document.createTextNode(t('createdOn', {
      date: formatDate(group.latestMergeRequest.createdAt),
    })));
    const mergeRequestLink = createElement(
      'a',
      'qgqr-mr-link',
      t('latestMergeRequest', { iid: group.latestMergeRequest.iid }),
    );
    mergeRequestLink.href = group.latestMergeRequest.webUrl;
    mergeRequestLink.append(createIcon('arrow', 'qgqr-inline-icon'));
    details.append(mergeRequestLink);
    if (group.mergeRequestCount > 1) {
      details.append(document.createTextNode(t('recentMergeRequestCount', {
        count: group.mergeRequestCount,
      })));
    }
    content.append(details);
    item.append(content);
    return item;
  }

  function renderSearchGroup(group, index) {
    const item = createElement('li', 'qgqr-item');
    item.append(createElement('span', 'qgqr-rank', String(index + 1)));
    const content = createElement('div', 'qgqr-item-content');
    appendProjectLinks(content, group);
    content.append(createElement(
      'span',
      'qgqr-detail',
      group.forks.length > 0
        ? t('pairedRepositories')
        : t(onlyOwnedSearch ? 'myRepository' : 'globalSearchResult'),
    ));
    item.append(content);
    return item;
  }

  function renderWidget() {
    const widget = document.getElementById(WIDGET_ID);
    if (!widget) return;

    const isSearchMode = searchQuery.length > 0;
    const groups = isSearchMode
      ? buildSearchProjectGroups(searchProjects)
      : buildRecentMrGroups(projects, mergeRequests);
    const renderItem = isSearchMode ? renderSearchGroup : renderGroup;
    widget.querySelector('.qgqr-list').replaceChildren(...groups.map(renderItem));
    widget.querySelector('.qgqr-count').textContent = String(groups.length);
    const statusElement = widget.querySelector('.qgqr-status');
    const activeStatus = isSearchMode ? searchStatus : recentStatus;
    const emptyStatus = t(
      isSearchMode ? 'noSearchResults' : 'noRecentMergeRequests',
      { query: searchQuery },
    );
    statusElement.textContent = groups.length === 0 && !activeStatus
      ? emptyStatus
      : statusText(activeStatus);
    statusElement.hidden = groups.length > 0 && !activeStatus;
    widget.querySelector('.qgqr-subtitle').textContent = isSearchMode
      ? (onlyOwnedSearch
        ? t('ownedSearchSubtitle')
        : t('globalSearchSubtitle'))
      : t('recentSubtitle');
    const refreshButton = widget.querySelector('.qgqr-refresh');
    refreshButton.hidden = isSearchMode;
    refreshButton.disabled = isRefreshing;
    refreshButton.classList.toggle('qgqr-is-spinning', isRefreshing);
    refreshButton.title = t('refreshRecent');
    refreshButton.setAttribute('aria-label', t(isRefreshing ? 'refreshing' : 'refreshRecent'));
    widget.querySelector('.qgqr-search-loader').hidden = !isSearching;
    widget.querySelector('.qgqr-search-clear').hidden = searchQuery.length === 0;
    widget.lang = currentLanguage;
    widget.querySelector('.qgqr-toggle-label').textContent = t('toggleLabel');
    const panel = widget.querySelector('.qgqr-panel');
    panel.setAttribute('aria-label', t('panelAriaLabel'));
    widget.querySelector('.qgqr-title').textContent = t('title');
    const searchInput = widget.querySelector('.qgqr-search-input');
    searchInput.placeholder = t(onlyOwnedSearch ? 'ownedSearchPlaceholder' : 'searchPlaceholder');
    searchInput.setAttribute('aria-label', t('searchAriaLabel'));
    const clearSearchButton = widget.querySelector('.qgqr-search-clear');
    clearSearchButton.title = t('clearSearch');
    clearSearchButton.setAttribute('aria-label', t('clearSearch'));
    widget.querySelector('.qgqr-owned-filter-label').textContent = t('ownedFilter');
    widget.querySelector('.qgqr-filter-hint').textContent = t('ownedHint');
    const languageButton = widget.querySelector('.qgqr-language');
    languageButton.textContent = currentLanguage === LANGUAGE_ZH_CN ? 'EN' : '中';
    languageButton.title = t('switchLanguage');
    languageButton.setAttribute('aria-label', t('switchLanguage'));
    const settingsButton = widget.querySelector('.qgqr-settings-button');
    const settingsLabel = t(updateState.status === 'available' ? 'settingsUpdateAvailable' : 'settings');
    settingsButton.title = settingsLabel;
    settingsButton.setAttribute('aria-label', settingsLabel);
    settingsButton.classList.toggle('qgqr-has-update', updateState.status === 'available');
    widget.querySelector('.qgqr-settings-title').textContent = t('settingsTitle');
    widget.querySelector('.qgqr-settings-description').textContent = t('settingsDescription');
    widget.querySelector('.qgqr-disable-origin').textContent = t('disableCurrentOrigin');
    widget.querySelector('.qgqr-update-title').textContent = t('updateTitle');
    widget.querySelector('.qgqr-update-status').textContent = updateStatusText();
    const updateCheckButton = widget.querySelector('.qgqr-update-check');
    updateCheckButton.textContent = t('checkForUpdates');
    updateCheckButton.disabled = updateState.status === 'checking';
    const installUpdateLink = widget.querySelector('.qgqr-install-update');
    installUpdateLink.textContent = t('installUpdate');
    installUpdateLink.hidden = updateState.status !== 'available';
    const reloadAfterUpdateButton = widget.querySelector('.qgqr-reload-after-update');
    reloadAfterUpdateButton.textContent = t('reloadAfterUpdate');
    reloadAfterUpdateButton.hidden = !updateInstallOpened;
    const updateInstallHint = widget.querySelector('.qgqr-update-hint');
    updateInstallHint.textContent = t('updateInstallHint');
    updateInstallHint.hidden = updateState.status !== 'available';
    if (!widget.querySelector('.qgqr-settings').hidden) {
      widget.querySelector('.qgqr-search-area').hidden = true;
      widget.querySelector('.qgqr-list').hidden = true;
      statusElement.hidden = true;
    }
  }

  async function refreshData({ force = false } = {}) {
    if (isRefreshing) return;

    const cache = readCache(window.localStorage, window.location.origin);
    if (!force && cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
      projects = cache.projects;
      mergeRequests = cache.mergeRequests;
      recentStatus = null;
      renderWidget();
      return;
    }

    isRefreshing = true;
    recentStatus = createStatus('loadingRecent');
    renderWidget();
    try {
      const [nextMergeRequests, memberProjects, ownedProjects] = await Promise.all([
        fetchMergeRequests(),
        fetchProjects('membership'),
        fetchProjects('owned'),
      ]);
      mergeRequests = nextMergeRequests;
      projects = deduplicateProjects([memberProjects, ownedProjects]);
      saveCache();
      recentStatus = null;
    } catch (error) {
      recentStatus = statusFromError(error, 'loadFailed');
    } finally {
      isRefreshing = false;
      renderWidget();
    }
  }

  function addStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${WIDGET_ID} { position: fixed; top: 76px; right: 18px; z-index: 10000; font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--gl-text-color-default, #172033); }
      #${WIDGET_ID} * { box-sizing: border-box; }
      #${WIDGET_ID} svg, #${WIDGET_ID} svg * { fill: none !important; stroke: currentColor !important; stroke-width: 1.75 !important; }
      .qgqr-icon { width: 18px; height: 18px; flex: 0 0 18px; }
      .qgqr-inline-icon { width: 13px; height: 13px; margin-left: 3px; vertical-align: -2px; }
      .qgqr-toggle { display: flex; align-items: center; gap: 8px; min-height: 40px; border: 1px solid rgba(99,102,241,.28); border-radius: 12px; padding: 8px 10px 8px 12px; background: var(--gl-background-color-default, rgba(255,255,255,.96)); color: var(--gl-text-color-default, #172033); box-shadow: 0 6px 20px rgba(24,32,51,.13), 0 1px 2px rgba(24,32,51,.08); cursor: pointer; font-weight: 650; letter-spacing: -.01em; backdrop-filter: blur(14px); transition: border-color .18s ease, box-shadow .18s ease, background-color .18s ease; }
      .qgqr-toggle:hover { border-color: #7c6cf2; background: var(--gl-background-color-subtle, #f8f7ff); box-shadow: 0 9px 26px rgba(76,61,174,.18), 0 1px 2px rgba(24,32,51,.08); }
      .qgqr-toggle .qgqr-icon { color: #6d5bd0; }
      .qgqr-count { display: grid; min-width: 22px; height: 22px; place-items: center; border-radius: 7px; padding: 0 5px; background: #ede9fe; color: #5943b6; font-size: 11px; font-weight: 750; }
      .qgqr-panel { position: absolute; top: 50px; right: 0; width: min(480px, calc(100vw - 24px)); max-height: min(78vh, 740px); overflow: hidden; border: 1px solid var(--gl-border-color-default, #dfe1e6); border-radius: 16px; background: var(--gl-background-color-default, #fff); box-shadow: 0 22px 60px rgba(24,32,51,.22), 0 4px 12px rgba(24,32,51,.08); animation: qgqr-enter .16s ease-out; }
      .qgqr-panel::before { display: block; height: 3px; background: linear-gradient(90deg, #6d5bd0, #8b5cf6 50%, #3b82f6); content: ''; }
      .qgqr-panel[hidden], .qgqr-status[hidden] { display: none; }
      .qgqr-header { display: flex; align-items: center; gap: 11px; padding: 14px 16px; border-bottom: 1px solid var(--gl-border-color-default, #e6e7eb); background: linear-gradient(180deg, rgba(109,91,208,.055), transparent); }
      .qgqr-header-icon { display: grid; width: 36px; height: 36px; flex: 0 0 36px; place-items: center; border-radius: 10px; background: #ede9fe; color: #5943b6; }
      .qgqr-heading { min-width: 0; flex: 1; }
      .qgqr-title { margin: 0; font-size: 15px; font-weight: 700; letter-spacing: -.015em; }
      .qgqr-subtitle { display: block; margin-top: 1px; color: var(--gl-text-color-subtle, #626b7d); font-size: 12px; }
      .qgqr-action { display: grid; width: 34px; height: 34px; place-items: center; border: 1px solid transparent; border-radius: 9px; padding: 0; background: transparent; color: var(--gl-text-color-subtle, #626b7d); cursor: pointer; transition: color .18s ease, background-color .18s ease, border-color .18s ease; }
      .qgqr-action:hover { border-color: var(--gl-border-color-default, #dfe1e6); background: var(--gl-background-color-subtle, #f4f5f7); color: #5943b6; }
      .qgqr-settings-button { position: relative; }
      .qgqr-settings-button.qgqr-has-update::after { position: absolute; top: 4px; right: 4px; width: 8px; height: 8px; border: 2px solid var(--gl-background-color-default, #fff); border-radius: 50%; background: #ef4444; box-shadow: 0 0 0 1px rgba(185,28,28,.12); content: ''; }
      .qgqr-language { width: auto; min-width: 34px; padding: 0 7px; font-size: 11px; font-weight: 750; letter-spacing: .02em; }
      .qgqr-action[hidden] { display: none; }
      .qgqr-action:disabled { opacity: .55; cursor: wait; }
      .qgqr-is-spinning .qgqr-icon { animation: qgqr-spin .8s linear infinite; }
      .qgqr-search-area { padding: 11px 12px; border-bottom: 1px solid var(--gl-border-color-default, #e6e7eb); background: var(--gl-background-color-default, #fff); }
      .qgqr-settings { padding: 18px 16px; background: var(--gl-background-color-default, #fff); }
      .qgqr-settings[hidden] { display: none; }
      .qgqr-settings-title { display: block; margin-bottom: 5px; font-size: 13px; }
      .qgqr-settings-description { margin: 0; color: var(--gl-text-color-subtle, #626b7d); font-size: 11.5px; }
      .qgqr-disable-origin { margin-top: 15px; border: 1px solid #dc2626; border-radius: 8px; padding: 7px 11px; background: transparent; color: #b91c1c; cursor: pointer; font: inherit; font-size: 12px; font-weight: 650; }
      .qgqr-disable-origin:hover { background: #fef2f2; }
      .qgqr-update { margin-top: 18px; border-top: 1px solid var(--gl-border-color-default, #e6e7eb); padding-top: 16px; }
      .qgqr-update-title { display: block; margin-bottom: 5px; font-size: 13px; }
      .qgqr-update-status, .qgqr-update-hint { margin: 0; color: var(--gl-text-color-subtle, #626b7d); font-size: 11.5px; }
      .qgqr-update-hint { margin-top: 10px; line-height: 1.5; }
      .qgqr-update-hint[hidden] { display: none; }
      .qgqr-update-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
      .qgqr-update-action { display: inline-flex; min-height: 32px; align-items: center; justify-content: center; border: 1px solid var(--gl-border-color-default, #d8dbe2); border-radius: 8px; padding: 6px 10px; background: var(--gl-background-color-default, #fff); color: var(--gl-text-color-default, #172033); cursor: pointer; font: inherit; font-size: 12px; font-weight: 650; text-decoration: none; }
      .qgqr-update-action:hover { border-color: #7c6cf2; color: #5943b6; }
      .qgqr-update-action:disabled { opacity: .55; cursor: wait; }
      .qgqr-install-update { border-color: #6d5bd0; background: #6d5bd0; color: #fff; }
      .qgqr-install-update:hover { background: #5943b6; color: #fff; }
      .qgqr-update-action[hidden] { display: none; }
      .qgqr-setup-card { width: min(370px, calc(100vw - 24px)); border: 1px solid rgba(99,102,241,.28); border-radius: 16px; padding: 18px; background: var(--gl-background-color-default, #fff); box-shadow: 0 18px 48px rgba(24,32,51,.2); }
      .qgqr-setup-heading { display: flex; align-items: center; gap: 10px; }
      .qgqr-setup-heading .qgqr-icon { color: #6d5bd0; }
      .qgqr-setup-title { margin: 0; font-size: 15px; }
      .qgqr-setup-description { margin: 12px 0; color: var(--gl-text-color-subtle, #626b7d); font-size: 12px; }
      .qgqr-origin-label { display: block; margin-bottom: 7px; color: var(--gl-text-color-default, #172033); font-size: 12px; font-weight: 650; }
      .qgqr-origin-input { width: 100%; margin-bottom: 12px; border: 1px solid var(--gl-border-color-default, #d8dbe2); border-radius: 9px; padding: 9px 11px; background: var(--gl-background-color-subtle, #f8f9fb); color: var(--gl-text-color-default, #172033); font: 13px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; outline: none; }
      .qgqr-origin-input:focus { border-color: #7c6cf2; background: var(--gl-background-color-default, #fff); box-shadow: 0 0 0 3px rgba(124,108,242,.14); }
      .qgqr-enable-origin { width: 100%; border: 0; border-radius: 9px; padding: 9px 12px; background: #6d5bd0; color: #fff; cursor: pointer; font: inherit; font-weight: 650; }
      .qgqr-enable-origin:hover { background: #5943b6; }
      .qgqr-setup-error { display: block; margin-top: 9px; color: #b91c1c; font-size: 11.5px; }
      .qgqr-setup-error[hidden] { display: none; }
      .qgqr-search-box { display: flex; height: 38px; align-items: center; gap: 8px; border: 1px solid var(--gl-border-color-default, #d8dbe2); border-radius: 10px; padding: 0 9px 0 11px; background: var(--gl-background-color-subtle, #f8f9fb); color: var(--gl-text-color-subtle, #626b7d); transition: border-color .18s ease, background-color .18s ease, box-shadow .18s ease; }
      .qgqr-search-box:focus-within { border-color: #7c6cf2; background: var(--gl-background-color-default, #fff); box-shadow: 0 0 0 3px rgba(124,108,242,.14); }
      .qgqr-search-icon { width: 17px; height: 17px; flex: 0 0 17px; }
      .qgqr-search-input { min-width: 0; flex: 1; border: 0; outline: 0; padding: 0; background: transparent; color: var(--gl-text-color-default, #172033); font: inherit; }
      .qgqr-search-input::placeholder { color: var(--gl-text-color-subtle, #747d8f); }
      .qgqr-search-input::-webkit-search-cancel-button { display: none; }
      .qgqr-search-clear { display: grid; width: 24px; height: 24px; flex: 0 0 24px; place-items: center; border: 0; border-radius: 7px; padding: 0; background: transparent; color: inherit; cursor: pointer; }
      .qgqr-search-clear:hover { background: var(--gl-background-color-strong, #e9ebef); color: var(--gl-text-color-default, #172033); }
      .qgqr-search-clear[hidden], .qgqr-search-loader[hidden] { display: none; }
      .qgqr-search-clear .qgqr-icon { width: 15px; height: 15px; }
      .qgqr-search-loader { width: 15px; height: 15px; flex: 0 0 15px; border: 2px solid rgba(124,108,242,.22); border-top-color: #6d5bd0; border-radius: 50%; animation: qgqr-spin .7s linear infinite; }
      .qgqr-search-options { display: flex; align-items: center; justify-content: space-between; margin-top: 9px; padding: 0 2px; }
      .qgqr-owned-filter { display: inline-flex; align-items: center; gap: 7px; color: var(--gl-text-color-subtle, #626b7d); cursor: pointer; font-size: 11.5px; user-select: none; }
      .qgqr-owned-checkbox { width: 15px; height: 15px; margin: 0; accent-color: #6d5bd0; cursor: pointer; }
      .qgqr-filter-hint { color: var(--gl-text-color-subtle, #7a8292); font-size: 10.5px; }
      .qgqr-list { max-height: calc(min(78vh, 740px) - 179px); margin: 0; padding: 8px; overflow-y: auto; list-style: none; scrollbar-width: thin; }
      .qgqr-item { display: flex; gap: 10px; margin: 2px 0; border: 1px solid transparent; border-radius: 11px; padding: 10px 11px; transition: border-color .18s ease, background-color .18s ease, box-shadow .18s ease; }
      .qgqr-item:hover { border-color: var(--gl-border-color-default, #e2e4e9); background: var(--gl-background-color-subtle, #fafafe); box-shadow: 0 2px 8px rgba(24,32,51,.05); }
      .qgqr-rank { display: grid; width: 25px; height: 25px; flex: 0 0 25px; place-items: center; border-radius: 8px; background: var(--gl-background-color-subtle, #f1f2f5); color: var(--gl-text-color-subtle, #626b7d); font-size: 11px; font-weight: 700; }
      .qgqr-item-content { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 4px; }
      .qgqr-project-entry { min-width: 0; }
      .qgqr-project-row { display: flex; min-width: 0; align-items: center; gap: 4px; }
      .qgqr-project-link { display: flex; min-width: 0; flex: 1; align-items: center; gap: 8px; border-radius: 5px; color: var(--gl-text-color-link, #1f63b5); text-decoration: none; outline: none; }
      .qgqr-project-link:hover .qgqr-project-name, .qgqr-mr-link:hover { text-decoration: underline; }
      .qgqr-project-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .qgqr-more-button { display: grid; width: 27px; height: 25px; flex: 0 0 27px; place-items: center; border: 1px solid transparent; border-radius: 7px; padding: 0; background: transparent; color: var(--gl-text-color-subtle, #626b7d); cursor: pointer; transition: color .18s ease, background-color .18s ease, border-color .18s ease; }
      .qgqr-more-button:hover, .qgqr-more-button[aria-expanded="true"] { border-color: var(--gl-border-color-default, #dfe1e6); background: var(--gl-background-color-strong, #eceef2); color: #5943b6; }
      .qgqr-more-button .qgqr-icon { width: 16px; height: 16px; }
      .qgqr-project-menu { margin: 5px 0 3px; border: 1px solid var(--gl-border-color-default, #dfe1e6); border-radius: 9px; padding: 4px; background: var(--gl-background-color-default, #fff); box-shadow: 0 4px 12px rgba(24,32,51,.08); }
      .qgqr-project-menu[hidden] { display: none; }
      .qgqr-menu-action { display: flex; width: 100%; min-height: 32px; align-items: center; gap: 8px; border: 0; border-radius: 6px; padding: 6px 9px; background: transparent; color: var(--gl-text-color-default, #172033); cursor: pointer; font: inherit; font-size: 12px; font-weight: 600; text-align: left; text-decoration: none; transition: color .18s ease, background-color .18s ease; }
      .qgqr-menu-action + .qgqr-menu-action { margin-top: 2px; }
      .qgqr-menu-action:hover { background: var(--gl-background-color-subtle, #f4f2ff); color: #5943b6; }
      .qgqr-menu-action .qgqr-icon { width: 16px; height: 16px; color: #6d5bd0; }
      .qgqr-menu-action:disabled { cursor: wait; opacity: .7; }
      .qgqr-menu-action-success { color: #15803d; }
      .qgqr-menu-action-error { color: #b91c1c; }
      .qgqr-menu-action-success .qgqr-icon { color: #15803d; }
      .qgqr-menu-action-error .qgqr-icon { color: #b91c1c; }
      .qgqr-type { flex: 0 0 65px; border: 1px solid transparent; border-radius: 6px; padding: 1px 6px; font-size: 10px; font-weight: 750; letter-spacing: .025em; text-align: center; text-transform: uppercase; }
      .qgqr-type-fork { border-color: #ddd6fe; background: #f3f0ff; color: #5b46ba; }
      .qgqr-type-upstream { border-color: #bfdbfe; background: #eff6ff; color: #175fAD; }
      .qgqr-project-only { font-weight: 600; }
      .qgqr-detail, .qgqr-status { color: var(--gl-text-color-subtle, #626b7d); font-size: 11.5px; }
      .qgqr-mr-link { color: var(--gl-text-color-link, #1f75cb); text-decoration: none; }
      .qgqr-status { display: block; padding: 11px 16px; border-top: 1px solid var(--gl-border-color-default, #e6e7eb); background: var(--gl-background-color-subtle, #fafbfc); }
      .qgqr-toggle:focus-visible, .qgqr-action:focus-visible, .qgqr-project-link:focus-visible, .qgqr-mr-link:focus-visible, .qgqr-search-clear:focus-visible, .qgqr-more-button:focus-visible, .qgqr-menu-action:focus-visible, .qgqr-enable-origin:focus-visible, .qgqr-disable-origin:focus-visible, .qgqr-origin-input:focus-visible, .qgqr-update-action:focus-visible { outline: 2px solid #7c6cf2; outline-offset: 2px; }
      @keyframes qgqr-enter { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes qgqr-spin { to { transform: rotate(360deg); } }
      @media (prefers-color-scheme: dark) {
        .qgqr-count, .qgqr-header-icon { background: rgba(139,92,246,.2); color: #c4b5fd; }
        .qgqr-type-fork { border-color: rgba(167,139,250,.4); background: rgba(109,40,217,.16); color: #c4b5fd; }
        .qgqr-type-upstream { border-color: rgba(96,165,250,.38); background: rgba(37,99,235,.14); color: #93c5fd; }
      }
      @media (prefers-reduced-motion: reduce) { .qgqr-panel, .qgqr-is-spinning .qgqr-icon, .qgqr-search-loader { animation: none; } * { scroll-behavior: auto !important; transition-duration: .01ms !important; } }
      @media (max-width: 640px) { #${WIDGET_ID} { top: 62px; right: 8px; } .qgqr-toggle { padding: 7px 9px; } .qgqr-panel { width: min(480px, calc(100vw - 16px)); } }
    `;
    document.head.append(style);
  }

  function createOriginSetup() {
    addStyles();
    const widget = createElement('div');
    widget.id = WIDGET_ID;
    widget.lang = currentLanguage;
    const card = createElement('section', 'qgqr-setup-card');
    const heading = createElement('div', 'qgqr-setup-heading');
    heading.append(createIcon('settings'), createElement('h2', 'qgqr-setup-title', t('enableTitle')));
    const description = createElement('p', 'qgqr-setup-description', t('enableDescription'));
    const form = createElement('form', 'qgqr-origin-form');
    const label = createElement('label', 'qgqr-origin-label', t('originInputLabel'));
    label.htmlFor = `${WIDGET_ID}-origin`;
    const originInput = createElement('input', 'qgqr-origin-input');
    originInput.id = `${WIDGET_ID}-origin`;
    originInput.type = 'url';
    originInput.value = window.location.origin;
    originInput.placeholder = t('originInputPlaceholder');
    originInput.autocomplete = 'url';
    originInput.autocapitalize = 'none';
    originInput.spellcheck = false;
    originInput.required = true;
    const enableButton = createElement(
      'button',
      'qgqr-enable-origin',
      t('enableConfiguredOrigin'),
    );
    enableButton.type = 'submit';
    const error = createElement('span', 'qgqr-setup-error');
    error.hidden = true;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const configurationError = getOriginConfigurationError(
        originInput.value,
        window.location.origin,
      );
      if (configurationError) {
        error.textContent = t(configurationError);
        error.hidden = false;
        return;
      }
      if (!enableOrigin(window.localStorage, originInput.value, window.location.origin)) {
        error.textContent = t('originStorageFailed');
        error.hidden = false;
        return;
      }
      window.location.reload();
    });
    form.append(label, originInput, enableButton, error);
    card.append(heading, description, form);
    widget.append(card);
    document.body.append(widget);
  }

  function createWidget() {
    addStyles();
    const widget = createElement('div');
    widget.id = WIDGET_ID;
    const toggle = createElement('button', 'qgqr-toggle');
    toggle.type = 'button';
    toggle.append(
      createIcon('merge'),
      createElement('span', 'qgqr-toggle-label', t('toggleLabel')),
      createElement('span', 'qgqr-count', '0'),
    );
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-haspopup', 'dialog');
    toggle.setAttribute('aria-controls', `${WIDGET_ID}-panel`);
    const panel = createElement('section', 'qgqr-panel');
    panel.id = `${WIDGET_ID}-panel`;
    panel.setAttribute('aria-label', t('panelAriaLabel'));
    panel.hidden = true;
    const header = createElement('header', 'qgqr-header');
    const headerIcon = createElement('span', 'qgqr-header-icon');
    headerIcon.append(createIcon('merge'));
    const heading = createElement('div', 'qgqr-heading');
    heading.append(
      createElement('h2', 'qgqr-title', t('title')),
      createElement('span', 'qgqr-subtitle', t('recentSubtitle')),
    );
    header.append(headerIcon, heading);
    const languageButton = createElement(
      'button',
      'qgqr-action qgqr-language',
      currentLanguage === LANGUAGE_ZH_CN ? 'EN' : '中',
    );
    languageButton.type = 'button';
    languageButton.title = t('switchLanguage');
    languageButton.setAttribute('aria-label', t('switchLanguage'));
    const refreshButton = createElement('button', 'qgqr-action qgqr-refresh');
    refreshButton.type = 'button';
    refreshButton.title = t('refreshRecent');
    refreshButton.setAttribute('aria-label', t('refreshRecent'));
    refreshButton.append(createIcon('refresh'));
    const settingsButton = createElement('button', 'qgqr-action qgqr-settings-button');
    settingsButton.type = 'button';
    settingsButton.title = t('settings');
    settingsButton.setAttribute('aria-label', t('settings'));
    settingsButton.setAttribute('aria-expanded', 'false');
    settingsButton.append(createIcon('settings'));
    header.append(settingsButton, languageButton, refreshButton);
    const settings = createElement('section', 'qgqr-settings');
    settings.hidden = true;
    settings.append(
      createElement('strong', 'qgqr-settings-title', t('settingsTitle')),
      createElement('p', 'qgqr-settings-description', t('settingsDescription')),
    );
    const disableButton = createElement('button', 'qgqr-disable-origin', t('disableCurrentOrigin'));
    disableButton.type = 'button';
    const update = createElement('section', 'qgqr-update');
    const updateActions = createElement('div', 'qgqr-update-actions');
    const updateCheckButton = createElement(
      'button',
      'qgqr-update-action qgqr-update-check',
      t('checkForUpdates'),
    );
    updateCheckButton.type = 'button';
    const installUpdateLink = createElement(
      'a',
      'qgqr-update-action qgqr-install-update',
      t('installUpdate'),
    );
    installUpdateLink.href = PUBLISHED_SCRIPT_URL;
    installUpdateLink.target = '_blank';
    installUpdateLink.rel = 'noopener noreferrer';
    installUpdateLink.hidden = true;
    const reloadAfterUpdateButton = createElement(
      'button',
      'qgqr-update-action qgqr-reload-after-update',
      t('reloadAfterUpdate'),
    );
    reloadAfterUpdateButton.type = 'button';
    reloadAfterUpdateButton.hidden = true;
    updateActions.append(updateCheckButton, installUpdateLink, reloadAfterUpdateButton);
    const updateInstallHint = createElement('p', 'qgqr-update-hint', t('updateInstallHint'));
    updateInstallHint.hidden = true;
    update.append(
      createElement('strong', 'qgqr-update-title', t('updateTitle')),
      createElement('p', 'qgqr-update-status', updateStatusText()),
      updateActions,
      updateInstallHint,
    );
    settings.append(disableButton, update);
    const searchArea = createElement('div', 'qgqr-search-area');
    const searchBox = createElement('div', 'qgqr-search-box');
    searchBox.append(createIcon('search', 'qgqr-search-icon'));
    const searchInput = createElement('input', 'qgqr-search-input');
    searchInput.type = 'search';
    searchInput.placeholder = t('searchPlaceholder');
    searchInput.autocomplete = 'off';
    searchInput.spellcheck = false;
    searchInput.setAttribute('aria-label', t('searchAriaLabel'));
    const searchLoader = createElement('span', 'qgqr-search-loader');
    searchLoader.hidden = true;
    searchLoader.setAttribute('aria-hidden', 'true');
    const clearSearchButton = createElement('button', 'qgqr-search-clear');
    clearSearchButton.type = 'button';
    clearSearchButton.hidden = true;
    clearSearchButton.title = t('clearSearch');
    clearSearchButton.setAttribute('aria-label', t('clearSearch'));
    clearSearchButton.append(createIcon('close'));
    searchBox.append(searchInput, searchLoader, clearSearchButton);
    const searchOptions = createElement('div', 'qgqr-search-options');
    const ownedFilter = createElement('label', 'qgqr-owned-filter');
    const ownedCheckbox = createElement('input', 'qgqr-owned-checkbox');
    ownedCheckbox.type = 'checkbox';
    ownedCheckbox.checked = onlyOwnedSearch;
    ownedFilter.append(ownedCheckbox, createElement('span', 'qgqr-owned-filter-label', t('ownedFilter')));
    searchOptions.append(ownedFilter, createElement('span', 'qgqr-filter-hint', t('ownedHint')));
    searchArea.append(searchBox, searchOptions);
    panel.append(
      header,
      settings,
      searchArea,
      createElement('ol', 'qgqr-list'),
      createElement('span', 'qgqr-status', statusText(recentStatus)),
    );
    widget.append(toggle, panel);
    document.body.append(widget);

    toggle.addEventListener('click', () => {
      panel.hidden = !panel.hidden;
      toggle.setAttribute('aria-expanded', String(!panel.hidden));
      if (panel.hidden) closeProjectMenus(widget);
    });
    languageButton.addEventListener('click', switchLanguage);
    refreshButton.addEventListener('click', () => refreshData({ force: true }));
    updateCheckButton.addEventListener('click', () => checkForUserscriptUpdates({ force: true }));
    installUpdateLink.addEventListener('click', () => {
      updateInstallOpened = true;
      renderWidget();
    });
    reloadAfterUpdateButton.addEventListener('click', () => window.location.reload());
    settingsButton.addEventListener('click', () => {
      settings.hidden = !settings.hidden;
      settingsButton.setAttribute('aria-expanded', String(!settings.hidden));
      searchArea.hidden = !settings.hidden;
      widget.querySelector('.qgqr-list').hidden = !settings.hidden;
      widget.querySelector('.qgqr-status').hidden = !settings.hidden;
    });
    disableButton.addEventListener('click', () => {
      if (!window.confirm(t('disableCurrentOriginConfirm'))) return;
      if (!disableOrigin(window.localStorage)) {
        window.alert(t('originStorageFailed'));
        return;
      }
      window.location.reload();
    });
    searchInput.addEventListener('input', () => updateSearch(searchInput.value));
    ownedCheckbox.addEventListener('change', () => {
      onlyOwnedSearch = ownedCheckbox.checked;
      updateSearch(searchInput.value);
    });
    clearSearchButton.addEventListener('click', () => {
      searchInput.value = '';
      updateSearch('');
      searchInput.focus();
    });
    document.addEventListener('click', (event) => {
      if (!widget.contains(event.target)) {
        closeProjectMenus(widget);
        panel.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
      } else if (event.target instanceof Element && !event.target.closest('.qgqr-project-entry')) {
        closeProjectMenus(widget);
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeProjectMenus(widget);
        panel.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
    renderWidget();
  }

  const cache = readCache(window.localStorage, window.location.origin);
  if (cache) {
    projects = cache.projects;
    mergeRequests = cache.mergeRequests;
    recentStatus = null;
  }
  createWidget();
  refreshData();
  checkForUserscriptUpdates();
})();
