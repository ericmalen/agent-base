// prompts.mjs — paste-able prompts for the bootstrap commands.
// The CLI cannot make an AI tool load skills from a staged checkout; instead
// it prints the exact prompt the user pastes into their AI session (Claude
// Code or Copilot) opened in the PROJECT. The skills' dispatch pattern is
// already path-based ("Read <checkout>/.claude/...SKILL.md and execute"), so
// a staged release works the same as an open clone.

const SKILLS = {
  setup: 'base-setup',
  orchestrate: 'base-orchestrate',
  refresh: 'base-refresh',
};

export function bootstrapPrompt({ command, checkoutPath, targetPath = '.', dev = false }) {
  const skill = SKILLS[command];
  if (!skill) throw new Error(`no bootstrap prompt for command: ${command}`);
  const skillPath = `${checkoutPath}/.claude/skills/${skill}/SKILL.md`;
  const provenance = dev
    ? `a local base clone — freshen it first if needed (git -C ${checkoutPath} pull --ff-only)`
    : 'an immutable staged release — never `git pull` it';
  return [
    `Read ${skillPath} and execute it for target ${targetPath}.`,
    `The base checkout is ${checkoutPath} — ${provenance}.`,
  ].join('\n');
}

export function printBootstrap({ command, checkoutPath, targetPath, dev, copied }) {
  const lines = [];
  if (copied) lines.push(`staged release at ${checkoutPath}`);
  else if (!dev) lines.push(`using staged release at ${checkoutPath}`);
  else lines.push(`running from clone ${checkoutPath} — staging skipped`);
  lines.push('', 'Paste this prompt into your AI session opened in the project:', '');
  lines.push(bootstrapPrompt({ command, checkoutPath, targetPath, dev }));
  return lines.join('\n');
}
