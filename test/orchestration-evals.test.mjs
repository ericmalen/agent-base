import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const FIXTURES = join(import.meta.dirname, 'fixtures', 'orchestration');
const EVALS = join(FIXTURES, 'evals');

// E2 acceptance: every roster agent of the maxi synthesized blueprint has
// >= 2 goldens (and meets its own evalRequirements.minGoldens), and every
// golden parses to the eval-runner format — non-empty `task` string plus a
// non-empty `expectedProperties` checklist of non-empty strings.
const bp = JSON.parse(readFileSync(join(FIXTURES, 'maxi-repo.synthesized.blueprint.json'), 'utf8'));
const roster = [...bp.specialists, bp.orchestrator];

for (const agent of roster) {
  const dir = join(EVALS, agent.name);
  const quota = Math.max(2, agent.evalRequirements?.minGoldens ?? 0);

  test(`E2 quota: ${agent.name} has >= ${quota} goldens`, () => {
    assert.ok(existsSync(dir), `missing evals dir for ${agent.name}`);
    const goldens = readdirSync(dir).filter((f) => f.endsWith('.json'));
    assert.ok(goldens.length >= quota, `${agent.name}: ${goldens.length}/${quota} goldens`);
  });

  test(`E2 format: every ${agent.name} golden parses`, () => {
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const golden = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      assert.equal(typeof golden.task, 'string', `${file}: task must be a string`);
      assert.ok(golden.task.trim().length > 0, `${file}: task must be non-empty`);
      assert.ok(Array.isArray(golden.expectedProperties), `${file}: expectedProperties must be an array`);
      assert.ok(golden.expectedProperties.length > 0, `${file}: checklist must be non-empty`);
      for (const prop of golden.expectedProperties) {
        assert.equal(typeof prop, 'string', `${file}: every property must be a string`);
        assert.ok(prop.trim().length > 0, `${file}: empty property`);
      }
    }
  });
}

// No orphan golden dirs — every evals/<agent> dir maps to a roster agent,
// so renames in the blueprint can't silently strand fixtures.
test('E2 hygiene: every evals dir matches a roster agent', () => {
  const names = new Set(roster.map((a) => a.name));
  for (const dir of readdirSync(EVALS, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    assert.ok(names.has(dir.name), `evals/${dir.name} has no matching roster agent`);
  }
});
