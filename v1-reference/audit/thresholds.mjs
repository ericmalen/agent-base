export const ROOT_AGENTS_MAX_NONBLANK_LINES = 120;
export const ROOT_AGENTS_MAX_CHARS = 6000;
export const NESTED_AGENTS_MAX_LINES = 50;
export const SKILL_MD_MAX_LINES = 200;
export const SKILL_DESCRIPTION_MAX_CHARS = 1024;

// Severity overrides applied when --strict is set.
// Only checks that differ from their natural severity need entries here.
export const STRICT_SEVERITY = {
  // Prompts
  'prompt-routes-agent-with-redundant-fields': 'error',
  'prompt-missing-description': 'error',
  'prompt-weak-description': 'warning',
  'prompt-filename-not-kebab-case': 'warning',
  'prompt-teaching-material-missing-underscore': 'warning',
  // Root CLAUDE.md
  'root-claude-md-missing-agents-import': 'error',
  'root-claude-md-missing': 'warning',
  // Nested CLAUDE.md
  'nested-claude-md-missing-agents-import': 'error',
  // Settings
  'claude-settings-missing-env-deny': 'error',
  'claude-settings-missing-or-invalid': 'warning',
  'vscode-ai-key-missing-or-wrong': 'warning',
  'vscode-settings-missing': 'warning',
  // Gitignore
  'gitignore-missing-ai-kit-entries': 'warning',
  'gitignore-missing': 'warning',
  // Audit report
  'audit-report-committed': 'error',
  // Asset folders
  'asset-folder-missing-readme': 'warning',
  // Naming
  'command-name-collides-with-vscode-builtin': 'warning',
  'agent-filename-not-kebab-case': 'warning',
  // Skill tighteners (Wave 4)
  'skill-description-missing-when': 'warning',
  'skill-body-uses-bare-sibling-paths': 'warning',
  // Orphans (Wave 4)
  'skill-not-registered': 'warning',
  'agent-not-registered': 'warning',
};
