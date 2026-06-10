import { join, dirname } from 'node:path';
import { readText, finding as _finding } from '../finding.mjs';
import { exists } from '../../fsutil.mjs';
import { NESTED_AGENTS_MAX_LINES } from '../thresholds.mjs';

const f = (p) => _finding({ surface: 'nested-agents-md', ...p });

export function checkNestedAgentsMd(absPath, rel) {
  const text = readText(absPath);
  if (!text) return [];
  const findings = [];

  const lines = text.split('\n').length;
  if (lines > NESTED_AGENTS_MAX_LINES) {
    findings.push(f({
      id: 'nested-agents-md-too-long',
      severity: 'warning',
      file: rel,
      message: `Nested AGENTS.md is ${lines} lines (max ~${NESTED_AGENTS_MAX_LINES}).`,
      detail: 'Nested AGENTS.md files should stay short and focused. Move content to skills if it is growing.',
      fixable: 'semantic',
    }));
  }

  if (text.startsWith('---')) {
    findings.push(f({
      id: 'nested-agents-md-has-frontmatter',
      severity: 'warning',
      file: rel,
      message: 'Nested AGENTS.md should not have YAML frontmatter.',
      detail: 'Only agent and skill files use frontmatter. Nested AGENTS.md is plain markdown.',
      fixable: 'deterministic',
    }));
  }

  const sibling = join(dirname(absPath), 'CLAUDE.md');
  if (!exists(sibling)) {
    findings.push(f({
      id: 'nested-agents-md-missing-sibling-claude',
      severity: 'warning',
      file: rel,
      message: 'Nested AGENTS.md has no sibling CLAUDE.md.',
      detail: 'Claude Code only reads CLAUDE.md, not AGENTS.md. A sibling CLAUDE.md containing "@AGENTS.md" is required for full coverage.',
      fixable: 'deterministic',
      convention: 'docs/cross-tool-setup.md:93-98',
    }));
  } else {
    // Check content: sibling CLAUDE.md must contain the @AGENTS.md import
    const claudeText = readText(sibling);
    if (claudeText && !/@AGENTS\.md/.test(claudeText)) {
      findings.push(f({
        id: 'nested-claude-md-missing-agents-import',
        severity: 'warning',
        file: join(dirname(rel), 'CLAUDE.md'),
        message: 'Sibling CLAUDE.md exists but does not contain "@AGENTS.md".',
        detail: 'The sibling CLAUDE.md must contain exactly "@AGENTS.md" so Claude Code picks up the nested rules.',
        fixable: 'deterministic',
        convention: 'docs/cross-tool-setup.md:93-98',
      }));
    }
  }

  return findings;
}
