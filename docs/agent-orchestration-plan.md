# Orchestration Kit — Complete Build Plan

Repo-agnostic agent/skill orchestration system, built and distributed through `agent-scaffold`.
First target: AI Portal monorepo (ui / api / db / shared). All decisions below are final for v1; deviations require editing this doc first (single source of truth).

---

## 1. Locked design decisions

| #     | Decision                                                                                                                                                                                                | Rationale                                                                                                              |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| DD-1  | Semantic work happens **only** in Discovery (Layer 1) and Execution (Layer 3). Generation (Layer 2) is **deterministic template instantiation** — slot-filling from blueprint values, no LLM authoring. | Preserves deterministic/semantic boundary; outputs are reproducible and SHA-trackable by the existing manifest system. |
| DD-2  | All structured artifacts are **JSON validated by Zod schemas**; human-facing companions are Markdown **rendered deterministically from the JSON** — never authored in parallel.                         | Matches AI Portal stack; one validation mechanism everywhere; single source of truth per artifact.                     |
| DD-3  | Work intake is a **`tasks.md` backlog file** in the target repo (spec in §9.2). No external tracker in v1; ADO work-item sync is Phase F.                                                               | Versioned with code, zero new tooling, agent-readable.                                                                 |
| DD-4  | Dispatch rule (encoded in blueprint, spec in §9.3): 1–2 layers touched → in-session subagents; 3+ layers or cross-repo → agent team; multi-day/scheduled → headless pipeline (Phase F only).            | Encodes the tiering decision instead of per-session judgment.                                                          |
| DD-5  | Template slot syntax is `{{slot_name}}` (double braces, snake_case). Unfilled slots fail instantiation — never ship a template literal.                                                                 | Deterministic, grep-able, trivially testable.                                                                          |
| DD-6  | Generated assets land in `.claude/agents/`, `.claude/skills/` with Copilot mirrors under `.github/` produced by the same instantiation pass (existing dual-target wiring).                              | Reuses scaffold wiring; one blueprint, two targets.                                                                    |
| DD-7  | Discovery outputs live in target repo at `docs/orchestration/` (`repo-profile.json`, `decisions.json` + rendered `decisions.md`, `blueprint.json`).                                                     | Docs serve human and agent audiences; lazy-loaded via `## Documents` sections.                                         |
| DD-8  | Flat orchestration only: feature-orchestrator calls all specialists directly. No nested subagents.                                                                                                      | Copilot constraint; keep Claude Code identical for parity.                                                             |
| DD-9  | Tests: Node built-in test runner, pure functions only (schema validation, slot-filling, renderers, parsers). Agent behavior is checked by evals, not unit tests.                                        | Matches agent-scaffold v1 testing scope.                                                                               |
| DD-10 | Every shipped bug or substantive review finding becomes a checklist item via the `retro` skill (§7, Phase E). No exceptions.                                                                            | The compounding quality loop; the kit's long-term asset.                                                               |
| DD-11 | **Only the orchestrator writes `tasks.md`.** Specialists report results exclusively via handoff log; the orchestrator applies status changes.                                                           | Prevents write contention when agent teams run multiple concurrent sessions (Phase D).                                 |
| DD-12 | Repo-agnosticism is enforced from Phase B onward: every discovery-pipeline acceptance runs against **both** AI Portal and the mini-repo fixture (§9.5).                                                 | Prevents overfitting discovery skills to a 4-layer monorepo; keeps the core portability claim honest before Phase F.   |

---

## 2. Asset inventory (end state)

**Meta-kit (lives in agent-scaffold repo, distributed via manifest):**

- Schemas (5): `repo-profile`, `decisions-doc`, `orchestration-blueprint`, `task-backlog`, `handoff-log`
- Pure functions (alongside schemas): `parseTasksMd`, `renderDecisionsMd`, `instantiate` (slot substitution)
- Meta-agents (5): `repo-analyst`, `requirements-interviewer`, `plan-synthesizer`, `scaffolder`, `evaluator`
- Meta-skills (12): `structure-detector`, `dependency-mapper`, `convention-detector`, `interview-guide`, `blueprint-generator`, `handoff-validator`, `agent-instantiator`, `skill-instantiator`, `eval-runner`, `drift-checker`, `retro`, `log-report`
- Templates: 1 orchestrator template, 6 specialist templates (`ui-engineer`, `api-engineer`, `db-engineer`, `code-reviewer`, `qa-agent`, `security-reviewer`), 1 generic specialist template (fallback for repo shapes the six don't cover), skill templates per specialist
- Docs: `dispatch-rules.md`, `tasks-format.md`, `handoff-logging.md`, `triage-rules.md` (ship iff referenced)
- Fixtures: `fixtures/mini-repo` (tiny single-package repo for repo-agnosticism testing, §9.5)

**Generated per target repo (not shipped):**

- `feature-orchestrator` + specialists per blueprint
- `tasks.md`, `docs/orchestration/*`, `checklists/review-checklist.md`, `evals/<agent>/`

---

## 3. Repo layout (agent-scaffold repo additions)

```
agent-scaffold/
├── schemas/                  # Zod, single types.ts export
│   ├── repo-profile.ts
│   ├── decisions-doc.ts
│   ├── orchestration-blueprint.ts
│   ├── task-backlog.ts
│   ├── handoff-log.ts
│   └── types.ts
├── src/
│   ├── instantiate.ts        # slot substitution (pure)
│   ├── render-decisions.ts   # decisions.json → decisions.md (pure)
│   └── parse-tasks.ts        # tasks.md parser (pure)
├── templates/
│   ├── agents/               # *.template.md with {{slots}}
│   └── skills/
├── content/                  # meta-agents + meta-skills (manifest-tracked)
│   ├── agents/
│   └── skills/
├── fixtures/
│   └── mini-repo/            # single-package fixture (§9.5)
├── docs/
│   ├── dispatch-rules.md
│   ├── tasks-format.md
│   ├── handoff-logging.md
│   └── triage-rules.md
└── test/                     # Node test runner: schemas, instantiator, renderer, parsers
```

---

## Phase A — Contracts

**Goal:** every downstream layer compiles against these. Nothing else starts until A is done.

| Step | Work                                                                                                                                                                                                                                                                                                                    | Deliverable                                                    | Acceptance                                                                                                             |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| A1   | Write `repo-profile` schema: repo name, type (mono/multi), layers[] (name, path, stack, test cmd, build cmd), package manager, CI system, conventions (naming, branching, commit style), detected gaps[]                                                                                                                | `schemas/repo-profile.ts` + unit tests                         | Validates hand-written AI Portal **and** mini-repo profile fixtures; rejects 3 malformed fixtures                      |
| A2   | Write `decisions-doc` schema: TDD policy, review gates, security requirements, QA depth, definition-of-done, human-gate placement, each field with finite enum values. Includes `renderDecisionsMd` pure function: `decisions.json` → `decisions.md` (DD-2)                                                             | `schemas/decisions-doc.ts` + `src/render-decisions.ts` + tests | Fixture validation as A1; renderer is deterministic (same input → byte-identical output) and covers every schema field |
| A3   | Write `orchestration-blueprint` schema: specialists[] (name, template id, **pinned template version**, slot values, model tier, turn limit, tools[]), orchestrator config, **dispatch_rules** (DD-4 thresholds as data), docs to reference, eval requirements per agent                                                 | `schemas/orchestration-blueprint.ts` + tests                   | Validates a hand-written blueprint fixture; rejects 3 malformed fixtures (full-instantiation check lives in C3/C4)     |
| A4   | Write `task-backlog` schema + `docs/tasks-format.md` per §9.2                                                                                                                                                                                                                                                           | Schema + doc + parser (`parseTasksMd`) with tests              | Parser round-trips the §9.2 example losslessly                                                                         |
| A5   | Write `handoff-log` schema: timestamp, from-agent, to-agent, task id, artifacts[], decision summary, duration_ms, status (success \| failed \| blocked), failure_reason, retry_count. **`model`, `turns_used`, `turn_limit` are optional** until capture is verified per runtime (see D7); required-ness revisited then | `schemas/handoff-log.ts` + tests                               | Fixture validation incl. a failed-dispatch fixture and a fixture omitting the optional fields                          |
| A6   | Write `docs/dispatch-rules.md` (DD-4, expanded with examples from AI Portal layers)                                                                                                                                                                                                                                     | Doc                                                            | Reviewed; referenced by orchestrator template                                                                          |

**Phase A done when:** all 5 schemas export from `types.ts`, all pure functions tested green, both docs written.

---

## Phase B — Discovery pipeline

**Goal:** point the kit at any repo, get a validated blueprint out. Semantic work lives here.

Per DD-12, every acceptance below runs against **two targets**: AI Portal and `fixtures/mini-repo`.

| Step | Work                                                                                                                                                                                                          | Deliverable                   | Acceptance                                                                                                                             |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| B0   | Create `fixtures/mini-repo`: tiny single-package Node CLI with one test, one lint config, deliberately different conventions from AI Portal (§9.5)                                                            | Fixture repo                  | Builds, tests pass, committed to agent-scaffold repo                                                                                   |
| B1   | `structure-detector` skill: walk repo, identify layers/packages, stacks, test/build commands                                                                                                                  | Skill md (lazy-load doc refs) | AI Portal: detects ui/api/db/shared with correct stacks. Mini-repo: detects single package correctly                                   |
| B2   | `dependency-mapper` skill: internal package deps, key external deps per layer                                                                                                                                 | Skill md                      | AI Portal: maps shared→api/ui, Prisma→db correctly. Mini-repo: reports no internal deps without erroring                               |
| B3   | `convention-detector` skill: naming, branch, commit, lint/format config                                                                                                                                       | Skill md                      | Detects existing conventions and lists gaps on both targets; outputs differ where the fixtures differ                                  |
| B4   | `repo-analyst` agent: runs B1–B3, emits `docs/orchestration/repo-profile.json`, validates against schema before writing                                                                                       | Agent md                      | Both targets produce profiles passing A1 schema with zero manual fixes                                                                 |
| B5   | `interview-guide` skill: question bank keyed to profile gaps (TDD? gates? security posture? QA depth?). Every question maps to a `decisions-doc` field; no open-ended questions without a target field        | Skill md                      | Every decisions-doc field is reachable by at least one question                                                                        |
| B6   | `requirements-interviewer` agent: loads profile, asks only gap-driven questions, emits **`decisions.json` only** (canonical); `decisions.md` is produced by `renderDecisionsMd` (A2), never authored directly | Agent md                      | AI Portal run produces schema-valid decisions doc in one session; rendered .md matches renderer output byte-for-byte                   |
| B7   | `blueprint-generator` skill + `handoff-validator` skill (checks blueprint completeness: every specialist has all slots filled, dispatch rules present, eval requirements set)                                 | 2 skill mds                   | Validator rejects a blueprint with one missing slot                                                                                    |
| B8   | `plan-synthesizer` agent: profile + decisions → `blueprint.json`, runs handoff-validator before writing                                                                                                       | Agent md                      | AI Portal blueprint validates and names ≥4 specialists. Mini-repo blueprint validates and selects the generic specialist template (≥1) |

**Phase B done when:** full pipeline runs end-to-end on both targets and both blueprints pass A3 + B7 validation untouched.

---

## Phase C — Deterministic generation

**Goal:** blueprint in, working agent/skill files out, reproducibly. Zero LLM authoring (DD-1).

| Step | Work                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Deliverable                           | Acceptance                                                                                                                                               |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1   | Author templates: orchestrator + 6 specialists + generic fallback, each with `{{slots}}` for: repo paths, stack names, test commands, conventions, doc references, model tier, turn limit                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `templates/agents/*.template.md`      | Slot lint: every `{{slot}}` appears in blueprint schema; no orphan slots                                                                                 |
| C2   | Author skill templates per specialist (e.g., `api-testing`, `ui-component-pattern`) with same slot rules                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `templates/skills/*.template.md`      | Same slot lint                                                                                                                                           |
| C3   | `agent-instantiator` + `skill-instantiator` skills: pure slot substitution functions (TS, unit-tested) wrapped as skills; fail hard on unfilled slot (DD-5)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Skills + `src/instantiate.ts` + tests | Same blueprint → byte-identical output on repeat runs. **The A3 blueprint fixture and both Phase B blueprints fully instantiate with zero manual edits** |
| C4   | `scaffolder` agent: reads blueprint, calls instantiators, writes `.claude/` + `.github/` mirrors (DD-6), registers outputs in scaffold manifest with SHAs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Agent md                              | Generated files appear in `agent-scaffold status`; drift detection works on them                                                                         |
| C5   | Wire `agent-scaffold update`: when a template changes upstream, re-instantiation against stored blueprint produces the updated asset; sidecar conflict approach applies if user edited the generated file. Update bumps the pinned template version in the blueprint (distinguishes "template improved" from "incompatible change" — major version bump requires explicit confirmation). **The blueprint is therefore partially machine-managed: version pins are owned by the CLI, all other fields by Discovery — documented in `docs/orchestration/` README.** Rollback = git revert of generated files; state this explicitly in generated orchestrator docs | CLI integration + tests               | Template edit → update → regenerated file with version bump; user-edited file → sidecar                                                                  |

**Phase C done when:** AI Portal's blueprint instantiates a complete agent set, manifest-tracked, reproducible, updateable.

---

## Phase D — Execution loop

**Goal:** work flows from `tasks.md` through generated agents to merged commits.

| Step | Work                                                                                                                                                                                                                                                                                                                                                                                                                                 | Deliverable                     | Acceptance                                                                                                                   |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| D1   | Create `tasks.md` in AI Portal per §9.2; seed with 3 real backlog items of varying scope (1-layer, 2-layer, 3+-layer)                                                                                                                                                                                                                                                                                                                | File                            | Parses via A4 parser                                                                                                         |
| D2   | Orchestrator template (from C1) includes: read `tasks.md` → pick next Backlog item → apply dispatch rules → execute → update task status → **commit after every unit of work** → append handoff log. **Failure protocol:** on specialist failure, max 1 retry; on second failure the task returns to Backlog with an indented `blocked:` line referencing the handoff-log entry. Never silent retry loops. Write ownership per DD-11 | Behavior encoded in template    | 1-layer task completes end-to-end with status updates and commits; forced-failure test produces a `blocked:` Backlog entry   |
| D3   | Run the 2-layer task: orchestrator dispatches 2 specialists in-session (subagent path)                                                                                                                                                                                                                                                                                                                                               | Session run                     | Both layers changed, reviewer ran, task moved to Done                                                                        |
| D4   | Run the 3+-layer task via **Claude Code agent teams**: orchestrator session + per-layer sessions coordinating on shared task list. Only the orchestrator session writes `tasks.md` (DD-11). Document the exact invocation in `docs/orchestration/agent-teams.md`                                                                                                                                                                     | Doc + session run               | Cross-layer task completes; handoff log shows inter-agent negotiation points; `tasks.md` history shows single-writer commits |
| D5   | Human gate: nothing merges without review. Encode in orchestrator template: final step is "open PR / present diff, stop." Never auto-merge                                                                                                                                                                                                                                                                                           | Template rule                   | Verified on D2–D4 runs                                                                                                       |
| D6   | Structured handoff logging: every dispatch and return appended to `docs/orchestration/handoff-log.jsonl` (A5 schema)                                                                                                                                                                                                                                                                                                                 | Logging convention in templates | Log validates; one entry per dispatch in D3/D4 runs                                                                          |
| D7   | **Verify optional A5 fields:** during D3/D4 runs, test whether `model`, `turns_used`, `turn_limit` are reliably capturable in Claude Code and Copilot. Promote to required in the schema only where capture is confirmed; otherwise they stay optional and `log-report` (E5) degrades gracefully                                                                                                                                     | Findings note + schema decision | Schema reflects verified reality; no field is required that a runtime can't populate                                         |

**Phase D done when:** all three seeded tasks shipped through the loop with logs, commits, and human-gated merges.

---

## Phase E — Quality flywheel

**Goal:** the system improves from its own failures.

| Step | Work                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Deliverable                              | Acceptance                                                                                                                                               |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1   | `retro` skill: input = bug report or review finding; output = appended item in `checklists/review-checklist.md` (format: `- [ ] CHK-### (src: BUG-###/PR-###): <check>`); code-reviewer template references this checklist via lazy-load                                                                                                                                                                                                                                                                  | Skill + checklist file + template update | Feed it 2 real AI Portal bugs → 2 well-formed checklist items the reviewer applies on next run                                                           |
| E2   | `eval-runner` skill: per generated agent, 2–3 golden examples in `evals/<agent>/` (input task + expected-properties checklist, not exact output). **Tiered runs:** per-edit regression check = 1× smoke run of affected agents' goldens; **release gate (via E4) = each golden 5×, pass rate ≥ 4/5** (agents are stochastic — single passes are meaningless for gating). Any edit to a template or meta-skill triggers at least the smoke tier before the change lands                                    | Skill + AI Portal eval fixtures          | All generated agents have ≥2 goldens; runner reports pass _rates_ at the 5× tier; a deliberate template regression is caught by the smoke tier pre-merge |
| E3   | `drift-checker` skill: re-instantiate from current templates + stored blueprint, diff against manifest SHAs; report template-drift vs user-edit separately                                                                                                                                                                                                                                                                                                                                                | Skill                                    | Detects a deliberate template change and a deliberate user edit, classifies both correctly                                                               |
| E4   | `evaluator` agent: wraps E2 (full 5× tier) + E3, runs on demand and as pre-distribution gate                                                                                                                                                                                                                                                                                                                                                                                                              | Agent md                                 | One command yields full kit health report                                                                                                                |
| E5   | `log-report` skill: parse `handoff-log.jsonl` → summary per agent (dispatch count, failure rate, avg duration, turn utilization vs. limit where captured per D7)                                                                                                                                                                                                                                                                                                                                          | Skill                                    | Report runs over D-phase logs; flags any agent with failure rate > 20% or turn utilization > 80% (when available)                                        |
| E6   | Triage taxonomy + periodic review. Write `docs/triage-rules.md` routing every finding to the right asset: template defect → fix template (propagates everywhere via update); blueprint defect → re-run synthesizer; skill gap → new/edited skill; one-off → checklist item via retro. Evaluator gains a review mode: run over handoff logs + eval pass-rate history, propose fixes routed per taxonomy, human-gated. Cadence: after every ~10 completed tasks or before each kit release, whichever first | Doc + evaluator update                   | A seeded mixed batch (1 template defect, 1 skill gap, 1 one-off) gets routed to the correct asset types                                                  |

**Phase E done when:** retro loop has produced ≥5 checklist items from real findings, one periodic review has run with at least one routed fix applied, and evaluator gates a release.

---

## Phase F — Scale-out

**Goal:** team distribution and unattended execution. Start only after E is in routine use.

| Step | Work                                                                                                                                                                                                                                                                                                                                                       | Deliverable         | Acceptance                                                  |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ----------------------------------------------------------- |
| F1   | Package meta-kit in agent-scaffold manifest: meta-agents/skills/templates/schemas as installable content (wiring + meta-skills default, content opt-in per existing policy)                                                                                                                                                                                | Manifest entries    | `agent-scaffold init` on a clean repo installs the kit      |
| F2   | Teammate pilot: one colleague runs Discovery → Generation on a second **real** repo using only the docs. Capture friction → retro items                                                                                                                                                                                                                    | Pilot report        | Blueprint + generated agents with ≤2 interventions from you |
| F3   | ADO work-item bridge: skill that syncs `tasks.md` ↔ ADO work items (read items in, write status out) via ADO MCP server                                                                                                                                                                                                                                    | Skill               | Round-trip on a test work item                              |
| F4   | Headless execution: `claude -p` in an ADO pipeline running the orchestrator against `tasks.md` on a schedule; audit trail = git history + handoff-log + pipeline logs. No custom server, ever (security posture). When team adoption warrants fleet-level visibility, switch observability from jsonl reports to Claude Code's native OpenTelemetry export | Pipeline YAML + doc | Scheduled run completes a seeded task and opens a PR        |

**Phase F done when:** ≥2 teammates self-serve the kit and one scheduled pipeline run has shipped a PR.

---

## 8. Build order & first milestone

```
A (contracts) → B (discovery) → C (generation) → D (execution) → E (quality) → F (scale)
```

**Thin-slice milestone (build this before finishing any phase fully):**
A1 + A3 (two schemas) → minimal B4 analyst → hand-write a blueprint → C3 instantiator → generate one specialist → run it on one tiny AI Portal task.
This validates the whole pipeline shape in days, not weeks. Then return to complete phases in order.

---

## 9. Appendices

### 9.1 Naming conventions

- Agents: `kebab-case` role nouns (`repo-analyst`)
- Skills: `kebab-case` capability nouns (`structure-detector`)
- Templates: `<name>.template.md`
- Schemas: `<name>.ts`, types inferred, exported via `types.ts` only
- Checklist items: `CHK-###`; tasks: `T-###`
- Design decisions: `DD-##`; phase steps: `<PhaseLetter><n>` (e.g., `B4`) — namespaces never collide

### 9.2 tasks.md format (canonical)

```markdown
# Tasks

## Backlog

- [ ] T-001 | scope: api, db | Add asset-tagging endpoint
  - AC: POST /assets/:id/tags validates via shared Zod schema
  - AC: Prisma migration included; integration test passes

## In Progress

- [~] T-002 | scope: ui | Bilingual toggle on catalogue page (owner: feature-orchestrator)

## Done

- [x] T-000 | scope: shared | Extract tag schema to types.ts (commit: abc1234)
```

Rules: one task per line + indented `AC:` lines; `scope:` lists layers touched (drives dispatch); orchestrator moves lines between sections and appends commit SHA on completion. Failed tasks return to Backlog with an indented `blocked:` line referencing the handoff-log entry. **Single writer: only the orchestrator modifies this file (DD-11); specialists never touch it.**

### 9.3 Dispatch rules (data form, lives in blueprint)

```json
{
  "subagent_max_scopes": 2,
  "agent_team_min_scopes": 3,
  "agent_team_on_cross_repo": true,
  "pipeline_when": ["scheduled", "multi_day"]
}
```

### 9.4 Out of scope for v1 (explicit)

- Custom orchestration server (permanently out — security posture)
- LLM-authored agent generation (revisit only if template coverage proves insufficient; would become migrator-agent-style semantic tooling in a later release)
- RAG over protected information (policy constraint)
- Model mixing across vendors

### 9.5 Mini-repo fixture spec

Purpose: cheap, permanent guard against overfitting discovery to AI Portal's shape (DD-12).

- Single-package Node CLI, ~5 source files, no workspaces
- One unit test (Node test runner), one lint config
- Conventions deliberately different from AI Portal: different branch naming, different commit style, no Prisma/React/Express
- Expected discovery outcomes are committed as fixtures: `mini-repo.profile.json` (golden profile) and the expectation that the synthesizer selects the **generic specialist template**
- Lives in `agent-scaffold/fixtures/mini-repo`; never distributed via manifest
