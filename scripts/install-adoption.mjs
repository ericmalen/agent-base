#!/usr/bin/env node
// install-adoption — copy the adoption tooling from a kit clone into a target
// repo. Run FROM the kit clone:
//   node <kit>/scripts/install-adoption.mjs /path/to/target-repo
//
// Installs (all removable; adopt-verify removes them before merge):
//   .claude/ai-kit-adoption/scripts/      (extractor, check, materialize, audit, report)
//   .claude/ai-kit-adoption/templates/    (target skeletons + wiring bases)
//   .claude/skills/adopt-{inventory,plan,materialize,verify}/
//   .claude/agents/adoption-verifier.md

import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

const kitRoot = resolve(dirname(new URL(import.meta.url).pathname), '..');
const target = process.argv[2] ? resolve(process.argv[2]) : null;

if (!target) {
  console.error('usage: node scripts/install-adoption.mjs /path/to/target-repo');
  process.exit(1);
}
if (!existsSync(target)) {
  console.error(`install-adoption: target does not exist: ${target}`);
  process.exit(1);
}
const inTree = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: target, encoding: 'utf8' });
if (inTree.status !== 0 || inTree.stdout.trim() !== 'true') {
  console.error('install-adoption: target is not a git repository.');
  process.exit(1);
}
const major = Number(process.versions.node.split('.')[0]);
if (major < 20) {
  console.error(`install-adoption: node >= 20 required (found ${process.versions.node}).`);
  process.exit(1);
}

const copies = [
  ['scripts', '.claude/ai-kit-adoption/scripts'],
  ['templates', '.claude/ai-kit-adoption/templates'],
  ['.claude/skills/adopt-inventory', '.claude/skills/adopt-inventory'],
  ['.claude/skills/adopt-plan', '.claude/skills/adopt-plan'],
  ['.claude/skills/adopt-materialize', '.claude/skills/adopt-materialize'],
  ['.claude/skills/adopt-verify', '.claude/skills/adopt-verify'],
  ['.claude/agents/adoption-verifier.md', '.claude/agents/adoption-verifier.md'],
];

for (const [src, dst] of copies) {
  const from = join(kitRoot, src);
  const to = join(target, dst);
  if (!existsSync(from)) {
    console.error(`install-adoption: missing in kit: ${src} (incomplete clone?)`);
    process.exit(1);
  }
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
  console.log(`  installed: ${dst}`);
}

console.log(`
Done. Next, in the target repo:
  1. Commit the tooling:  git add -A && git commit -m "chore: ai-kit adoption tooling"
  2. Open your AI tool (Claude Code, or VS Code Copilot in AGENT MODE) and
     invoke the adopt-inventory skill.
Adoption is fully reversible until you merge the ai-kit-adoption branch
(the tooling itself is removed again before merge by adopt-verify).`);
