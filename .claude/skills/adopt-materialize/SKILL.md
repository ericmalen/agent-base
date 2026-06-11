---
name: adopt-materialize
description: Phase 3 of ai-kit adoption — deterministically assemble the target tree and converge the mechanical gates. Use after the adoption plan is approved, in a fresh session.
---

# adopt-materialize

The materializer writes the target tree from the approved manifest. You review
the rendered result and iterate — by editing `.adoption/manifest.json` and
`.adoption/literals/*` ONLY. NEVER edit generated files directly; the
reproducibility gate exists to catch exactly that.

Preconditions: `.adoption/manifest.json` parses, and
`node .claude/ai-kit-adoption/scripts/check.mjs --root . --skip-repro` exits 0.

## Procedure

1. Materialize:
   `node .claude/ai-kit-adoption/scripts/materialize.mjs --root . --templates .claude/ai-kit-adoption/templates`
2. Read the generated files end to end. Judge coherence: section order,
   seams between verbatim blocks, orphaned references. Fix by reordering
   manifest entries, adjusting slots, or (sparingly, justified) a merge
   literal — then re-materialize. Commit each iteration:
   `git add -A && git commit -m "chore(adoption): materialize iteration <n>"`
3. Converge the mechanical gates — loop until BOTH exit 0:
   - `node .claude/ai-kit-adoption/scripts/check.mjs --root . --templates .claude/ai-kit-adoption/templates`
   - `node .claude/ai-kit-adoption/scripts/audit.mjs --root .`
   Audit findings carry rule IDs; fix via manifest/literal edits and
   re-materialize. If an audit finding and repo content genuinely conflict,
   surface it to the user rather than silently dropping content.
4. Regenerate the report: `node .claude/ai-kit-adoption/scripts/report.mjs --root .`
5. Commit, then tell the user: fresh session → `adopt-verify`.

If the iteration count climbs past ~6 without converging, STOP and report the
blocking pattern to the user (this is pivot-trigger telemetry — record it).
