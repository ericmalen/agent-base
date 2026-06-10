import { join, relative, dirname } from 'node:path';
import { getScaffoldRoot, getConsumerRoot } from './paths.mjs';
import { loadRegistry } from './registry.mjs';
import { readManifest } from './manifest.mjs';
import { walkFiles, exists } from './fsutil.mjs';
import { log } from './log.mjs';
import { checkRootAgentsMd } from './audit/checks/root-agents-md.mjs';
import { checkNestedAgentsMd } from './audit/checks/nested-agents-md.mjs';
import { checkAgent } from './audit/checks/agent.mjs';
import { checkSkill } from './audit/checks/skill.mjs';
import { checkCrossFile } from './audit/checks/cross-file.mjs';
import { checkPrompt } from './audit/checks/prompt.mjs';
import { checkRootClaudeMd } from './audit/checks/root-claude-md.mjs';
import { checkAssetFolderReadmes } from './audit/checks/readmes.mjs';
import { checkClaudeSettings } from './audit/checks/claude-settings.mjs';
import { checkVscodeSettings } from './audit/checks/vscode-settings.mjs';
import { checkGitignore } from './audit/checks/gitignore.mjs';
import { checkAuditReportLeak } from './audit/checks/audit-report-leak.mjs';
import { checkStaleGithubDirs } from './audit/checks/stale-github-dirs.mjs';
import { checkBrokenReference } from './audit/checks/broken-reference.mjs';
import { STRICT_SEVERITY } from './audit/thresholds.mjs';

const CONSUMER_SKIP_DIRS = new Set([
  '.git', '.claude', 'node_modules', '.next', 'dist', 'build', '.turbo', '.cache',
]);

export async function audit(flags) {
  const aiKitRoot = getScaffoldRoot(import.meta.url);
  const consumerRoot = flags?._consumerRoot ?? getConsumerRoot();
  const registry = loadRegistry(aiKitRoot);
  const manifest = readManifest(consumerRoot, registry.manifestName);

  const emptyReport = (message) => {
    if (!flags?.json) log.info(message);
    return {
      schemaVersion: 2,
      scannedAt: new Date().toISOString(),
      consumerRoot,
      strict: flags?.strict ?? false,
      summary: { error: 0, warning: 0, info: 0, filesScanned: 0, bySurface: {} },
      findings: [],
    };
  };

  if (!manifest) {
    return emptyReport('Not initialized. Run `ai-kit init` first.');
  }

  const allFindings = [];
  let filesScanned = 0;
  const installedSkillDirs = [];

  // ── Root AGENTS.md ──────────────────────────────────────────────────────────
  const rootAgentsMd = join(consumerRoot, 'AGENTS.md');
  if (exists(rootAgentsMd)) {
    filesScanned++;
    allFindings.push(...checkRootAgentsMd(rootAgentsMd, 'AGENTS.md'));
    allFindings.push(...checkBrokenReference(rootAgentsMd, 'AGENTS.md', consumerRoot, 'root-agents-md'));
  }

  // ── Walk .claude/agents and .claude/skills ──────────────────────────────────
  const agentsDir = join(consumerRoot, '.claude', 'agents');
  const skillsDir = join(consumerRoot, '.claude', 'skills');

  if (exists(agentsDir)) {
    for (const absPath of walkFiles(agentsDir)) {
      const rel = relative(consumerRoot, absPath);
      const base = absPath.split('/').pop();
      if (base === 'README.md') continue;
      if (!absPath.endsWith('.md')) continue;
      filesScanned++;
      allFindings.push(...checkAgent(absPath, rel, manifest));
      allFindings.push(...checkBrokenReference(absPath, rel, consumerRoot, 'agent'));
    }
  }

  if (exists(skillsDir)) {
    for (const absPath of walkFiles(skillsDir)) {
      const rel = relative(consumerRoot, absPath);
      if (!absPath.endsWith('SKILL.md')) continue;
      filesScanned++;
      installedSkillDirs.push(dirname(rel));
      allFindings.push(...checkSkill(absPath, rel, manifest));
      allFindings.push(...checkBrokenReference(absPath, rel, consumerRoot, 'skill'));
    }
  }

  // ── Nested AGENTS.md (outside .claude/) ────────────────────────────────────
  if (exists(consumerRoot)) {
    for (const absPath of walkFiles(consumerRoot, { skipDirs: CONSUMER_SKIP_DIRS })) {
      const base = absPath.split('/').pop();
      if (base !== 'AGENTS.md') continue;
      const rel = relative(consumerRoot, absPath);
      if (rel === 'AGENTS.md') continue; // root, already handled
      filesScanned++;
      // Skip ai-kit-owned nested AGENTS.md files (installed by migrate)
      if (manifest?.files?.[rel]?.role === 'nested-agents-md') continue;
      allFindings.push(...checkNestedAgentsMd(absPath, rel));
      allFindings.push(...checkBrokenReference(absPath, rel, consumerRoot, 'nested-agents-md'));
    }
  }

  // ── Root CLAUDE.md ──────────────────────────────────────────────────────────
  const rootClaudeMd = join(consumerRoot, 'CLAUDE.md');
  filesScanned++;
  allFindings.push(...checkRootClaudeMd(rootClaudeMd, 'CLAUDE.md'));

  // ── .github/prompts/ ────────────────────────────────────────────────────────
  const promptsDir = join(consumerRoot, '.github', 'prompts');
  if (exists(promptsDir)) {
    for (const absPath of walkFiles(promptsDir)) {
      const base = absPath.split('/').pop();
      if (base === 'README.md') continue;
      if (!absPath.endsWith('.prompt.md')) continue;
      const rel = relative(consumerRoot, absPath);
      filesScanned++;
      allFindings.push(...checkPrompt(absPath, rel));
      allFindings.push(...checkBrokenReference(absPath, rel, consumerRoot, 'prompt'));
    }
  }

  // ── Asset folder READMEs ────────────────────────────────────────────────────
  allFindings.push(...checkAssetFolderReadmes(consumerRoot));

  // ── .claude/settings.json ───────────────────────────────────────────────────
  allFindings.push(...checkClaudeSettings(join(consumerRoot, '.claude', 'settings.json'), '.claude/settings.json'));

  // ── .vscode/settings.json ───────────────────────────────────────────────────
  allFindings.push(...checkVscodeSettings(join(consumerRoot, '.vscode', 'settings.json'), '.vscode/settings.json'));

  // ── .gitignore ──────────────────────────────────────────────────────────────
  allFindings.push(...checkGitignore(consumerRoot));

  // ── Audit report leak ────────────────────────────────────────────────────────
  allFindings.push(...checkAuditReportLeak(consumerRoot));

  // ── Stale .github/{agents,skills,prompts} dirs ──────────────────────────────
  allFindings.push(...checkStaleGithubDirs(consumerRoot));

  // ── Cross-file ──────────────────────────────────────────────────────────────
  allFindings.push(...checkCrossFile(manifest, consumerRoot, installedSkillDirs, { aiKitRoot, registry }));

  // ── Strict severity escalation ──────────────────────────────────────────────
  if (flags?.strict) {
    for (const f of allFindings) {
      if (STRICT_SEVERITY[f.id]) f.severity = STRICT_SEVERITY[f.id];
    }
  }

  // ── Build report ────────────────────────────────────────────────────────────
  const summary = { error: 0, warning: 0, info: 0, filesScanned, bySurface: {} };
  for (const f of allFindings) {
    summary[f.severity] = (summary[f.severity] ?? 0) + 1;
    if (f.surface) summary.bySurface[f.surface] = (summary.bySurface[f.surface] ?? 0) + 1;
  }

  const report = {
    schemaVersion: 2,
    scannedAt: new Date().toISOString(),
    consumerRoot,
    strict: flags?.strict ?? false,
    summary,
    findings: allFindings,
  };

  // ── Output ──────────────────────────────────────────────────────────────────
  if (flags?.json) {
    console.log(JSON.stringify(report, null, 2));
    return report;
  }

  if (allFindings.length === 0) {
    log.success(`✓ No issues found across ${filesScanned} file(s).`);
    return report;
  }

  // Group by file
  const byFile = new Map();
  for (const f of allFindings) {
    if (!byFile.has(f.file)) byFile.set(f.file, []);
    byFile.get(f.file).push(f);
  }

  for (const [file, fileFindings] of byFile) {
    log.header(file);
    for (const f of fileFindings) {
      const loc = f.line != null ? `:${f.line}` : '';
      if (f.severity === 'error')        log.error(`  [error]   ${f.id}${loc}: ${f.message}`);
      else if (f.severity === 'warning') log.warn(`  [warn]    ${f.id}${loc}: ${f.message}`);
      else                               log.dim(`  [info]    ${f.id}${loc}: ${f.message}`);
    }
  }

  log.blank();
  const parts = [];
  if (summary.error)   parts.push(`${summary.error} error(s)`);
  if (summary.warning) parts.push(`${summary.warning} warning(s)`);
  if (summary.info)    parts.push(`${summary.info} info`);
  log.info(`${filesScanned} file(s) scanned — ${parts.join(', ')}`);

  if (summary.error > 0 || summary.warning > 0) {
    log.info('Run /optimize to fix these issues automatically.');
  }

  return report;
}
