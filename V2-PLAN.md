# ai-kit v2 — Implementation Plan (adoption tooling)

**Architecture: extract → route → materialize** (constructive conservation).
Source content is extracted verbatim by code, exactly once. The AI never re-types
preserved content — it authors a routing **manifest** plus small **literal** files
for genuinely new text. A **materializer** assembles the target tree
deterministically. Weakening of moved content is impossible by construction;
drops and merges are visible-and-reviewed, never silent.

Decision criteria, in priority order:
1. No silent loss or weakening of existing repo content (outranks everything).
2. Cross-tool: Claude Code AND VS Code Copilot (agent mode), hard requirement.
3. Correctness over implementation effort; effort is not a decision factor.

Division of labor: **determinism on the closed world** (kit-defined target state,
conservation invariants), **AI judgment on the open world** (interpreting arbitrary
inputs). Never grow an input taxonomy in code.

Mental model: Terraform plan/apply for the migration. Manifest = desired state;
materialize = apply; reproducibility check = plan-shows-no-drift. The manifest is a
migration-time artifact only — after merge, the repo's files are the source of
truth (AGENTS.md is NOT a permanently generated file).

---

## 1. Product definition

One deliverable: a skill package that sets up a repository (greenfield) or
refactors an existing one (brownfield, any input shape) to the ai-kit target state.

Target state (spec/, already written):
- `spec/rules.md` — canonical rule catalog (R-IDs; mechanical ↔ audit 1:1,
  judgment → rubric with pass/fail examples)
- `spec/target-layout.md` — annotated post-adoption tree
- Resolved policy decisions: path-scoping is rules-first (`.claude/rules/` primary,
  nested AGENTS.md+CLAUDE.md as compat option, one mechanism per repo);
  `.github/copilot-instructions.md` conditional on a recorded code-review answer;
  prompts surface dropped (slash commands = user-invocable skills); full
  `.vscode/settings.json` key set enforced; v1 thresholds confirmed.

Settings surfaces (`.vscode/settings.json`, `.claude/settings.json`) are **merged
at key level**, never overwritten wholesale. The ~55-skill catalog is fetched on
demand (shallow clone), not bundled.

## 2. Components

All scripts: zero-dependency Node (.mjs), pinned minimum version, shell-agnostic,
unit-tested. No shell-specific one-liners on the critical path.

| Component | Type | Responsibility |
|---|---|---|
| `spec/rules.md` | doc | Single source of truth for the target state |
| `inventory-extract.mjs` | script | Enumerate + extract source content (§3). Pure mechanics, no classification |
| `.adoption/manifest.json` | artifact | AI-authored disposition of every extracted node (§4) |
| `.adoption/literals/` | artifacts | AI-authored new text, edited as normal files, referenced by manifest |
| `materialize.mjs` | script | Deterministically assemble target tree from nodes + manifest + templates + literals; key-level JSON merge for settings |
| `check.mjs` | script | Mechanical gates: completeness, tiling, reproducibility, scope (§6) |
| `audit.mjs` | script | Target-state conformance, ported from v1's 14 tested check modules, findings keyed by R-ID; `--json`; exit 0 = conformant. Checks the TARGET only — closed world |
| `adoption-verifier` | agent | Read-only, fresh-context verifier (§7). One file, valid in both tools' formats |
| Phase skills | skills | `adopt-inventory` → `adopt-plan` → `adopt-materialize` → `adopt-verify`. Each phase = fresh session; handoffs are committed artifacts; each phase validates the previous artifact parses before starting |
| `ai-kit-check` | installed skill | Permanent post-adoption drift surface in the target repo (audit + rubric + fix-findings workflow); its absence is an audit finding |
| Report generator | script | Risk-ordered human review report from manifest + nodes (§8) |

## 3. Extraction (`inventory-extract.mjs`)

- **Universe:** `git ls-files --cached --others --exclude-standard` — never a raw
  filesystem walk.
- **Enumerated surfaces:** root/nested AGENTS.md + CLAUDE.md, `.claude/**`,
  `.github` AI surfaces (copilot-instructions, instructions/, prompts/,
  chatmodes/), `.vscode` AI-relevant keys, known other-tool files (`.cursorrules`,
  `.cursor/rules/*.mdc`, `.windsurfrules`, `GEMINI.md`, `.aider.conf.yml`, …).
- **Content sweep (mandatory):** grep ALL tracked text files for AI-instruction
  markers (marker list in spec; tuned for recall over precision — a false
  candidate costs one triage line, a miss costs content). Hits become candidate
  files for AI triage in the plan phase; ruled-out candidates must be recorded
  `out-of-scope` with reason in the manifest. This closes the open-world
  enumeration gap; classification stays with the AI.
- **Block model:** fence-aware Markdown parsing (`#` inside a code fence is not a
  heading); pre-first-heading content = explicit preamble pseudo-block; setext
  headings supported; YAML frontmatter = own node; JSON surfaces = key-level
  nodes. Every node gets a stable ID; exact bytes stored content-addressed under
  `.adoption/nodes/`.
- **Normalization happens here, once, one direction** (line endings recorded,
  bytes preserved; policy documented in spec). There is no matching step anywhere
  in the system, so no match-time normalization exists to tune.

## 4. Manifest

Op vocabulary — complete by construction (every source byte is kept verbatim,
removed with reason, or replaced by declared new bytes):

| Op | Meaning |
|---|---|
| `move` | node placed verbatim at target (+ anchor) |
| `split` | node ranges routed to multiple targets; ranges must tile (§6) |
| `keep-file` | file stays as is |
| `drop` | removed; reason required; full text surfaced in report |
| `merge` | replaced by a literal file (new text); side-by-side generated |
| `supersede` | replaced by a catalog skill; diff attached for review |
| `out-of-scope` | sweep candidate ruled non-instructional; reason required |

Plus `jsonMerges` (key-level merge of settings surfaces against kit templates).

`split` and `key-merge` are conveniences, not input classification. **Future
maintainers: never add input-classification ops.** Anchor/ordering semantics (how
multiple nodes compose inside a target like `AGENTS.md#conventions`) is where
assembled-document coherence lives — design carefully, finalize in Phase 1.

## 5. Workflow

```
0 PRECONDITIONS  git repo · clean tree · node >= pinned floor.
                 Node missing → STOP. NO degraded fallback (a fallback silently
                 drops the core guarantee). Copilot: agent mode required.
1 INVENTORY      inventory-extract → .adoption/nodes/ + report.
                 Baseline commit; adoption branch. (fresh session)
2 PLAN           greenfield → template selection.
                 brownfield → AI reads every node + sweep candidate, authors
                 manifest + literals, drafts plan. (fresh session)
                 Adoption questions recorded in kit marker: GitHub code review?
                 path-scoping rules vs nested-compat?
3 USER GATE 1    approve plan + risk-ordered manifest summary (§8).
4 MATERIALIZE    run materialize; AI reviews rendered output; iterates by editing
                 manifest/literals ONLY and re-materializing. EXTRACTION FIRST:
                 prefer verbatim relocation over any rewrite; merges few, small,
                 justified. Commit per iteration. (fresh session)
5 MECH GATE      check (completeness+tiling+reproducibility+scope) → audit →
                 fix via manifest/literal edits only → loop to double exit 0.
6 AGENT GATE     adoption-verifier, two invocations, fresh context each (§7).
7 USER GATE 2    risk-ordered review report → human merges, deletes branch.
                 .adoption/ removed at merge.
```

Abort at any point = delete branch, repo untouched. Re-run = start over (state is
committed artifacts; resume support only if fixture runs prove it's needed).
**Sequential single-writer only; no parallel writing agents.** Read-only fan-out
permitted in PLAN phase only, Claude Code only, serialized into one manifest.
Phase boundaries are user actions (new chat + invoke next skill) — never depend on
automatic subagent orchestration for anything load-bearing.

## 6. Invariants (`check.mjs`)

1. **Completeness** — every extracted node and every sweep candidate has exactly
   one disposition.
2. **Tiling** — `split` ranges exactly cover the node; gaps must be explicit
   `drop` ranges with reasons.
3. **Reproducibility** — re-running materialize yields a tree byte-identical to
   the working tree's generated surfaces. Hand edits to generated output fail the
   gate and must be routed through manifest/literals. (Output-side provenance:
   every generated byte is node | template | literal.)
4. **Scope** — no diff outside AI-config surfaces and `.adoption/` on the branch.

## 7. Verifier agent

- One agent file, both tools (VS Code reads `.claude/agents/*.md` Claude format).
  Read-only via tool restrictions, **plus mandatory mechanical backstop**: after
  every invocation assert `git status --porcelain` is empty (restriction-name
  mapping across tools is unverified — never rely on restriction alone).
- **Invocation ① — conformance/rubric:** walk `spec/rules.md` judgment rules; emit
  a structured R-ID × asset pass/fail matrix (forced structure prevents silent
  skipping); review assembled-document coherence.
- **Invocation ② — adversarial loss-hunt:** review EVERY `merge`/`supersede` via
  generated side-by-side (never spelunks commits), every `drop` reason, and
  `out-of-scope` rulings. Verbatim spot-checks of moves are unnecessary by
  construction — spend the entire judgment budget on dispositions and coherence.

## 8. Human review report (Gate 1 summary, Gate 2 full)

Generated mechanically from manifest + nodes, risk-ordered:
1. `drop` — full source text + reason.
2. `out-of-scope` (sweep candidates) — full matched text + reason (same treatment
   as drops: a bogus ruling is an equivalent silent-loss path).
3. `merge`/`supersede` — side-by-side source vs replacement.
4. `split` — routing table with range map.
5. `move`/`keep` — counts + routing table, collapsed; random sample expandable.
6. Headline counters: totals per op + **merged-bytes as % of source-bytes** — the
   creeping-merge tripwire. Note: the root AGENTS.md size cap forces condensation
   on messy repos, so this metric is the central quality battle; set an explicit
   expectation for it in Phase 3, don't just report it.

Reviewer aid: per-iteration commits via
`git diff --color-moved=zebra --find-copies-harder` (verify at fixture diff sizes).

## 9. Hard requirements (MUST)

1. Zero-dep Node scripts, pinned version floor, unit-tested.
2. Extraction per §3 (sweep, fence-aware, preamble blocks, JSON key nodes,
   git ls-files universe).
3. Invariants per §6; gates converge via manifest/literal edits only.
4. Extraction-first in skills prose AND as a metric; every merge/supersede gets a
   generated side-by-side.
5. Verifier per §7 with clean-tree backstop.
6. Risk-ordered report per §8 at both human gates.
7. Phase-per-fresh-session; committed artifacts; next phase validates previous.
8. Node hard precondition; abort = branch delete restores everything.
9. Sequential single-writer; read-only fan-out only (plan phase, Claude Code).
10. `spec/rules.md` single source of truth; kit CI enforces mechanical-rule ↔
    audit-check 1:1 (no orphans either direction).
11. Audit checks the target only; no input-classification logic in any script.
12. Honest guarantee in all copy: moves/splits conserved by construction; drops
    and merges visible-and-reviewed, not prevented.

## 10. Validation

**Fixtures (planted sentinel sentences):** greenfield-empty, greenfield-code,
claude-only, copilot-only, mixed-messy, large — plus adversarial: CRLF; duplicate
identical blocks in two files; `#` inside code fence; preamble content; setext
headings; 4,000-line single-section file; mixed AI/non-AI `.vscode/settings.json`;
heavy node_modules; **injection fixture** (content that tries to steer the agent —
brownfield input is instruction-shaped by definition); AI guidance buried in
README/CONTRIBUTING (sweep must surface it).

**Negative / seeded-defect tests — gates must FAIL these:** omitted node →
completeness fails; split gap → tiling fails; hand-edited generated file →
reproducibility fails. **Sabotage runs:** seed N known defects (unjustified drops,
dilution rewrites in literals, bogus out-of-scope rulings); record verifier
invocation-② catch-rate per tool; report the number honestly. A suite that only
proves good runs pass is unacceptable.

**Property test (Phase 1 exit):** extract → all-`keep-file` manifest →
materialize ⇒ byte-identical AI surfaces (full round trip).

**Matrix:** every fixture × both tools, manual runbook; record gate-loop iteration
counts and Copilot session interruptions as convergence/UX metrics. Also test:
`ai-kit-check` on a drifted repo; update/re-run on an already-adopted repo with
user customizations (must survive or be consciously dispositioned).

**Unit tests:** extractor (golden files), materializer (golden files), check
invariants, JSON key-merge, report generator.

## 11. Build order (checkpoint with human at every phase boundary)

| Phase | Content | Exit criterion |
|---|---|---|
| 0 — shared spine | `spec/rules.md` ✔(done) + target-layout ✔(done); `inventory-extract` + tests; `audit` port + tests; all fixtures incl. adversarial + seeded-defect harness; resolve §13 questions | spine green; §13 answered |
| 1 — constructive core | manifest schema final (incl. anchor/ordering semantics); `check.mjs`; `materialize.mjs` + JSON key-merge; report generator | round-trip property test green |
| 2 — AI assets | phase skills; verifier agent + backstop; `ai-kit-check`; setup docs (agent-mode note, terminal allowlist) | assets load in both tools |
| 3 — validation matrix | fixtures × both tools; sabotage catch-rate; convergence metrics | go/no-go vs pivot triggers |
| 4 — post-proof | Claude Code Stop/PostToolUse audit hook (labeled CC-only); CI templates (GH Actions + ADO) `audit --strict`; kit-CI rule↔check cross-check | shipped |

## 12. Pivot (pre-specified fallback, measured in Phase 3)

**Triggers (any):** materialize-iterate cycles per fixture consistently exceed the
bound proposed in the Phase-1 plan, or assembled-document quality judged
materially worse than direct editing on ≥2 fixtures; split/range handling becomes
the defect cluster; Copilot can't complete the materialize loop within tolerable
approval friction even with the allowlist.

**Pivot design:** keep Phase 0 and most of Phase 2. Replace materializer+manifest
with direct AI file editing under a three-sub-phase discipline (verbatim
reorganize → conform → condense) tracked in a `kept|moved|merged|dropped` ledger,
plus `reconcile.mjs` — a verbatim matcher reusing the extraction output as its
match corpus, with a written normalization spec (CRLF, whitespace, fences,
one-to-one consuming matches). Mandatory: merged entries embed source text +
target ref with generated side-by-sides; extraction-first; risk-ordered report;
micro-commit per ledger entry; seeded-defect tests targeting the matcher. The
pivot costs one component, not the project.

## 13. Open questions — resolve in Phase 0 (verify, don't assume)

1. Does the Claude-format `tools:` list actually restrict in current VS Code?
   (Backstop stands regardless.)
2. Current Copilot agent-mode iteration caps / continuation / terminal
   auto-approval — capture in setup docs.
3. `git diff --color-moved=zebra --find-copies-harder` behavior at fixture sizes.
4. Node availability on the team's managed machines.
5. Content-sweep marker list — tune against fixtures, recall first.

## 14. Working agreements

Outline before code; human approval on Phase 0/1 designs (manifest schema,
normalization policy, marker list) before building. ADRs for decisions. No scope
creep — anything beyond this plan is a proposal, not an action. When uncertain,
ask.
