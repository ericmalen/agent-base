---
name: agent-instantiator
description: Orchestration generation step — instantiates ONE agent definition (specialist or orchestrator) from its agent template via pure slot substitution from a validated blueprint entry, writing the result into the target repo's .claude/agents/. Zero authoring; the same blueprint always yields byte-identical output. Use when an orchestration blueprint.json has passed the handoff gate and its agents must be materialized into a target repo. Not for creating or designing new agents (use agent-creator), not for instantiating paired skills (use skill-instantiator), not for ai-kit adoption materialization, and not for any agent work outside orchestration generation.
---

# agent-instantiator

Pure substitution, zero authoring: a blueprint agent entry plus a target path
in, one generated agent file out. The engine is
[instantiate.mjs](../../../scripts/lib/orchestration/instantiate.mjs) (strict
inline slot substitution — unfilled, unused, or malformed markers are all
errors). Version pins and sha256 template pins live in
[template-registry.json](../../../templates/orchestration/template-registry.json) —
consumed by the scaffolder's manifest, not by this single-asset step.

## Inputs

- A blueprint entry: one of `specialists[]` or the `orchestrator` from a
  validated `docs/orchestration/blueprint.json` in the target.
- The target repo path.
- The entry's template: `templates/orchestration/agents/<templateId>.template.md`
  in the kit clone.

## Procedure

1. Derive the flat slot map — `entry.slots` PLUS the injected quartet:

   | slot | value |
   |---|---|
   | `name` | `entry.name` |
   | `tools` | `entry.tools.join(", ")` |
   | `model-tier` | `entry.modelTier` |
   | `turn-limit` | `String(entry.turnLimit)` |

2. Instantiate the template strictly. From the kit clone root:

   ```
   node --input-type=module -e '
   import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
   import { instantiateTemplate } from "./scripts/lib/orchestration/instantiate.mjs";
   const [bpPath, agentName, target] = process.argv.slice(1);
   const bp = JSON.parse(readFileSync(bpPath, "utf8"));
   const entry = [...bp.specialists, bp.orchestrator].find((a) => a.name === agentName);
   if (!entry) { console.error(`no agent "${agentName}" in blueprint`); process.exit(1); }
   const tplPath = `templates/orchestration/agents/${entry.templateId}.template.md`;
   if (!existsSync(tplPath)) { console.error(`missing template ${tplPath}`); process.exit(1); }
   const slots = { ...entry.slots, name: entry.name, tools: entry.tools.join(", "),
     "model-tier": entry.modelTier, "turn-limit": String(entry.turnLimit) };
   const { content, errors } = instantiateTemplate(readFileSync(tplPath, "utf8"), slots);
   if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
   mkdirSync(`${target}/.claude/agents`, { recursive: true });
   writeFileSync(`${target}/.claude/agents/${entry.name}.md`, content);
   console.log(`wrote ${target}/.claude/agents/${entry.name}.md`);
   ' <blueprint.json> <agent-name> <target>
   ```

3. On success the file lands at `<target>/.claude/agents/<entry.name>.md`,
   byte-exact as substituted — no reformatting, no edits.

## Error discipline

On ANY error (missing entry, missing template, unfilled/unused/malformed
slot): stop and report the error-string array verbatim. Never write partial
output; never hand-patch the template, the slots, or the generated file.
Fixes belong upstream in the blueprint (re-gate it with handoff-validator)
or in the kit template.

## Contract

Deterministic: the same blueprint entry against the same template version
produces byte-identical output on every run. Repeat runs are safe overwrites,
never merges.
