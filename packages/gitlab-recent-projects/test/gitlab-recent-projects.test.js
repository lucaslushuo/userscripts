'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildRecentMrGroups,
  buildGlobalSearchFallbackPath,
  buildMyMergeRequestsUrl,
  buildNewMergeRequestUrl,
  buildPipelinesUrl,
  buildProjectSearchPath,
  buildProjectsPath,
  buildRepositoryBranchPath,
  buildRepositoryComparePath,
  buildRepositoryBranchesPath,
  buildSearchProjectGroups,
  buildUpstreamBranchMergeRequestUrl,
  compareUserscriptVersions,
  copyTextToClipboard,
  createUncheckedBranchResults,
  disableOrigin,
  enableOrigin,
  extractPublishedUserscriptVersion,
  getCrossProjectBranchMergeStatus,
  getOriginConfigurationError,
  getUpdateActionState,
  isGitLabPage,
  isOriginEnabled,
  normalizeHttpsOrigin,
  normalizeBranch,
  normalizeMergeRequest,
  normalizeProject,
  readFavoriteProjects,
  resolvePreferredLanguage,
  saveFavoriteProjects,
  selectRecentForkProjects,
  selectRecentBranches,
  shouldPollForUserscriptUpdates,
  toggleFavoriteProject,
  translate,
} = require('../src/gitlab-recent-projects.user.js');

const ORIGIN = 'https://git.example.com';

function documentWithMetadata(metadata = {}) {
  return {
    querySelector(selector) {
      const content = metadata[selector];
      return content === undefined ? null : {
        getAttribute(attribute) {
          return attribute === 'content' ? content : null;
        },
      };
    },
  };
}

test('recognizes supported GitLab metadata without relying on a company domain', () => {
  assert.equal(isGitLabPage(documentWithMetadata({
    'meta[property="og:site_name"]': 'GitLab',
  })), true);
  assert.equal(isGitLabPage(documentWithMetadata({
    'meta[name="application-name"]': ' gitlab ',
  })), true);
});

test('does not initialize on unrelated HTTPS pages', () => {
  assert.equal(isGitLabPage(documentWithMetadata()), false);
  assert.equal(isGitLabPage(documentWithMetadata({
    'meta[name="generator"]': 'WordPress',
  })), false);
});

function memoryStorage(initialValue = null) {
  let value = initialValue;
  return {
    getItem() {
      return value;
    },
    setItem(_key, nextValue) {
      value = nextValue;
    },
    removeItem() {
      value = null;
    },
  };
}

test('requires an explicit HTTPS origin configuration', () => {
  const storage = memoryStorage();

  assert.equal(isOriginEnabled(storage, ORIGIN), false);
  assert.equal(enableOrigin(storage, ORIGIN, ORIGIN), true);
  assert.equal(isOriginEnabled(storage, ORIGIN), true);
  assert.equal(isOriginEnabled(storage, 'https://git.other.example.com'), false);
});

test('rejects unsafe origins and supports disabling the current origin', () => {
  const storage = memoryStorage(ORIGIN);

  assert.equal(normalizeHttpsOrigin('http://git.example.com'), null);
  assert.equal(normalizeHttpsOrigin('https://user:pass@git.example.com'), null);
  assert.equal(enableOrigin(storage, 'not a URL', ORIGIN), false);
  assert.equal(disableOrigin(storage), true);
  assert.equal(isOriginEnabled(storage, ORIGIN), false);
});

test('fails closed when browser storage is unavailable', () => {
  const unavailableStorage = {
    getItem() {
      throw new Error('storage unavailable');
    },
    setItem() {
      throw new Error('storage unavailable');
    },
    removeItem() {
      throw new Error('storage unavailable');
    },
  };

  assert.equal(isOriginEnabled(unavailableStorage, ORIGIN), false);
  assert.equal(enableOrigin(unavailableStorage, ORIGIN, ORIGIN), false);
  assert.equal(disableOrigin(unavailableStorage), false);
  assert.deepEqual(readFavoriteProjects(unavailableStorage, ORIGIN), []);
  assert.equal(saveFavoriteProjects(unavailableStorage, []), false);
});

test('requires the configured domain to match the current GitLab origin', () => {
  assert.equal(getOriginConfigurationError('', ORIGIN), 'invalidHttpsOrigin');
  assert.equal(
    getOriginConfigurationError('http://git.example.com', ORIGIN),
    'invalidHttpsOrigin',
  );
  assert.equal(
    getOriginConfigurationError('https://git.other.example.com', ORIGIN),
    'originMismatch',
  );
  assert.equal(getOriginConfigurationError(ORIGIN, ORIGIN), null);
});

test('compares stable and prerelease userscript versions', () => {
  assert.equal(compareUserscriptVersions('3.2.0', '3.3.0'), -1);
  assert.equal(compareUserscriptVersions('3.3.0', '3.3.0'), 0);
  assert.equal(compareUserscriptVersions('4.0.0', '3.3.0'), 1);
  assert.equal(compareUserscriptVersions('3.3.0-beta.2', '3.3.0-beta.10'), -1);
  assert.equal(compareUserscriptVersions('3.3.0-beta.1', '3.3.0'), -1);
  assert.equal(compareUserscriptVersions('invalid', '3.3.0'), null);
});

test('extracts a valid version only from userscript metadata', () => {
  assert.equal(
    extractPublishedUserscriptVersion('// ==UserScript==\n// @version      3.3.0\n// ==/UserScript=='),
    '3.3.0',
  );
  assert.equal(extractPublishedUserscriptVersion('// @version latest'), null);
  assert.equal(extractPublishedUserscriptVersion('<html>Not a userscript</html>'), null);
});

function project(id, path, upstream = null) {
  return {
    id,
    nameWithNamespace: path,
    pathWithNamespace: path,
    webUrl: `${ORIGIN}/${path}`,
    upstream,
  };
}

test('favorites persist normalized same-origin projects and reject unsafe entries', () => {
  const favorite = project(2, 'lucas/app', project(1, 'team/app'));
  const storage = memoryStorage();

  assert.equal(saveFavoriteProjects(storage, [favorite]), true);
  const storedFavorites = readFavoriteProjects(storage, ORIGIN);
  assert.equal(storedFavorites.length, 1);
  assert.equal(storedFavorites[0].id, favorite.id);
  assert.equal(storedFavorites[0].upstream.id, favorite.upstream.id);

  storage.setItem('gitlab-recent-mr-repos:favorites:v1', JSON.stringify([
    {
      id: 3,
      name_with_namespace: 'team/unsafe',
      path_with_namespace: 'team/unsafe',
      web_url: 'https://attacker.example/team/unsafe',
    },
    {
      id: 4,
      name_with_namespace: 'team/safe',
      path_with_namespace: 'team/safe',
      web_url: `${ORIGIN}/team/safe`,
    },
    {
      id: 4,
      name_with_namespace: 'team/safe duplicate',
      path_with_namespace: 'team/safe-duplicate',
      web_url: `${ORIGIN}/team/safe-duplicate`,
    },
  ]));
  const filteredFavorites = readFavoriteProjects(storage, ORIGIN);
  assert.deepEqual(filteredFavorites.map(({ id }) => id), [4]);
  assert.equal(filteredFavorites[0].webUrl, `${ORIGIN}/team/safe`);
});

test('favorite toggling adds newest projects first and removes existing projects', () => {
  const first = project(1, 'team/first');
  const second = project(2, 'team/second');

  const withSecond = toggleFavoriteProject([first], second);
  assert.deepEqual(withSecond.map(({ id }) => id), [second.id, first.id]);
  assert.deepEqual(toggleFavoriteProject(withSecond, first).map(({ id }) => id), [second.id]);
});

function mergeRequest(id, iid, sourceProjectId, targetProjectId, createdAt, targetPath = 'team/app') {
  return normalizeMergeRequest({
    id,
    iid,
    source_project_id: sourceProjectId,
    target_project_id: targetProjectId,
    created_at: createdAt,
    web_url: `${ORIGIN}/${targetPath}/-/merge_requests/${iid}`,
  }, ORIGIN);
}

test('normalizes a merge request and infers its target project', () => {
  const normalized = mergeRequest(101, 12, 2, 1, '2026-07-15T01:00:00Z');

  assert.equal(normalized.sourceProjectId, 2);
  assert.equal(normalized.targetProject.id, 1);
  assert.equal(normalized.targetProject.webUrl, `${ORIGIN}/team/app`);
});

test('rejects external merge request URLs', () => {
  const normalized = normalizeMergeRequest({
    id: 101,
    iid: 12,
    source_project_id: 2,
    target_project_id: 1,
    created_at: '2026-07-15T01:00:00Z',
    web_url: 'https://attacker.example/team/app/-/merge_requests/12',
  }, ORIGIN);

  assert.equal(normalized, null);
});

test('ranks repositories by my latest MR creation time and groups fork with upstream', () => {
  const upstream = project(1, 'team/app');
  const fork = project(2, 'lucas/app', upstream);
  const other = project(3, 'team/other');
  const mergeRequests = [
    mergeRequest(101, 12, 2, 1, '2026-07-14T01:00:00Z'),
    mergeRequest(102, 13, 2, 1, '2026-07-15T01:00:00Z'),
    mergeRequest(103, 3, 3, 3, '2026-07-13T01:00:00Z', 'team/other'),
  ];

  const groups = buildRecentMrGroups([upstream, fork, other], mergeRequests, 20);

  assert.equal(groups.length, 2);
  assert.equal(groups[0].upstream.id, upstream.id);
  assert.deepEqual(groups[0].forks.map(({ id }) => id), [fork.id]);
  assert.equal(groups[0].mergeRequestCount, 2);
  assert.equal(groups[0].latestMergeRequest.iid, 13);
});

test('uses MR URL as an upstream fallback when target project is absent from membership', () => {
  const fork = project(2, 'lucas/app');
  const mr = mergeRequest(101, 12, 2, 1, '2026-07-15T01:00:00Z');
  const [group] = buildRecentMrGroups([fork], [mr], 20);

  assert.equal(group.upstream.id, 1);
  assert.equal(group.upstream.webUrl, `${ORIGIN}/team/app`);
  assert.equal(group.forks[0].id, 2);
});

test('normalizes project fork metadata', () => {
  const normalized = normalizeProject({
    id: 2,
    name_with_namespace: 'lucas/app',
    path_with_namespace: 'lucas/app',
    web_url: `${ORIGIN}/lucas/app`,
    forked_from_project: {
      id: 1,
      name_with_namespace: 'team/app',
      path_with_namespace: 'team/app',
      web_url: `${ORIGIN}/team/app`,
    },
  }, ORIGIN);

  assert.equal(normalized.upstream.id, 1);
});

test('global search groups a matching fork with its upstream', () => {
  const upstream = project(1, 'team/app');
  const fork = project(2, 'lucas/app', upstream);
  const unrelated = project(3, 'team/another-app');

  const groups = buildSearchProjectGroups([upstream, fork, unrelated], 20);

  assert.equal(groups.length, 2);
  assert.equal(groups[0].upstream.id, upstream.id);
  assert.deepEqual(groups[0].forks.map(({ id }) => id), [fork.id]);
});

test('global search keeps API result order and applies the result limit', () => {
  const searchProjects = Array.from({ length: 25 }, (_, index) => (
    project(index + 1, `team/project-${index + 1}`)
  ));

  const groups = buildSearchProjectGroups(searchProjects, 20);

  assert.equal(groups.length, 20);
  assert.equal(groups[0].upstream.id, 1);
  assert.equal(groups[19].upstream.id, 20);
});

test('recent fork projects keep API activity order, exclude standalone projects, and deduplicate', () => {
  const upstream = project(1, 'team/app');
  const fork = project(2, 'lucas/app', upstream);
  const otherUpstream = project(3, 'team/other');
  const otherFork = project(4, 'lucas/other', otherUpstream);
  const standalone = project(5, 'team/standalone');

  const result = selectRecentForkProjects(
    [standalone, otherFork, fork, { ...otherFork, nameWithNamespace: 'duplicate' }],
    2,
  );

  assert.deepEqual(result.map(({ id }) => id), [otherFork.id, fork.id]);
  assert.equal(result[0].nameWithNamespace, otherFork.nameWithNamespace);
});

function branch(name, committedAt, commitId = `${name}-commit`) {
  return {
    name,
    webUrl: `${ORIGIN}/team/app/-/tree/${encodeURIComponent(name)}`,
    commitId,
    committedAt: Date.parse(committedAt),
  };
}

test('normalizes same-origin branches and rejects unsafe branch data', () => {
  const normalized = normalizeBranch({
    name: 'feature/branch-status',
    web_url: `${ORIGIN}/team/app/-/tree/feature%2Fbranch-status`,
    commit: {
      id: 'abc123',
      committed_date: '2026-07-20T08:00:00Z',
    },
  }, ORIGIN);

  assert.equal(normalized.name, 'feature/branch-status');
  assert.equal(normalized.commitId, 'abc123');
  assert.equal(normalizeBranch({
    name: 'feature/unsafe',
    web_url: 'https://attacker.example/team/app/-/tree/feature',
    commit: {
      id: 'abc123',
      committed_date: '2026-07-20T08:00:00Z',
    },
  }, ORIGIN), null);
});

test('recent branches exclude environment branches and keep latest commit order', () => {
  const branches = [
    branch('feature/newer', '2026-07-22T00:00:00Z'),
    branch('dev', '2026-07-21T00:00:00Z'),
    branch('feature/older', '2026-06-01T00:00:00Z'),
    branch('feature/stale', '2026-01-01T00:00:00Z'),
    branch('blue', '2026-07-20T00:00:00Z'),
  ];

  assert.deepEqual(
    selectRecentBranches(branches, 2).map(({ name }) => name),
    ['feature/newer', 'feature/older'],
  );
});

test('recent branch rows are visible before merge status checks run', () => {
  const branches = [
    branch('feature/visible-first', '2026-07-22T00:00:00Z'),
    branch('fix/also-visible', '2026-07-21T00:00:00Z'),
  ];

  assert.deepEqual(
    createUncheckedBranchResults(branches),
    branches.map((visibleBranch) => ({
      branch: visibleBranch,
      checkStatus: 'idle',
      statuses: null,
    })),
  );
});

test('branch status API paths encode project IDs and branch names', () => {
  const branchesUrl = new URL(buildRepositoryBranchesPath(42), ORIGIN);
  assert.equal(branchesUrl.pathname, '/api/v4/projects/42/repository/branches');
  assert.equal(branchesUrl.searchParams.get('per_page'), '100');

  assert.equal(
    buildRepositoryBranchPath(42, 'release/blue'),
    '/api/v4/projects/42/repository/branches/release%2Fblue',
  );

  const compareUrl = new URL(
    buildRepositoryComparePath(2, 1, 'feature/status', 'dev'),
    ORIGIN,
  );
  assert.equal(compareUrl.pathname, '/api/v4/projects/2/repository/compare');
  assert.equal(compareUrl.searchParams.get('from'), 'dev');
  assert.equal(compareUrl.searchParams.get('to'), 'feature/status');
  assert.equal(compareUrl.searchParams.get('from_project_id'), '1');
});

test('owned projects path requests recent activity order for branch status repositories', () => {
  const url = new URL(buildProjectsPath('owned'), ORIGIN);

  assert.equal(url.pathname, '/api/v4/projects');
  assert.equal(url.searchParams.get('owned'), 'true');
  assert.equal(url.searchParams.get('order_by'), 'last_activity_at');
  assert.equal(url.searchParams.get('sort'), 'desc');
  assert.equal(url.searchParams.get('archived'), 'false');
  assert.equal(url.searchParams.get('per_page'), '100');
});

test('branch merge status distinguishes merged, unmerged, and missing targets', () => {
  const source = branch('feature/app', '2026-07-22T00:00:00Z', 'source-sha');
  const target = branch('dev', '2026-07-21T00:00:00Z', 'target-sha');

  assert.equal(getCrossProjectBranchMergeStatus(source, null, []), 'missing');
  assert.equal(getCrossProjectBranchMergeStatus(source, target, []), 'merged');
  assert.equal(getCrossProjectBranchMergeStatus(source, target, [{ id: 'source-sha' }]), 'unmerged');
  assert.equal(
    getCrossProjectBranchMergeStatus(
      source,
      { ...target, commitId: 'source-sha' },
      [{ id: 'source-sha' }],
    ),
    'merged',
  );
});

test('owned-only search uses lightweight parameters without changing the query', () => {
  const path = buildProjectSearchPath('mobile sdk', true);
  const url = new URL(path, ORIGIN);

  assert.equal(url.pathname, '/api/v4/projects');
  assert.equal(url.searchParams.get('search'), 'mobile sdk');
  assert.equal(url.searchParams.get('owned'), 'true');
  assert.equal(url.searchParams.get('per_page'), '20');
  assert.equal(url.searchParams.has('search_namespaces'), false);
  assert.equal(url.searchParams.has('order_by'), false);
  assert.equal(url.searchParams.has('sort'), false);
});

test('global search does not accidentally apply the owned filter', () => {
  const path = buildProjectSearchPath('mobile', false);
  const url = new URL(path, ORIGIN);

  assert.equal(url.searchParams.has('owned'), false);
});

test('global fallback uses the dedicated GitLab projects search API', () => {
  const path = buildGlobalSearchFallbackPath('mobile sdk');
  const url = new URL(path, ORIGIN);

  assert.equal(url.pathname, '/api/v4/search');
  assert.equal(url.searchParams.get('scope'), 'projects');
  assert.equal(url.searchParams.get('search'), 'mobile sdk');
  assert.equal(url.searchParams.get('per_page'), '20');
});

test('new merge request URL stays within the selected repository', () => {
  const fork = project(2, 'lucas/app');
  const upstream = project(1, 'team/app');

  assert.equal(
    buildNewMergeRequestUrl(fork),
    `${ORIGIN}/lucas/app/-/merge_requests/new?change_branches=true`,
  );
  assert.equal(
    buildNewMergeRequestUrl(upstream),
    `${ORIGIN}/team/app/-/merge_requests/new?change_branches=true`,
  );
});

test('branch merge request URL prefills the fork source and upstream master target', () => {
  const upstream = project(1, 'team/app');
  const fork = project(2, 'lucas/app', upstream);
  const url = new URL(buildUpstreamBranchMergeRequestUrl(fork, 'feature/login state'));

  assert.equal(url.pathname, '/team/app/-/merge_requests/new');
  assert.equal(url.searchParams.get('merge_request[source_project_id]'), '2');
  assert.equal(url.searchParams.get('merge_request[source_branch]'), 'feature/login state');
  assert.equal(url.searchParams.get('merge_request[target_project_id]'), '1');
  assert.equal(url.searchParams.get('merge_request[target_branch]'), 'master');
  assert.equal(buildUpstreamBranchMergeRequestUrl(upstream, 'feature/login'), null);
});

test('my merge requests URL filters the selected repository by the current user', () => {
  const fork = project(2, 'lucas/app');
  const upstream = project(1, 'team/app');

  assert.equal(
    buildMyMergeRequestsUrl(fork),
    `${ORIGIN}/lucas/app/-/merge_requests?scope=created_by_me`,
  );
  assert.equal(
    buildMyMergeRequestsUrl(upstream),
    `${ORIGIN}/team/app/-/merge_requests?scope=created_by_me`,
  );
});

test('pipelines URL stays within the selected repository', () => {
  const fork = project(2, 'lucas/app');
  const upstream = project(1, 'team/app');

  assert.equal(buildPipelinesUrl(fork), `${ORIGIN}/lucas/app/-/pipelines`);
  assert.equal(buildPipelinesUrl(upstream), `${ORIGIN}/team/app/-/pipelines`);
});

test('copies the selected repository URL and reports clipboard failures', async () => {
  let copiedText = null;
  const clipboard = {
    async writeText(text) {
      copiedText = text;
    },
  };

  assert.equal(await copyTextToClipboard(`${ORIGIN}/lucas/app`, clipboard), true);
  assert.equal(copiedText, `${ORIGIN}/lucas/app`);
  assert.equal(await copyTextToClipboard(`${ORIGIN}/lucas/app`, {
    async writeText() {
      throw new Error('permission denied');
    },
  }), false);
  assert.equal(await copyTextToClipboard(`${ORIGIN}/lucas/app`, null), false);
});

test('saved language overrides the browser language', () => {
  assert.equal(resolvePreferredLanguage('en', ['zh-CN']), 'en');
  assert.equal(resolvePreferredLanguage('zh-CN', ['en-US']), 'zh-CN');
});

test('browser primary language selects Chinese or English by default', () => {
  assert.equal(resolvePreferredLanguage(null, ['zh-HK', 'en-US']), 'zh-CN');
  assert.equal(resolvePreferredLanguage(null, ['en-US', 'zh-CN']), 'en');
  assert.equal(resolvePreferredLanguage('unsupported', []), 'en');
});

test('translations interpolate dynamic status values in both languages', () => {
  assert.equal(translate('zh-CN', 'minSearchCharacters', { count: 2 }), '请至少输入 2 个字符');
  assert.equal(translate('en', 'apiRequestFailed', { status: 401 }), 'GitLab API request failed (HTTP 401)');
  assert.equal(translate('zh-CN', 'repositoryUrlCopied'), '已复制仓库地址');
  assert.equal(translate('en', 'copyRepositoryUrl'), 'Copy repository URL');
  assert.equal(translate('zh-CN', 'updateTag'), '有新版本');
  assert.equal(translate('en', 'updateTag'), 'UPDATE AVAILABLE');
  assert.equal(
    translate('zh-CN', 'updateInstalled', { version: '3.14.0' }),
    'v3.14.0 已更新，重新加载后生效。',
  );
  assert.equal(translate('zh-CN', 'appTitle'), 'gitcube');
  assert.equal(translate('en', 'appTitle'), 'gitcube');
  assert.equal(translate('zh-CN', 'branchLegendMerged'), '已合入');
  assert.equal(translate('en', 'branchLegendUnavailable'), 'Unknown or missing');
  assert.equal(
    translate('en', 'addFavorite', { project: 'team/app' }),
    'Add team/app to favorites',
  );
  assert.equal(
    translate('zh-CN', 'branchMerged', { target: 'dev' }),
    'dev 已合入',
  );
});

test('update flow exposes only the next relevant action', () => {
  assert.deepEqual(getUpdateActionState('available', false), {
    showCheck: true,
    showInstall: true,
    showReload: false,
  });
  assert.deepEqual(getUpdateActionState('available', true), {
    showCheck: false,
    showInstall: false,
    showReload: true,
  });
  assert.deepEqual(getUpdateActionState('current', false), {
    showCheck: true,
    showInstall: false,
    showReload: false,
  });
});

test('update polling runs only for visible pages without a pending update', () => {
  assert.equal(shouldPollForUserscriptUpdates('visible', 'current', false), true);
  assert.equal(shouldPollForUserscriptUpdates('visible', 'error', false), true);
  assert.equal(shouldPollForUserscriptUpdates('hidden', 'current', false), false);
  assert.equal(shouldPollForUserscriptUpdates('visible', 'available', false), false);
  assert.equal(shouldPollForUserscriptUpdates('visible', 'current', true), false);
});
