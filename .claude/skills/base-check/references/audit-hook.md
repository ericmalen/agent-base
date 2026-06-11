# Optional: audit Stop-hook

An opt-in end-of-session nudge. When a Claude Code or GitHub Copilot (VS Code) session
ends, it runs the Agent Base audit against this repo and prints one line if the
AI-config has drifted off the target state. It never blocks the session and is
silent when the repo is clean or no base checkout is reachable.

This complements, and does not replace, the CI `audit-strict` gate
(`templates/ci/audit-strict.*.yml`): CI is the hard gate; the hook is an
in-session heads-up so you catch drift while you are still working.

## Wire it (opt-in)

Add to `.claude/settings.json` (read natively by both tools — R-46). The script
finds Agent Base via `$AGENT_BASE_HOME` (or legacy `$AI_KIT_HOME`),
`.claude/agent-base-setup/` (during setup), the npx-staged release at this
project's pin (`~/.agent-base/versions/<pin>/`), or `~/tools/agent-base`:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/skills/base-check/scripts/audit-nudge.mjs"
          }
        ]
      }
    ]
  }
}
```

Remove the `hooks` block to turn it off. The `audit-nudge.mjs` script exits 0
in every case, so a missing base checkout or a parse error is silently ignored.
