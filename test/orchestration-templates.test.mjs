import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { instantiateTemplate } from '../scripts/lib/orchestration/instantiate.mjs';
import { validateGenerationManifest, validateTaskBacklog } from '../scripts/lib/orchestration/schemas.mjs';
import { parseTasksMd } from '../scripts/lib/orchestration/parse-tasks.mjs';

const FIXTURES = join(import.meta.dirname, 'fixtures', 'orchestration');
const TEMPLATES = join(import.meta.dirname, '..', 'templates', 'orchestration', 'agents');
const loadFixture = (name) => JSON.parse(readFileSync(join(FIXTURES, name), 'utf8'));

// C1/C3 acceptance: every agent entry of the hand-written A3 fixture and
// both synthesized Phase B blueprints fully instantiates against its
// template — strict both ways, so this is simultaneously the "no orphan
// slots" lint and the "no unfillable template" lint.
const BLUEPRINTS = [
  'maxi-repo.blueprint.json',
  'maxi-repo.synthesized.blueprint.json',
  'mini-repo.synthesized.blueprint.json',
];

// Same derivation the instantiator skills use: declared slots + the
// injected quartet from blueprint fields.
const slotMapFor = (agent) => ({
  ...agent.slots,
  name: agent.name,
  tools: agent.tools.join(', '),
  'model-tier': agent.modelTier,
  'turn-limit': String(agent.turnLimit),
});

for (const fixture of BLUEPRINTS) {
  const bp = loadFixture(fixture);
  for (const agent of [...bp.specialists, bp.orchestrator]) {
    test(`C1 lint: ${fixture} → ${agent.name} (${agent.templateId}) instantiates clean`, () => {
      const path = join(TEMPLATES, `${agent.templateId}.template.md`);
      assert.ok(existsSync(path), `template ${agent.templateId}.template.md missing`);
      const { content, errors } = instantiateTemplate(readFileSync(path, 'utf8'), slotMapFor(agent));
      assert.deepEqual(errors, []);
      assert.ok(!content.includes('ai-kit:slot'), 'no marker text survives');
      assert.match(content, new RegExp(`^name: ${agent.name}$`, 'm'));
    });
  }
}

// C2: each skill template instantiates clean from its paired specialist's
// blueprint slots alone (no quartet — skills carry no agent identity).
const SKILL_TEMPLATES = join(import.meta.dirname, '..', 'templates', 'orchestration', 'skills');
const registry = JSON.parse(
  readFileSync(join(import.meta.dirname, '..', 'templates', 'orchestration', 'template-registry.json'), 'utf8'),
);

for (const [skillId, meta] of Object.entries(registry.skills)) {
  test(`C2 lint: ${skillId} instantiates from its paired specialist's slots`, () => {
    const bp = loadFixture('maxi-repo.synthesized.blueprint.json');
    const specialist = bp.specialists.find((s) => s.templateId === meta.pairsWith);
    assert.ok(specialist, `no maxi specialist uses template ${meta.pairsWith}`);
    const tpl = readFileSync(join(SKILL_TEMPLATES, `${skillId}.template.md`), 'utf8');
    // C2 invariant stated directly, not via the fixture: exactly these 4 slots
    const markers = new Set([...tpl.matchAll(/<!--\s*ai-kit:slot:([a-z0-9-]+)\s*-->/g)].map((m) => m[1]));
    assert.deepEqual([...markers].sort(), ['conventions', 'layer-path', 'stack', 'test-cmd']);
    const { content, errors } = instantiateTemplate(tpl, specialist.slots);
    assert.deepEqual(errors, []);
    assert.ok(!content.includes('ai-kit:slot'));
    assert.match(content, new RegExp(`^name: ${skillId}$`, 'm'));
  });
}

test('C2 lint: registry and shipped templates cover each other exactly', () => {
  const agentFiles = readdirSync(TEMPLATES).filter((f) => f.endsWith('.template.md')).map((f) => f.replace('.template.md', ''));
  const skillFiles = readdirSync(SKILL_TEMPLATES).filter((f) => f.endsWith('.template.md')).map((f) => f.replace('.template.md', ''));
  assert.deepEqual(agentFiles.sort(), Object.keys(registry.agents).sort());
  assert.deepEqual(skillFiles.sort(), Object.keys(registry.skills).sort());
  for (const [skillId, meta] of Object.entries(registry.skills)) {
    assert.ok(registry.agents[meta.pairsWith], `${skillId} pairsWith unknown template ${meta.pairsWith}`);
  }
  const docFiles = readdirSync(join(import.meta.dirname, '..', 'templates', 'orchestration', 'docs'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace('.md', ''));
  assert.deepEqual(docFiles.sort(), Object.keys(registry.docs).sort());
});

test('C1 lint: every shipped template is referenced by at least one fixture blueprint', () => {
  const referenced = new Set(
    BLUEPRINTS.flatMap((f) => {
      const bp = loadFixture(f);
      return [...bp.specialists, bp.orchestrator].map((a) => a.templateId);
    }),
  );
  const shipped = readdirSync(TEMPLATES)
    .filter((f) => f.endsWith('.template.md'))
    .map((f) => f.replace('.template.md', ''));
  for (const id of shipped) {
    assert.ok(referenced.has(id), `template ${id} is orphaned — no fixture blueprint references it`);
  }
});

// ── generation-manifest validator (C4 contract) ─────────────────────────────

const SHA = 'a'.repeat(64);
const ENTRY = { path: '.claude/agents/api-engineer.md', templateId: 'api-engineer', templateVersion: '1.0.0', sha256: SHA };

test('validateGenerationManifest: well-formed manifest validates clean', () => {
  assert.deepEqual(validateGenerationManifest({ schemaVersion: 1, generated: [ENTRY] }), []);
});

test('validateGenerationManifest: non-object and empty shapes rejected', () => {
  assert.deepEqual(validateGenerationManifest(null), ['generation manifest must be an object']);
  assert.deepEqual(validateGenerationManifest({}), [
    'schemaVersion must be 1 (got undefined)',
    'generated must be a non-empty array',
  ]);
});

test('validateGenerationManifest: bad entries report per field', () => {
  const manifest = {
    schemaVersion: 1,
    generated: [
      { ...ENTRY, path: '/abs/path', templateVersion: 'v1', sha256: 'beef' },
      { ...ENTRY, path: '.claude/../escape.md' },
      'not-an-entry',
    ],
  };
  assert.deepEqual(validateGenerationManifest(manifest), [
    'generated[0].path must be root-relative without ".." (got /abs/path)',
    'generated[0].templateVersion must be semver x.y.z (got v1)',
    'generated[0].sha256 must be a 64-char lowercase hex digest',
    'generated[1].path must be root-relative without ".." (got .claude/../escape.md)',
    'generated[2] must be an object',
  ]);
});

test('validateGenerationManifest: duplicate paths rejected', () => {
  assert.deepEqual(validateGenerationManifest({ schemaVersion: 1, generated: [ENTRY, { ...ENTRY }] }), [
    'generated: duplicate path ".claude/agents/api-engineer.md"',
  ]);
});

// ── D1: seeded maxi-repo tasks.md ───────────────────────────────────────────

test('D1: maxi-repo fixture tasks.md parses and validates with 3 scoped backlog items', () => {
  const text = readFileSync(join(import.meta.dirname, 'fixtures', 'maxi-repo', 'tasks.md'), 'utf8');
  const { doc, errors } = parseTasksMd(text);
  assert.deepEqual(errors, []);
  assert.deepEqual(validateTaskBacklog(doc), []);
  assert.deepEqual(doc.backlog.map((t) => t.scope.length), [1, 2, 3]);
});
