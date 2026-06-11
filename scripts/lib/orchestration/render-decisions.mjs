// render-decisions.mjs — decisions.json → decisions.md (A2, DD-2).
//
// The Markdown companion is RENDERED, never authored: same input →
// byte-identical output, so drift-checker (E3) can re-render and diff to
// catch hand edits. Precondition: the doc passed validateDecisionsDoc —
// the pipeline (B6) validates before writing; unknown values render with an
// empty Meaning cell rather than throwing.

import { DECISION_ENUMS } from './schemas.mjs';

const FIELD_LABELS = {
  tddPolicy: 'TDD policy',
  reviewGates: 'Review gates',
  securityRequirements: 'Security requirements',
  qaDepth: 'QA depth',
  definitionOfDone: 'Definition of done',
  humanGatePlacement: 'Human gate placement',
};

// One-line meaning per enum value — the human-facing half of the contract.
// Every value in DECISION_ENUMS must have a gloss (unit-tested).
const GLOSS = {
  tddPolicy: {
    'test-first': 'Write the failing test before the implementation.',
    'test-with-change': 'Tests land in the same change as the code they cover.',
    'optional': 'Tests are encouraged but not required per change.',
  },
  reviewGates: {
    'every-task': 'Code review before a task moves to Done.',
    'every-merge': 'Code review before anything merges.',
    'risk-based': 'Review required only for changes the orchestrator flags as risky.',
  },
  securityRequirements: {
    'review-all-changes': 'Security review on every change.',
    'review-sensitive-paths': 'Security review when auth, data, or dependency surfaces change.',
    'none': 'No dedicated security review step.',
  },
  qaDepth: {
    'unit-only': 'Unit tests only.',
    'unit-and-integration': 'Unit plus integration tests.',
    'full-pyramid': 'Unit, integration, and end-to-end tests.',
  },
  definitionOfDone: {
    'tests-pass': 'Done when acceptance criteria are met and tests pass.',
    'tests-and-review': 'Done when tests pass and review is approved.',
    'tests-review-docs': 'Done when tests pass, review is approved, and docs are updated.',
  },
  humanGatePlacement: {
    'pre-merge': 'A human approves before merge; agents never auto-merge.',
    'pre-dispatch-and-pre-merge': 'A human approves both task dispatch and merge.',
  },
};

export function renderDecisionsMd(doc) {
  const lines = [
    '# Orchestration decisions',
    '',
    'Rendered from `decisions.json` — never edit this file by hand; change the',
    'JSON and re-render.',
    '',
    '| Decision | Value | Meaning |',
    '| --- | --- | --- |',
  ];
  for (const field of Object.keys(DECISION_ENUMS)) {
    lines.push(`| ${FIELD_LABELS[field]} | \`${doc[field]}\` | ${GLOSS[field]?.[doc[field]] ?? ''} |`);
  }
  return lines.join('\n') + '\n';
}
