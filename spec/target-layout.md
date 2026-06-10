# Target layout — the post-adoption repo tree

Companion to [`rules.md`](./rules.md). This is what an adopted repo looks like;
every entry names the rules that govern it. Conditional entries are marked.

```
<repo-root>/
├── AGENTS.md                      canonical AI instructions          R-01..R-08
├── CLAUDE.md                      shim: first line `@AGENTS.md`      R-10..R-12
├── .gitignore                     covers .claude/settings.local.json R-47
│
├── .claude/
│   ├── ai-kit.json                one-line kit marker: version/sha,
│   │                              adoptedAt, githubCodeReview        R-50
│   ├── settings.json              permissions (.env deny) + hooks    R-43, R-44, R-46
│   ├── settings.local.json        personal, never committed          R-43, R-47
│   │
│   ├── rules/                     path-scoped instructions (DEFAULT
│   │   │                          mechanism, D-1)                    R-52, R-53
│   │   ├── README.md                                                 R-48
│   │   └── <scope>.md             paths: globs, ≤50 non-blank lines  R-52
│   │
│   ├── skills/
│   │   ├── README.md                                                 R-48
│   │   ├── ai-kit-check/          permanent maintenance skill
│   │   │   │                      (audit + rubric + fix loop)        R-50
│   │   │   ├── SKILL.md
│   │   │   ├── scripts/audit.mjs
│   │   │   └── references/rubric.md
│   │   └── <skill-id>/            flat, one level                    R-17..R-26, R-54
│   │       ├── SKILL.md           ≤200 lines, Markdown sibling links
│   │       ├── references/        loaded on demand
│   │       ├── examples/
│   │       └── scripts/
│   │
│   └── agents/
│       ├── README.md                                                 R-48
│       └── <agent-name>.md        kebab-case, tools: declared,
│                                  Never + Procedures + Documents     R-27..R-37
│
├── .vscode/
│   └── settings.json              pinned key set                     R-45
│
└── .github/                       ONLY when githubCodeReview: true   R-09, R-49
    ├── copilot-instructions.md    ≤4,000 chars, points to AGENTS.md  R-09
    └── instructions/              path-specific *.instructions.md
                                   (applyTo globs, excludeAgent)      R-09
```

## Compat variant (nested AGENTS.md instead of rules/)

Chosen at adoption when the team uses other AGENTS.md-ecosystem tools
(Cursor, Codex, Gemini CLI, …). Replaces `.claude/rules/` — never combined
with it (R-53).

```
└── <subtree>/
    ├── AGENTS.md                  ≤50 non-blank lines, no frontmatter,
    │                              one scope                          R-13, R-14, R-16
    └── CLAUDE.md                  sibling shim, first line @AGENTS.md R-15
```
Also adds `chat.useNestedAgentsMdFiles: true` to `.vscode/settings.json` (R-45).

## What is deliberately ABSENT

| Absent | Why | Rule |
|---|---|---|
| `.github/prompts/` | dropped (D-4) — slash commands are `user-invocable` skills | R-54 |
| `.github/chatmodes/` | deprecated upstream → custom agents | R-42 |
| `.github/skills/`, `.github/agents/` | `.claude/` is the shared home both tools read | R-49 |
| `.github/copilot-instructions.md` (when `githubCodeReview: false`) | folded into AGENTS.md at adoption | R-09 |
| category subfolders under `.claude/skills/` | neither tool discovers them | R-26 |
| v1 machinery (hash manifest, sidecars, audit-report file) | v2 has no sync layer; marker is one line | — |

## Load model (why the layout is shaped this way)

Always-on, every interaction: `AGENTS.md` (Copilot natively; Claude Code via the
CLAUDE.md shim). Per-path, automatic: `.claude/rules/<scope>.md` (both tools) or
nested AGENTS.md (compat). On-demand, model-selected: skills via frontmatter
description scan → SKILL.md on activation → siblings via Markdown links. Delegated:
agents, loaded only when invoked. Enforced: settings + hooks from
`.claude/settings.json`, read by both tools.

The cost gradient drives every size cap: always-on content is the most expensive
(R-02), per-path next (R-13/R-52), on-demand cheapest (R-20 generous by
comparison). Detailed rationale: `docs/why-this-way.md`.
