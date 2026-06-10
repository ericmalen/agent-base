import { readText, lineOf, isAiKitOwnAsset, finding as _finding, stripFencedCodeBlocks } from '../finding.mjs';
import { parseFrontmatter } from '../../frontmatter.mjs';
import { SKILL_MD_MAX_LINES, SKILL_DESCRIPTION_MAX_CHARS } from '../thresholds.mjs';

const VSCODE_BUILTIN_COMMANDS = new Set([
  'create-skill', 'create-agent', 'create-prompt', 'create-instruction', 'create-hook',
]);

const f = (p) => _finding({ surface: 'skill', ...p });

export function checkSkill(absPath, rel, manifest) {
  const text = readText(absPath);
  if (!text) return [];
  const findings = [];
  const { frontmatter, body } = parseFrontmatter(text);

  const expectedName = rel.split('/').slice(-2, -1)[0]; // folder name
  const actualName = frontmatter.name ?? '';
  if (actualName && actualName !== expectedName) {
    findings.push(f({
      id: 'skill-name-folder-mismatch',
      severity: 'error',
      file: rel,
      message: `Skill name "${actualName}" does not match its folder name "${expectedName}".`,
      detail: 'The skill name in frontmatter must match the containing folder name exactly. Rename one to match the other.',
      fixable: 'deterministic',
    }));
  }

  // Flag plugin-namespace separators (: or /) — reserved for Claude Code
  // plugin-namespaced skills (e.g. "code-review:code-review").
  if (actualName && /[:/]/.test(actualName)) {
    findings.push(f({
      id: 'skill-name-has-namespace-separator',
      severity: 'warning',
      file: rel,
      message: `Skill name "${actualName}" contains a namespace separator (":" or "/").`,
      detail: 'These characters are reserved for plugin-namespaced skills. User-authored skills use only a simple kebab-case name matching their folder.',
      fixable: 'deterministic',
    }));
  }

  const desc = frontmatter.description ?? '';
  if (desc.length > SKILL_DESCRIPTION_MAX_CHARS) {
    findings.push(f({
      id: 'skill-description-too-long',
      severity: 'error',
      file: rel,
      message: `Skill description is ${desc.length} chars (max ${SKILL_DESCRIPTION_MAX_CHARS}).`,
      detail: 'Some AI tools truncate descriptions over 1024 chars. Move detail into the skill body.',
      fixable: 'deterministic',
      convention: '.claude/skills/README.md:122',
    }));
  }

  const aiKitOwned = isAiKitOwnAsset(rel, manifest);

  const lines = body.split('\n').length;
  if (lines > SKILL_MD_MAX_LINES && !aiKitOwned) {
    findings.push(f({
      id: 'skill-md-too-long',
      severity: 'warning',
      file: rel,
      message: `SKILL.md is ${lines} lines (max ~${SKILL_MD_MAX_LINES}).`,
      detail: 'Long SKILL.md files get truncated by context windows. Move detail into references/ and examples/ siblings.',
      fixable: 'semantic',
    }));
  }

  if (!aiKitOwned) {
    if (!desc && actualName) {
      findings.push(f({
        id: 'skill-weak-description',
        severity: 'info',
        file: rel,
        message: 'Skill is missing a description in frontmatter.',
        detail: 'A description is required for AI tools to discover and invoke this skill.',
        fixable: 'manual',
      }));
    } else if (desc && desc.split(' ').length < 8) {
      findings.push(f({
        id: 'skill-weak-description',
        severity: 'info',
        file: rel,
        message: 'Skill description is very short — consider expanding it.',
        detail: 'Include trigger phrasings and a "do not use for" clause so AI tools activate it correctly.',
        fixable: 'manual',
      }));
    }

    if (desc && !/\bwhen\b/i.test(desc)) {
      findings.push(f({
        id: 'skill-description-missing-when',
        severity: 'info',
        file: rel,
        message: 'Skill description does not mention when to invoke it.',
        detail: 'Include a "when" clause so AI tools activate the skill on the right trigger.',
        fixable: 'manual',
        convention: '.claude/skills/new-skill/SKILL.md:48-67',
      }));
    }
  }

  // Skill name collides with VS Code built-in /create-* commands
  if (actualName && VSCODE_BUILTIN_COMMANDS.has(actualName)) {
    findings.push(f({
      id: 'command-name-collides-with-vscode-builtin',
      severity: 'info',
      file: rel,
      message: `Skill name "${actualName}" shadows a VS Code built-in command.`,
      detail: 'VS Code ships built-in /create-skill, /create-agent, /create-prompt, /create-instruction, /create-hook. A skill with the same name will conflict in the slash menu.',
      fixable: 'manual',
      convention: '.claude/skills/README.md:65-72',
    }));
  }

  // Plaintext sibling paths: ./something or ../something in body.
  // Ignore matches inside fenced code blocks — those are shell examples, not prose.
  const bodyOutsideFences = stripFencedCodeBlocks(body);
  if (/(?:^|\s)\.\//m.test(bodyOutsideFences) || /(?:^|\s)\.\.\//m.test(bodyOutsideFences)) {
    const line = lineOf(bodyOutsideFences, /(?:^|\s)\.\.?\//m);
    findings.push(f({
      id: 'skill-body-uses-plaintext-sibling-paths',
      severity: 'info',
      file: rel,
      line,
      message: 'SKILL.md body uses relative plain-text paths (./... or ../....).',
      detail: 'Relative paths in skill bodies may not resolve correctly when the skill is invoked from a different context. Use document-relative paths from the consumer root.',
      fixable: 'semantic',
    }));
  }

  // Bare sibling paths outside Markdown links: references/foo.md, examples/bar.md, scripts/baz.sh
  // Negative lookbehind for "](" to avoid flagging properly-linked paths.
  const bareSiblingRe = /(?<!\]\()(?:^|(?<=\s))((?:references|examples|scripts)\/[a-z0-9_-]+\.(?:md|sh|mjs|js))/m;
  if (bareSiblingRe.test(body)) {
    const line = lineOf(body, bareSiblingRe);
    findings.push(f({
      id: 'skill-body-uses-bare-sibling-paths',
      severity: 'info',
      file: rel,
      line,
      message: 'SKILL.md body references sibling files as bare paths instead of Markdown links.',
      detail: 'Skills should link sibling files with Markdown links ([label](references/file.md)) so tools can lazily load them.',
      fixable: 'manual',
      convention: 'docs/conventions.md:10-21',
    }));
  }

  return findings;
}
