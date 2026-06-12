# Terminology

Canonical vocabulary for Agent Base docs, skills, and scripts. Use these terms
consistently; do not rotate synonyms.

| Term | Meaning |
| --- | --- |
| **Agent Base** | The product (this repo). Display name in prose. |
| **agent-base** | Slug: repo name, paths, package name. |
| **base checkout** | Local copy of this repo used to run setup or orchestration against a project: a git clone, or an npx-staged release. |
| **base clone** | A checkout that is a git clone (has `.git`; freshened with `git pull --ff-only`). Canonical for Agent Base development. |
| **staged release** | Immutable copy of a tagged release at `~/.agent-base/versions/<tag>/`, created by the bootstrap commands. Never pulled; replaced by staging a newer tag. ("npx-staged release" only at first mention in a doc.) |
| **stage** (verb) | Copy-once placement of a release into the release store (sentinel-guarded, idempotent). |
| **release store** | `~/.agent-base/versions/`; managed by `agent-base cache list\|prune`. |
| **bootstrap commands** | `agent-base setup`/`orchestrate`/`refresh` — stage the release, then hand off down the launch chain: spawn `claude` in the target → drop the one-shot `/agent-base-bootstrap` launcher skill → print the bootstrap prompt. |
| **bootstrap prompt** | The printed paste-able prompt for an AI session opened in the project. |
| **delegated commands** | `agent-base install`/`audit`/`sync`/`tracker-sync`/`starter`/`headless-guard` — passthroughs to `scripts/*.mjs`. |
| **npx spec** | `github:owner/repo#tag` or `git+<url>#tag`, computed from the marker (`npxSpecFromToolRepo`). |
| **pin** | Git tag in the marker (`pin`, falling back to `v`+`standard`); what npx and CI resolve. |
| **refresh / sync / upgrade** | `refresh` = guided baseline-upgrade skill loop · `sync` = the deterministic engine (`sync-baseline.mjs`) · `--upgrade` = the sync mode that applies changes. |
| **project** | Any repo receiving the standard layout. |
| **starter** | New project emitted via `build-starter.mjs` (skips inventory). |
| **existing project** | Project with prior AI config; inventory-first setup path. |
| **setup** | Four-phase pipeline: inventory → plan → apply → verify. |
| **setup window** | Temporary skills and tooling removed before merge (`base-inventory` … `base-verify`). |
| **standard layout** | Post-setup tree defined in [`spec/target-layout.md`](../../spec/target-layout.md). |
| **baseline skills** | Permanent skills copied into every project (`base-check`, `docs`, …). |
| **orchestration** | Optional generated multi-agent layer (`base-orchestrate` entry). |
| **`.setup/`** | Working directory during setup (`manifest.json`, `nodes/`, `literals/`, `merge-sources.json`). |
| **`.claude/agent-base-setup/`** | Temporary tooling copied into a project during setup. |
| **`.claude/agent-base.json`** | Marker: `standard`, `toolRepo`, `pin`, `lastSyncedAt`, `setupAt`, `githubCodeReview`. |

## Skill prefix convention

- **`base-*`** — setup and maintenance entry skills (`base-setup`, `base-check`, `base-orchestrate`, phase skills).
- **Plain kebab-case** — universal baseline and orchestration tooling (`docs`, `drift-checker`, `repo-analyst`, …).

## Retired terms (do not use)

`ai-kit`, kit (any bare use: “the kit”, kit clone, kit-side, kit template,
orchestration kit — say “Agent Base …”), greenfield, brownfield, adopt/adoption
(as pipeline nouns), target repo, factory/house metaphor. The only surviving
`kit` spellings are legacy compatibility surfaces: the `$AI_KIT_HOME` env var
and the `--kit-root`/`--old-kit-root` flag aliases of `sync-baseline.mjs`.
