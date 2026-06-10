import { readText, lineOf, isAiKitOwnAsset, finding as _finding } from '../finding.mjs';
import { parseFrontmatter } from '../../frontmatter.mjs';

// Tool keyword detection for agent-grants-all-tools deterministic suggestion
const TOOL_KEYWORDS = [
  { tool: 'Read',  patterns: [/\bread(s|ing)?\b/i, /\bopen(s|ing)?\b/i, /\binspect\b/i] },
  { tool: 'Grep',  patterns: [/\bgrep\b/i, /\bsearch\b/i, /\bregex\b/i] },
  { tool: 'Glob',  patterns: [/\bglob\b/i, /\blist\s+files\b/i, /\bdiscover\s+files\b/i] },
  { tool: 'Edit',  patterns: [/\bedit(s|ing)?\b/i, /\bmodif(y|ies|ied)\b/i, /\breplace\b/i] },
  { tool: 'Write', patterns: [/\bwrite(s|ing)?\b/i, /\bcreate(s|ing)?\s+(a\s+)?file\b/i] },
  { tool: 'Bash',  patterns: [/\bbash\b/i, /\brun(s|ning)?\s+(the\s+)?command\b/i, /\bgit\s+\w+/i, /\bnpm\b/i, /\bcurl\b/i] },
];

function suggestToolList(body) {
  const procMatch = body.match(/##\s+procedures?\b([\s\S]*?)(?=\n##|\s*$)/i);
  if (!procMatch) return null;
  const procText = procMatch[1];
  const tools = TOOL_KEYWORDS
    .filter(({ patterns }) => patterns.some(re => re.test(procText)))
    .map(({ tool }) => tool);
  // Always include Read as baseline — most agents read something
  if (!tools.includes('Read')) tools.unshift('Read');
  return tools.join(', ');
}

const f = (p) => _finding({ surface: 'agent', ...p });

export function checkAgent(absPath, rel, manifest) {
  const text = readText(absPath);
  if (!text) return [];
  const findings = [];
  const { frontmatter, body } = parseFrontmatter(text);

  // Filename must be kebab-case
  const basename = absPath.split('/').pop().replace(/\.md$/, '');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(basename)) {
    findings.push(f({
      id: 'agent-filename-not-kebab-case',
      severity: 'info',
      file: rel,
      message: `Agent filename "${basename}.md" is not kebab-case.`,
      detail: 'Agent files should use kebab-case names (e.g. "code-reviewer.md").',
      fixable: 'deterministic',
      convention: 'docs/conventions.md:57-66',
    }));
  }

  if (!frontmatter.tools) {
    const suggestedTools = suggestToolList(body);
    findings.push(f({
      id: 'agent-grants-all-tools',
      severity: 'warning',
      file: rel,
      message: 'Agent has no "tools:" frontmatter — grants all tools by default.',
      detail: 'Explicitly list only the tools the agent needs. Minimizing tool grants reduces risk of unintended actions.',
      fixable: suggestedTools ? 'deterministic' : 'manual',
      suggestedFix: suggestedTools ? `tools: ${suggestedTools}` : undefined,
      convention: 'docs/conventions.md:43-49',
    }));
  }

  // Deterministic: markdown links in a ## Documents section
  const docSection = text.match(/##\s+documents?\b[\s\S]*?(?=\n##|\s*$)/i)?.[0] ?? '';
  if (docSection && /\[.+?\]\(.+?\)/.test(docSection)) {
    const line = lineOf(text, /##\s+documents?\b/i);
    findings.push(f({
      id: 'agent-documents-uses-markdown-links',
      severity: 'warning',
      file: rel,
      line,
      message: 'Agent ## Documents section uses Markdown links instead of plain file paths.',
      detail: 'AI tools read Documents sections as plain-text file paths to lazy-load. Use bare paths, not [label](path) syntax.',
      fixable: 'deterministic',
      convention: 'docs/conventions.md:10-21',
    }));
  }

  if (!/##\s+never\b/i.test(text)) {
    findings.push(f({
      id: 'agent-missing-never-section',
      severity: 'warning',
      file: rel,
      message: 'Agent is missing a "## Never" section.',
      detail: 'Every agent should have an explicit ## Never section listing prohibited actions.',
      fixable: 'semantic',
    }));
  }

  if (!/##\s+procedures?\b/i.test(text)) {
    findings.push(f({
      id: 'agent-missing-procedures-section',
      severity: 'warning',
      file: rel,
      message: 'Agent is missing a "## Procedures" section.',
      detail: 'Agents need a step-by-step ## Procedures section so they execute predictably.',
      fixable: 'manual',
    }));
  }

  // Role statement: first non-blank, non-heading body line after frontmatter
  const bodyLines = body.split('\n').filter(l => l.trim());
  const firstContentLine = bodyLines.find(l => !l.startsWith('#'));
  if (!firstContentLine) {
    findings.push(f({
      id: 'agent-missing-role-statement',
      severity: 'warning',
      file: rel,
      message: 'Agent appears to be missing a role statement (first non-heading body line).',
      detail: 'A one-line role statement immediately after the title tells AI tools what the agent does and what it never does.',
      fixable: 'manual',
    }));
  }

  const desc = frontmatter.description ?? '';
  if (!isAiKitOwnAsset(rel, manifest)) {
    if (desc && desc.split(' ').length < 8) {
      findings.push(f({
        id: 'agent-weak-description',
        severity: 'info',
        file: rel,
        message: 'Agent description is very short — consider expanding it.',
        detail: 'A richer description helps AI tools decide when to invoke this agent. Include trigger phrasings and a "do not use for" clause.',
        fixable: 'manual',
      }));
    }

    if (desc && !/\bwhen\b/i.test(desc)) {
      findings.push(f({
        id: 'agent-description-missing-when',
        severity: 'info',
        file: rel,
        message: 'Agent description does not mention when to invoke it.',
        detail: 'Include a "when" clause so AI tools activate the agent on the right trigger.',
        fixable: 'semantic',
      }));
    }
  }

  return findings;
}
