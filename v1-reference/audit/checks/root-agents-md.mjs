import { readText, lineOf, finding as _finding } from '../finding.mjs';
import { ROOT_AGENTS_MAX_NONBLANK_LINES, ROOT_AGENTS_MAX_CHARS } from '../thresholds.mjs';

const f = (p) => _finding({ surface: 'root-agents-md', ...p });

export function checkRootAgentsMd(absPath, rel) {
  const text = readText(absPath);
  if (!text) return [];
  const findings = [];

  const nonBlankLines = text.split('\n').filter(l => l.trim()).length;
  const chars = text.length;
  if (nonBlankLines > ROOT_AGENTS_MAX_NONBLANK_LINES || chars > ROOT_AGENTS_MAX_CHARS) {
    findings.push(f({
      id: 'agents-md-over-two-pages',
      severity: 'warning',
      file: rel,
      message: `Root AGENTS.md is long (${nonBlankLines} non-blank lines, ${chars} chars). Two pages is the recommended maximum.`,
      detail: 'A long root AGENTS.md slows every AI interaction. Move directory-specific rules to nested AGENTS.md files using the layer-agents skill.',
      fixable: 'semantic',
      convention: 'docs/conventions.md:38-40',
    }));
  }

  if (!/##\s*do\s*not/i.test(text)) {
    findings.push(f({
      id: 'agents-md-missing-do-not-section',
      severity: 'warning',
      file: rel,
      message: 'Root AGENTS.md is missing a "Do Not" section.',
      detail: 'A "## Do Not" section lists universal prohibitions (no secrets in code, no @ts-ignore, etc.).',
      fixable: 'manual',
    }));
  }

  if (/<!--\s*TODO:/i.test(text)) {
    const line = lineOf(text, /<!--\s*TODO:/i);
    findings.push(f({
      id: 'agents-md-unfilled-todo',
      severity: 'info',
      file: rel,
      line,
      message: 'Root AGENTS.md has unfilled TODO placeholders.',
      detail: 'Fill in each <!-- TODO: ... --> section with real project content.',
      fixable: 'none',
    }));
  }

  // Heuristic: heading or bullet names a specific subdir/layer
  const subdirPattern = /(?:^|\n)\s*(?:#+|-)\s+[A-Za-z0-9_\-./]+\/[^\n]{0,80}/;
  if (subdirPattern.test(text)) {
    const line = lineOf(text, subdirPattern);
    findings.push(f({
      id: 'agents-md-directory-scoped-rule',
      severity: 'info',
      file: rel,
      line,
      message: 'Root AGENTS.md may contain directory-scoped rules that belong in a nested AGENTS.md.',
      detail: 'Rules specific to a subdirectory or layer load faster and are more targeted when placed in a nested AGENTS.md + sibling CLAUDE.md.',
      fixable: 'semantic',
    }));
  }

  return findings;
}
