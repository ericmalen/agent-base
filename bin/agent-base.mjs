#!/usr/bin/env node
// agent-base — npx entry point. `npx github:<owner>/agent-base#<tag> <command>`.
//
// Deterministic commands spawn the existing scripts/ entry points with argv
// passed through byte-for-byte (no flag re-parsing here); bootstrap commands
// stage the release to ~/.agent-base/versions/<tag>/ and print the bootstrap
// prompt to paste into an AI session. The clone workflow is unchanged — this
// bin is additive and never ships into projects (see scripts/lib/baseline.mjs
// allowlist; AGENTS.md "Do Not").
//
// Exit: passthrough for delegated scripts · 0 ok · 2 usage error

import { spawnSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { stageRelease, listStaged, pruneStaged } from './lib/staging.mjs';
import { printBootstrap } from './lib/prompts.mjs';

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// command → scripts/ entry point (argv after the command passes through verbatim)
const DELEGATED = {
  install: 'install-setup.mjs',
  audit: 'audit.mjs',
  sync: 'sync-baseline.mjs',
  'tracker-sync': 'tracker-sync.mjs',
  starter: 'build-starter.mjs',
  'headless-guard': 'headless-guard.mjs',
};

const LLM_ENTRIES = new Set(['setup', 'orchestrate', 'refresh']);

const HELP = `agent-base — install and maintain AI-coding setups (npx or clone)

Usage: agent-base <command> [args]

Bootstrap (stages this release, prints a prompt for your AI session):
  setup [path]            agent-base setup of a repository (base-setup)
  orchestrate [path]      generate repo-specific orchestration (base-orchestrate)
  refresh [path]          upgrade a project's baseline pin (base-refresh)

Deterministic (delegates to the matching scripts/ entry point):
  install <path>          copy setup tooling into a project (install-setup.mjs)
  audit [--root --json --strict]
  sync [--root --check|--report|--upgrade ...]   (sync-baseline.mjs)
  tracker-sync [--target --apply ...]
  starter <dir> [--git]   emit a clean starter repo (build-starter.mjs)
  headless-guard [--root --open-branches <json>]

Release store (~/.agent-base/versions/):
  cache list              staged releases, newest first
  cache prune [--keep N]  remove all but the newest N (default 2)

  --version | --help
`;

const [command, ...rest] = process.argv.slice(2);

if (!command || command === '--help' || command === 'help') {
  process.stdout.write(HELP);
  process.exit(command ? 0 : 2);
}

if (command === '--version' || command === 'version') {
  const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8'));
  console.log(pkg.version ?? '0.0.0');
  process.exit(0);
}

if (DELEGATED[command]) {
  const r = spawnSync(process.execPath, [join(pkgRoot, 'scripts', DELEGATED[command]), ...rest], {
    stdio: 'inherit',
  });
  process.exit(r.status ?? 1);
}

if (LLM_ENTRIES.has(command)) {
  const targetPath = rest[0] ? resolve(rest[0]) : process.cwd();
  const { path, dev, copied } = stageRelease({ pkgRoot });
  console.log(printBootstrap({ command, checkoutPath: path, targetPath, dev, copied }));
  process.exit(0);
}

if (command === 'cache') {
  const [sub, ...cacheArgs] = rest;
  if (sub === 'list' || sub === undefined) {
    const entries = listStaged();
    if (!entries.length) console.log('cache: no staged releases.');
    for (const e of entries) console.log(`${e.tag}  ${e.path}${e.partial ? '  (partial — re-staged on next use)' : ''}`);
    process.exit(0);
  }
  if (sub === 'prune') {
    let keep = 2;
    for (let i = 0; i < cacheArgs.length; i++) {
      if (cacheArgs[i] === '--keep') keep = Number(cacheArgs[++i]);
      else { console.error(`agent-base cache prune: unknown flag ${cacheArgs[i]}`); process.exit(2); }
    }
    if (!Number.isInteger(keep) || keep < 0) { console.error('agent-base cache prune: --keep must be a non-negative integer'); process.exit(2); }
    const removed = pruneStaged({ keep });
    console.log(removed.length ? `pruned: ${removed.join(', ')}` : 'cache: nothing to prune.');
    process.exit(0);
  }
  console.error(`agent-base cache: unknown subcommand ${sub}`);
  process.exit(2);
}

console.error(`agent-base: unknown command ${command} (try --help)`);
process.exit(2);
