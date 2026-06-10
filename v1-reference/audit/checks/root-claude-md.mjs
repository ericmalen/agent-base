import { readText, finding as _finding } from '../finding.mjs';
import { exists } from '../../fsutil.mjs';

const f = (p) => _finding({ surface: 'root-claude-md', ...p });

export function checkRootClaudeMd(absPath, rel) {
  if (!exists(absPath)) {
    return [f({
      id: 'root-claude-md-missing',
      severity: 'info',
      file: rel,
      message: 'Root CLAUDE.md is absent.',
      detail: 'Claude Code reads CLAUDE.md, not AGENTS.md. A root CLAUDE.md containing "@AGENTS.md" is required so Claude Code picks up the project rules.',
      fixable: 'deterministic',
      convention: 'docs/cross-tool-setup.md:41-51',
    })];
  }

  const text = readText(absPath);
  if (text && !/@AGENTS\.md/.test(text)) {
    return [f({
      id: 'root-claude-md-missing-agents-import',
      severity: 'warning',
      file: rel,
      message: 'Root CLAUDE.md exists but does not contain "@AGENTS.md".',
      detail: 'The root CLAUDE.md must import AGENTS.md via "@AGENTS.md" so Claude Code reads the canonical project rules.',
      fixable: 'deterministic',
      convention: 'docs/cross-tool-setup.md:41-51',
    })];
  }

  return [];
}
