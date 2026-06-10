import { join } from 'node:path';
import { finding as _finding } from '../finding.mjs';
import { exists } from '../../fsutil.mjs';

const f = (p) => _finding({ surface: 'cross-file', ...p });

const ASSET_DIRS = [
  '.claude/agents',
  '.claude/skills',
  '.github/prompts',
];

export function checkAssetFolderReadmes(consumerRoot) {
  const findings = [];
  for (const dir of ASSET_DIRS) {
    const absDir = join(consumerRoot, dir);
    if (!exists(absDir)) continue;
    const readme = join(absDir, 'README.md');
    if (!exists(readme)) {
      findings.push(f({
        id: 'asset-folder-missing-readme',
        severity: 'info',
        file: `${dir}/README.md`,
        message: `${dir}/ exists but has no README.md.`,
        detail: 'Each asset folder should have a README.md explaining the conventions for that surface.',
        fixable: 'deterministic',
        convention: 'docs/conventions.md:80-82',
      }));
    }
  }
  return findings;
}
