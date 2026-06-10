import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { audit } from '../lib/audit.mjs';

function tmp() {
  return mkdtempSync(join(tmpdir(), 'ai-kit-audit-test-'));
}

function writeManifest(dir, extra = {}) {
  mkdirSync(join(dir, '.claude'), { recursive: true });
  writeFileSync(join(dir, '.claude', 'ai-kit.json'), JSON.stringify({
    schemaVersion: 1,
    source: { repo: 'test', commit: 'abc1234', commitShort: 'abc1234', installedAt: '', updatedAt: '' },
    mode: 'full',
    installed: { baseSkills: [], baseAgents: [], skills: [], agents: [] },
    files: {},
    pendingIntegration: [],
    preexistingUnmanaged: [],
    ...extra,
  }));
}

test('audit — no manifest returns empty report', async () => {
  const dir = tmp();
  const report = await audit({ _consumerRoot: dir });
  assert.equal(report.findings.length, 0);
  assert.equal(report.summary.filesScanned, 0);
});

test('audit — clean repo returns no findings', async () => {
  const dir = tmp();
  writeManifest(dir);
  writeFileSync(join(dir, 'AGENTS.md'), '# Project\n\n## Overview\nShort.\n\n## Do Not\n- No secrets.\n');
  const report = await audit({ _consumerRoot: dir });
  assert.equal(report.summary.error, 0);
  assert.equal(report.summary.warning, 0);
});

test('audit — agents-md-over-two-pages triggered', async () => {
  const dir = tmp();
  writeManifest(dir);
  const longContent = '# Project\n\n## Do Not\n- No secrets.\n\n' +
    Array.from({ length: 130 }, (_, i) => `Rule ${i + 1}: do something specific.`).join('\n');
  writeFileSync(join(dir, 'AGENTS.md'), longContent);
  const report = await audit({ _consumerRoot: dir });
  const ids = report.findings.map(f => f.id);
  assert.ok(ids.includes('agents-md-over-two-pages'), `Expected agents-md-over-two-pages, got: ${ids}`);
});

test('audit — agents-md-missing-do-not-section triggered', async () => {
  const dir = tmp();
  writeManifest(dir);
  writeFileSync(join(dir, 'AGENTS.md'), '# Project\n\n## Overview\nShort content here.\n');
  const report = await audit({ _consumerRoot: dir });
  const ids = report.findings.map(f => f.id);
  assert.ok(ids.includes('agents-md-missing-do-not-section'), `Expected finding, got: ${ids}`);
});

test('audit — agents-md-unfilled-todo triggered', async () => {
  const dir = tmp();
  writeManifest(dir);
  writeFileSync(join(dir, 'AGENTS.md'), '# Project\n\n## Do Not\n- No.\n\n<!-- TODO: Fill this in -->');
  const report = await audit({ _consumerRoot: dir });
  const ids = report.findings.map(f => f.id);
  assert.ok(ids.includes('agents-md-unfilled-todo'), `Expected finding, got: ${ids}`);
});

test('audit — nested-agents-md-missing-sibling-claude triggered', async () => {
  const dir = tmp();
  writeManifest(dir);
  writeFileSync(join(dir, 'AGENTS.md'), '# Project\n\n## Do Not\n- No.\n');
  mkdirSync(join(dir, 'src'), { recursive: true });
  writeFileSync(join(dir, 'src', 'AGENTS.md'), '# Src rules\n');
  const report = await audit({ _consumerRoot: dir });
  const ids = report.findings.map(f => f.id);
  assert.ok(ids.includes('nested-agents-md-missing-sibling-claude'), `Expected finding, got: ${ids}`);
});

test('audit — nested-agents-md-missing-sibling-claude not triggered when CLAUDE.md present', async () => {
  const dir = tmp();
  writeManifest(dir);
  writeFileSync(join(dir, 'AGENTS.md'), '# Project\n\n## Do Not\n- No.\n');
  mkdirSync(join(dir, 'src'), { recursive: true });
  writeFileSync(join(dir, 'src', 'AGENTS.md'), '# Src rules\n');
  writeFileSync(join(dir, 'src', 'CLAUDE.md'), '@AGENTS.md\n');
  const report = await audit({ _consumerRoot: dir });
  const ids = report.findings.map(f => f.id);
  assert.ok(!ids.includes('nested-agents-md-missing-sibling-claude'), `Should not trigger, got: ${ids}`);
});

test('audit — agent-grants-all-tools triggered', async () => {
  const dir = tmp();
  writeManifest(dir);
  mkdirSync(join(dir, '.claude', 'agents'), { recursive: true });
  writeFileSync(join(dir, '.claude', 'agents', 'my-agent.md'),
    '---\nname: my-agent\ndescription: Does stuff when needed\n---\n# My Agent\nDoes things.\n## Procedures\n1. Do it.\n## Never\n- Never break.');
  const report = await audit({ _consumerRoot: dir });
  const ids = report.findings.map(f => f.id);
  assert.ok(ids.includes('agent-grants-all-tools'), `Expected finding, got: ${ids}`);
});

test('audit — agent-grants-all-tools not triggered when tools set', async () => {
  const dir = tmp();
  writeManifest(dir);
  mkdirSync(join(dir, '.claude', 'agents'), { recursive: true });
  writeFileSync(join(dir, '.claude', 'agents', 'my-agent.md'),
    '---\nname: my-agent\ndescription: Does stuff when the user asks about X\ntools: Read, Bash\n---\n# My Agent\nDoes things.\n## Procedures\n1. Do it.\n## Never\n- Never break.');
  const report = await audit({ _consumerRoot: dir });
  const ids = report.findings.map(f => f.id);
  assert.ok(!ids.includes('agent-grants-all-tools'), `Should not trigger, got: ${ids}`);
});

test('audit — skill-name-folder-mismatch is error severity', async () => {
  const dir = tmp();
  writeManifest(dir);
  mkdirSync(join(dir, '.claude', 'skills', 'my-skill'), { recursive: true });
  writeFileSync(join(dir, '.claude', 'skills', 'my-skill', 'SKILL.md'),
    '---\nname: wrong-name\ndescription: A skill that does things when you ask it\n---\n# My Skill\nContent.\n');
  const report = await audit({ _consumerRoot: dir });
  const errFindings = report.findings.filter(f => f.id === 'skill-name-folder-mismatch');
  assert.equal(errFindings.length, 1);
  assert.equal(errFindings[0].severity, 'error');
  assert.equal(report.summary.error, 1);
});

test('audit — skill-description-too-long is error severity', async () => {
  const dir = tmp();
  writeManifest(dir);
  mkdirSync(join(dir, '.claude', 'skills', 'my-skill'), { recursive: true });
  const longDesc = 'x'.repeat(1025);
  writeFileSync(join(dir, '.claude', 'skills', 'my-skill', 'SKILL.md'),
    `---\nname: my-skill\ndescription: "${longDesc}"\n---\n# My Skill\nContent.\n`);
  const report = await audit({ _consumerRoot: dir });
  const errFindings = report.findings.filter(f => f.id === 'skill-description-too-long');
  assert.equal(errFindings.length, 1);
  assert.equal(errFindings[0].severity, 'error');
});

test('audit — pending-integration-present emitted when manifest has entries', async () => {
  const dir = tmp();
  writeManifest(dir, { pendingIntegration: [{ managedPath: 'AGENTS.md', sidecarPath: 'AGENTS.md.ai-kit', reason: 'conflict' }] });
  const report = await audit({ _consumerRoot: dir });
  const ids = report.findings.map(f => f.id);
  assert.ok(ids.includes('pending-integration-present'), `Expected finding, got: ${ids}`);
  assert.equal(report.findings.find(f => f.id === 'pending-integration-present').severity, 'info');
});

test('audit — --json flag returns report object (no console output tested via return value)', async () => {
  const dir = tmp();
  writeManifest(dir);
  const report = await audit({ _consumerRoot: dir, json: true });
  assert.equal(typeof report, 'object');
  assert.ok('schemaVersion' in report);
  assert.ok('findings' in report);
  assert.ok('summary' in report);
});

test('audit — README.md in agents dir is skipped', async () => {
  const dir = tmp();
  writeManifest(dir);
  mkdirSync(join(dir, '.claude', 'agents'), { recursive: true });
  writeFileSync(join(dir, '.claude', 'agents', 'README.md'), '# Agents\n\nDocumentation.\n');
  const report = await audit({ _consumerRoot: dir, json: true });
  const agentFindings = report.findings.filter(f => f.file.includes('README.md'));
  assert.equal(agentFindings.length, 0);
});

// ── Item 4: skill-name-has-namespace-separator ────────────────────────────────

test('audit — skill-name-has-namespace-separator fires on colon separator', async () => {
  const dir = tmp();
  writeManifest(dir);
  mkdirSync(join(dir, '.claude', 'skills', 'code-review:code-review'), { recursive: true });
  writeFileSync(join(dir, '.claude', 'skills', 'code-review:code-review', 'SKILL.md'),
    '---\nname: code-review:code-review\ndescription: Reviews code when the user asks for a review\n---\n# Code Review\nContent.\n');
  const report = await audit({ _consumerRoot: dir });
  const ids = report.findings.map(f => f.id);
  assert.ok(ids.includes('skill-name-has-namespace-separator'), `Expected finding, got: ${ids}`);
  assert.equal(report.findings.find(f => f.id === 'skill-name-has-namespace-separator').severity, 'warning');
});

test('audit — skill-name-has-namespace-separator does not fire on plain kebab names', async () => {
  const dir = tmp();
  writeManifest(dir);
  mkdirSync(join(dir, '.claude', 'skills', 'new-skill'), { recursive: true });
  writeFileSync(join(dir, '.claude', 'skills', 'new-skill', 'SKILL.md'),
    '---\nname: new-skill\ndescription: Creates new skills when the user requests one\n---\n# New Skill\nContent.\n');
  const report = await audit({ _consumerRoot: dir });
  const ids = report.findings.map(f => f.id);
  assert.ok(!ids.includes('skill-name-has-namespace-separator'), `Should not fire, got: ${ids}`);
});

test('audit — skill-name-has-namespace-separator does not fire on scaffold-migrate style names', async () => {
  const dir = tmp();
  writeManifest(dir);
  mkdirSync(join(dir, '.claude', 'skills', 'scaffold-migrate'), { recursive: true });
  writeFileSync(join(dir, '.claude', 'skills', 'scaffold-migrate', 'SKILL.md'),
    '---\nname: scaffold-migrate\ndescription: Migrates scaffold files when invoked\n---\n# Scaffold Migrate\nContent.\n');
  const report = await audit({ _consumerRoot: dir });
  const ids = report.findings.map(f => f.id);
  assert.ok(!ids.includes('skill-name-has-namespace-separator'), `Should not fire, got: ${ids}`);
});

// ── Item 5: isAiKitOwnAsset exemption ────────────────────────────────────────

test('audit — skill-weak-description not fired for ai-kit-distributed skill', async () => {
  const dir = tmp();
  const skillRelPath = '.claude/skills/my-kit-skill/SKILL.md';
  writeManifest(dir, {
    files: {
      'src/my-kit-skill/SKILL.md': {
        sourceHash: 'abc',
        installedAs: skillRelPath,
        role: 'skill',
      },
    },
  });
  mkdirSync(join(dir, '.claude', 'skills', 'my-kit-skill'), { recursive: true });
  writeFileSync(join(dir, skillRelPath),
    '---\nname: my-kit-skill\ndescription: Short\n---\n# My Kit Skill\nContent.\n');
  const report = await audit({ _consumerRoot: dir });
  const ids = report.findings.map(f => f.id);
  assert.ok(!ids.includes('skill-weak-description'), `Should be exempt, got: ${ids}`);
});

test('audit — skill-weak-description fires for user-authored skill not in manifest', async () => {
  const dir = tmp();
  writeManifest(dir); // empty files map
  mkdirSync(join(dir, '.claude', 'skills', 'my-skill'), { recursive: true });
  writeFileSync(join(dir, '.claude', 'skills', 'my-skill', 'SKILL.md'),
    '---\nname: my-skill\ndescription: Short\n---\n# My Skill\nContent.\n');
  const report = await audit({ _consumerRoot: dir });
  const ids = report.findings.map(f => f.id);
  assert.ok(ids.includes('skill-weak-description'), `Expected finding, got: ${ids}`);
});

test('audit — skill-md-too-long suppressed for ai-kit-distributed skill (Bug 5)', async () => {
  const dir = tmp();
  const skillRelPath = '.claude/skills/upstream/SKILL.md';
  writeManifest(dir, {
    files: {
      '.claude/skills/upstream/SKILL.md': {
        sourceHash: 'abc',
        installedAs: skillRelPath,
        role: 'skill',
      },
    },
  });
  mkdirSync(join(dir, '.claude', 'skills', 'upstream'), { recursive: true });
  const longBody = Array.from({ length: 250 }, (_, i) => `Line ${i + 1}`).join('\n');
  writeFileSync(join(dir, skillRelPath),
    `---\nname: upstream\ndescription: Long upstream skill that does X when invoked\n---\n# Upstream\n${longBody}\n`);
  const report = await audit({ _consumerRoot: dir });
  const ids = report.findings.map(f => f.id);
  assert.ok(!ids.includes('skill-md-too-long'),
    `ai-kit-distributed skills should be exempt; got: ${ids}`);
});

test('audit — skill-md-too-long still fires for consumer-authored skill (Bug 5)', async () => {
  const dir = tmp();
  writeManifest(dir); // empty files map; skill is consumer-authored
  mkdirSync(join(dir, '.claude', 'skills', 'local'), { recursive: true });
  const longBody = Array.from({ length: 250 }, (_, i) => `Line ${i + 1}`).join('\n');
  writeFileSync(join(dir, '.claude', 'skills', 'local', 'SKILL.md'),
    `---\nname: local\ndescription: Long local skill that does X when invoked\n---\n# Local\n${longBody}\n`);
  const report = await audit({ _consumerRoot: dir });
  const ids = report.findings.map(f => f.id);
  assert.ok(ids.includes('skill-md-too-long'),
    `Consumer-authored skills should still fire; got: ${ids}`);
});

// ── Wave 1: schemaVersion + surface field ─────────────────────────────────────

test('audit — schemaVersion is 2', async () => {
  const dir = tmp();
  writeManifest(dir);
  const report = await audit({ _consumerRoot: dir, json: true });
  assert.equal(report.schemaVersion, 2);
});

test('audit — all findings carry a surface field', async () => {
  const dir = tmp();
  writeManifest(dir);
  // Create conditions that trigger findings across multiple surfaces
  writeFileSync(join(dir, 'AGENTS.md'), '# Project\n\n## Overview\nShort.\n');
  mkdirSync(join(dir, '.claude', 'agents'), { recursive: true });
  writeFileSync(join(dir, '.claude', 'agents', 'my-agent.md'),
    '---\nname: my-agent\ndescription: Does stuff when needed\n---\n# My Agent\nDoes things.\n## Procedures\n1. Do it.\n## Never\n- Never break.');
  mkdirSync(join(dir, '.claude', 'skills', 'my-skill'), { recursive: true });
  writeFileSync(join(dir, '.claude', 'skills', 'my-skill', 'SKILL.md'),
    '---\nname: my-skill\ndescription: Short\n---\n# My Skill\nContent.\n');
  const report = await audit({ _consumerRoot: dir, json: true });
  assert.ok(report.findings.length > 0, 'Expected at least one finding');
  assert.ok(
    report.findings.every(f => typeof f.surface === 'string' && f.surface.length > 0),
    `Some findings missing surface: ${JSON.stringify(report.findings.map(f => ({ id: f.id, surface: f.surface })))}`,
  );
});

test('audit — report has bySurface summary', async () => {
  const dir = tmp();
  writeManifest(dir);
  writeFileSync(join(dir, 'AGENTS.md'), '# Project\n\n## Overview\nShort.\n');
  const report = await audit({ _consumerRoot: dir, json: true });
  assert.ok(typeof report.summary.bySurface === 'object', 'summary.bySurface should be an object');
});

// ── Wave 2: prompts ───────────────────────────────────────────────────────────

test('audit — prompt-routes-agent-with-redundant-fields fires when prompt has agent+tools', async () => {
  const dir = tmp();
  writeManifest(dir);
  mkdirSync(join(dir, '.github', 'prompts'), { recursive: true });
  writeFileSync(join(dir, '.github', 'prompts', 'review.prompt.md'),
    '---\nagent: code-reviewer\ntools: Read, Grep\ndescription: Reviews code when the user asks\n---\n# Review\n');
  const report = await audit({ _consumerRoot: dir, json: true });
  const ids = report.findings.map(f => f.id);
  assert.ok(ids.includes('prompt-routes-agent-with-redundant-fields'), `Expected finding, got: ${ids}`);
  assert.equal(report.findings.find(f => f.id === 'prompt-routes-agent-with-redundant-fields').severity, 'warning');
});

test('audit — prompt-routes-agent-with-redundant-fields fires when prompt has agent+model', async () => {
  const dir = tmp();
  writeManifest(dir);
  mkdirSync(join(dir, '.github', 'prompts'), { recursive: true });
  writeFileSync(join(dir, '.github', 'prompts', 'review.prompt.md'),
    '---\nagent: code-reviewer\nmodel: claude-opus-4-7\ndescription: Reviews code when the user asks for review\n---\n# Review\n');
  const report = await audit({ _consumerRoot: dir, json: true });
  const ids = report.findings.map(f => f.id);
  assert.ok(ids.includes('prompt-routes-agent-with-redundant-fields'), `Expected finding, got: ${ids}`);
});

test('audit — prompt-routes-agent-with-redundant-fields silent when prompt has only agent', async () => {
  const dir = tmp();
  writeManifest(dir);
  mkdirSync(join(dir, '.github', 'prompts'), { recursive: true });
  writeFileSync(join(dir, '.github', 'prompts', 'review.prompt.md'),
    '---\nagent: code-reviewer\ndescription: Reviews code when the user asks for a review\n---\n# Review\n');
  const report = await audit({ _consumerRoot: dir, json: true });
  const ids = report.findings.map(f => f.id);
  assert.ok(!ids.includes('prompt-routes-agent-with-redundant-fields'), `Should not fire, got: ${ids}`);
});

test('audit — prompt-routes-agent-with-redundant-fields silent when prompt has tools but no agent', async () => {
  const dir = tmp();
  writeManifest(dir);
  mkdirSync(join(dir, '.github', 'prompts'), { recursive: true });
  writeFileSync(join(dir, '.github', 'prompts', 'review.prompt.md'),
    '---\ntools: Read, Grep\ndescription: Reviews code when the user asks for a review\n---\n# Review\n');
  const report = await audit({ _consumerRoot: dir, json: true });
  const ids = report.findings.map(f => f.id);
  assert.ok(!ids.includes('prompt-routes-agent-with-redundant-fields'), `Should not fire, got: ${ids}`);
});

test('audit — prompt-missing-description fires', async () => {
  const dir = tmp();
  writeManifest(dir);
  mkdirSync(join(dir, '.github', 'prompts'), { recursive: true });
  writeFileSync(join(dir, '.github', 'prompts', 'review.prompt.md'),
    '---\nagent: code-reviewer\n---\n# Review\n');
  const report = await audit({ _consumerRoot: dir, json: true });
  const ids = report.findings.map(f => f.id);
  assert.ok(ids.includes('prompt-missing-description'), `Expected finding, got: ${ids}`);
});

test('audit — prompt-filename-not-kebab-case fires on PascalCase', async () => {
  const dir = tmp();
  writeManifest(dir);
  mkdirSync(join(dir, '.github', 'prompts'), { recursive: true });
  writeFileSync(join(dir, '.github', 'prompts', 'ReviewCode.prompt.md'),
    '---\ndescription: Reviews code when the user asks for a code review\n---\n# Review\n');
  const report = await audit({ _consumerRoot: dir, json: true });
  const ids = report.findings.map(f => f.id);
  assert.ok(ids.includes('prompt-filename-not-kebab-case'), `Expected finding, got: ${ids}`);
});

test('audit — prompt-filename-not-kebab-case silent on _example.prompt.md', async () => {
  const dir = tmp();
  writeManifest(dir);
  mkdirSync(join(dir, '.github', 'prompts'), { recursive: true });
  writeFileSync(join(dir, '.github', 'prompts', '_example.prompt.md'),
    '---\ndescription: Example of how to write a review prompt for when users ask\n---\n# Example\n');
  const report = await audit({ _consumerRoot: dir, json: true });
  const ids = report.findings.map(f => f.id);
  assert.ok(!ids.includes('prompt-filename-not-kebab-case'), `Should not fire, got: ${ids}`);
});

test('audit — prompt-teaching-material-missing-underscore fires', async () => {
  const dir = tmp();
  writeManifest(dir);
  mkdirSync(join(dir, '.github', 'prompts'), { recursive: true });
  writeFileSync(join(dir, '.github', 'prompts', 'review.prompt.md'),
    '---\ndescription: Example showing how to review code when asked by users\n---\n# Review\n');
  const report = await audit({ _consumerRoot: dir, json: true });
  const ids = report.findings.map(f => f.id);
  assert.ok(ids.includes('prompt-teaching-material-missing-underscore'), `Expected finding, got: ${ids}`);
});

test('audit — README.md in prompts dir is skipped', async () => {
  const dir = tmp();
  writeManifest(dir);
  mkdirSync(join(dir, '.github', 'prompts'), { recursive: true });
  writeFileSync(join(dir, '.github', 'prompts', 'README.md'), '# Prompts\n\nDocumentation.\n');
  const report = await audit({ _consumerRoot: dir, json: true });
  const promptFindings = report.findings.filter(f => f.file.includes('README.md') && f.file.includes('prompts'));
  assert.equal(promptFindings.length, 0);
});

// ── Wave 2: root CLAUDE.md ────────────────────────────────────────────────────

test('audit — root-claude-md-missing fires when CLAUDE.md absent', async () => {
  const dir = tmp();
  writeManifest(dir);
  const report = await audit({ _consumerRoot: dir, json: true });
  const ids = report.findings.map(f => f.id);
  assert.ok(ids.includes('root-claude-md-missing'), `Expected finding, got: ${ids}`);
});

test('audit — root-claude-md-missing-agents-import fires when CLAUDE.md lacks @AGENTS.md', async () => {
  const dir = tmp();
  writeManifest(dir);
  writeFileSync(join(dir, 'CLAUDE.md'), '# Project notes\nSome content.\n');
  const report = await audit({ _consumerRoot: dir, json: true });
  const ids = report.findings.map(f => f.id);
  assert.ok(ids.includes('root-claude-md-missing-agents-import'), `Expected finding, got: ${ids}`);
  assert.equal(report.findings.find(f => f.id === 'root-claude-md-missing-agents-import').severity, 'warning');
});

test('audit — root-claude-md-missing-agents-import silent when @AGENTS.md present', async () => {
  const dir = tmp();
  writeManifest(dir);
  writeFileSync(join(dir, 'CLAUDE.md'), '@AGENTS.md\n');
  const report = await audit({ _consumerRoot: dir, json: true });
  const ids = report.findings.map(f => f.id);
  assert.ok(!ids.includes('root-claude-md-missing'), `Should not fire missing, got: ${ids}`);
  assert.ok(!ids.includes('root-claude-md-missing-agents-import'), `Should not fire import, got: ${ids}`);
});

// ── Wave 2: nested CLAUDE.md content check ───────────────────────────────────

test('audit — nested-claude-md-missing-agents-import fires when CLAUDE.md lacks @AGENTS.md', async () => {
  const dir = tmp();
  writeManifest(dir);
  writeFileSync(join(dir, 'AGENTS.md'), '# Project\n\n## Do Not\n- No.\n');
  mkdirSync(join(dir, 'src'), { recursive: true });
  writeFileSync(join(dir, 'src', 'AGENTS.md'), '# Src rules\n');
  writeFileSync(join(dir, 'src', 'CLAUDE.md'), '# Not the right content\n');
  const report = await audit({ _consumerRoot: dir, json: true });
  const ids = report.findings.map(f => f.id);
  assert.ok(ids.includes('nested-claude-md-missing-agents-import'), `Expected finding, got: ${ids}`);
});

test('audit — nested-claude-md-missing-agents-import silent when CLAUDE.md has @AGENTS.md', async () => {
  const dir = tmp();
  writeManifest(dir);
  writeFileSync(join(dir, 'AGENTS.md'), '# Project\n\n## Do Not\n- No.\n');
  mkdirSync(join(dir, 'src'), { recursive: true });
  writeFileSync(join(dir, 'src', 'AGENTS.md'), '# Src rules\n');
  writeFileSync(join(dir, 'src', 'CLAUDE.md'), '@AGENTS.md\n');
  const report = await audit({ _consumerRoot: dir, json: true });
  const ids = report.findings.map(f => f.id);
  assert.ok(!ids.includes('nested-claude-md-missing-agents-import'), `Should not fire, got: ${ids}`);
});

// ── Wave 2: asset-folder READMEs ─────────────────────────────────────────────

test('audit — asset-folder-missing-readme fires for .claude/agents/', async () => {
  const dir = tmp();
  writeManifest(dir);
  mkdirSync(join(dir, '.claude', 'agents'), { recursive: true });
  writeFileSync(join(dir, '.claude', 'agents', 'my-agent.md'),
    '---\nname: my-agent\ndescription: Does stuff when needed\ntools: Read\n---\n# My Agent\nDoes things.\n## Procedures\n1. Do it.\n## Never\n- Never break.');
  const report = await audit({ _consumerRoot: dir, json: true });
  const ids = report.findings.map(f => f.id);
  assert.ok(ids.includes('asset-folder-missing-readme'), `Expected finding, got: ${ids}`);
  assert.equal(report.findings.find(f => f.id === 'asset-folder-missing-readme').file, '.claude/agents/README.md');
});

test('audit — asset-folder-missing-readme silent when README.md present', async () => {
  const dir = tmp();
  writeManifest(dir);
  mkdirSync(join(dir, '.claude', 'agents'), { recursive: true });
  writeFileSync(join(dir, '.claude', 'agents', 'README.md'), '# Agents\n\nDocumentation.\n');
  const report = await audit({ _consumerRoot: dir, json: true });
  const readmesFindings = report.findings.filter(f => f.id === 'asset-folder-missing-readme' && f.file === '.claude/agents/README.md');
  assert.equal(readmesFindings.length, 0);
});

// ── Wave 3: .claude/settings.json ────────────────────────────────────────────

test('audit — claude-settings-missing-env-deny fires when deny list is missing rules', async () => {
  const dir = tmp();
  writeManifest(dir);
  writeFileSync(join(dir, '.claude', 'settings.json'), JSON.stringify({ permissions: { deny: [] } }));
  const report = await audit({ _consumerRoot: dir, json: true });
  const ids = report.findings.map(f => f.id);
  assert.ok(ids.includes('claude-settings-missing-env-deny'), `Expected finding, got: ${ids}`);
  assert.equal(report.findings.find(f => f.id === 'claude-settings-missing-env-deny').severity, 'warning');
});

test('audit — claude-settings-missing-env-deny silent when both deny rules present', async () => {
  const dir = tmp();
  writeManifest(dir);
  writeFileSync(join(dir, '.claude', 'settings.json'), JSON.stringify({
    permissions: { deny: ['Read(./.env)', 'Read(./.env.*)'] },
  }));
  const report = await audit({ _consumerRoot: dir, json: true });
  const ids = report.findings.map(f => f.id);
  assert.ok(!ids.includes('claude-settings-missing-env-deny'), `Should not fire, got: ${ids}`);
});

// ── Wave 3: .vscode/settings.json ────────────────────────────────────────────

test('audit — vscode-settings-missing fires when file absent', async () => {
  const dir = tmp();
  writeManifest(dir);
  const report = await audit({ _consumerRoot: dir, json: true });
  const ids = report.findings.map(f => f.id);
  assert.ok(ids.includes('vscode-settings-missing'), `Expected finding, got: ${ids}`);
});

test('audit — vscode-ai-key-missing-or-wrong fires for each missing key', async () => {
  const dir = tmp();
  writeManifest(dir);
  // Provide settings with only one correct key; rest missing
  mkdirSync(join(dir, '.vscode'), { recursive: true });
  writeFileSync(join(dir, '.vscode', 'settings.json'), JSON.stringify({
    'chat.useAgentsMdFile': true,
  }));
  const report = await audit({ _consumerRoot: dir, json: true });
  const keyFindings = report.findings.filter(f => f.id === 'vscode-ai-key-missing-or-wrong');
  // Should fire for 7 remaining keys
  assert.ok(keyFindings.length >= 7, `Expected ≥7 findings, got: ${keyFindings.length}`);
  assert.ok(keyFindings.every(f => f.severity === 'info'), 'Default severity should be info');
});

test('audit — vscode-ai-key-missing-or-wrong silent when all keys correct', async () => {
  const dir = tmp();
  writeManifest(dir);
  mkdirSync(join(dir, '.vscode'), { recursive: true });
  writeFileSync(join(dir, '.vscode', 'settings.json'), JSON.stringify({
    'chat.useAgentsMdFile': true,
    'chat.useNestedAgentsMdFiles': true,
    'chat.useClaudeMdFile': false,
    'chat.useCustomizationsInParentRepositories': true,
    'chat.useAgentSkills': true,
    'chat.useCustomAgentHooks': true,
    'chat.subagents.allowInvocationsFromSubagents': true,
    'chat.tools.terminal.enableAutoApprove': false,
  }));
  const report = await audit({ _consumerRoot: dir, json: true });
  const ids = report.findings.map(f => f.id);
  assert.ok(!ids.includes('vscode-ai-key-missing-or-wrong'), `Should not fire, got: ${ids}`);
  assert.ok(!ids.includes('vscode-settings-missing'), `Should not fire missing, got: ${ids}`);
});

// ── Wave 3: .gitignore ────────────────────────────────────────────────────────

test('audit — gitignore-missing-ai-kit-entries fires for missing entry', async () => {
  const dir = tmp();
  writeManifest(dir);
  writeFileSync(join(dir, '.gitignore'), '# Existing\nnode_modules\n');
  const report = await audit({ _consumerRoot: dir, json: true });
  const entryFindings = report.findings.filter(f => f.id === 'gitignore-missing-ai-kit-entries');
  assert.ok(entryFindings.length >= 2, `Expected ≥2 findings, got: ${entryFindings.length}`);
});

test('audit — gitignore-missing-ai-kit-entries silent when all entries present', async () => {
  const dir = tmp();
  writeManifest(dir);
  writeFileSync(join(dir, '.gitignore'),
    '.claude/settings.local.json\n.claude/ai-kit-audit-report.json\n');
  const report = await audit({ _consumerRoot: dir, json: true });
  const ids = report.findings.map(f => f.id);
  assert.ok(!ids.includes('gitignore-missing-ai-kit-entries'), `Should not fire, got: ${ids}`);
});

test('audit — gitignore parent-directory ignore covers required children (Bug 4b)', async () => {
  const dir = tmp();
  writeManifest(dir);
  // A wholesale `.claude/` ignore covers .claude/settings.local.json and
  // .claude/ai-kit-audit-report.json — the checker must not report them missing.
  writeFileSync(join(dir, '.gitignore'), '.claude/\nnode_modules\n');
  const report = await audit({ _consumerRoot: dir, json: true });
  const ids = report.findings.map(f => f.id);
  assert.ok(!ids.includes('gitignore-missing-ai-kit-entries'),
    `Parent-dir ignore should suppress per-file findings; got: ${ids}`);
});

test('audit — gitignore bare directory name (no trailing slash) also covers children (Bug 4b)', async () => {
  const dir = tmp();
  writeManifest(dir);
  writeFileSync(join(dir, '.gitignore'), '.claude\n');
  const report = await audit({ _consumerRoot: dir, json: true });
  const ids = report.findings.map(f => f.id);
  assert.ok(!ids.includes('gitignore-missing-ai-kit-entries'),
    `Bare directory ignore should suppress per-file findings; got: ${ids}`);
});

// ── Wave 3: audit-report leak ─────────────────────────────────────────────────

test('audit — audit-report-committed fires when file exists and not gitignored', async () => {
  const dir = tmp();
  writeManifest(dir);
  writeFileSync(join(dir, '.gitignore'), 'node_modules\n');
  writeFileSync(join(dir, '.claude', 'ai-kit-audit-report.json'), '{}');
  const report = await audit({ _consumerRoot: dir, json: true });
  const ids = report.findings.map(f => f.id);
  assert.ok(ids.includes('audit-report-committed'), `Expected finding, got: ${ids}`);
  assert.equal(report.findings.find(f => f.id === 'audit-report-committed').severity, 'warning');
});

test('audit — audit-report-committed silent when file gitignored', async () => {
  const dir = tmp();
  writeManifest(dir);
  writeFileSync(join(dir, '.gitignore'), '.claude/ai-kit-audit-report.json\n');
  writeFileSync(join(dir, '.claude', 'ai-kit-audit-report.json'), '{}');
  const report = await audit({ _consumerRoot: dir, json: true });
  const ids = report.findings.map(f => f.id);
  assert.ok(!ids.includes('audit-report-committed'), `Should not fire, got: ${ids}`);
});

// ── Wave 3: naming checks ─────────────────────────────────────────────────────

test('audit — command-name-collides-with-vscode-builtin fires on skill named create-skill', async () => {
  const dir = tmp();
  writeManifest(dir);
  mkdirSync(join(dir, '.claude', 'skills', 'create-skill'), { recursive: true });
  writeFileSync(join(dir, '.claude', 'skills', 'create-skill', 'SKILL.md'),
    '---\nname: create-skill\ndescription: Creates skills when the user asks to create a new skill\n---\n# Create Skill\nContent.\n');
  const report = await audit({ _consumerRoot: dir, json: true });
  const ids = report.findings.map(f => f.id);
  assert.ok(ids.includes('command-name-collides-with-vscode-builtin'), `Expected finding, got: ${ids}`);
});

test('audit — agent-filename-not-kebab-case fires on PascalCase filename', async () => {
  const dir = tmp();
  writeManifest(dir);
  mkdirSync(join(dir, '.claude', 'agents'), { recursive: true });
  writeFileSync(join(dir, '.claude', 'agents', 'MyAgent.md'),
    '---\nname: MyAgent\ndescription: Does stuff when the user asks for MyAgent things\ntools: Read\n---\n# MyAgent\nDoes things.\n## Procedures\n1. Do it.\n## Never\n- Never break.');
  const report = await audit({ _consumerRoot: dir, json: true });
  const ids = report.findings.map(f => f.id);
  assert.ok(ids.includes('agent-filename-not-kebab-case'), `Expected finding, got: ${ids}`);
});

// ── Wave 3: --strict flag ─────────────────────────────────────────────────────

test('audit --strict escalates info to warning for supported checks', async () => {
  const dir = tmp();
  writeManifest(dir);
  // vscode-settings-missing is info by default, warning under strict
  const reportNormal = await audit({ _consumerRoot: dir, json: true });
  const reportStrict = await audit({ _consumerRoot: dir, json: true, strict: true });

  const vscodeMissing = reportNormal.findings.find(f => f.id === 'vscode-settings-missing');
  assert.ok(vscodeMissing, 'Should have vscode-settings-missing finding');
  assert.equal(vscodeMissing.severity, 'info', 'Default: info');

  const vscodeStrict = reportStrict.findings.find(f => f.id === 'vscode-settings-missing');
  assert.ok(vscodeStrict, 'Should have vscode-settings-missing under strict');
  assert.equal(vscodeStrict.severity, 'warning', 'Strict: warning');
});

test('audit --strict sets strict:true in report', async () => {
  const dir = tmp();
  writeManifest(dir);
  const report = await audit({ _consumerRoot: dir, json: true, strict: true });
  assert.equal(report.strict, true);
});

// ── Wave 4: skill description + bare paths + tools deterministic ──────────────

test('audit — skill-description-missing-when fires for non-ai-kit skill', async () => {
  const dir = tmp();
  writeManifest(dir);
  mkdirSync(join(dir, '.claude', 'skills', 'my-skill'), { recursive: true });
  writeFileSync(join(dir, '.claude', 'skills', 'my-skill', 'SKILL.md'),
    '---\nname: my-skill\ndescription: Reviews code for quality and style issues\n---\n# My Skill\nContent.\n');
  const report = await audit({ _consumerRoot: dir, json: true });
  const ids = report.findings.map(f => f.id);
  assert.ok(ids.includes('skill-description-missing-when'), `Expected finding, got: ${ids}`);
});

test('audit — skill-description-missing-when silent when description has "when"', async () => {
  const dir = tmp();
  writeManifest(dir);
  mkdirSync(join(dir, '.claude', 'skills', 'my-skill'), { recursive: true });
  writeFileSync(join(dir, '.claude', 'skills', 'my-skill', 'SKILL.md'),
    '---\nname: my-skill\ndescription: Reviews code for quality when the user asks for a review\n---\n# My Skill\nContent.\n');
  const report = await audit({ _consumerRoot: dir, json: true });
  const ids = report.findings.map(f => f.id);
  assert.ok(!ids.includes('skill-description-missing-when'), `Should not fire, got: ${ids}`);
});

test('audit — skill-description-missing-when silent for ai-kit-distributed skill', async () => {
  const dir = tmp();
  const skillRelPath = '.claude/skills/my-kit-skill/SKILL.md';
  writeManifest(dir, {
    files: { 'src/my-kit-skill/SKILL.md': { sourceHash: 'abc', installedAs: skillRelPath, role: 'skill' } },
  });
  mkdirSync(join(dir, '.claude', 'skills', 'my-kit-skill'), { recursive: true });
  writeFileSync(join(dir, skillRelPath),
    '---\nname: my-kit-skill\ndescription: A skill without when clause\n---\n# My Kit Skill\nContent.\n');
  const report = await audit({ _consumerRoot: dir, json: true });
  const ids = report.findings.map(f => f.id);
  assert.ok(!ids.includes('skill-description-missing-when'), `Should be exempt, got: ${ids}`);
});

test('audit — skill-body-uses-bare-sibling-paths fires on bare references path', async () => {
  const dir = tmp();
  writeManifest(dir);
  mkdirSync(join(dir, '.claude', 'skills', 'my-skill'), { recursive: true });
  writeFileSync(join(dir, '.claude', 'skills', 'my-skill', 'SKILL.md'),
    '---\nname: my-skill\ndescription: Does stuff when needed for the user\n---\n# My Skill\nSee references/details.md for more info.\n');
  const report = await audit({ _consumerRoot: dir, json: true });
  const ids = report.findings.map(f => f.id);
  assert.ok(ids.includes('skill-body-uses-bare-sibling-paths'), `Expected finding, got: ${ids}`);
});

test('audit — skill-body-uses-bare-sibling-paths silent on properly linked path', async () => {
  const dir = tmp();
  writeManifest(dir);
  mkdirSync(join(dir, '.claude', 'skills', 'my-skill'), { recursive: true });
  writeFileSync(join(dir, '.claude', 'skills', 'my-skill', 'SKILL.md'),
    '---\nname: my-skill\ndescription: Does stuff when needed for the user\n---\n# My Skill\nSee [details](references/details.md) for more info.\n');
  const report = await audit({ _consumerRoot: dir, json: true });
  const ids = report.findings.map(f => f.id);
  assert.ok(!ids.includes('skill-body-uses-bare-sibling-paths'), `Should not fire, got: ${ids}`);
});

test('audit — agent-grants-all-tools now deterministic with suggestedFix when Procedures present', async () => {
  const dir = tmp();
  writeManifest(dir);
  mkdirSync(join(dir, '.claude', 'agents'), { recursive: true });
  writeFileSync(join(dir, '.claude', 'agents', 'my-agent.md'),
    '---\nname: my-agent\ndescription: Does stuff when the user needs things done\n---\n# My Agent\nDoes things.\n## Procedures\n1. Read the file and grep for patterns.\n2. Run the git diff command.\n## Never\n- Never break.');
  const report = await audit({ _consumerRoot: dir, json: true });
  const finding = report.findings.find(f => f.id === 'agent-grants-all-tools');
  assert.ok(finding, 'Expected agent-grants-all-tools finding');
  assert.equal(finding.fixable, 'deterministic');
  assert.ok(finding.suggestedFix, 'Should have suggestedFix');
  assert.ok(finding.suggestedFix.includes('Read'), 'suggestedFix should include Read');
});

test('audit — agent-grants-all-tools falls back to manual when no Procedures section', async () => {
  const dir = tmp();
  writeManifest(dir);
  mkdirSync(join(dir, '.claude', 'agents'), { recursive: true });
  writeFileSync(join(dir, '.claude', 'agents', 'my-agent.md'),
    '---\nname: my-agent\ndescription: Does stuff when the user needs things done\n---\n# My Agent\nDoes things.\n## Never\n- Never break.');
  const report = await audit({ _consumerRoot: dir, json: true });
  const finding = report.findings.find(f => f.id === 'agent-grants-all-tools');
  assert.ok(finding, 'Expected agent-grants-all-tools finding');
  assert.equal(finding.fixable, 'manual');
  assert.ok(!finding.suggestedFix, 'Should not have suggestedFix without Procedures');
});

// ── Wave 4: orphan registration (skipped outside scaffold repo) ───────────────

test('checkCrossFile — nested opt-in skill registered by full path produces no orphan finding', async () => {
  const { checkCrossFile } = await import('../lib/audit/checks/cross-file.mjs');
  const dir = tmp();
  mkdirSync(join(dir, '.claude', 'skills', 'terraform', 'refactor-module'), { recursive: true });
  writeFileSync(
    join(dir, '.claude', 'skills', 'terraform', 'refactor-module', 'SKILL.md'),
    '---\nname: refactor-module\ndescription: x\n---\n',
  );
  const fakeRegistry = {
    baseSkills: () => [],
    optInSkills: () => [{ id: 'refactor-module', path: '.claude/skills/terraform/refactor-module' }],
    baseAgents: () => [],
    optInAgents: () => [],
  };
  const findings = checkCrossFile({ pendingIntegration: [] }, dir, [], { aiKitRoot: dir, registry: fakeRegistry });
  const orphans = findings.filter(f => f.id === 'skill-not-registered');
  assert.equal(orphans.length, 0, `Expected 0 orphans for registered nested skill, got: ${JSON.stringify(orphans)}`);
});

test('checkCrossFile — nested skill missing from registry fires orphan with nested file path', async () => {
  const { checkCrossFile } = await import('../lib/audit/checks/cross-file.mjs');
  const dir = tmp();
  mkdirSync(join(dir, '.claude', 'skills', 'terraform', 'ghost-skill'), { recursive: true });
  writeFileSync(
    join(dir, '.claude', 'skills', 'terraform', 'ghost-skill', 'SKILL.md'),
    '---\nname: ghost-skill\ndescription: x\n---\n',
  );
  const fakeRegistry = {
    baseSkills: () => [],
    optInSkills: () => [],
    baseAgents: () => [],
    optInAgents: () => [],
  };
  const findings = checkCrossFile({ pendingIntegration: [] }, dir, [], { aiKitRoot: dir, registry: fakeRegistry });
  const orphans = findings.filter(f => f.id === 'skill-not-registered');
  assert.equal(orphans.length, 1, `Expected exactly 1 orphan for nested unregistered skill, got: ${JSON.stringify(orphans)}`);
  assert.equal(orphans[0].file, '.claude/skills/terraform/ghost-skill/SKILL.md');
  assert.match(orphans[0].message, /ghost-skill/);
  assert.match(orphans[0].message, /terraform\/ghost-skill/);
});

test('checkCrossFile — flat base skill registered does not fire orphan', async () => {
  const { checkCrossFile } = await import('../lib/audit/checks/cross-file.mjs');
  const dir = tmp();
  mkdirSync(join(dir, '.claude', 'skills', 'migrate'), { recursive: true });
  writeFileSync(
    join(dir, '.claude', 'skills', 'migrate', 'SKILL.md'),
    '---\nname: migrate\ndescription: x\n---\n',
  );
  const fakeRegistry = {
    baseSkills: () => ['migrate'],
    optInSkills: () => [],
    baseAgents: () => [],
    optInAgents: () => [],
  };
  const findings = checkCrossFile({ pendingIntegration: [] }, dir, [], { aiKitRoot: dir, registry: fakeRegistry });
  const orphans = findings.filter(f => f.id === 'skill-not-registered');
  assert.equal(orphans.length, 0, `Expected 0 orphans for registered base skill, got: ${JSON.stringify(orphans)}`);
});

test('audit — orphan registration checks skipped in consumer repo (no ai-kit.config.json)', async () => {
  const dir = tmp();
  writeManifest(dir);
  mkdirSync(join(dir, '.claude', 'skills', 'my-orphan-skill'), { recursive: true });
  writeFileSync(join(dir, '.claude', 'skills', 'my-orphan-skill', 'SKILL.md'),
    '---\nname: my-orphan-skill\ndescription: An orphan skill when needed\n---\n# Orphan\nContent.\n');
  const report = await audit({ _consumerRoot: dir, json: true });
  const ids = report.findings.map(f => f.id);
  // Consumer repos (no ai-kit.config.json at consumerRoot) should NOT fire orphan checks
  assert.ok(!ids.includes('skill-not-registered'), `Orphan check should be skipped, got: ${ids}`);
});

test('audit — stale-github-dir fired for empty .github/agents', async () => {
  const dir = tmp();
  writeManifest(dir);
  mkdirSync(join(dir, '.github', 'agents'), { recursive: true });
  const report = await audit({ _consumerRoot: dir });
  const finding = report.findings.find(f => f.id === 'stale-github-dir');
  assert.ok(finding, `expected stale-github-dir, got: ${report.findings.map(f => f.id)}`);
  assert.equal(finding.severity, 'warning');
  assert.equal(finding.file, '.github/agents');
});

test('audit — stale-github-dir fired for non-empty .github/skills with stray sibling', async () => {
  const dir = tmp();
  writeManifest(dir);
  mkdirSync(join(dir, '.github', 'skills'), { recursive: true });
  writeFileSync(join(dir, '.github', 'skills', 'README.md'), '# stray\n');
  const report = await audit({ _consumerRoot: dir });
  const finding = report.findings.find(f => f.id === 'stale-github-dir' && f.file === '.github/skills');
  assert.ok(finding, 'finding emitted for non-empty .github/skills');
  assert.ok(finding.message.includes('1 item'), `message mentions count, got: ${finding.message}`);
});

test('audit — stale-github-dir not fired when no .github/ AI-config dirs exist', async () => {
  const dir = tmp();
  writeManifest(dir);
  const report = await audit({ _consumerRoot: dir });
  assert.ok(!report.findings.some(f => f.id === 'stale-github-dir'),
    'no finding when .github/ AI-config dirs absent');
});

test('audit — broken-reference flagged when SKILL.md links a missing sibling', async () => {
  const dir = tmp();
  writeManifest(dir);
  const skillDir = join(dir, '.claude', 'skills', 'foo');
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, 'SKILL.md'),
    '---\nname: foo\ndescription: A skill that uses foo to do bar when bazzing.\n---\n# Foo\n\nSee [missing](./references/gone.md).\n');
  const report = await audit({ _consumerRoot: dir });
  const broken = report.findings.filter(f => f.id === 'broken-reference');
  assert.equal(broken.length, 1, `expected 1 broken-reference, got ${broken.length}`);
  assert.equal(broken[0].severity, 'warning');
  assert.match(broken[0].message, /references\/gone\.md/);
});

test('audit — broken-reference NOT flagged when link target exists', async () => {
  const dir = tmp();
  writeManifest(dir);
  const skillDir = join(dir, '.claude', 'skills', 'foo');
  mkdirSync(join(skillDir, 'references'), { recursive: true });
  writeFileSync(join(skillDir, 'references', 'present.md'), 'content\n');
  writeFileSync(join(skillDir, 'SKILL.md'),
    '---\nname: foo\ndescription: A skill that uses foo to do bar when bazzing.\n---\n# Foo\n\nSee [present](./references/present.md).\n');
  const report = await audit({ _consumerRoot: dir });
  assert.equal(report.findings.filter(f => f.id === 'broken-reference').length, 0);
});

test('audit — broken-reference flags missing path in agent ## Documents section', async () => {
  const dir = tmp();
  writeManifest(dir);
  const agentDir = join(dir, '.claude', 'agents');
  mkdirSync(agentDir, { recursive: true });
  writeFileSync(join(agentDir, 'a.md'),
    '---\nname: a\ndescription: x\ntools: Read\n---\n# A\nrole.\n## Procedures\n1. step.\n## Never\n- never.\n## Documents\n.claude/skills/missing/references/x.md\n');
  const report = await audit({ _consumerRoot: dir });
  const broken = report.findings.filter(f => f.id === 'broken-reference');
  assert.equal(broken.length, 1);
  assert.match(broken[0].message, /missing\/references\/x\.md/);
});

test('audit — broken-reference ignores fenced code block content', async () => {
  const dir = tmp();
  writeManifest(dir);
  const skillDir = join(dir, '.claude', 'skills', 'foo');
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, 'SKILL.md'),
    '---\nname: foo\ndescription: A skill that uses foo to do bar when bazzing.\n---\n# Foo\n\n```\nSee [fake](./does-not-exist.md)\n```\n');
  const report = await audit({ _consumerRoot: dir });
  assert.equal(report.findings.filter(f => f.id === 'broken-reference').length, 0);
});

test('audit — broken-reference skips URLs and anchors', async () => {
  const dir = tmp();
  writeManifest(dir);
  const skillDir = join(dir, '.claude', 'skills', 'foo');
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, 'SKILL.md'),
    '---\nname: foo\ndescription: A skill that uses foo to do bar when bazzing.\n---\n# Foo\n\n[home](https://example.com) [top](#intro) [mail](mailto:x@y.z)\n');
  const report = await audit({ _consumerRoot: dir });
  assert.equal(report.findings.filter(f => f.id === 'broken-reference').length, 0);
});

test('audit — agent-weak-description not fired for ai-kit-distributed agent', async () => {
  const dir = tmp();
  const agentRelPath = '.claude/agents/my-kit-agent.md';
  writeManifest(dir, {
    files: {
      '.claude/agents/my-kit-agent.md': {
        sourceHash: 'abc',
        installedAs: agentRelPath,
        role: 'agent',
      },
    },
  });
  mkdirSync(join(dir, '.claude', 'agents'), { recursive: true });
  writeFileSync(join(dir, agentRelPath),
    '---\nname: my-kit-agent\ndescription: Short desc\ntools: Read\n---\n# My Kit Agent\nDoes stuff.\n## Procedures\n1. Do it.\n## Never\n- Never break.\n');
  const report = await audit({ _consumerRoot: dir });
  const ids = report.findings.map(f => f.id);
  assert.ok(!ids.includes('agent-weak-description'), `Should be exempt, got: ${ids}`);
  assert.ok(!ids.includes('agent-description-missing-when'), `Should be exempt, got: ${ids}`);
});
