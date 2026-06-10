# docs package — demonstration record (June 2026)

All runs executed in disposable sandbox repos; trigger tests used real
Claude Code v2.1.170 headless. Demo repos torn down after; this record and
the package itself are what persists.

## 1. Proportionality: small CLI vs multi-service app

**demoA — `linewrap`** (3 files, JS, `private: true`, no consumer signals)
→ inspected, inferred **T1**, confirmed. Output: rewritten README (what-it-is,
quickstart, the one flag), 4-line AGENTS.md docs section (no docs map, no
changelog clause). Omissions stated: no docs/ tree, no changelog (no external
consumers), no ADR directory ("decisions fit in README/commits").
Verified: **no docs/ directory was created.**

**demoB — `orders`** (Node API + Python worker + Redis/SQS, compose, private
manifests) → inferred **T3 service**, confirmed. Output: README rewritten
(the "see wiki (outdated)" claim replaced — verify-don't-preserve rule),
full AGENTS.md docs section with docs map, **changelog explicitly omitted
with reasoning** (internal consumers only). Sample task produced
`docs/adr/0001-retry-with-dlq.md`: context marked **reconstructed** (sourced
from worker.py + main.tf, "original discussion not recorded"), consequences
include real downsides. Verified: docs/ contains exactly one file — **no
tutorial/explanation scaffolding.**

## 2. Trigger discipline (real Claude Code, transcript-verified)

| Probe | Skill loaded? | Outcome |
|---|---|---|
| Negative: "where do the docs live, is there a changelog?" | **No** (no Skill call, no SKILL.md read) | Correct answer anyway — from the tool-neutral AGENTS.md lines alone (adjustment 3 validated) |
| Trivial positive: "update the README quickstart" | No | Edit correct AND verified against cli.js first — always-on rules carried it. Acceptable: defense in depth; noted as the expected pattern for one-line edits |
| Substantive positive: "write an ADR for word-boundary wrapping" | **Yes** — `Skill docs` invoked | Read exactly adr.md → proportionality.md → templates.md, verified against cli.js (found the unguarded long-word edge case at line 10 and put it in Consequences), created docs/adr/ lazily, AND proactively flagged the T1-vs-ADR proportionality tension, deferring to the human |

## 3. Adoption dry runs (both paths)

**Path B (standalone copy)** — demoA: two folder copies, `docs setup`, done.
No kit dependency exercised; package fully self-contained.

**Path A (ai-kit adoption, first real `supersede`)** — demoC: brownfield
CLAUDE.md with bespoke, partly contradictory docs rules ("wiki… confluence…
update README when you remember"). Adoption manifest superseded that section
with `catalogSkill: "docs"`; catalog fetched and installed. All gates green
including reproducibility; **audit clean** — meaning the installed docs skill
and docs-auditor agent themselves pass every kit convention (R-17–R-26,
R-27–R-34). Review report shows the superseded source text in full with the
side-by-side section (80.2% superseded-bytes on this tiny fixture — the
note explains the replacement; the human judges at Gate 2 as designed).

Minor finding from the dry run: when the catalog install creates
`.claude/agents/`, the manifest should also install `agents-README.md`
(R-48 info fired). Noted in adopt-plan's manifest reference as standard
practice; not a defect in the package.

## 4. Enforcement layers (ADR-0002 build, demonstrated)

**Layer 2 — session nudge** (`scripts/docs-nudge.mjs`, wired at T2+): fire
case (code-only session → one reminder), once-guard (second Stop silent),
suppress case (docs touched too → silent), T1 skip (silent by design) — all
verified. Found and fixed during testing: `git status --porcelain` output
must never be trimmed (the leading space of the first line's status code
was being eaten, beheading the path — single-file sessions silently broke).
The demo environment also exposed a sandbox-only exec-cache quirk
(re-executed local copies served stale pages); final verification ran the
kit-source script directly.

**Layer 3 — CI docs-impact gate** (`scripts/docs-impact.mjs` + GH/ADO
templates): T1 repo → skipped by design with notice; code+docs → pass;
pure refactor + legitimate commit-trailer declaration → pass with the
declaration echoed visibly in the log; behavior change with no docs and no
declaration → **FAIL** with both platforms' remediation instructions;
GitHub PR-description declaration path → pass (parsed from the event
payload; workflow re-runs on description edits).

**Layer 4 — declaration sampling**: added to docs-auditor procedures
(sample `Docs: not-needed` history, flag implausible claims with diff
evidence, report sampled-vs-flagged ratio).

**Verification record (adjustment 1):** VS Code hooks documentation fetched
2026-06-10 confirms `.claude/settings.json` in default
`chat.hookFilesLocations`, `SessionStart`/`Stop` events, and "same hook
format as Claude Code" — recorded with source in ADR-0002.

## Net assessment

All five approved adjustments demonstrated working: narrow trigger (incl.
the negative case), verify-don't-ask bootstrap, tool-neutral always-on
lines (proven by the negative test answering correctly without the skill),
both adoption paths exercised end-to-end, and the advisory-enforcement
trade-off recorded in the package's own ADR-0001.
