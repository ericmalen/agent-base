import { exists } from '../../fsutil.mjs';
import { readJsonConfig } from '../../json-config.mjs';
import { finding as _finding } from '../finding.mjs';

const f = (p) => _finding({ surface: 'claude-settings', ...p });

const REQUIRED_DENY_RULES = ['Read(./.env)', 'Read(./.env.*)'];

export function checkClaudeSettings(absPath, rel) {
  if (!exists(absPath)) {
    return [f({
      id: 'claude-settings-missing-or-invalid',
      severity: 'info',
      file: rel,
      message: '.claude/settings.json is absent.',
      detail: 'A .claude/settings.json with deny rules for .env files is recommended to prevent accidental secret exposure.',
      fixable: 'manual',
      convention: 'docs/cross-tool-setup.md:86-87',
    })];
  }

  const config = readJsonConfig(absPath);
  if (!config) {
    return [f({
      id: 'claude-settings-missing-or-invalid',
      severity: 'info',
      file: rel,
      message: '.claude/settings.json could not be parsed.',
      detail: 'Check that the file is valid JSON.',
      fixable: 'manual',
    })];
  }

  const deny = config?.permissions?.deny ?? [];
  const missingRules = REQUIRED_DENY_RULES.filter(rule => !deny.includes(rule));
  if (missingRules.length > 0) {
    return [f({
      id: 'claude-settings-missing-env-deny',
      severity: 'warning',
      file: rel,
      message: `.claude/settings.json is missing deny rule(s): ${missingRules.join(', ')}.`,
      detail: 'Deny rules for .env files prevent Claude Code from accidentally reading secrets.',
      fixable: 'deterministic',
      suggestedFix: `Add to permissions.deny: ${JSON.stringify(missingRules)}`,
      convention: '.claude/settings.json:23-26',
    })];
  }

  return [];
}
