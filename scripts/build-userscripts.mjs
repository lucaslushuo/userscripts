import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIRECTORY = path.resolve(SCRIPT_DIRECTORY, '..');
const PACKAGES_DIRECTORY = path.join(ROOT_DIRECTORY, 'packages');
const OUTPUT_DIRECTORY = path.join(ROOT_DIRECTORY, 'dist');
const VERSION_PLACEHOLDER = '__USERSCRIPT_VERSION__';
const USER_SCRIPT_OUTPUT_PATTERN = /^[a-z0-9][a-z0-9.-]*\.user\.js$/;
const USER_SCRIPT_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function assertString(value, field, packageName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${packageName}: ${field} must be a non-empty string`);
  }
  return value;
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function readUserscriptPackage(directoryEntry) {
  const packageDirectory = path.join(PACKAGES_DIRECTORY, directoryEntry.name);
  const packageJsonPath = path.join(packageDirectory, 'package.json');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  const packageName = assertString(packageJson.name, 'name', directoryEntry.name);
  const version = assertString(packageJson.version, 'version', packageName);
  if (!USER_SCRIPT_VERSION_PATTERN.test(version)) {
    throw new Error(`${packageName}: version must use semantic versioning`);
  }
  const userscript = packageJson.userscript;

  if (!userscript || typeof userscript !== 'object' || Array.isArray(userscript)) {
    throw new Error(`${packageName}: userscript configuration is required`);
  }

  const source = assertString(userscript.source, 'userscript.source', packageName);
  const output = assertString(userscript.output, 'userscript.output', packageName);
  const title = assertString(userscript.title, 'userscript.title', packageName);
  if (!USER_SCRIPT_OUTPUT_PATTERN.test(output)) {
    throw new Error(`${packageName}: userscript.output must be a safe *.user.js filename`);
  }

  const sourcePath = path.resolve(packageDirectory, source);
  const packagePrefix = `${packageDirectory}${path.sep}`;
  if (!sourcePath.startsWith(packagePrefix)) {
    throw new Error(`${packageName}: userscript.source must stay inside its package`);
  }

  const sourceCode = await readFile(sourcePath, 'utf8');
  const builtSourceCode = replaceUserscriptVersion(sourceCode, version, packageName);

  return {
    description: typeof packageJson.description === 'string' ? packageJson.description : '',
    output,
    sourceCode: builtSourceCode,
    title,
    version,
  };
}

export function replaceUserscriptVersion(sourceCode, version, packageName) {
  const placeholderCount = sourceCode.split(VERSION_PLACEHOLDER).length - 1;
  if (placeholderCount !== 1) {
    throw new Error(`${packageName}: source must contain exactly one ${VERSION_PLACEHOLDER}`);
  }
  return sourceCode.replace(VERSION_PLACEHOLDER, version);
}

export function assertUniqueOutputs(userscripts) {
  const seenOutputs = new Set();
  for (const { output } of userscripts) {
    if (seenOutputs.has(output)) {
      throw new Error(`Duplicate userscript output: ${output}`);
    }
    seenOutputs.add(output);
  }
}

function renderIndex(userscripts) {
  const cards = userscripts.map(({ description, output, title, version }) => `
      <article class="card">
        <div>
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(description)}</p>
        </div>
        <footer>
          <span>v${escapeHtml(version)}</span>
          <a href="./${encodeURIComponent(output)}">安装脚本</a>
        </footer>
      </article>`).join('');

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Userscripts</title>
  <style>
    :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    body { margin: 0; background: #f5f7fb; color: #172033; }
    main { width: min(920px, calc(100% - 32px)); margin: 64px auto; }
    h1 { margin-bottom: 8px; font-size: clamp(32px, 6vw, 52px); }
    .intro { margin: 0 0 32px; color: #657087; }
    .grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
    .card { display: flex; min-height: 180px; flex-direction: column; justify-content: space-between; padding: 24px; border: 1px solid #dce2ec; border-radius: 18px; background: #fff; box-shadow: 0 12px 32px rgb(23 32 51 / 7%); }
    .card h2 { margin: 0 0 10px; font-size: 20px; }
    .card p { margin: 0; color: #657087; line-height: 1.6; }
    footer { display: flex; align-items: center; justify-content: space-between; margin-top: 28px; }
    footer span { color: #7a8498; font-size: 13px; }
    a { padding: 9px 14px; border-radius: 10px; background: #5b5bd6; color: #fff; font-weight: 650; text-decoration: none; }
    a:hover { background: #4747c2; }
    @media (prefers-color-scheme: dark) {
      body { background: #111522; color: #f0f2f8; }
      .intro, .card p, footer span { color: #aeb6c8; }
      .card { border-color: #30384a; background: #1a2030; box-shadow: none; }
    }
  </style>
</head>
<body>
  <main>
    <h1>Userscripts</h1>
    <p class="intro">浏览器增强脚本。点击安装后由 Tampermonkey 自动检查更新。</p>
    <section class="grid" aria-label="可安装脚本">${cards}
    </section>
  </main>
</body>
</html>
`;
}

async function buildUserscripts() {
  const directoryEntries = (await readdir(PACKAGES_DIRECTORY, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name));
  const userscripts = await Promise.all(directoryEntries.map(readUserscriptPackage));

  if (userscripts.length === 0) {
    throw new Error('No userscript packages were found');
  }
  assertUniqueOutputs(userscripts);

  await rm(OUTPUT_DIRECTORY, { force: true, recursive: true });
  await mkdir(OUTPUT_DIRECTORY, { recursive: true });
  await Promise.all(userscripts.map(({ output, sourceCode }) => (
    writeFile(path.join(OUTPUT_DIRECTORY, output), sourceCode, 'utf8')
  )));
  await writeFile(path.join(OUTPUT_DIRECTORY, 'index.html'), renderIndex(userscripts), 'utf8');

  console.log(`Built ${userscripts.length} userscript package(s) in ${OUTPUT_DIRECTORY}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildUserscripts();
}
