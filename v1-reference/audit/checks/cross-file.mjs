import { join, dirname } from 'node:path';
import { readText, finding as _finding } from '../finding.mjs';
import { walkFiles, exists } from '../../fsutil.mjs';

const f = (p) => _finding({ surface: 'cross-file', ...p });

export function checkCrossFile(manifest, consumerRoot, installedSkillDirs, { aiKitRoot, registry } = {}) {
  const findings = [];

  if (manifest.pendingIntegration && manifest.pendingIntegration.length > 0) {
    findings.push(f({
      id: 'pending-integration-present',
      severity: 'info',
      file: '.claude/ai-kit.json',
      message: `${manifest.pendingIntegration.length} pending integration(s) found in .claude/ai-kit.json.`,
      detail: 'Run /migrate to resolve brownfield .ai-kit sidecars before optimizing.',
      fixable: 'manual',
    }));
  }

  // Heuristic: skill name appears multiple times in root AGENTS.md — may duplicate skill content
  const agentsMdPath = join(consumerRoot, 'AGENTS.md');
  const agentsMdText = readText(agentsMdPath);
  if (agentsMdText) {
    for (const skillDir of installedSkillDirs) {
      const skillName = skillDir.split('/').pop();
      const re = new RegExp(`\\b${skillName.replace(/-/g, '[-_]?')}\\b`, 'gi');
      const matches = agentsMdText.match(re) ?? [];
      if (matches.length >= 3) {
        findings.push(f({
          id: 'redundant-content-agents-md-vs-skill',
          severity: 'info',
          file: 'AGENTS.md',
          message: `AGENTS.md may duplicate guidance already covered by the "${skillName}" skill.`,
          detail: `The keyword "${skillName}" appears ${matches.length} times. If AGENTS.md is restating what the skill covers, consider removing or summarizing that section.`,
          fixable: 'semantic',
        }));
      }
    }
  }

  // Orphan registration — only fires when auditing the scaffold repo itself
  if (aiKitRoot && registry && aiKitRoot === consumerRoot) {
    // Base skills are always at .claude/skills/{name}; opt-in skills live at registry.skills[id].path
    // (which may be nested, e.g. .claude/skills/terraform/refactor-module). Compare against both.
    const registeredBaseSkillDirs = new Set(registry.baseSkills().map(n => `.claude/skills/${n}`));
    const registeredOptInSkillDirs = new Set(registry.optInSkills().map(s => s.path));
    const registeredAgents = new Set([
      ...registry.baseAgents(),
      ...registry.optInAgents().map(a => a.id),
    ]);

    const skillsDir = join(consumerRoot, '.claude', 'skills');
    if (exists(skillsDir)) {
      for (const absPath of walkFiles(skillsDir)) {
        if (!absPath.endsWith('SKILL.md')) continue;
        const skillRelDir = dirname(absPath.replace(consumerRoot + '/', ''));
        const skillId = skillRelDir.split('/').pop();
        if (!registeredBaseSkillDirs.has(skillRelDir) && !registeredOptInSkillDirs.has(skillRelDir)) {
          findings.push(f({
            id: 'skill-not-registered',
            severity: 'info',
            file: `${skillRelDir}/SKILL.md`,
            message: `Skill "${skillId}" at ${skillRelDir} is not registered in ai-kit.config.json and will not be shipped.`,
            detail: 'Skills not registered under base.skills or skills: in ai-kit.config.json are not installed by the CLI.',
            fixable: 'manual',
          }));
        }
      }
    }

    const agentsDir = join(consumerRoot, '.claude', 'agents');
    if (exists(agentsDir)) {
      for (const absPath of walkFiles(agentsDir)) {
        const base = absPath.split('/').pop();
        if (base === 'README.md' || !absPath.endsWith('.md')) continue;
        const agentId = base.replace(/\.md$/, '');
        if (!registeredAgents.has(agentId)) {
          findings.push(f({
            id: 'agent-not-registered',
            severity: 'info',
            file: `.claude/agents/${base}`,
            message: `Agent "${agentId}" is not registered in ai-kit.config.json and will not be shipped.`,
            detail: 'Agents not registered in the agents: section of ai-kit.config.json are not installed by the CLI.',
            fixable: 'manual',
          }));
        }
      }
    }
  }

  return findings;
}
