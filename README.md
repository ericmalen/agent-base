# ai-kit

## What this is

ai-kit sets up repositories for AI-assisted coding, wired for **both GitHub
Copilot and Claude Code** from one set of files. It ships a rule catalog
([`spec/rules.md`](./spec/rules.md)), a four-phase adoption pipeline
(inventory → plan → materialize → verify) that brings any repo — greenfield or
brownfield — to the target state, and a set of baseline skills/agents
installed into every adopted repo.

No stack-specific or domain-specific content — you add those on top.

> **This repo is the factory, not the house.** Nobody starts a project by
> cloning ai-kit. Adoption runs *from your repo* against a shared clone of
> this kit, and installs only what belongs in your repo (see
> [`spec/target-layout.md`](./spec/target-layout.md) for what you end up with).

## Who it's for

Developers setting up GitHub Copilot and/or Claude Code in a project —
first-time setup or bringing existing AI config up to the team standard.

## Quick start

### Adopt a repo (recommended)

One-time: clone the kit.

```sh
git clone <this-repo-url> ~/tools/ai-kit
```

Then open the kit clone in Claude Code (or Copilot agent mode) and run
`/ai-kit-adopt /path/to/repo-to-set-up`. It asks two questions (GitHub code review? path-scoping
mechanism?), runs the four phases in fresh contexts, and stops at two human
approval gates. Details: [`docs/adoption-guide.md`](./docs/adoption-guide.md).

### Greenfield starter

For a brand-new repo, emit the clean target state directly:

```sh
node ~/tools/ai-kit/scripts/build-starter.mjs /path/to/new-repo --git
```

### Check for drift later

Adopted repos get a permanent `ai-kit-check` skill — run it any time to audit
against the conventions and fix findings by rule ID.

## Repo layout (this repo)

```
spec/            the standard: rules.md (R-IDs, source of truth) + target-layout.md
templates/       wiring skeletons materialized into every adopted repo
                 (AGENTS.md/CLAUDE.md/settings skeletons + slot bases)
scripts/ test/   the engine (zero-dep Node ≥ 20) — also copied into targets
                 during adoption as .claude/ai-kit-adoption/
.claude/         this repo's own live config; the adopt-* skills, baseline
                 skills (ai-kit-check, docs, git-conventions, skill-creator,
                 agent-creator) and agents are dual-role (used here AND
                 installed into targets — see scripts/install-adoption.mjs).
                 ai-kit-adopt is the adoption entry point: run from this
                 clone, never shipped
docs/            consumer-facing guides; docs/dev/ = kit-process material
reports/         generated outputs (gitignored)
ADOPT.md         adoption instructions read by the ai-kit-adopt skill and
                 the one-prompt flow (path is load-bearing: <kit>/ADOPT.md)
```

Why `templates/` is *not* under `.claude/`: anything in `.claude/` auto-loads
while working on the kit itself. Payload is cargo, not config. Rationale: [`docs/why-this-way.md`](./docs/why-this-way.md).

## Next steps

- [`docs/adoption-guide.md`](./docs/adoption-guide.md) — adopting a repo.
- [`docs/cross-tool-setup.md`](./docs/cross-tool-setup.md) — how one set of
  files serves both tools.
- [`docs/conventions.md`](./docs/conventions.md) — the do's and don'ts.
- [`docs/copilot-customization-reference.md`](./docs/copilot-customization-reference.md)
  — authoritative reference for Copilot concepts.
- [`docs/built-in-reference.md`](./docs/built-in-reference.md) — what ships out
  of the box with VS Code + Copilot.
- [`docs/workflow-tips.md`](./docs/workflow-tips.md) — practical tips.
- [`docs/why-this-way.md`](./docs/why-this-way.md) — design rationale.

## License

Licensed under the MIT License. See [LICENSE](./LICENSE).
