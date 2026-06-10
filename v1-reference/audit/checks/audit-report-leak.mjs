import { join } from 'node:path';
import { exists } from '../../fsutil.mjs';
import { readText, finding as _finding } from '../finding.mjs';

const f = (p) => _finding({ surface: 'cross-file', ...p });

const REPORT_PATH = '.claude/ai-kit-audit-report.json';

function isGitignored(consumerRoot) {
  const gitignorePath = join(consumerRoot, '.gitignore');
  const text = readText(gitignorePath);
  if (!text) return false;
  return text.split('\n').some(l => l.trim() === REPORT_PATH);
}

export function checkAuditReportLeak(consumerRoot) {
  const reportAbs = join(consumerRoot, REPORT_PATH);
  if (!exists(reportAbs)) return [];
  if (isGitignored(consumerRoot)) return [];

  return [f({
    id: 'audit-report-committed',
    severity: 'warning',
    file: REPORT_PATH,
    message: '.claude/ai-kit-audit-report.json exists on disk and is not in .gitignore.',
    detail: 'This auto-generated file will be committed on the next "git add ." unless gitignored.',
    fixable: 'deterministic',
    suggestedFix: `Add "${REPORT_PATH}" to .gitignore`,
  })];
}
