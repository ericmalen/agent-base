# Baseline sync (release pins)

Enterprise-style baseline management: projects **pin** an Agent Base release,
pull upgrades deterministically, and optionally let CI or a bot nudge when the
pin is stale.

## Marker

Every set-up project records releases in [`.claude/agent-base.json`](../../spec/target-layout.md):

```json
{
  "standard": "1.0.0",
  "toolRepo": "https://github.com/ericmalen/agent-base",
  "pin": "v1.0.0",
  "lastSyncedAt": "2026-06-11",
  "setupAt": "2026-03-01",
  "githubCodeReview": false
}
```

| Field | Role |
| --- | --- |
| `standard` | Semver of the Agent Base standard at setup/last sync |
| `toolRepo` | Clone URL for Agent Base (GitHub or Azure DevOps) |
| `pin` | Git tag checked out for audit CI and baseline sync |
| `lastSyncedAt` | Date baseline files were last synced from `pin` |
| `setupAt` | Date setup completed (immutable) |
| `githubCodeReview` | Setup policy flag (R-09/R-49) |

Agent Base tags releases (`v1.0.0`, `v1.4.0`, …). Patch/minor upgrades within
the same major are **compatible** by default.

## Commands

From a project root (or pass `--root`):

```sh
# CI / weekly nudge — exit 1 when pin is behind
node /path/to/agent-base/scripts/sync-baseline.mjs --check

# Bot-friendly JSON plan (files to update, conflicts)
node /path/to/agent-base/scripts/sync-baseline.mjs --report --json

# Apply safe updates (skips files with local edits vs old kit)
node /path/to/agent-base/scripts/sync-baseline.mjs --upgrade

# Preview only
node /path/to/agent-base/scripts/sync-baseline.mjs --upgrade --dry-run
```

Use `--allow-major` to consider the latest tag across major versions.

During development, point at a local clone:

```sh
node ~/tools/agent-base/scripts/sync-baseline.mjs --check --kit-root ~/tools/agent-base
```

## What gets synced

Only **permanent baseline** assets (same set as post-merge install):

- `base-check`, `docs`, `git-conventions`, `skill-creator`, `agent-creator`
- `docs-auditor`, `retro`, `log-report`, `eval-runner`

Setup-window skills (`.claude/agent-base-setup/`, `base-inventory` …) are
never touched.

## Conflict model

For each baseline file:

- Matches old kit, differs on new kit → **auto-update**
- Matches new kit already → **unchanged**
- Differs from both old and new kit → **conflict** (human resolves, then re-run)

This is the polished version of “pull from source” — not silent auto-sync.

## CI templates

Copy from the Agent Base clone when the project has CI:

| Template | Purpose |
| --- | --- |
| `templates/ci/audit-strict.github.yml` / `.ado.yml` | Audit at **pinned** release (`--strict`) |
| `templates/ci/baseline-pin-check.github.yml` / `.ado.yml` | Fail/warn when `pin` is behind |

All read `toolRepo` and `pin` from the marker, and fail hard when the clone
at `pin` fails — a bad pin never silently falls back to an unpinned clone.
For private repos, inject credentials (`secrets.KIT_TOKEN` on GitHub, a
secret pipeline variable on ADO — see comments in each template).

## Bot PR (optional)

`templates/ci/baseline-upgrade-bot.github.yml` is a scheduled workflow that
does the upgrade for you: weekly (or on manual dispatch) it runs
`sync-baseline --report --json`, and when the pin is behind with **zero
conflicts** it applies `--upgrade` and opens a PR titled
**"chore(agent-base): baseline v1.3.0 → v1.4.0"** with the real file diff.

Install: copy the template to `.github/workflows/`, enable the repo setting
*Allow GitHub Actions to create and approve pull requests*, and (private
Agent Base repo only) add a `KIT_TOKEN` secret — see comments in the template.

Safety rules, encoded in the workflow:

- PR only when `behind && conflictCount === 0`; conflicts turn the run red
  for a human to resolve instead.
- Never `--allow-major` — major upgrades are a deliberate human PR.
- Never auto-merge; rollback is closing the PR (branch auto-deletes).

No ADO equivalent ships yet — on Azure DevOps use the scheduled
`baseline-pin-check.ado.yml` nudge plus a manual `base-refresh` run.

### Renovate (supplement, not replacement)

Renovate can bump the `"pin"` string in the marker via a custom regex
manager, but it cannot copy skill trees — pair it with the bot workflow (or a
CI step running `sync-baseline --upgrade`) if your teams already use
Renovate. Otherwise the bot workflow alone is the simpler path.

## Legacy markers (set up before the first tag)

Projects set up before `v1.0.0` may have a marker without `pin`:

- `standard` is semver, `pin` missing → nothing to do; sync derives the pin
  as `v<standard>`, and the first `--upgrade` writes the full marker shape
  (`pin`, `lastSyncedAt`).
- `standard` is not semver (e.g. a sha) → the marker fails validation.
  Edit `.claude/agent-base.json` once by hand: set `standard` to the release
  you are effectively on (e.g. `1.0.0`) and add `"pin": "v1.0.0"`, then run
  `--upgrade` normally.

## Related

- [Setup guide](./setup-guide.md) — initial install
- [Terminology](../reference/terminology.md) — vocabulary
- `base-check` skill — post-sync audit loop
