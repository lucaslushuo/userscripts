'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
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
  isGitLabPage,
  isOriginEnabled,
  normalizeHttpsOrigin,
  normalizeMergeRequest,
  normalizeProject,
  resolvePreferredLanguage,
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
});
