# ai-kit (kit development repo)

This is the **factory, not the house**: the repo that builds and ships AI-config
setups into other repositories. Nobody starts a project by cloning this repo —
adoption runs *from a target repo* against a shared clone of this kit.

## Overview

ai-kit installs a conformant AI-coding setup — Claude Code + GitHub Copilot
(VS Code), one set of files — into consumer repos via a four-phase adoption pipeline
(inventory → plan → materialize → verify). Zero-dependency Node ≥ 20 (.mjs),
unit-tested, shell-agnostic.

## Architecture

- [`spec/rules.md`](./spec/rules.md) — single source of truth (R-IDs). Never
  restate a rule; reference its ID.
- [`spec/target-layout.md`](./spec/target-layout.md) — what an adopted repo
  looks like.

## Repo zones

| Zone | Role |
|---|---|
| `templates/` | Payload materialized into every adopted repo: `instructions/` (AGENTS.md/CLAUDE.md skeletons + slot bases), `settings/`, `readmes/`, `ci/`, `gitignore`. |
| `scripts/` + `test/` | The engine. Dev tooling here; adoption copies ONLY the five adoption scripts (inventory-extract, materialize, check, report, audit) + `scripts/lib/` + `templates/` into targets as `.claude/ai-kit-adoption/` — `test/` never ships. |
| `.claude/` | This repo's live config AND the baseline shipped to every target. The `adopt-*` skills, `adoption-verifier` agent, and the baseline `ai-kit-check`, `docs`, `git-conventions`, `skill-creator`, `agent-creator` skills + `docs-auditor` agent are dual-role: loaded here AND installed path-for-path into targets (see `scripts/install-adoption.mjs`, the allowlist that decides what ships). `ai-kit-adopt` is the adoption entry point — run from this clone against a target path; deliberately NOT installed into targets. |
| `docs/` | Consumer-facing guides. |
| `reports/` | Generated outputs (validation/audit reports). Gitignored. |

## Conventions

- Rule-ID indirection (R-51): docs and templates cite rules by R-ID only.
- All scripts zero-dependency Node ≥ 20; the kit's own test suite (`npm test`) needs Node ≥ 22.
- Self-audit: `node scripts/audit.mjs` (this repo is itself adopted — marker in
  `.claude/ai-kit.json`).
- Generated reports go to `reports/`, never committed.
- v1/v2 are internal kit generations; released artifacts version from 1.0.
- Kit CI gates beyond tests: `docs-consistency` (banned v1 vocabulary + doc
  link resolution) and `rule-check-map` (spec-rule ⇄ audit-check coverage).

## Documentation

Conventions: `.claude/skills/docs/SKILL.md` (standard, Diátaxis types, rules).
Tier T3 (`.claude/docs-paths.json`). Docs live in `docs/` (consumer-facing
how-to/reference/explanation), `spec/` (source-of-truth rules + target layout),
`README.md` (entry point), and `AGENTS.md`/`CLAUDE.md` (agent
instructions). Behavior-changing edits to `scripts/`, `templates/`, or `test/`
update the affected docs in the same change. Verify doc claims against code;
fix or flag stale content, never preserve it silently. No CHANGELOG.md or
`docs/decisions/` — decisions live in commits/PRs, consumer changes in release
notes.

## Do Not

- Do not add payload to `.claude/` unless it is also wanted while developing
  the kit — everything there auto-loads here (v1's mistake; see dropped rules
  in spec). The installer allowlist (`scripts/install-adoption.mjs`) decides
  what ships to targets; `ai-kit-adopt` stays kit-only.
- Do not move `.claude/skills/ai-kit-adopt/` or rename `scripts/`,
  `templates/` — paths are load-bearing (one-prompt flow in
  `docs/adoption-guide.md`, `materialize.mjs`, `install-adoption.mjs`).
  Within `templates/`: `instructions/` is resolved by target path during
  slot assembly (`materialize.mjs`), and `gitignore` is dotless so it is
  never live — neither here nor when copied into targets.
- Do not edit installed-asset copies in a target repo by hand during adoption —
  manifest + literals only (reproducibility gate).
- No secrets in code; no new dependencies without discussion.

## More Context

For on-demand workflows see `.claude/skills/` (adoption pipeline + validation).
For specialized roles see `.claude/agents/`.

> **Cross-tool note:** `AGENTS.md` is canonical; `CLAUDE.md` imports it
> (`@AGENTS.md`). Shared agents/skills in `.claude/` load in both Claude Code
> and Copilot. See [`docs/cross-tool-setup.md`](./docs/cross-tool-setup.md).
