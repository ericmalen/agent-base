import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { audit } from '../scripts/audit.mjs';

const BUILD = join(import.meta.dirname, '..', 'scripts', 'build-starter.mjs');
const BASE_VERSION = JSON.parse(
  readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8'),
).version;

const run = (args, opts = {}) =>
  spawnSync(process.execPath, [BUILD, ...args], { encoding: 'utf8', ...opts });

test('starter build: empty dir → exit 0, files written, version printed', () => {
  const target = mkdtempSync(join(tmpdir(), 'ab-starter-'));
  try {
    const r = run([target]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, new RegExp(`starter → .+ \\(v${BASE_VERSION.replaceAll('.', '\\.')}\\)`));
    for (const rel of [
      'AGENTS.md', 'CLAUDE.md', '.gitignore', 'README.md',
      '.claude/settings.json', '.vscode/settings.json',
      '.claude/skills/README.md', '.claude/skills/base-check/SKILL.md',
      '.claude/agent-base.json',
    ]) {
      assert.ok(existsSync(join(target, rel)), `starter ships ${rel}`);
    }
    const marker = JSON.parse(readFileSync(join(target, '.claude/agent-base.json'), 'utf8'));
    assert.equal(marker.standard, BASE_VERSION);
    assert.equal(marker.githubCodeReview, false);
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
});

test('starter build: non-empty dir → exit 1, refusing message, untouched', () => {
  const target = mkdtempSync(join(tmpdir(), 'ab-starter-'));
  try {
    writeFileSync(join(target, 'precious.txt'), 'keep me\n');
    const r = run([target]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /refusing/);
    assert.ok(!existsSync(join(target, 'AGENTS.md')), 'nothing written');
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
});

test('starter build: no dir argument → exit 1, usage', () => {
  const r = run([]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /usage:/);
});

test('starter build: output is audit-clean', () => {
  const target = mkdtempSync(join(tmpdir(), 'ab-starter-'));
  try {
    const r = run([target]);
    assert.equal(r.status, 0, r.stderr);
    const report = audit({ root: target, strict: true });
    assert.deepEqual(report.findings, [], JSON.stringify(report.findings, null, 2));
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
});

test('starter build: --git → repo on main, one commit, clean tree', () => {
  const target = mkdtempSync(join(tmpdir(), 'ab-starter-'));
  try {
    const r = run([target, '--git']);
    assert.equal(r.status, 0, r.stderr);
    const git = (args) => spawnSync('git', ['-C', target, ...args], { encoding: 'utf8' });
    assert.equal(git(['branch', '--show-current']).stdout.trim(), 'main');
    assert.equal(git(['rev-list', '--count', 'HEAD']).stdout.trim(), '1');
    assert.equal(git(['status', '--porcelain']).stdout.trim(), '', 'working tree clean');
    assert.match(git(['log', '-1', '--format=%s']).stdout, /agent-base starter/);
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
});
