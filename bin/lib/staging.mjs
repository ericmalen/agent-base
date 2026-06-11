// staging.mjs — copy-once-immutable release staging for the bootstrap commands.
// npx delivers the package into a prunable cache (~/.npm/_npx); the AI-tool
// sessions that base-setup/base-orchestrate dispatch need the checkout at a
// stable path across sessions. So the CLI copies the whole package to
// ~/.agent-base/versions/<tag>/ exactly once per tag (sentinel written last;
// a partial stage without the sentinel is wiped and re-copied). Staged
// releases are immutable — never `git pull`ed (npm strips .git anyway).
//
// Dev escape hatch: running from a clone (pkgRoot/.git present) skips staging
// and points the prompt at the clone itself.
//
// CLI-only module: lives under bin/lib/, NOT scripts/lib/ (which ships
// wholesale into projects via the installer allowlist).

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { compareSemver, tagToSemver } from '../../scripts/lib/release.mjs';

export const SENTINEL = '.agent-base-staged';

export function pkgRootFromHere() {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
}

export function versionsDir(home = homedir()) {
  return join(home, '.agent-base', 'versions');
}

/**
 * Ensure the package at pkgRoot is available at a stable, immutable path.
 * Returns { path, tag, dev, copied }:
 *   dev    — running from a git clone; nothing staged, path = the clone
 *   copied — true when this call performed the copy (false: already staged)
 */
export function stageRelease({ pkgRoot = pkgRootFromHere(), home = homedir() } = {}) {
  if (existsSync(join(pkgRoot, '.git'))) {
    return { path: pkgRoot, tag: null, dev: true, copied: false };
  }
  const version = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8')).version ?? '0.0.0';
  const tag = `v${version}`;
  const dest = join(versionsDir(home), tag);
  const sentinel = join(dest, SENTINEL);

  if (existsSync(sentinel)) return { path: dest, tag, dev: false, copied: false };
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true }); // partial stage — redo

  mkdirSync(dirname(dest), { recursive: true });
  cpSync(pkgRoot, dest, { recursive: true });
  writeFileSync(sentinel, `${new Date().toISOString()}\n`);
  return { path: dest, tag, dev: false, copied: true };
}

/** Staged tags, newest first. Entries without a sentinel are flagged partial. */
export function listStaged(home = homedir()) {
  const dir = versionsDir(home);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map((tag) => ({ tag, semver: tagToSemver(tag), path: join(dir, tag) }))
    .filter((e) => e.semver)
    .sort((a, b) => compareSemver(b.semver, a.semver))
    .map(({ tag, path }) => ({ tag, path, partial: !existsSync(join(path, SENTINEL)) }));
}

/** Remove all but the newest `keep` staged releases. Returns removed tags. */
export function pruneStaged({ keep = 2, home = homedir() } = {}) {
  const removed = [];
  for (const e of listStaged(home).slice(Math.max(0, keep))) {
    rmSync(e.path, { recursive: true, force: true });
    removed.push(e.tag);
  }
  return removed;
}
