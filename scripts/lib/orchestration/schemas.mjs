// schemas.mjs — syntactic validators for orchestration artifacts (DD-2).
// Error-string-array style per scripts/lib/manifest.mjs validateShape:
// shapes only; semantic invariants (e.g. slot coverage against templates)
// live with the consuming skills and agents.
//
// Validators (one per artifact, all exported from this module — §9.1):
//   validateRepoProfile        — docs/orchestration/repo-profile.json (A1)
//   validateDecisionsDoc       — docs/orchestration/decisions.json (A2)
//   validateBlueprint          — docs/orchestration/blueprint.json (A3)
// Remaining two (task-backlog, handoff-log) land with A4/A5.

const REPO_TYPES = new Set(['monorepo', 'single-package']);
const PIPELINE_WHEN = new Set(['scheduled', 'multi_day']);   // §9.3 / DD-4
const SLOT_NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;             // kebab-case (DD-5)
// Logical tiers, not concrete model ids — ids churn with releases; the
// scaffolder (C4) owns the tier → concrete-model map.
const MODEL_TIERS = new Set(['haiku', 'sonnet', 'opus']);

const isNonEmptyString = (v) => typeof v === 'string' && v.trim() !== '';
const isStringOrNull = (v) => v === null || typeof v === 'string';
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function checkStringArray(arr, field, e) {
  if (!Array.isArray(arr)) {
    e(`${field} must be an array`);
    return;
  }
  arr.forEach((item, i) => {
    if (!isNonEmptyString(item)) e(`${field}[${i}] must be a non-empty string`);
  });
}

// ── repo-profile (A1) ───────────────────────────────────────────────────────

export function validateRepoProfile(profile) {
  if (!isPlainObject(profile)) return ['profile must be an object'];
  const errors = [];
  const e = (m) => errors.push(m);

  if (profile.schemaVersion !== 1) e(`schemaVersion must be 1 (got ${profile.schemaVersion})`);
  if (!isNonEmptyString(profile.name)) e('name must be a non-empty string');
  if (!REPO_TYPES.has(profile.type)) {
    e(`type must be one of ${[...REPO_TYPES].join(' | ')} (got ${profile.type})`);
  }

  if (!Array.isArray(profile.layers) || profile.layers.length === 0) {
    e('layers must be a non-empty array');
  } else {
    profile.layers.forEach((layer, i) => {
      const where = `layers[${i}]`;
      if (!isPlainObject(layer)) {
        e(`${where} must be an object`);
        return;
      }
      for (const field of ['name', 'path', 'stack']) {
        if (!isNonEmptyString(layer[field])) e(`${where}.${field} must be a non-empty string`);
      }
      // Commands must be present: a string when detected, explicit null when
      // not — discovery may not omit them silently (gaps[] is where absence
      // is reported as a finding).
      for (const field of ['testCmd', 'buildCmd']) {
        if (!isStringOrNull(layer[field])) {
          e(`${where}.${field} must be a string or null (null = not detected)`);
        }
      }
    });
  }

  if (!isNonEmptyString(profile.packageManager)) e('packageManager must be a non-empty string');
  if (!isStringOrNull(profile.ci)) e('ci must be a string or null (null = no CI detected)');

  if (!isPlainObject(profile.conventions)) {
    e('conventions must be an object');
  } else {
    for (const field of ['naming', 'branching', 'commitStyle']) {
      if (!isStringOrNull(profile.conventions[field])) {
        e(`conventions.${field} must be a string or null (null = not detected)`);
      }
    }
  }

  checkStringArray(profile.gaps, 'gaps', e);

  return errors;
}

// ── decisions-doc (A2) ──────────────────────────────────────────────────────

// Every decision field is a finite enum — the interview (B5/B6) maps answers
// onto these values; no free-text policy fields. Arrays (not Sets) so field
// and value order is stable for the renderer and error messages.
export const DECISION_ENUMS = {
  tddPolicy: ['test-first', 'test-with-change', 'optional'],
  reviewGates: ['every-task', 'every-merge', 'risk-based'],
  securityRequirements: ['review-all-changes', 'review-sensitive-paths', 'none'],
  qaDepth: ['unit-only', 'unit-and-integration', 'full-pyramid'],
  definitionOfDone: ['tests-pass', 'tests-and-review', 'tests-review-docs'],
  humanGatePlacement: ['pre-merge', 'pre-dispatch-and-pre-merge'],
};

export function validateDecisionsDoc(doc) {
  if (!isPlainObject(doc)) return ['decisions must be an object'];
  const errors = [];
  const e = (m) => errors.push(m);

  if (doc.schemaVersion !== 1) e(`schemaVersion must be 1 (got ${doc.schemaVersion})`);
  for (const [field, values] of Object.entries(DECISION_ENUMS)) {
    if (!values.includes(doc[field])) {
      e(`${field} must be one of ${values.join(' | ')} (got ${doc[field]})`);
    }
  }

  return errors;
}

// ── orchestration-blueprint (A3) ────────────────────────────────────────────

// Shared shape for the orchestrator config and each specialist entry.
// Slot-coverage against actual templates is C1 lint / B7 handoff-validator
// territory, not here.
function checkAgentConfig(agent, where, e) {
  if (!isPlainObject(agent)) {
    e(`${where} must be an object`);
    return;
  }
  if (!isNonEmptyString(agent.name)) e(`${where}.name must be a non-empty string`);
  if (!isNonEmptyString(agent.templateId)) e(`${where}.templateId must be a non-empty string`);
  // Version pins live in the generation manifest, never in the blueprint —
  // deliberate tripwire, not generic unknown-key rejection (DD-13).
  if ('templateVersion' in agent) {
    e(`${where}.templateVersion is not allowed — version pins live in the generation manifest (DD-13)`);
  }
  if (!isPlainObject(agent.slots)) {
    e(`${where}.slots must be an object`);
  } else {
    for (const [key, value] of Object.entries(agent.slots)) {
      if (!SLOT_NAME_RE.test(key)) e(`${where}.slots: slot name "${key}" must be kebab-case (DD-5)`);
      if (!isNonEmptyString(value)) e(`${where}.slots["${key}"] must be a non-empty string`);
    }
  }
  if (!MODEL_TIERS.has(agent.modelTier)) {
    e(`${where}.modelTier must be one of ${[...MODEL_TIERS].join(' | ')} (got ${agent.modelTier})`);
  }
  if (!Number.isInteger(agent.turnLimit) || agent.turnLimit < 1) {
    e(`${where}.turnLimit must be a positive integer`);
  }
  if (!Array.isArray(agent.tools) || agent.tools.length === 0) {
    e(`${where}.tools must be a non-empty array`);
  } else {
    agent.tools.forEach((tool, i) => {
      if (!isNonEmptyString(tool)) e(`${where}.tools[${i}] must be a non-empty string`);
    });
  }
  if (!isPlainObject(agent.evalRequirements)
      || !Number.isInteger(agent.evalRequirements.minGoldens)
      || agent.evalRequirements.minGoldens < 1) {
    e(`${where}.evalRequirements.minGoldens must be a positive integer`);
  }
}

export function validateBlueprint(blueprint) {
  if (!isPlainObject(blueprint)) return ['blueprint must be an object'];
  const errors = [];
  const e = (m) => errors.push(m);

  if (blueprint.schemaVersion !== 1) e(`schemaVersion must be 1 (got ${blueprint.schemaVersion})`);

  if (!Array.isArray(blueprint.specialists) || blueprint.specialists.length === 0) {
    e('specialists must be a non-empty array');
  } else {
    blueprint.specialists.forEach((s, i) => checkAgentConfig(s, `specialists[${i}]`, e));
    const seen = new Set();
    for (const s of blueprint.specialists) {
      if (!isPlainObject(s) || !isNonEmptyString(s.name)) continue;
      if (seen.has(s.name)) e(`specialists: duplicate name "${s.name}"`);
      seen.add(s.name);
    }
  }

  checkAgentConfig(blueprint.orchestrator, 'orchestrator', e);

  // Key names verbatim from §9.3 — the one snake_case island in the kit.
  const dr = blueprint.dispatch_rules;
  if (!isPlainObject(dr)) {
    e('dispatch_rules must be an object');
  } else {
    for (const field of ['subagent_max_scopes', 'agent_team_min_scopes']) {
      if (!Number.isInteger(dr[field]) || dr[field] < 1) {
        e(`dispatch_rules.${field} must be a positive integer`);
      }
    }
    if (typeof dr.agent_team_on_cross_repo !== 'boolean') {
      e('dispatch_rules.agent_team_on_cross_repo must be a boolean');
    }
    if (!Array.isArray(dr.pipeline_when)) {
      e('dispatch_rules.pipeline_when must be an array');
    } else {
      dr.pipeline_when.forEach((v, i) => {
        if (!PIPELINE_WHEN.has(v)) {
          e(`dispatch_rules.pipeline_when[${i}] must be one of scheduled | multi_day (got ${v})`);
        }
      });
    }
  }

  checkStringArray(blueprint.docs, 'docs', e);

  return errors;
}
