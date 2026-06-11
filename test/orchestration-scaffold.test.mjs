import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

import { planGeneration, manifestFor } from '../scripts/lib/orchestration/scaffold.mjs';
import { validateGenerationManifest } from '../scripts/lib/orchestration/schemas.mjs';

const ROOT = join(import.meta.dirname, '..');
const FIXTURES = join(import.meta.dirname, 'fixtures', 'orchestration');
const loadFixture = (name) => JSON.parse(readFileSync(join(FIXTURES, name), 'utf8'));
const registry = JSON.parse(readFileSync(join(ROOT, 'templates', 'orchestration', 'template-registry.json'), 'utf8'));

const TEMPLATE_DIRS = {
  agent: (id) => join(ROOT, 'templates', 'orchestration', 'agents', `${id}.template.md`),
  skill: (id) => join(ROOT, 'templates', 'orchestration', 'skills', `${id}.template.md`),
  doc: (id) => join(ROOT, 'templates', 'orchestration', 'docs', `${id}.md`),
};
const readTemplate = (kind, id) => {
  const p = TEMPLATE_DIRS[kind](id);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
};

test('planGeneration: maxi synthesized blueprint plans the full asset set', () => {
  const { files, errors } = planGeneration(loadFixture('maxi-repo.synthesized.blueprint.json'), registry, readTemplate);
  assert.deepEqual(errors, []);
  const paths = files.map((f) => f.path);
  // 8 agents + 3 paired skills (ui/api/db engineers) + 3 docs
  assert.equal(files.length, 14);
  assert.ok(paths.includes('.claude/agents/feature-orchestrator.md'));
  assert.ok(paths.includes('.claude/skills/api-testing/SKILL.md'));
  assert.ok(paths.includes('docs/orchestration/dispatch-rules.md'));
  // generic-specialist (shared-engineer) pairs with no skills
  assert.ok(!paths.some((p) => p.includes('shared-engineer/SKILL')));
});

test('planGeneration: mini synthesized blueprint plans agents + docs, no paired skills for generic', () => {
  const { files, errors } = planGeneration(loadFixture('mini-repo.synthesized.blueprint.json'), registry, readTemplate);
  assert.deepEqual(errors, []);
  const skillPaths = files.filter((f) => f.path.startsWith('.claude/skills/'));
  assert.deepEqual(skillPaths, []); // generic-specialist + code-reviewer pair with nothing
});

test('planGeneration: deterministic — repeat runs produce deeply equal plans and manifests', () => {
  const bp = loadFixture('maxi-repo.synthesized.blueprint.json');
  const first = planGeneration(bp, registry, readTemplate);
  const second = planGeneration(bp, registry, readTemplate);
  assert.deepEqual(first, second);
  assert.deepEqual(manifestFor(first.files), manifestFor(second.files));
});

test('manifestFor: plan manifest validates and SHAs are content-derived', () => {
  const { files } = planGeneration(loadFixture('maxi-repo.synthesized.blueprint.json'), registry, readTemplate);
  const manifest = manifestFor(files);
  assert.deepEqual(validateGenerationManifest(manifest), []);
  assert.equal(manifest.generated.length, files.length);
  // a content change must change the SHA
  const tweaked = manifestFor([{ ...files[0], content: files[0].content + ' ' }]);
  assert.notEqual(tweaked.generated[0].sha256, manifest.generated[0].sha256);
});

test('planGeneration: unknown templateId and missing template fail all-or-nothing', () => {
  const bp = loadFixture('mini-repo.synthesized.blueprint.json');
  bp.specialists[0].templateId = 'nonexistent';
  const { files, errors } = planGeneration(bp, registry, readTemplate);
  assert.deepEqual(files, []);
  assert.deepEqual(errors, ['agent cli-engineer: templateId "nonexistent" not in registry']);
});

test('planGeneration: instantiation errors propagate with agent context', () => {
  const bp = loadFixture('mini-repo.synthesized.blueprint.json');
  delete bp.specialists[0].slots['test-cmd'];
  const { files, errors } = planGeneration(bp, registry, readTemplate);
  assert.deepEqual(files, []);
  assert.ok(errors.length > 0);
  assert.ok(errors.every((m) => m.startsWith('agent cli-engineer: unfilled slot "test-cmd"')));
});

test('planGeneration: unregistered doc in blueprint.docs fails', () => {
  const bp = loadFixture('mini-repo.synthesized.blueprint.json');
  bp.docs.push('docs/orchestration/made-up.md');
  const { files, errors } = planGeneration(bp, registry, readTemplate);
  assert.deepEqual(files, []);
  assert.deepEqual(errors, ['doc docs/orchestration/made-up.md: "made-up" not in registry']);
});

test('planGeneration: registry sha pin mismatch refuses to generate', () => {
  const bp = loadFixture('mini-repo.synthesized.blueprint.json');
  const tampered = (kind, id) => {
    const src = readTemplate(kind, id);
    return kind === 'agent' && id === 'generic-specialist' ? src + '\n<!-- drifted -->\n' : src;
  };
  const { files, errors } = planGeneration(bp, registry, tampered);
  assert.deepEqual(files, []);
  assert.deepEqual(errors, [
    'agent template generic-specialist: source drifted from registry pin — bump version and update sha256',
  ]);
});

test('planGeneration: duplicate-templateId specialists collide on skill paths, all-or-nothing', () => {
  const bp = loadFixture('maxi-repo.synthesized.blueprint.json');
  const clone = JSON.parse(JSON.stringify(bp.specialists.find((s) => s.templateId === 'api-engineer')));
  clone.name = 'api2-engineer';
  bp.specialists.push(clone);
  const { files, errors } = planGeneration(bp, registry, readTemplate);
  assert.deepEqual(files, []);
  assert.deepEqual(errors, ['duplicate generated path ".claude/skills/api-testing/SKILL.md" — two blueprint entries collide']);
});

test('registry pins: every sha256 matches its shipped file (edit a template → update the registry)', () => {
  const sha = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
  for (const [section, kind] of [['agents', 'agent'], ['skills', 'skill'], ['docs', 'doc']]) {
    for (const [id, meta] of Object.entries(registry[section])) {
      assert.equal(typeof meta.sha256, 'string', `${section}.${id} missing sha256 pin`);
      assert.match(meta.version, /^\d+\.\d+\.\d+$/, `${section}.${id} version must be semver`);
      assert.equal(sha(readTemplate(kind, id)), meta.sha256,
        `${section}.${id}: shipped file drifted from registry pin — bump version + re-pin sha256`);
    }
  }
});

test('validateGenerationManifest: unknown keys rejected at both levels (determinism guard)', () => {
  const entry = { path: 'x.md', templateId: 't', templateVersion: '1.0.0', sha256: 'a'.repeat(64) };
  assert.deepEqual(
    validateGenerationManifest({ schemaVersion: 1, generatedAt: 'now', generated: [{ ...entry, writtenAt: 1 }] }),
    [
      'unknown key "generatedAt" — the manifest is deterministic state, no extra fields',
      'generated[0]: unknown key "writtenAt"',
    ],
  );
});
