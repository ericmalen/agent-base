import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
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

test('cli: setup --no-launch drops the launcher skill and prints the prompt', () => {
  const target = mkdtempSync(join(tmpdir(), 'ab-cli-target-'));
  const r = run(['setup', target, '--no-launch']);
  assert.equal(r.status, 0);
  // repo has .git → dev mode, no staging into the real home
  assert.match(r.stdout, /running from clone/);
  assert.match(r.stdout, /\/agent-base-bootstrap/);
  assert.match(r.stdout, /base-setup\/SKILL\.md/);
  assert.ok(existsSync(join(target, '.claude', 'skills', 'agent-base-bootstrap', 'SKILL.md')));
});

test('cli: setup --print touches nothing and prints the prompt only', () => {
  const target = mkdtempSync(join(tmpdir(), 'ab-cli-target-'));
  const r = run(['setup', target, '--print']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Paste this prompt/);
  assert.ok(!existsSync(join(target, '.claude')));
});

test('cli: bootstrap command rejects unknown flags', () => {
  const r = run(['setup', '--frobnicate']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /unknown flag --frobnicate/);
});

test('cli: bootstrap command rejects a nonexistent target path', () => {
  const r = run(['setup', join(tmpdir(), 'ab-cli-no-such-dir-7f3a'), '--print']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /target is not an existing directory/);
});

test('cli: bootstrap command rejects a file as target', () => {
  const target = mkdtempSync(join(tmpdir(), 'ab-cli-target-'));
  const file = join(target, 'somefile');
  writeFileSync(file, 'x\n');
  const r = run(['setup', file, '--print']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /target is not an existing directory/);
});

test('cli: bootstrap command rejects extra positional args', () => {
  const target = mkdtempSync(join(tmpdir(), 'ab-cli-target-'));
  const r = run(['setup', target, target]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /expected at most one path/);
});

test('cli: packaging guard — zero deps and staging-critical paths in the files whitelist', () => {
  const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8'));
  // staging copies only the package dir; runtime deps would land in a sibling
  // node_modules and silently break every staged release
  assert.equal(pkg.dependencies, undefined);
  for (const p of ['bin', 'scripts', 'templates', '.claude', 'spec']) {
    assert.ok(pkg.files.includes(p), `files whitelist ships ${p}`);
  }
  for (const p of ['test', 'notes']) {
    assert.ok(!pkg.files.includes(p), `files whitelist excludes ${p}`);
  }
});

test('cli: cache prune rejects bad --keep', () => {
  const r = run(['cache', 'prune', '--keep', 'lots']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--keep must be a non-negative integer/);
});
