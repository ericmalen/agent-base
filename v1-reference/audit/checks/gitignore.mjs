import { join } from 'node:path';
import { exists } from '../../fsutil.mjs';
import { readText, finding as _finding } from '../finding.mjs';

const f = (p) => _finding({ surface: 'gitignore', ...p });

const REQUIRED_ENTRIES = [
  '.claude/settings.local.json',
  '.claude/ai-kit-audit-report.json',
];

function parseEntries(text) {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));
}

// True when `entry` is covered by `pattern` — either an exact match, or a
// directory-level pattern whose directory is a path-prefix of `entry`.
// e.g. `.claude/` or bare `.claude` both cover `.claude/settings.local.json`.
function patternCovers(pattern, entry) {
  if (pattern === entry) return true;
  const dir = pattern.endsWith('/') ? pattern.slice(0, -1) : pattern;
  if (!dir) return false;
  return entry === dir || entry.startsWith(dir + '/');
}

function isIgnored(entry, patterns) {
  return patterns.some(p => patternCovers(p, entry));
}

export function checkGitignore(consumerRoot) {
  const absPath = join(consumerRoot, '.gitignore');
  const rel = '.gitignore';

  if (!exists(absPath)) {
    // Only flag if this is a git repo (has .git/)
    if (!exists(join(consumerRoot, '.git'))) return [];
    return [f({
      id: 'gitignore-missing',
      severity: 'info',
      file: rel,
      message: 'No .gitignore found.',
      detail: 'A .gitignore should ignore .claude/settings.local.json and .claude/ai-kit-audit-report.json.',
      fixable: 'deterministic',
    })];
  }

  const text = readText(absPath) ?? '';
  const patterns = parseEntries(text);
  const missing = REQUIRED_ENTRIES.filter(e => !isIgnored(e, patterns));

  return missing.map(entry => f({
    id: 'gitignore-missing-ai-kit-entries',
    severity: 'info',
    file: rel,
    message: `.gitignore is missing the entry "${entry}".`,
    detail: `This file should be gitignored to avoid accidentally committing ${entry.includes('local') ? 'personal settings' : 'auto-generated audit reports'}.`,
    fixable: 'deterministic',
    suggestedFix: `Add "${entry}" to .gitignore`,
  }));
}
