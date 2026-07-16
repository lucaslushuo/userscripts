import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertUniqueOutputs,
  replaceUserscriptVersion,
} from './build-userscripts.mjs';

test('injects exactly one package version into userscript metadata', () => {
  const sourceCode = '// @version __USERSCRIPT_VERSION__\n';
  assert.equal(
    replaceUserscriptVersion(sourceCode, '3.1.0', '@userscripts/example'),
    '// @version 3.1.0\n',
  );
});

test('rejects missing or repeated version placeholders', () => {
  assert.throws(
    () => replaceUserscriptVersion('// @version 1.0.0', '3.1.0', '@userscripts/example'),
    /exactly one/,
  );
  assert.throws(
    () => replaceUserscriptVersion(
      '__USERSCRIPT_VERSION__\n__USERSCRIPT_VERSION__',
      '3.1.0',
      '@userscripts/example',
    ),
    /exactly one/,
  );
});

test('rejects duplicate output filenames across packages', () => {
  assert.doesNotThrow(() => assertUniqueOutputs([
    { output: 'first.user.js' },
    { output: 'second.user.js' },
  ]));
  assert.throws(
    () => assertUniqueOutputs([
      { output: 'same.user.js' },
      { output: 'same.user.js' },
    ]),
    /Duplicate userscript output/,
  );
});
