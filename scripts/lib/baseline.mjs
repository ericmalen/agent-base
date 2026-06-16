// baseline.mjs — paths copied into every set-up project (shared by install-setup
// and sync-baseline). Setup-window tooling is install-only, never synced.

/**
 * Optional skill tier — opt-in lifecycle skills, NOT installed by default.
 * Selected at setup time (base-plan/base-apply), post-install via
 * `agent-base skills add`, or auto-installed by base-orchestrate. Tracked per
 * project in the marker's `optionalSkills`; sync-baseline upgrades only the
 * ones a project selected. Sources stay dual-role in `.claude/skills/` (still
 * dogfooded here); they ride into the setup window via SETUP_WINDOW_COPIES so
 * base-apply can copy selected ones, but never enter BASELINE_COPIES.
 * @type {{name: string, src: string, dst: string}[]}
 */
export const OPTIONAL_SKILLS = [
  { name: 'retro', src: '.claude/skills/retro', dst: '.claude/skills/retro' },
  { name: 'log-report', src: '.claude/skills/log-report', dst: '.claude/skills/log-report' },
  { name: 'eval-runner', src: '.claude/skills/eval-runner', dst: '.claude/skills/eval-runner' },
  { name: 'tracker-sync', src: '.claude/skills/tracker-sync', dst: '.claude/skills/tracker-sync' },
];

export const OPTIONAL_NAMES = OPTIONAL_SKILLS.map((s) => s.name);

/** Staging dst for an optional skill inside the setup window (base-apply source). */
export const optionalStagingDst = (name) => `.claude/agent-base-setup/optional-skills/${name}`;

export const optionalByName = (name) => OPTIONAL_SKILLS.find((s) => s.name === name);

/** Project-relative live dst paths for a selected optional set. */
export const optionalProjectPaths = (selected) =>
  OPTIONAL_SKILLS.filter((s) => selected.includes(s.name)).map((s) => s.dst);

/** @type {[srcRel, dstRel][]} Agent Base-root-relative → project-relative */
export const SETUP_WINDOW_COPIES = [
  ['scripts/inventory-extract.mjs', '.claude/agent-base-setup/scripts/inventory-extract.mjs'],
  ['scripts/apply.mjs', '.claude/agent-base-setup/scripts/apply.mjs'],
  ['scripts/check.mjs', '.claude/agent-base-setup/scripts/check.mjs'],
  ['scripts/report.mjs', '.claude/agent-base-setup/scripts/report.mjs'],
  ['scripts/audit.mjs', '.claude/agent-base-setup/scripts/audit.mjs'],
  ['scripts/lib', '.claude/agent-base-setup/scripts/lib'],
  ['templates', '.claude/agent-base-setup/templates'],
  ['.claude/skills/base-inventory', '.claude/skills/base-inventory'],
  ['.claude/skills/base-plan', '.claude/skills/base-plan'],
  ['.claude/skills/base-apply', '.claude/skills/base-apply'],
  ['.claude/skills/base-verify', '.claude/skills/base-verify'],
  ['.claude/agents/setup-verifier.md', '.claude/agents/setup-verifier.md'],
  // Optional skills staged into the setup window (not their live path) so
  // base-apply can copy the ones selected during planning. Removed post-merge.
  ...OPTIONAL_SKILLS.map((s) => [s.src, optionalStagingDst(s.name)]),
];

/** Permanent baseline — kept after setup merge; sync-baseline upgrades these. */
export const BASELINE_COPIES = [
  ['.claude/skills/base-check', '.claude/skills/base-check'],
  ['.claude/skills/docs', '.claude/skills/docs'],
  ['.claude/skills/git-conventions', '.claude/skills/git-conventions'],
  ['.claude/skills/skill-creator', '.claude/skills/skill-creator'],
  ['.claude/skills/agent-creator', '.claude/skills/agent-creator'],
  ['.claude/agents/docs-auditor.md', '.claude/agents/docs-auditor.md'],
];

export const ALL_INSTALL_COPIES = [...SETUP_WINDOW_COPIES, ...BASELINE_COPIES];

/** Project-relative paths touched by sync-baseline (for conflict reports). */
export const BASELINE_PROJECT_PATHS = BASELINE_COPIES.map(([, dst]) => dst);
