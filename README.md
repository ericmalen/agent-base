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
approval gates. Details: [`docs/how-to/adoption-guide.md`](./docs/how-to/adoption-guide.md).

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
templates/       payload materialized into every adopted repo: instructions/
                 (AGENTS.md/CLAUDE.md skeletons + slot bases), settings/,
                 readmes/ (R-48 stubs), ci/, gitignore
scripts/ test/   the engine (zero-dep Node ≥ 20). Adoption copies only the
                 five adoption scripts + scripts/lib/ + templates/ into
                 targets as .claude/ai-kit-adoption/ (test/ never ships)
.claude/         this repo's own live config; the adopt-* skills, baseline
                 skills (ai-kit-check, docs, git-conventions, skill-creator,
                 agent-creator) and agents are dual-role (used here AND
                 installed into targets — see scripts/install-adoption.mjs).
                 ai-kit-adopt is the adoption entry point: run from this
                 clone (or followed directly by the one-prompt flow), never
                 shipped (path is load-bearing:
                 <kit>/.claude/skills/ai-kit-adopt/SKILL.md)
docs/            consumer-facing guides
reports/         generated outputs (gitignored)
```

Why `templates/` is *not* under `.claude/`: anything in `.claude/` auto-loads
while working on the kit itself. Payload is cargo, not config. Rationale: [`docs/explanation/why-this-way.md`](./docs/explanation/why-this-way.md).

## Next steps

- [`docs/how-to/adoption-guide.md`](./docs/how-to/adoption-guide.md) — adopting a repo.
- [`docs/how-to/cross-tool-setup.md`](./docs/how-to/cross-tool-setup.md) — how one set of
  files serves both tools.
- [`docs/reference/conventions.md`](./docs/reference/conventions.md) — the do's and don'ts.
- [`docs/reference/copilot-customization-reference.md`](./docs/reference/copilot-customization-reference.md)
  — authoritative reference for Copilot concepts.
- [`docs/reference/built-in-reference.md`](./docs/reference/built-in-reference.md) — what ships out
  of the box with VS Code + Copilot.
- [`docs/how-to/workflow-tips.md`](./docs/how-to/workflow-tips.md) — practical tips.
- [`docs/explanation/why-this-way.md`](./docs/explanation/why-this-way.md) — design rationale.

## License

Licensed under the MIT License. See [LICENSE](./LICENSE).
