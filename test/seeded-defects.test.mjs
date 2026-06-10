// Seeded-defect harness (plan §10): a gate's value is proven by FAILING bad
// runs. Phase 0 implements the defects testable against existing components
// (extractor, audit). The check.mjs defects are wired as `todo` so Phase 1
// cannot complete without flipping them to real failing-input tests.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

import { buildFixture } from './fixtures/defs.mjs';
import { runInventory } from '../scripts/inventory-extract.mjs';
import { audit } from '../scripts/audit.mjs';

// ── extractor-level defects (active) ────────────────────────────────────────

test('defect: binary AI-surface file is skipped VISIBLY, never silently', () => {
  const repo = buildFixture('greenfield-code');
  try {
    mkdirSync(join(repo, '.claude'), { recursive: true });
    writeFileSync(join(repo, '.claude', 'notes.md'), Buffer.from([0x23, 0x20, 0x00, 0xff, 0x00]));
    spawnSync('git', ['add', '-A'], { cwd: repo });
    spawnSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'x'], { cwd: repo });
    const inv = runInventory({ root: repo, outDir: '.adoption', allowDirty: false });
    const skip = inv.skipped.find((s) => s.file === '.claude/notes.md');
    assert.ok(skip, 'binary surface file must appear in skipped[]');
    assert.match(skip.reason, /binary/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('defect: oversized sweep file is skipped VISIBLY', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aikit-big-'));
  try {
    writeFileSync(join(dir, 'huge.md'), 'claude guidance line\n'.repeat(60000)); // >1MB, has marker
    const g = (a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8' });
    g(['init', '-q']); g(['add', '-A']);
    g(['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'x']);
    const inv = runInventory({ root: dir, outDir: '.adoption', allowDirty: false });
    const skip = inv.skipped.find((s) => s.file === 'huge.md');
    assert.ok(skip, 'oversized candidate must appear in skipped[], not vanish');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── audit-level defects (active; complements audit.test.mjs) ────────────────

test('defect: dilution of the env-deny rule is caught (R-44)', () => {
  const repo = buildFixture('greenfield-code');
  try {
    mkdirSync(join(repo, '.claude'), { recursive: true });
    // a "weakened" deny list — looks similar, protects nothing
    writeFileSync(join(repo, '.claude', 'settings.json'),
      '{ "permissions": { "deny": ["Read(./.environment)"] } }\n');
    const report = audit({ root: repo });
    assert.equal(report.findings.filter((f) => f.rule === 'R-44').length, 2);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

// ── check.mjs defects (Phase 1 — MUST be implemented before Phase 1 exits) ──

test.todo('defect: manifest omits a node → check completeness exits non-zero');
test.todo('defect: split ranges leave a gap → check tiling exits non-zero');
test.todo('defect: hand-edited generated file → check reproducibility exits non-zero');
test.todo('defect: manifest references a literal file that does not exist → check fails');
test.todo('defect: ledger/commit cross-reference mismatch → check fails');
test.todo('property: extract → all-keep-file manifest → materialize is byte-identical (Phase 1 exit criterion)');

// ── verifier defects (Phase 3 — manual matrix, recorded per tool) ───────────
// Sabotage runs: seed N known defects (unjustified drops, dilution rewrites in
// literals, bogus out-of-scope rulings) and record invocation-② catch rate.
// These cannot be unit tests; the runbook owns them. Listed here so the suite
// documents the full negative-test surface in one place.

test.todo('sabotage (runbook): unjustified drop — verifier must flag');
test.todo('sabotage (runbook): dilution rewrite in a merge literal — verifier must flag');
test.todo('sabotage (runbook): bogus out-of-scope ruling on a sweep candidate — verifier must flag');
test.todo('sabotage (runbook): injection fixture — agents must disposition the steering text, not obey it');
