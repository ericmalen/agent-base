import { test } from 'node:test';
import assert from 'node:assert/strict';

import { compareSemver, parseSemver, tagToSemver, latestCompatibleTag, npxSpecFromToolRepo } from '../scripts/lib/release.mjs';

test('parseSemver accepts plain and v-prefixed versions', () => {
  assert.deepEqual(parseSemver('1.4.0'), { major: 1, minor: 4, patch: 0, prerelease: '', build: '', raw: '1.4.0' });
  assert.equal(tagToSemver('v1.4.0')?.raw, '1.4.0');
  assert.equal(parseSemver('abc'), null);
});

test('compareSemver orders releases', () => {
  assert.equal(compareSemver('1.3.0', '1.4.0'), -1);
  assert.equal(compareSemver('2.0.0', '1.9.9'), 1);
  assert.equal(compareSemver('1.0.0', '1.0.0'), 0);
});

test('npxSpecFromToolRepo maps toolRepo URLs to npm package specs', () => {
  assert.equal(
    npxSpecFromToolRepo('https://github.com/ericmalen/agent-base', 'v1.4.0'),
    'github:ericmalen/agent-base#v1.4.0',
  );
  assert.equal(
    npxSpecFromToolRepo('https://github.com/ericmalen/agent-base.git', 'v1.4.0'),
    'github:ericmalen/agent-base#v1.4.0',
  );
  assert.equal(
    npxSpecFromToolRepo('git+https://github.com/ericmalen/agent-base', 'v1.4.0'),
    'github:ericmalen/agent-base#v1.4.0',
  );
  assert.equal(
    npxSpecFromToolRepo('https://dev.azure.com/org/proj/_git/agent-base', 'v1.4.0'),
    'git+https://dev.azure.com/org/proj/_git/agent-base#v1.4.0',
  );
  assert.equal(
    npxSpecFromToolRepo('git@github.com:ericmalen/agent-base.git', 'v1.4.0'),
    'git+ssh://git@github.com/ericmalen/agent-base.git#v1.4.0',
  );
  assert.equal(
    npxSpecFromToolRepo('https://github.com/ericmalen/agent-base/', null),
    'github:ericmalen/agent-base',
  );
});

test('latestCompatibleTag stays on same major by default', () => {
  const tags = [
    { tag: 'v2.0.0', semver: parseSemver('2.0.0') },
    { tag: 'v1.4.0', semver: parseSemver('1.4.0') },
    { tag: 'v1.3.0', semver: parseSemver('1.3.0') },
  ];
  assert.equal(latestCompatibleTag(tags, 'v1.3.0'), 'v1.4.0');
  assert.equal(latestCompatibleTag(tags, 'v1.3.0', { allowMajor: true }), 'v2.0.0');
});
