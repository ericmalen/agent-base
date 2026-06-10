import { exists } from '../../fsutil.mjs';
import { readJsonConfig } from '../../json-config.mjs';
import { finding as _finding } from '../finding.mjs';

const f = (p) => _finding({ surface: 'vscode-settings', ...p });

const REQUIRED_VSCODE_KEYS = {
  'chat.useAgentsMdFile': true,
  'chat.useNestedAgentsMdFiles': true,
  'chat.useClaudeMdFile': false,
  'chat.useCustomizationsInParentRepositories': true,
  'chat.useAgentSkills': true,
  'chat.useCustomAgentHooks': true,
  'chat.subagents.allowInvocationsFromSubagents': true,
  'chat.tools.terminal.enableAutoApprove': false,
};

export function checkVscodeSettings(absPath, rel) {
  if (!exists(absPath)) {
    return [f({
      id: 'vscode-settings-missing',
      severity: 'info',
      file: rel,
      message: '.vscode/settings.json is absent.',
      detail: 'A .vscode/settings.json with required Copilot keys is needed for full cross-tool coverage.',
      fixable: 'manual',
      convention: 'docs/copilot-customization-reference.md:467-492',
    })];
  }

  const config = readJsonConfig(absPath);
  if (!config) return [];

  const findings = [];
  for (const [key, expectedValue] of Object.entries(REQUIRED_VSCODE_KEYS)) {
    const actualValue = config[key];
    if (actualValue === undefined || actualValue !== expectedValue) {
      findings.push(f({
        id: 'vscode-ai-key-missing-or-wrong',
        severity: 'info',
        file: rel,
        message: `VS Code key "${key}" ${actualValue === undefined ? 'is missing' : `is ${JSON.stringify(actualValue)} (expected ${JSON.stringify(expectedValue)})`}.`,
        detail: 'This key is required for full Copilot + ai-kit integration.',
        fixable: 'manual',
        suggestedFix: `"${key}": ${JSON.stringify(expectedValue)}`,
        convention: 'docs/copilot-customization-reference.md:467-492',
      }));
    }
  }
  return findings;
}
