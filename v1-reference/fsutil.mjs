import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, copyFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

export function hashFile(absPath) {
  const bytes = readFileSync(absPath);
  return createHash('sha256').update(bytes).digest('hex');
}

export function copyFile(src, dst) {
  mkdirSync(dirname(dst), { recursive: true });
  copyFileSync(src, dst);
}

export function* walkFiles(dir, { skipDirs = new Set() } = {}) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      yield* walkFiles(full, { skipDirs });
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

export function exists(p) {
  return existsSync(p);
}
