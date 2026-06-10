import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

import { audit } from '../scripts/audit.mjs';

function makeRepo(files, { git = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'aikit-audit-'));
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(dir, rel);
    mkdirSync(join(abs, '..'), { recursive: true });
    writeFileSync(abs, content);
  }
  if (git) {
    const r = spawnSync('git', ['init', '-q'], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0);
  }
  return dir;
}

const rules = (report) => [...new Set(report.findings.map((f) => f.rule))].sort();
const of = (report, rule) => report.findings.filter((f) => f.rule === rule);

// ── The canonical conformant repo: zero findings ────────────────────────────

const CONFORMANT = {
  'AGENTS.md': `# Demo Project

## Overview

A demo.

## Conventions

Use strict mode everywhere.

## Do Not

- No secrets in code.
`,
  'CLAUDE.md': '@AGENTS.md\n',
  '.gitignore': '.claude/settings.local.json\n',
  '.claude/ai-kit.json': '{ "kit": "2.0.0", "adoptedAt": "2026-06-10", "githubCodeReview": false }\n',
  '.claude/settings.json': `{
  "permissions": {
    "deny": ["Read(./.env)", "Read(./.env.*)"]
  }
}
`,
  '.claude/skills/README.md': '# Skills\nConventions for this folder.\n',
  '.claude/skills/ai-kit-check/SKILL.md': `---
name: ai-kit-check
description: Audits this repo's AI setup against ai-kit conventions. Use when checking for drift or when asked to fix AI-config findings.
---

# ai-kit-check

Run the bundled audit and fix findings by rule ID.
`,
  '.vscode/settings.json': `{
  "chat.useAgentsMdFile": true,
  "chat.useClaudeMdFile": false,
  "chat.useCustomizationsInParentRepositories": true,
  "chat.useAgentSkills": true,
  "chat.useCustomAgentHooks": true,
  "chat.subagents.allowInvocationsFromSubagents": true,
  "chat.tools.terminal.enableAutoApprove": false,
  "explorer.fileNesting.enabled": true,
  "explorer.fileNesting.patterns": { "AGENTS.md": "CLAUDE.md" }
}
`,
};

test('conformant repo produces zero findings', () => {
  const repo = makeRepo(CONFORMANT);
  try {
    const report = audit({ root: repo });
    assert.deepEqual(report.findings, [], JSON.stringify(report.findings, null, 2));
    assert.deepEqual(report.summary, { error: 0, warning: 0, info: 0 });
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

// ── Kitchen-sink violations repo: every expected rule fires ─────────────────

test('violations repo: expected rules fire', () => {
  const longDesc = 'x'.repeat(1100);
  const nested60 = '---\nscope: api\n---\n' + Array.from({ length: 60 }, (_, i) => `rule line ${i}`).join('\n') + '\n';
  const repo = makeRepo({
    // no AGENTS.md → R-01
    'CLAUDE.md': 'hello world\n@AGENTS.md\n', // wrong first line → R-11
    'src/api/AGENTS.md': nested60, // R-13 (60 lines), R-14 (frontmatter), R-15 (no sibling)
    '.claude/rules/style.md': '# Style\nNo paths frontmatter here.\n', // R-52 (+R-53 with nested present)
    '.claude/skills/Bad_Skill/SKILL.md': `---\nname: other-name\ndescription: ${longDesc}\nbogus-key: 1\n---\nSee [missing](references/gone.md).\n`,
    '.claude/skills/cat/sub/SKILL.md': '---\nname: sub\ndescription: nested too deep, used when testing\n---\nbody\n', // R-26
    '.claude/agents/MyAgent.md': `---\nmodel: claude-sonnet-4-0\n---\nDoes things.\n\n## Documents\n\n[link](AGENTS.md)\n`,
    '.github/chatmodes/dev.chatmode.md': 'old chatmode\n', // R-42
    '.github/prompts/go.prompt.md': '---\ndescription: x\n---\nbody\n', // R-54
    '.github/skills/x/SKILL.md': 'misplaced\n', // R-49
    '.claude/settings.json': '{ "permissions": { "deny": [] } }\n', // R-44 ×2
    '.gitignore': 'node_modules/\n', // R-47
    // no .vscode/settings.json → R-45; no marker → R-50
  });
  try {
    const report = audit({ root: repo });
    const fired = rules(report);
    for (const expected of [
      'R-01', 'R-11', 'R-13', 'R-14', 'R-15', 'R-17', 'R-18', 'R-19', 'R-25', 'R-26',
      'R-27', 'R-28', 'R-30', 'R-31', 'R-32', 'R-34', 'R-35', 'R-42', 'R-44', 'R-45',
      'R-47', 'R-48', 'R-49', 'R-50', 'R-52', 'R-53', 'R-54', 'R-07',
    ]) {
      assert.ok(fired.includes(expected), `expected ${expected} to fire; fired: ${fired.join(', ')}`);
    }
    // severities spot-checks
    assert.equal(of(report, 'R-01')[0].severity, 'error');
    assert.equal(of(report, 'R-17')[0].severity, 'error');
    assert.equal(of(report, 'R-19')[0].severity, 'error');
    assert.equal(of(report, 'R-26')[0].severity, 'error');
    assert.equal(of(report, 'R-44').length, 2);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

// ── R-09 conditional branches ───────────────────────────────────────────────

test('R-09: codeReview=true requires copilot-instructions.md (short, pointing at AGENTS.md)', () => {
  const repo = makeRepo({
    ...CONFORMANT,
    '.claude/ai-kit.json': '{ "kit": "2.0.0", "githubCodeReview": true }\n',
  });
  try {
    let report = audit({ root: repo });
    assert.equal(of(report, 'R-09').length, 1); // missing file

    writeFileSync(join(repo, '.github', 'copilot-instructions.md'), 'See AGENTS.md.\n', { flag: 'w' });
  } catch (e) {
    // .github does not exist yet
    mkdirSync(join(repo, '.github'), { recursive: true });
    writeFileSync(join(repo, '.github', 'copilot-instructions.md'), 'See AGENTS.md.\n');
  }
  try {
    const report = audit({ root: repo });
    assert.equal(of(report, 'R-09').length, 0);

    // oversized file fires
    writeFileSync(join(repo, '.github', 'copilot-instructions.md'), 'See AGENTS.md.\n' + 'y'.repeat(4100));
    const report2 = audit({ root: repo });
    assert.equal(of(report2, 'R-09').length, 1);
    assert.match(of(report2, 'R-09')[0].message, /4,000/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('R-09: codeReview=false flags a lingering copilot-instructions.md', () => {
  const repo = makeRepo({
    ...CONFORMANT,
    '.github/copilot-instructions.md': 'leftover\n',
  });
  try {
    const report = audit({ root: repo });
    assert.equal(of(report, 'R-09').length, 1);
    assert.match(of(report, 'R-09')[0].message, /folded/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('R-09: no recorded stance → info', () => {
  const { ['.claude/ai-kit.json']: _omit, ...rest } = CONFORMANT;
  const repo = makeRepo({ ...rest, '.github/copilot-instructions.md': 'stuff\n' });
  try {
    const report = audit({ root: repo });
    const r09 = of(report, 'R-09');
    assert.equal(r09.length, 1);
    assert.equal(r09[0].severity, 'info');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

// ── compat mode: nested AGENTS.md requires the nested VS Code key ───────────

test('compat mode requires chat.useNestedAgentsMdFiles', () => {
  const repo = makeRepo({
    ...CONFORMANT,
    'src/AGENTS.md': '# API scope\nShort and focused.\n',
    'src/CLAUDE.md': '@AGENTS.md\n',
  });
  try {
    const report = audit({ root: repo });
    const r45 = of(report, 'R-45');
    assert.equal(r45.length, 1);
    assert.match(r45[0].message, /useNestedAgentsMdFiles/);
    // no R-53: only one mechanism in use (no rules files beyond README)
    assert.equal(of(report, 'R-53').length, 0);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

// ── strict escalation + CLI exit codes ──────────────────────────────────────

test('strict escalates per spec (R-04 info → warning)', () => {
  const repo = makeRepo({
    ...CONFORMANT,
    'AGENTS.md': CONFORMANT['AGENTS.md'] + '\n<!-- TODO: fill this in -->\n',
  });
  try {
    assert.equal(of(audit({ root: repo }), 'R-04')[0].severity, 'info');
    assert.equal(of(audit({ root: repo, strict: true }), 'R-04')[0].severity, 'warning');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('CLI: exit 0 on clean, exit 1 with --strict on any finding', () => {
  const cleanRepo = makeRepo(CONFORMANT);
  const todoRepo = makeRepo({
    ...CONFORMANT,
    'AGENTS.md': CONFORMANT['AGENTS.md'] + '\n<!-- TODO -->\n',
  });
  const cli = join(process.cwd(), 'scripts', 'audit.mjs');
  try {
    assert.equal(spawnSync(process.execPath, [cli, '--root', cleanRepo], { encoding: 'utf8' }).status, 0);
    // info-only findings: non-strict passes, strict fails
    assert.equal(spawnSync(process.execPath, [cli, '--root', todoRepo], { encoding: 'utf8' }).status, 0);
    assert.equal(spawnSync(process.execPath, [cli, '--root', todoRepo, '--strict'], { encoding: 'utf8' }).status, 1);
    // --json emits parseable report
    const r = spawnSync(process.execPath, [cli, '--root', cleanRepo, '--json'], { encoding: 'utf8' });
    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.summary.error, 0);
  } finally {
    rmSync(cleanRepo, { recursive: true, force: true });
    rmSync(todoRepo, { recursive: true, force: true });
  }
});

// ── R-07 reference resolution ───────────────────────────────────────────────

test('R-07: broken and valid references across surfaces', () => {
  const repo = makeRepo({
    ...CONFORMANT,
    'AGENTS.md': CONFORMANT['AGENTS.md'] + '\nSee [docs](docs/missing.md) and [spec](docs/real.md).\n',
    'docs/real.md': 'exists\n',
    '.claude/agents/README.md': '# Agents\n',
    '.claude/agents/reviewer.md': `---
name: reviewer
description: Reviews PRs. Use when a PR needs review.
tools: Read, Grep, Glob
---

Reviews pull requests; never edits files.

## Procedures

1. Read the diff.

## Never

- Never edit files.

## Documents

AGENTS.md
docs/nonexistent-thing.md
`,
  });
  try {
    const report = audit({ root: repo });
    const r07 = of(report, 'R-07');
    const targets = r07.map((f) => f.message);
    assert.equal(r07.length, 2, JSON.stringify(r07));
    assert.ok(targets.some((m) => m.includes('docs/missing.md')));
    assert.ok(targets.some((m) => m.includes('docs/nonexistent-thing.md')));
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
