import { readText, finding as _finding } from '../finding.mjs';
import { parseFrontmatter } from '../../frontmatter.mjs';

const f = (p) => _finding({ surface: 'prompt', ...p });

// Matches *.prompt.md but not _*.prompt.md (teaching material has underscore prefix)
const KEBAB_PROMPT_RE = /^[a-z0-9][a-z0-9-]*\.prompt\.md$/;
const TEACHING_DESCRIPTION_RE = /^(example|demo)\b/i;

export function checkPrompt(absPath, rel) {
  const text = readText(absPath);
  if (!text) return [];
  const findings = [];
  const { frontmatter } = parseFrontmatter(text);
  const filename = absPath.split('/').pop();

  // When a prompt routes to an agent, model and tools must be omitted.
  // The agent is the source of truth for those — duplicating them causes drift.
  if (frontmatter.agent) {
    if (frontmatter.model || frontmatter.tools) {
      findings.push(f({
        id: 'prompt-routes-agent-with-redundant-fields',
        severity: 'warning',
        file: rel,
        message: `Prompt routes to agent "${frontmatter.agent}" but also sets ${[frontmatter.model && 'model', frontmatter.tools && 'tools'].filter(Boolean).join(' and ')}.`,
        detail: 'When a prompt has "agent:", the agent owns model and tools. Duplicating them causes drift.',
        fixable: 'deterministic',
        convention: 'docs/conventions.md:51-55',
      }));
    }
  }

  const desc = frontmatter.description ?? '';
  if (!desc) {
    findings.push(f({
      id: 'prompt-missing-description',
      severity: 'warning',
      file: rel,
      message: 'Prompt is missing a description in frontmatter.',
      detail: 'A description is required for AI tools to discover and invoke this prompt.',
      fixable: 'manual',
    }));
  } else if (desc.split(' ').length < 8) {
    findings.push(f({
      id: 'prompt-weak-description',
      severity: 'info',
      file: rel,
      message: 'Prompt description is very short — consider expanding it.',
      detail: 'Include trigger phrasings and a "do not use for" clause so AI tools invoke it correctly.',
      fixable: 'manual',
    }));
  }

  // Teaching material (examples/demos) should have underscore prefix
  if (!filename.startsWith('_')) {
    if (!KEBAB_PROMPT_RE.test(filename)) {
      findings.push(f({
        id: 'prompt-filename-not-kebab-case',
        severity: 'info',
        file: rel,
        message: `Prompt filename "${filename}" is not kebab-case (expected: [a-z0-9-]+.prompt.md).`,
        detail: 'Prompt files should use kebab-case names like "review-file.prompt.md". Teaching material gets an underscore prefix: "_example.prompt.md".',
        fixable: 'deterministic',
        convention: 'docs/conventions.md:63-67',
      }));
    }

    if (desc && TEACHING_DESCRIPTION_RE.test(desc)) {
      findings.push(f({
        id: 'prompt-teaching-material-missing-underscore',
        severity: 'info',
        file: rel,
        message: `Prompt description starts with "Example"/"Demo" but filename lacks an underscore prefix.`,
        detail: 'Teaching material should be prefixed with "_" (e.g. "_example-review.prompt.md") to sort visually and signal it is not a real command.',
        fixable: 'deterministic',
        convention: 'docs/conventions.md:65-66',
      }));
    }
  }

  return findings;
}
