# Custom Agents

Specialized personas invoked deliberately — for a specific role, with a defined
procedure and an explicit tool boundary.

This folder uses the **Claude subagent format** (`.claude/agents/{name}.md`).
Claude Code reads it natively; GitHub Copilot (VS Code) also detects `.md` files here and
maps Claude tool names to its own. One folder, both tools — see
[`docs/cross-tool-setup.md`](../../docs/cross-tool-setup.md).

Vocabulary: an **agent** is the definition file/persona in this folder; a
**subagent** is that agent invoked as a delegated, fresh-context worker. In
Copilot the same file also appears as a top-level persona in the agent picker;
in Claude Code it is always invoked as a subagent.

## What lives in this folder

- [`docs-auditor.md`](./docs-auditor.md) — heavy documentation audit/migration
  planner. Permanent baseline: installed into every adopted repo.
- [`adoption-verifier.md`](./adoption-verifier.md) — fresh-context verifier for
  adoption phase 4. Adoption-time only: installed for the adoption window,
  removed again before merge.
- [`example-reviewer.md`](./example-reviewer.md) — annotated example of a
  read-only reviewer. Kit-side reference to copy from; NOT installed into
  targets.

## When to create an agent

Create one when:

- A role should have **restricted tools** (e.g., a reviewer that can read but
  not edit).
- A workflow benefits from **explicit procedures** the agent must follow.
- A task is **repeated often enough** that you want a consistent persona rather
  than re-prompting each time.

## Anatomy

An agent file has frontmatter and a Markdown body.

Frontmatter:

- `name` — agent identifier, kebab-case (defaults to the filename).
- `description` — what the agent does and what it never does; drives delegation.
- `tools` — comma-separated list, using Claude tool names (`Read, Grep, Glob,
  Bash, Edit, Write`). Copilot maps these to its own tools automatically. Omit
  to grant all tools.
- Optional: `model`, `permissionMode`, and other Claude-specific fields — these
  are ignored by Copilot, so they are safe to include.

Body sections:

- **Role statement** — one line: what the agent does and what it never does.
- **Procedures** — numbered steps the agent follows.
- **Never** — explicit boundaries.
- **Documents** — paths the agent may consult.

## Lazy-load convention (project-specific)

The `## Documents` section **uses plain-text paths, not Markdown links**.

The agent reads them on demand via the Read tool, never up-front. This keeps
the agent's always-on context small. Plain-text paths also visually distinguish
agent `## Documents` sections from skill bodies (which intentionally use
Markdown links for progressive disclosure).

## Flat orchestration (preferred default)

ai-kit prefers flat orchestration: orchestrators call every specialist
directly. Nesting (a subagent invoking subagents) is possible in both tools
but compounds token cost and is harder to debug — reach for it only when a
specialist genuinely needs its own helpers. See
[`docs/why-this-way.md`](../../docs/why-this-way.md) for the rationale.

## Good example

See [`example-reviewer.md`](./example-reviewer.md) for an annotated read-only
reviewer showing correct frontmatter, a tight tools list, and a lazy-load
`## Documents` section.

## Adding agents

New agents live in this same folder. The steps mirror the skills workflow:

1. **Author** — run `/agent-creator` in chat. The meta-skill walks you through
   the role statement, procedures, tool list, and lazy-load `## Documents`
   section.

2. **Check** — run the `ai-kit-check` skill; agent conventions are enforced
   by rule ID (R-27..R-37).

In the kit repo itself, `adoption-verifier` and `docs-auditor` are dual-role:
loaded while developing the kit AND installed path-for-path into adopted
repos by `scripts/install-adoption.mjs` (the installer allowlist decides what
ships; `example-reviewer` stays kit-side).

## Filename convention

`{name}.md` — e.g., `code-reviewer.md`, `release-agent.md`.
