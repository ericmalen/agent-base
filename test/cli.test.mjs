import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const BIN = join(import.meta.dirname, '..', 'bin', 'agent-base.mjs');
const FIXTURES = join(import.meta.dirname, 'fixtures', 'orchestration');

const run = (args, opts = {}) =>
  spawnSync(process.execPath, [BIN, ...args], { encoding: 'utf8', ...opts });

test('cli: --help prints command surface, exit 0', () => {
  const r = run(['--help']);
  assert.equal(r.status, 0);
  for (const cmd of ['setup', 'orchestrate', 'refresh', 'install', 'audit', 'sync', 'tracker-sync', 'starter', 'headless-guard', 'cache']) {
    assert.match(r.stdout, new RegExp(`\\b${cmd}\\b`), `help mentions ${cmd}`);
  }
});

test('cli: no command prints help, exit 2', () => {
  const r = run([]);
  assert.equal(r.status, 2);
  assert.match(r.stdout, /Usage: agent-base/);
});

test('cli: --version matches package.json', () => {
  const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8'));
  const r = run(['--version']);
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), pkg.version);
});

test('cli: unknown command exits 2', () => {
  const r = run(['frobnicate']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /unknown command frobnicate/);
});

test('cli: delegated command propagates underlying exit code (audit usage error → 2)', () => {
  const r = run(['audit', '--bogus-flag']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /unknown flag --bogus-flag/);
});

test('cli: headless-guard delegation produces guard output lines', () => {
  const root = mkdtempSync(join(tmpdir(), 'ab-cli-'));
  cpSync(join(FIXTURES, 'tasks-canonical.md'), join(root, 'tasks.md'));
  const r = run(['headless-guard', '--root', root]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /^run=true$/m);
  assert.match(r.stdout, /^reason=eligible-task$/m);
  assert.match(r.stdout, /^task=T-001$/m);
});

test('cli: cache prune rejects bad --keep', () => {
  const r = run(['cache', 'prune', '--keep', 'lots']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--keep must be a non-negative integer/);
});
