# Documentation-AI Setup Audit Report

**Repo:** `ai-kit` (`dnd-caf/ai-kit`)  
**Audit date:** 2026-06-10  
**Kit version found:** `2.0.0-dev` (from `package.json`)  
**Auditor:** read-only automated audit; no files modified

---

## 1. Role & Evidence

**Role: PROVIDER**

Evidence:
- `package.json` → `"name": "ai-kit"`, `"version": "2.0.0-dev"`, `"private": true`
- `README.md` explicitly: *"ai-kit for adding AI-coding customization to internal repos … Ships the folder structure, conventions, annotated `_example` files, and three meta-skills … that create new assets to match the conventions."*
- Contains meta-skills (adopt-inventory, adopt-plan, adopt-materialize, adopt-verify, validate-adoption) whose sole purpose is to install the kit in other repos.
- No domain-specific or application logic — purely tooling.

**Inferred tier (this repo):** T2 or T3. The kit has 14 docs files, a multi-phase CLI workflow, multiple skill and agent assets, and ships to internal teams as a dependency. It is well above T1 (README-only). The repo does not declare its own tier anywhere in the documentation.

**Configured tier:** Not declared. No tier label appears in AGENTS.md, README, docs/, or any config file.

Both the **Provider checklist** and the **Consumer checklist** (providers must document themselves to their own standard) are evaluated below.

---

## 2. Summary Table

| # | Check | Result |
|---|---|---|
| **Provider checks** | | |
| P-1 | Catalog contains `docs` skill | FAIL |
| P-2 | Catalog contains `docs-auditor` agent | FAIL |
| P-3 | Skill router lean; templates load only at write time | N/A — skill absent |
| P-4 | Hook script present | FAIL |
| P-5 | CI templates present (GH Actions) | FAIL |
| P-6 | CI templates present (ADO) | FAIL |
| P-7 | Hook + CI setup matches ADR-0002 | FAIL — no ADRs exist |
| P-8 | Verified hook-support claim (source + date) | FAIL — no hook, no ADR |
| P-9 | ADR-0001/0002 chain intact | FAIL |
| P-10 | Demonstrations exist and pass | UNCLEAR |
| **Consumer checks (provider self-documentation)** | | |
| C-1 | AGENTS.md contains generated docs lines (location map, update-with-code rule, verify-claims rule) | FAIL |
| C-2 | AGENTS.md proportional to tier; tool-neutral; lean | FAIL |
| C-3 | `docs` skill present and current | FAIL |
| C-4 | `docs` skill trigger scoped correctly | N/A — skill absent |
| C-5 | `docs-auditor` agent present; read-only tooling; never-auto-invoke | FAIL |
| C-6 | Stop-hook nudge in `.claude/settings.json` (T2+) | FAIL |
| C-7 | CI docs-impact check present | FAIL |
| C-8 | CI code-path/doc-path config matches actual layout | FAIL — no CI |
| C-9 | Declaration escape hatch functional | FAIL — no CI |
| C-10 | Tier declared / inferred tier matches configured tier | FAIL — no tier declared |
| C-11 | Diátaxis separation holds | FAIL |
| C-12 | No empty scaffolding / placeholder pages | FAIL |
| C-13 | README entry-point-sized; depth in docs | PASS |
| C-14 | ADRs present (if tier warrants) | UNCLEAR |
| C-15 | Changelog present (external consumers) | FAIL |
| C-16 | Spot-verify: README `bin/` claim | FAIL |
| C-17 | Spot-verify: README meta-skills claim | FAIL |
| C-18 | Spot-verify: adoption-guide scripts claim | UNCLEAR |
| C-19 | Spot-verify: phase3-results / validation-report SHA consistency | FAIL |

---

## 3. Per-Failure Detail

### P-1 / P-2 — `docs` skill and `docs-auditor` agent absent from catalog

**Expected:** The kit catalog (`.claude/skills/`, `.claude/agents/`) contains an approved `docs` skill and `docs-auditor` agent.

**Found:** Skills present: `adopt-inventory`, `adopt-plan`, `adopt-materialize`, `adopt-verify`, `validate-adoption`. Agents present: `example-reviewer`, `adoption-verifier`. Neither a `docs` skill nor a `docs-auditor` agent exists anywhere in the repository.

**File:** `.claude/skills/` listing — no `docs/` subdirectory. `.claude/agents/` listing — no `docs-auditor.md`.

**Severity: Critical.** The entire consumer-side docs enforcement model described in the audit standard depends on these two assets being shipped by the provider. Their absence means no consumer can adopt the docs package by installing the kit.

---

### P-4 — Hook script absent

**Expected:** A stop-hook script exists (e.g., `.claude/hooks/`) that fires deterministically on session stop, checks changes since session start against configured doc paths, and emits a nudge. No AI calls; no hook configured in `.claude/settings.json`.

**Found:** No `.claude/hooks/` directory. `.claude/settings.json` contains no `hooks` key:

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "permissions": {
    "allow": [ ... ],
    "ask": [],
    "deny": [ "Read(./.env)", "Read(./.env.*)" ]
  }
}
```

No `hooks` key is present at all.

**Severity: Critical.** The enforcement layer (layer 2 per `docs-package-demo.md`) is entirely absent from the shipped kit.

---

### P-5 / P-6 — CI templates absent

**Expected:** GitHub Actions and Azure DevOps CI templates for the docs-impact check exist in the kit, ready for consumer repos to install.

**Found:** No `.github/workflows/` directory. No `azure-pipelines.yml` at any path. The only `.github/` contents are:
- `.github/prompts/_example.prompt.md` — a Copilot prompt file
- `.github/prompts/README.md`
- `.github/instructions/azure-devops-pipelines.instructions.md` — a Copilot path-scoped **instruction** file about ADO pipeline conventions, not an actual pipeline definition

**File:** `.github/instructions/azure-devops-pipelines.instructions.md` frontmatter:
```yaml
---
description: 'Best practices for Azure DevOps Pipeline YAML files'
applyTo: '**/azure-pipelines.yml, **/azure-pipelines*.yml, **/*.pipeline.yml'
---
```

This is a Copilot instructions file, not a CI template.

**Severity: Critical.** Layer 3 enforcement (CI docs-impact gate) cannot be installed by consumers if the template does not exist in the kit.

---

### P-7 / P-8 / P-9 — No ADRs exist; ADR-0001/0002 chain cannot be verified

**Expected:** ADR-0001 and ADR-0002 exist under `docs/` (or a subdirectory), with a correct supersede relationship, append-only format, and no fabricated rationale. ADR-0002 documents hook support with source + date.

**Found:** No ADR subdirectory under `docs/`. The 14 files in `docs/` are:

```
conventions.md, migration.md, optimization.md, why-this-way.md,
built-in-reference.md, cross-tool-setup.md, copilot-customization-reference.md,
workflow-tips.md, phase0-notes.md, validation-runbook.md, adoption-guide.md,
phase3-results.md, validation-report-2026-06-10.md, docs-package-demo.md
```

None are ADRs. No `adr/` or `decisions/` subdirectory was found by recursive glob.

**Severity: Major.** The audit standard requires ADR-0001/0002 for a provider repo, and the hook-support claim is unverifiable without ADR-0002.

---

### P-10 — Demonstrations: UNCLEAR

**Expected:** Proportionality pair demo, negative-trigger case, both adoption dry runs, CI positive + legitimate-not-needed case exist and pass.

**Found:** `docs/docs-package-demo.md` records results for all five demonstration types, including enforcement layers 2–4 (session nudge, CI docs-impact gate, declaration sampling). However:

1. The docs skill and docs-auditor agent that these demos exercise **do not exist** in the current repo.
2. No CI exists in this repo, yet the demo records a CI docs-impact gate pass.
3. No stop-hook exists in `.claude/settings.json`, yet the demo records a "session nudge" pass.

The demo document may have been authored against a prior state of the repo, against an external consumer, or may be forward-looking. It cannot be verified against the current repo state.

**What would resolve it:** Determine when `docs-package-demo.md` was authored (git log), whether it was run against this repo or a consumer fixture, and whether the referenced assets ever existed in this repo.

---

### C-1 / C-2 — AGENTS.md is an unfilled template

**Expected:** AGENTS.md contains the generated docs lines: docs location map, docs-update-with-code rule, verify-claims rule. Content proportional to tier, tool-neutral, lean.

**Found:** AGENTS.md is entirely TODO placeholders. Verbatim content:

```markdown
# Project Name

<!-- TODO: Replace with your project's name and a one-paragraph overview. -->

## Overview

TODO: 2–4 sentence summary.

## Architecture

<!-- TODO: Link to deeper docs if you have them. Keep this section to links,
     not full explanations. -->

## Conventions

<!-- TODO: List the non-obvious conventions an AI assistant can't infer from code. -->

## Do Not

<!-- TODO: Universal rules. -->
```

The repo that ships the AGENTS.md template to other teams has not filled in its own AGENTS.md. No docs location map, no docs-update-with-code rule, no verify-claims rule are present.

**Severity: Critical.** A provider repo that ships AGENTS.md templates to consumers should itself demonstrate a complete, correctly filled AGENTS.md. The current state is a live counter-example.

---

### C-6 — Stop-hook absent from `.claude/settings.json`

Already detailed under P-4 above. For the consumer self-documentation check: a T2+ repo must have the stop-hook nudge configured. This repo has no `hooks` key in settings. **Severity: Critical.**

---

### C-7 / C-8 / C-9 — CI docs-impact check absent

No `.github/workflows/` directory exists. No CI of any kind is configured for this repo. For a provider repo that ships CI templates to consumers, having no CI enforcement on itself is a notable gap. **Severity: Major.**

---

### C-10 — Tier not declared

No tier label appears anywhere in the documentation. The audit standard requires that the configured tier be checkable against the inferred tier. With no declared tier, the check cannot be performed. **Severity: Minor** (informational gap, not a structural defect).

---

### C-11 — Diátaxis separation does not hold

**Expected:** Documents in distinct Diátaxis quadrants (tutorial, how-to, reference, explanation); no mixed-type documents; content in correct quadrants.

**Found:** The `docs/` folder is a flat list with no subdirectory organization. Several files appear to be process journal entries rather than documentation:

- `phase0-notes.md` — team notes and resolved open questions
- `phase3-results.md` — sandbox run results
- `validation-report-2026-06-10.md` — automated test run output
- `docs-package-demo.md` — a demonstration record

These are closer to engineering logs than user-facing documentation. The remaining files mix reference (`built-in-reference.md`, `copilot-customization-reference.md`), explanation (`why-this-way.md`, `cross-tool-setup.md`), and how-to (`migration.md`, `adoption-guide.md`) without separation.

**Severity: Minor.** The docs are readable but unstructured; a consumer looking for how-to guidance versus reference has no navigational signal.

---

### C-12 — Empty scaffolding in AGENTS.md

Already detailed under C-1/C-2. The AGENTS.md consists almost entirely of HTML comment TODO blocks and placeholder text. This is the definition of empty scaffolding. **Severity: Critical** (same finding as C-1; listed separately per checklist item).

---

### C-15 — No CHANGELOG

**Expected:** A CHANGELOG (or equivalent) exists for a repo with external consumers, with behavior-focused entries and breaking changes/migrations visible.

**Found:** No `CHANGELOG.md` or equivalent file at root or in `docs/`. The kit is at version `2.0.0-dev`, implying a prior `1.x` line existed. The `docs/migration.md` covers brownfield *consumer* migration, not kit version-to-version migration.

**Severity: Major.** Consumers upgrading from a prior kit version have no documented breaking changes or migration path.

---

### C-16 — Stale claim: `bin/ai-kit.mjs` does not exist

**Claim (README.md, Quick start section):**
```
node ~/tools/ai-kit/bin/ai-kit.mjs init --skills git,terraform --yes
```

**Finding:** No `bin/` directory was found in the repository. Recursive glob across the repo root returned no `bin/` or `ai-kit.mjs` path.

**Severity: Critical.** The primary quick-start command in the README points to a file that does not exist. A user following the documented workflow will immediately fail.

---

### C-17 — Stale claim: meta-skills `new-skill`, `new-agent`, `layer-agents`

**Claim (README.md):**
> "Ships the folder structure, conventions, annotated `_example` files, and three meta-skills (`new-skill`, `new-agent`, `layer-agents`) that create new assets to match the conventions."

**Finding:** The skills present in `.claude/skills/` are:
`adopt-inventory`, `adopt-plan`, `adopt-materialize`, `adopt-verify`, `validate-adoption`

None of `new-skill`, `new-agent`, or `layer-agents` exist. These were likely present in a prior version and are either renamed or removed.

**Severity: Major.** The README's core description of the kit's contents is inaccurate.

---

### C-18 — UNCLEAR: Adoption scripts claim

**Claim (adopt-inventory SKILL.md):**
> "Scripts live at `.claude/ai-kit-adoption/scripts/` (placed by the kit installer). If that folder is missing, stop and tell the user to run the installer from their kit clone first."

**Finding:** No `.claude/ai-kit-adoption/` directory was found in this repo. The `bin/` directory (the installer) also does not exist.

**What would resolve it:** Determine whether the scripts are generated at adoption time in a *consumer* repo (not stored in the kit), or whether they should exist in the kit and are missing. Git log on `.claude/ai-kit-adoption/` would clarify.

---

### C-19 — SHA mismatch between phase3-results and validation-report

**Claim (`docs/phase3-results.md`):**
> "Sandbox recommendation: architecture validated; proceed to Phase 4 pending owner's interactive confirmation."
> (Implicitly refers to work at the commit represented at that time)

**Claim (`docs/validation-report-2026-06-10.md`):**
> "Kit SHA validated: `09e48d9`"
> "Kit HEAD at report time: `23eaac9`"

Two different SHAs appear across documents. The validation report itself notes the SHA validated differs from HEAD at report time, suggesting validation was run on a non-tip commit. `phase3-results.md` references no SHA. These documents cannot be cross-referenced to confirm they describe the same codebase state.

**Severity: Minor** (informational inconsistency; does not affect current functionality).

---

## 4. Stale-Claims Findings

| # | Claim | Source | Contradicting Evidence |
|---|---|---|---|
| SC-1 | `node ~/tools/ai-kit/bin/ai-kit.mjs init ...` | `README.md`, Quick start | No `bin/` directory exists anywhere in the repo |
| SC-2 | "three meta-skills (`new-skill`, `new-agent`, `layer-agents`)" | `README.md`, What this is | `.claude/skills/` contains none of these; present skills are adoption-phase skills |
| SC-3 | "Three lifecycle verbs … CREATE … MIGRATE … OPTIMIZE" | `README.md`, What this is | No CREATE or OPTIMIZE skills found; only MIGRATE-phase skills (adopt-*) exist |
| SC-4 | Scripts at `.claude/ai-kit-adoption/scripts/` | `adopt-inventory/SKILL.md` | No `.claude/ai-kit-adoption/` directory found in this repo |
| SC-5 | Enforcement demos (stop-hook, CI) passed | `docs/docs-package-demo.md` | No stop-hook and no CI exist in the current repo |

**SC-3 detail:** README says the kit covers three lifecycle verbs: CREATE (new conformant assets), MIGRATE (brownfield), OPTIMIZE (drifted assets). Inspecting `.claude/skills/`: all five skills are MIGRATE/adoption-phase. No skill corresponds to CREATE or OPTIMIZE. `docs/optimization.md` describes what an `ai-kit audit` command checks, but no such command or skill exists in the repo.

---

## 5. UNCLEAR Items

| # | Item | What's ambiguous | Question that would resolve it |
|---|---|---|---|
| U-1 | `docs-package-demo.md` provenance | Records enforcement demos (stop-hook, CI) that have no corresponding assets in the repo | Was this run against a consumer fixture repo? Against a prior branch? `git log --follow docs/docs-package-demo.md` and checking which branch/commit the assets existed on would clarify. |
| U-2 | ADRs ever existed | Audit standard requires ADR-0001/0002; none exist | `git log --all --full-history -- docs/adr/` would show if they were deleted |
| U-3 | `adopt-inventory` scripts location | Skill references `.claude/ai-kit-adoption/scripts/` but neither that path nor the installer (`bin/`) exists | Are scripts generated into a consumer repo by the installer, or should they exist in the kit? |
| U-4 | `bin/ai-kit.mjs` removed or not yet added | README references it as primary entry point; no `bin/` directory exists | `git log --all --full-history -- bin/` would show if it was removed |
| U-5 | Tier declaration | No tier is declared anywhere | Is a tier system formally part of this kit's documentation standard, and if so where should it be declared? |
| U-6 | `ai-kit.config.json` | Referenced in documentation context as a config file, not found in repo listing | Glob `**/*.config.json` from repo root, or check git history |

---

## 6. Additional Observations (not covered by checklist)

**O-1: `settings.local.json` committed or tracked?**  
`.claude/settings.local.json` exists in the repo listing. This file typically holds personal developer overrides and is meant to be gitignored. Its presence in a repo listing suggests it may be tracked by git. If it is tracked, personal/machine-specific allow-list entries (wide `Bash(git *)`, `Bash(node *)`, absolute paths to developer worktrees) are visible to all contributors and may mislead them about the intended permissions surface.

**O-2: `docs/phase0-notes.md`, `docs/phase3-results.md`, `docs/validation-report-2026-06-10.md` are engineering logs, not documentation**  
These three files record internal development process (open questions, sandbox run results, automated test output). They do not belong in a `docs/` folder that consumers will read. Their presence inflates the apparent documentation surface and may mislead consumers about the maturity or scope of documented behavior.

**O-3: `docs/docs-package-demo.md` records a feature that has no present implementation**  
The demo document is dated and records detailed pass/fail results for the docs enforcement package. Since the docs skill, docs-auditor agent, stop-hook, and CI templates are all absent, this document describes behavior that is not deliverable by the current kit. A reviewer reading only this file would conclude the feature is complete.

**O-4: `example-reviewer` agent references `docs/conventions.md` in its `## Documents` section**  
`docs/conventions.md` exists and appears complete. This reference is valid. However, `docs/conventions.md` line 5 states: *"Keep `AGENTS.md` under two pages."* The actual `AGENTS.md` in this repo is essentially empty (all TODOs). The conventions document is internally consistent but the repo does not follow its own conventions.

**O-5: No `src/` directory, no `test/` directory visible**  
`phase0-notes.md` records "55 tests: 45 pass / 0 fail / 10 todo". `package.json` has `"test": "node --test 'test/**/*.test.mjs'"`. No `test/` directory was found in the recursive listing. Either tests were removed, live in a branch, or the glob did not surface them. This is not a documentation finding but is notable context for the validation claims in `phase3-results.md`.

**O-6: `CLAUDE.md` contains a TODO comment**  
```markdown
<!-- TODO: Add Claude-Code-specific guidance here, if any. Most teams won't
     need anything — keep this section minimal or delete it. -->
```
A shipped template instruction left in the provider's own `CLAUDE.md`.

---

*End of report. No files were modified during this audit.*
