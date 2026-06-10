# ADR-0002: Four-layer enforcement of docs-update-with-code

Status: Accepted (partially supersedes the "advisory only" consequence of ADR-0001)
Date: 2026-06-10

## Context

ADR-0001 accepted advisory-only enforcement and committed to revisiting
when cross-tool hook support stabilized. Two scenarios need coverage:
(A) an AI agent changes code — an instructed agent is in the loop;
(B) a human changes code without AI — nothing fires at all. "Behavior-
changing" is a judgment call no mechanism can detect; but the PATTERN
(code paths changed, doc paths didn't) is mechanically detectable, and a
mechanism can force an explicit, visible human decision instead of
pretending to judge.

Verification for the hook condition: VS Code's hooks documentation
(code.visualstudio.com/docs/copilot/customization/hooks, fetched
2026-06-10) lists `.claude/settings.json` and `.claude/settings.local.json`
as default `chat.hookFilesLocations` entries, documents `SessionStart` and
`Stop` events, and states VS Code "uses the same hook format as Claude
Code and Copilot CLI for compatibility". The condition is met. If a
consuming environment lacks hook support, layer 2 silently degrades to
Claude-Code-only; no other layer depends on it.

## Decision

1. Always-on AGENTS.md rule (existing) — the in-context conscience for
   scenario A.
2. Deterministic session nudge (`scripts/docs-nudge.mjs`), wired by
   `docs setup` at tier T2+ into `.claude/settings.json`: SessionStart
   records HEAD as baseline; Stop computes commits baseline..HEAD plus
   uncommitted paths, matches against `.claude/docs-paths.json`, and when
   code changed without docs prints one non-blocking reminder (once per
   session). No AI calls; errors exit silently — a nudge never breaks a
   session.
3. CI docs-impact gate (`scripts/docs-impact.mjs` + GH Actions / ADO
   templates) — the only layer covering scenario B. Tier-aware (T1 skips
   by design; small repos must not be trained into reflexive
   declarations), path lists generated per repo by `docs setup`. Escape
   hatch is an explicit visible declaration — GitHub: PR-description line
   `Docs: not-needed — <reason>` (the workflow re-runs on description
   edits); ADO: the same line as a commit message trailer (PR description
   is not exposed to the pipeline without API calls); reason ≥ 10 chars.
4. Periodic audit (docs-auditor) — extended to sample recent not-needed
   declarations and flag implausible ones (declared no-behavior-change
   while the diff shows API/CLI/config/schema changes). Layer 4 polices
   layer 3's escape hatch so the declaration cannot decay into a rubber
   stamp.

Rejected: pre-commit hooks (friction without coverage beyond CI; not
installed by default), AI-judgment in CI (cost, nondeterminism), and any
mechanism claiming to detect "behavior change" mechanically.

## Consequences

- Scenario B is now covered at the merge boundary; the human either
  updates docs or makes a one-line visible declaration reviewers see.
- Known weakness, accepted: the session nudge is ONE faint end-of-session
  signal — easily ignored, fires only in AI sessions, baseline-dependent.
  It is a conscience, not coverage; CI is the coverage. Do not mistake
  layer 2 for enforcement.
- Declarations create an auditable record; their honesty is sampled, not
  assumed.
- Cost: two zero-dep scripts and a config file (`.claude/docs-paths.json`)
  now ship into T2+ repos; CI templates require Node 20 on runners.
