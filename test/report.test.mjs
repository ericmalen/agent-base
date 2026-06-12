// report.test.mjs — CLI fails gracefully on missing/corrupt .setup.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'report.mjs');

const run = (root) =>
  spawnSync(process.execPath, [SCRIPT, '--root', root], { encoding: 'utf8' });

test('report CLI: missing .setup exits 1 with message, no stack trace', () => {
  const root = mkdtempSync(join(tmpdir(), 'ab-report-'));
  try {
    const res = run(root);
    assert.equal(res.status, 1);
    assert.match(res.stderr, /^report: /);
    assert.ok(!/\n\s+at /.test(res.stderr), 'no stack trace on stderr');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('report CLI: corrupt manifest.json exits 1 with message, no stack trace', () => {
  const root = mkdtempSync(join(tmpdir(), 'ab-report-'));
  try {
    mkdirSync(join(root, '.setup'), { recursive: true });
    writeFileSync(join(root, '.setup', 'manifest.json'), '{ not json');
    writeFileSync(join(root, '.setup', 'inventory.json'), '{ "nodes": {} }');
    const res = run(root);
    assert.equal(res.status, 1);
    assert.match(res.stderr, /^report: /);
    assert.ok(!/\n\s+at /.test(res.stderr), 'no stack trace on stderr');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
