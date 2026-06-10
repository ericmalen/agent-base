import { join } from 'node:path';
import { readdirSync } from 'node:fs';
import { exists } from '../../fsutil.mjs';
import { finding as _finding } from '../finding.mjs';

const f = (p) => _finding({ surface: 'cross-file', ...p });

// Dirs that ai-kit migrate consumes and then expects to remove. If any of these
// still exist post-migrate, something didn't get swept (stray sibling files
// like README.md, or migrate skipped due to collision/non-approval).
const STALE_DIRS = ['.github/agents', '.github/skills', '.github/prompts'];

export function checkStaleGithubDirs(consumerRoot) {
  const findings = [];
  for (const dir of STALE_DIRS) {
    const abs = join(consumerRoot, dir);
    if (!exists(abs)) continue;

    let entries;
    try { entries = readdirSync(abs); } catch { continue; }
    if (entries.length === 0) {
      findings.push(f({
        id: 'stale-github-dir',
        severity: 'warning',
        file: dir,
        message: `${dir}/ is empty and should be removed.`,
        detail: 'ai-kit migrate moves AI-config out of .github/ into .claude/. An empty .github/ subdir indicates leftover scaffolding.',
        fixable: 'deterministic',
        suggestedFix: `rmdir ${dir}`,
      }));
    } else {
      findings.push(f({
        id: 'stale-github-dir',
        severity: 'warning',
        file: dir,
        message: `${dir}/ still contains ${entries.length} item(s) after migrate.`,
        detail: `Strays: ${entries.slice(0, 5).join(', ')}${entries.length > 5 ? `, …` : ''}. Either route them to .claude/ or delete them so the parent dir can be cleaned up.`,
        fixable: 'deterministic',
        suggestedFix: `Review and remove .github/${dir.split('/').slice(1).join('/')}/`,
      }));
    }
  }
  return findings;
}
