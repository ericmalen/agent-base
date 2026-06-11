import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderDecisionsMd } from '../scripts/lib/orchestration/render-decisions.mjs';
import { DECISION_ENUMS, validateDecisionsDoc } from '../scripts/lib/orchestration/schemas.mjs';

const FIXTURES = join(import.meta.dirname, 'fixtures', 'orchestration');
const loadFixture = (name) => JSON.parse(readFileSync(join(FIXTURES, name), 'utf8'));

test('renderDecisionsMd: maxi-repo decisions render matches committed golden byte-for-byte', () => {
  const golden = readFileSync(join(FIXTURES, 'maxi-repo.decisions.md'), 'utf8');
  assert.equal(renderDecisionsMd(loadFixture('maxi-repo.decisions.json')), golden);
});

test('renderDecisionsMd: deterministic — repeat runs and shuffled key order are byte-identical', () => {
  const doc = loadFixture('mini-repo.decisions.json');
  const shuffled = Object.fromEntries(Object.entries(doc).reverse());
  const first = renderDecisionsMd(doc);
  assert.equal(renderDecisionsMd(doc), first);
  assert.equal(renderDecisionsMd(shuffled), first);
});

test('renderDecisionsMd: covers every schema field', () => {
  const out = renderDecisionsMd(loadFixture('mini-repo.decisions.json'));
  const labels = [
    'TDD policy', 'Review gates', 'Security requirements',
    'QA depth', 'Definition of done', 'Human gate placement',
  ];
  assert.equal(labels.length, Object.keys(DECISION_ENUMS).length);
  for (const label of labels) assert.ok(out.includes(`| ${label} | `), `missing field row: ${label}`);
});

test('renderDecisionsMd: every enum value renders with a non-empty Meaning gloss', () => {
  const base = loadFixture('maxi-repo.decisions.json');
  for (const [field, values] of Object.entries(DECISION_ENUMS)) {
    for (const value of values) {
      const doc = { ...base, [field]: value };
      assert.deepEqual(validateDecisionsDoc(doc), []);
      const row = renderDecisionsMd(doc).split('\n').find((l) => l.includes(`\`${value}\``));
      assert.ok(row, `no row renders value ${value}`);
      const meaning = row.split('|')[3].trim();
      assert.ok(meaning.length > 0, `empty gloss for ${field}=${value}`);
    }
  }
});

test('renderDecisionsMd: rendered file carries the do-not-hand-edit notice', () => {
  assert.match(renderDecisionsMd(loadFixture('mini-repo.decisions.json')), /never edit this file by hand/);
});
