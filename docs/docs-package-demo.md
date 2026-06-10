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

## Net assessment

All five approved adjustments demonstrated working: narrow trigger (incl.
the negative case), verify-don't-ask bootstrap, tool-neutral always-on
lines (proven by the negative test answering correctly without the skill),
both adoption paths exercised end-to-end, and the advisory-enforcement
trade-off recorded in the package's own ADR-0001.
