import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  validateRepoProfile,
  validateDecisionsDoc,
  validateBlueprint,
  DECISION_ENUMS,
} from '../scripts/lib/orchestration/schemas.mjs';

const FIXTURES = join(import.meta.dirname, 'fixtures', 'orchestration');
const loadFixture = (name) => JSON.parse(readFileSync(join(FIXTURES, name), 'utf8'));

// ── validateRepoProfile (A1) ────────────────────────────────────────────────

test('validateRepoProfile: maxi-repo profile fixture validates clean', () => {
  assert.deepEqual(validateRepoProfile(loadFixture('maxi-repo.profile.json')), []);
});

test('validateRepoProfile: mini-repo profile fixture validates clean', () => {
  assert.deepEqual(validateRepoProfile(loadFixture('mini-repo.profile.json')), []);
});

test('validateRepoProfile: non-object inputs are rejected outright', () => {
  for (const input of [null, undefined, [], 'profile', 42]) {
    assert.deepEqual(validateRepoProfile(input), ['profile must be an object']);
  }
});

test('validateRepoProfile: malformed fixture — wrong schemaVersion, empty layers', () => {
  assert.deepEqual(validateRepoProfile(loadFixture('profile-malformed-empty-layers.json')), [
    'schemaVersion must be 1 (got 2)',
    'layers must be a non-empty array',
  ]);
});

test('validateRepoProfile: malformed fixture — bad type enum, empty packageManager, non-string ci', () => {
  assert.deepEqual(validateRepoProfile(loadFixture('profile-malformed-bad-enums.json')), [
    'type must be one of monorepo | single-package (got hybrid)',
    'packageManager must be a non-empty string',
    'ci must be a string or null (null = no CI detected)',
  ]);
});

test('validateRepoProfile: malformed fixture — broken layer entries, conventions, gaps', () => {
  assert.deepEqual(validateRepoProfile(loadFixture('profile-malformed-bad-layer.json')), [
    'layers[0].stack must be a non-empty string',
    'layers[0].testCmd must be a string or null (null = not detected)',
    'layers[1] must be an object',
    'conventions.commitStyle must be a string or null (null = not detected)',
    'gaps[1] must be a non-empty string',
  ]);
});

test('validateRepoProfile: commands must be string or null, never omitted or mistyped', () => {
  const profile = loadFixture('mini-repo.profile.json');
  delete profile.layers[0].testCmd;       // omitted
  profile.layers[0].buildCmd = false;     // mistyped
  assert.deepEqual(validateRepoProfile(profile), [
    'layers[0].testCmd must be a string or null (null = not detected)',
    'layers[0].buildCmd must be a string or null (null = not detected)',
  ]);
});

test('validateRepoProfile: missing top-level fields all report', () => {
  assert.deepEqual(validateRepoProfile({}), [
    'schemaVersion must be 1 (got undefined)',
    'name must be a non-empty string',
    'type must be one of monorepo | single-package (got undefined)',
    'layers must be a non-empty array',
    'packageManager must be a non-empty string',
    'ci must be a string or null (null = no CI detected)',
    'conventions must be an object',
    'gaps must be an array',
  ]);
});

// ── validateDecisionsDoc (A2) ───────────────────────────────────────────────

test('validateDecisionsDoc: maxi-repo decisions fixture validates clean', () => {
  assert.deepEqual(validateDecisionsDoc(loadFixture('maxi-repo.decisions.json')), []);
});

test('validateDecisionsDoc: mini-repo decisions fixture validates clean', () => {
  assert.deepEqual(validateDecisionsDoc(loadFixture('mini-repo.decisions.json')), []);
});

test('validateDecisionsDoc: non-object inputs are rejected outright', () => {
  for (const input of [null, undefined, [], 'decisions', 42]) {
    assert.deepEqual(validateDecisionsDoc(input), ['decisions must be an object']);
  }
});

test('validateDecisionsDoc: every enum value of every field validates', () => {
  for (const [field, values] of Object.entries(DECISION_ENUMS)) {
    for (const value of values) {
      const doc = { ...loadFixture('maxi-repo.decisions.json'), [field]: value };
      assert.deepEqual(validateDecisionsDoc(doc), []);
    }
  }
});

test('validateDecisionsDoc: malformed fixture — wrong schemaVersion, missing field', () => {
  assert.deepEqual(validateDecisionsDoc(loadFixture('decisions-malformed-bad-version.json')), [
    'schemaVersion must be 1 (got 2)',
    'humanGatePlacement must be one of pre-merge | pre-dispatch-and-pre-merge (got undefined)',
  ]);
});

test('validateDecisionsDoc: malformed fixture — out-of-enum values', () => {
  assert.deepEqual(validateDecisionsDoc(loadFixture('decisions-malformed-bad-enums.json')), [
    'tddPolicy must be one of test-first | test-with-change | optional (got tdd)',
    'reviewGates must be one of every-task | every-merge | risk-based (got always)',
    'qaDepth must be one of unit-only | unit-and-integration | full-pyramid (got e2e)',
  ]);
});

test('validateDecisionsDoc: malformed fixture — wrong types', () => {
  assert.deepEqual(validateDecisionsDoc(loadFixture('decisions-malformed-bad-types.json')), [
    'tddPolicy must be one of test-first | test-with-change | optional (got true)',
    'reviewGates must be one of every-task | every-merge | risk-based (got every-merge)',
    'qaDepth must be one of unit-only | unit-and-integration | full-pyramid (got 3)',
    'humanGatePlacement must be one of pre-merge | pre-dispatch-and-pre-merge (got null)',
  ]);
});

test('validateDecisionsDoc: missing top-level fields all report', () => {
  const errors = validateDecisionsDoc({});
  assert.equal(errors.length, 1 + Object.keys(DECISION_ENUMS).length);
  assert.equal(errors[0], 'schemaVersion must be 1 (got undefined)');
});

// ── validateBlueprint (A3) ──────────────────────────────────────────────────

test('validateBlueprint: maxi-repo blueprint fixture validates clean', () => {
  assert.deepEqual(validateBlueprint(loadFixture('maxi-repo.blueprint.json')), []);
});

test('validateBlueprint: non-object inputs are rejected outright', () => {
  for (const input of [null, undefined, [], 'blueprint', 42]) {
    assert.deepEqual(validateBlueprint(input), ['blueprint must be an object']);
  }
});

test('validateBlueprint: malformed fixture — wrong schemaVersion type, everything missing', () => {
  assert.deepEqual(validateBlueprint(loadFixture('blueprint-malformed-empty.json')), [
    'schemaVersion must be 1 (got 1)',
    'specialists must be a non-empty array',
    'orchestrator must be an object',
    'dispatch_rules must be an object',
    'docs must be an array',
  ]);
});

test('validateBlueprint: malformed fixture — broken specialist entry and duplicate name', () => {
  assert.deepEqual(validateBlueprint(loadFixture('blueprint-malformed-bad-specialist.json')), [
    'specialists[0].templateId must be a non-empty string',
    'specialists[0].slots: slot name "LayerPath" must be kebab-case (DD-5)',
    'specialists[0].slots["test-cmd"] must be a non-empty string',
    'specialists[0].turnLimit must be a positive integer',
    'specialists[0].tools must be a non-empty array',
    'specialists[0].evalRequirements.minGoldens must be a positive integer',
    'specialists: duplicate name "api-engineer"',
  ]);
});

test('validateBlueprint: malformed fixture — version pin tripwire, bad dispatch_rules, bad docs', () => {
  assert.deepEqual(validateBlueprint(loadFixture('blueprint-malformed-bad-dispatch.json')), [
    'specialists[0].templateVersion is not allowed — version pins live in the generation manifest (DD-13)',
    'orchestrator.evalRequirements.minGoldens must be a positive integer',
    'dispatch_rules.subagent_max_scopes must be a positive integer',
    'dispatch_rules.agent_team_on_cross_repo must be a boolean',
    'dispatch_rules.pipeline_when[0] must be one of scheduled | multi_day (got nightly)',
    'docs must be an array',
  ]);
});

test('validateBlueprint: missing top-level fields all report', () => {
  assert.deepEqual(validateBlueprint({}), [
    'schemaVersion must be 1 (got undefined)',
    'specialists must be a non-empty array',
    'orchestrator must be an object',
    'dispatch_rules must be an object',
    'docs must be an array',
  ]);
});

test('validateBlueprint: modelTier must be a logical tier, not a concrete model id', () => {
  const blueprint = loadFixture('maxi-repo.blueprint.json');
  blueprint.specialists[0].modelTier = 'opus-4';   // model id, not a tier
  blueprint.orchestrator.modelTier = 'sonet';      // typo
  assert.deepEqual(validateBlueprint(blueprint), [
    'specialists[0].modelTier must be one of haiku | sonnet | opus (got opus-4)',
    'orchestrator.modelTier must be one of haiku | sonnet | opus (got sonet)',
  ]);
});

test('validateBlueprint: non-object specialist and non-string tool entries report by index', () => {
  const blueprint = loadFixture('maxi-repo.blueprint.json');
  blueprint.specialists.push('qa-agent');
  blueprint.orchestrator.tools = ['Read', '', 'Agent'];
  assert.deepEqual(validateBlueprint(blueprint), [
    'specialists[4] must be an object',
    'orchestrator.tools[1] must be a non-empty string',
  ]);
});
