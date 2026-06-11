import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseTasksMd, renderTasksMd } from '../scripts/lib/orchestration/parse-tasks.mjs';
import { validateTaskBacklog } from '../scripts/lib/orchestration/schemas.mjs';

const FIXTURES = join(import.meta.dirname, 'fixtures', 'orchestration');
const loadText = (name) => readFileSync(join(FIXTURES, name), 'utf8');

// ── round-trip (A4 acceptance) ──────────────────────────────────────────────

test('parseTasksMd: canonical §9.2 example round-trips losslessly', () => {
  const text = loadText('tasks-canonical.md');
  const { doc, errors } = parseTasksMd(text);
  assert.deepEqual(errors, []);
  assert.equal(renderTasksMd(doc), text);
});

test('parseTasksMd: blocked-task fixture round-trips losslessly', () => {
  const text = loadText('tasks-blocked.md');
  const { doc, errors } = parseTasksMd(text);
  assert.deepEqual(errors, []);
  assert.equal(renderTasksMd(doc), text);
});

test('parseTasksMd: ref-carrying fixture round-trips losslessly (F3)', () => {
  const text = loadText('tasks-with-refs.md');
  const { doc, errors } = parseTasksMd(text);
  assert.deepEqual(errors, []);
  assert.equal(renderTasksMd(doc), text);
  assert.equal(doc.backlog[0].ref, 'AB#231');
  assert.equal(doc.backlog[1].ref, '#17');
  assert.equal(doc.inProgress[0].ref, 'AB#230');
  assert.equal(doc.done[0].ref, '#12');
});

test('parseTasksMd: parsed canonical example has expected structure', () => {
  const { doc } = parseTasksMd(loadText('tasks-canonical.md'));
  assert.deepEqual(doc.backlog, [{
    id: 'T-001',
    scope: ['api', 'db'],
    title: 'Add asset-tagging endpoint',
    owner: null,
    commit: null,
    ref: null,
    ac: [
      'POST /assets/:id/tags validates via shared Zod schema',
      'Prisma migration included; integration test passes',
    ],
    blocked: null,
  }]);
  assert.equal(doc.inProgress[0].owner, 'feature-orchestrator');
  assert.equal(doc.inProgress[0].title, 'Bilingual toggle on catalogue page');
  assert.equal(doc.done[0].commit, 'abc1234');
});

test('parseTasksMd: parsed fixtures pass validateTaskBacklog', () => {
  for (const name of ['tasks-canonical.md', 'tasks-blocked.md', 'tasks-with-refs.md']) {
    assert.deepEqual(validateTaskBacklog(parseTasksMd(loadText(name)).doc), []);
  }
});

test('parseTasksMd: duplicate ref line on one task reports', () => {
  const { errors } = parseTasksMd(
    '# Tasks\n\n## Backlog\n\n- [ ] T-001 | scope: api | Title\n  - ref: #1\n  - ref: #2\n\n## In Progress\n\n## Done\n',
  );
  assert.deepEqual(errors, ['line 7: task T-001 has more than one ref line']);
});

test('parseTasksMd: ref line after AC or blocked reports (canonical order)', () => {
  const { errors } = parseTasksMd(
    '# Tasks\n\n## Backlog\n\n- [ ] T-001 | scope: api | Title\n  - AC: something\n  - ref: #1\n\n## In Progress\n\n## Done\n',
  );
  assert.deepEqual(errors, ['line 7: task T-001 ref line must precede AC and blocked lines']);
});

test('parseTasksMd: ref line without a preceding task reports', () => {
  const { errors } = parseTasksMd('# Tasks\n\n## Backlog\n\n  - ref: #1\n\n## In Progress\n\n## Done\n');
  assert.deepEqual(errors, ['line 5: ref line without a preceding task']);
});

// ── parser strictness ───────────────────────────────────────────────────────

test('parseTasksMd: non-string input rejected', () => {
  assert.deepEqual(parseTasksMd(42), { doc: null, errors: ['tasks.md input must be a string'] });
});

test('parseTasksMd: checkbox must match its section', () => {
  const { doc, errors } = parseTasksMd(
    '# Tasks\n\n## Backlog\n\n- [x] T-001 | scope: api | Done box in backlog\n\n## In Progress\n\n## Done\n',
  );
  assert.equal(doc, null);
  assert.deepEqual(errors, ['line 5: checkbox "[x]" does not match section (expected "[ ]")']);
});

test('parseTasksMd: unrecognized line, orphan AC, missing sections all report', () => {
  const { errors } = parseTasksMd('# Tasks\n\n  - AC: floating\nfree prose\n\n## Backlog\n');
  assert.deepEqual(errors, [
    'line 3: AC line without a preceding task',
    'line 4: unrecognized line "free prose"',
    'missing canonical sections — Backlog, In Progress, Done must all be present',
  ]);
});

test('parseTasksMd: out-of-order headings report', () => {
  const { errors } = parseTasksMd('# Tasks\n\n## Done\n\n## Backlog\n\n## In Progress\n');
  assert.ok(errors.length > 0);
  assert.match(errors[0], /unexpected heading "## Done" — canonical order expects "## Backlog"/);
});

test('parseTasksMd: missing title line reports', () => {
  const { errors } = parseTasksMd('## Backlog\n\n## In Progress\n\n## Done\n');
  assert.deepEqual(errors, ['missing "# Tasks" title']);
});

test('renderTasksMd: empty sections render canonically and re-parse', () => {
  const empty = { backlog: [], inProgress: [], done: [] };
  const text = renderTasksMd(empty);
  const { doc, errors } = parseTasksMd(text);
  assert.deepEqual(errors, []);
  assert.deepEqual(doc, empty);
});

// ── validateTaskBacklog (A4) ────────────────────────────────────────────────

test('validateTaskBacklog: non-object inputs are rejected outright', () => {
  for (const input of [null, undefined, [], 'tasks', 42]) {
    assert.deepEqual(validateTaskBacklog(input), ['task backlog must be an object']);
  }
});

test('validateTaskBacklog: missing sections report', () => {
  assert.deepEqual(validateTaskBacklog({}), [
    'backlog must be an array',
    'inProgress must be an array',
    'done must be an array',
  ]);
});

test('validateTaskBacklog: bad task shape reports per field', () => {
  const doc = {
    backlog: [{ id: 'TASK-1', title: ' ', scope: [], ac: 'not-array' }],
    inProgress: ['not-a-task'],
    done: [],
  };
  assert.deepEqual(validateTaskBacklog(doc), [
    'backlog[0].id must match T-### (got TASK-1)',
    'backlog[0].title must be a non-empty string',
    'backlog[0].scope must be a non-empty array',
    'backlog[0].owner must be a string or null',
    'backlog[0].commit must be a string or null',
    'backlog[0].blocked must be a string or null',
    'backlog[0].ref must be a string or null',
    'backlog[0].ac must be an array',
    'inProgress[0] must be an object',
  ]);
});

test('validateTaskBacklog: duplicate ids and misplaced blocked line report', () => {
  const task = (id, extra = {}) => ({
    id, scope: ['api'], title: 't', owner: null, commit: null, ref: null, ac: [], blocked: null, ...extra,
  });
  const doc = {
    backlog: [task('T-001')],
    inProgress: [task('T-001'), task('T-002', { blocked: 'see log' })],
    done: [],
  };
  assert.deepEqual(validateTaskBacklog(doc), [
    'duplicate task id "T-001"',
    'inProgress[1] ("T-002") has a blocked line — blocked tasks belong in Backlog',
  ]);
});

test('validateTaskBacklog: ref format and cross-task duplicates report (F3)', () => {
  const task = (id, extra = {}) => ({
    id, scope: ['api'], title: 't', owner: null, commit: null, ref: null, ac: [], blocked: null, ...extra,
  });
  const doc = {
    backlog: [task('T-001', { ref: 'AB123' }), task('T-002', { ref: '#9' })],
    inProgress: [task('T-003', { ref: '#9' })],
    done: [task('T-004', { ref: 'owner/repo#12' })],
  };
  assert.deepEqual(validateTaskBacklog(doc), [
    'backlog[0].ref must look like AB#123, #45, or owner/repo#45 (got AB123)',
    'duplicate ref "#9" — one tracker item maps to one task',
  ]);
});
