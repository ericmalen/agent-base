@AGENTS.md

## Claude Code notes

The `@AGENTS.md` line above imports the canonical repo instructions, so Claude
Code and Copilot share one source of truth. Claude Code reads this file;
Copilot and other AGENTS.md-aware tools read `AGENTS.md` directly.

Shared agents and skills live in `.claude/agents/` and `.claude/skills/` — both
tools load them natively. See [`docs/how-to/cross-tool-setup.md`](./docs/how-to/cross-tool-setup.md).
