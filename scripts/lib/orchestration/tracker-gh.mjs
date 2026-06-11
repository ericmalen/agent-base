// tracker-gh.mjs — GitHub Issues adapter for tracker-sync (F3, DD-14).
// Shells the gh CLI (already authenticated locally and via GH_TOKEN in
// Actions) instead of raw REST. Pure helpers build every argv; the thin IO
// functions only spawn.
//
// State mapping is structural: open = intake, open + "in-progress" label =
// active, closed = done; "blocked" label mirrors a blocked Backlog task.

import { spawnSync } from 'node:child_process';

export function buildGhListArgs() {
  return ['issue', 'list', '--json', 'number,title,state,labels,url', '--state', 'all', '--limit', '200'];
}

// One `gh issue list --json` element → normalization contract.
export function normalizeGhIssue(issue) {
  const labels = (issue.labels ?? []).map((l) => l.name);
  let state = 'intake';
  if (issue.state === 'CLOSED') state = 'done';
  else if (labels.includes('in-progress')) state = 'active';
  return {
    externalId: `#${issue.number}`,
    title: issue.title,
    state,
    url: issue.url ?? null,
  };
}

export function issueNumberFromRef(ref) {
  const m = ref.match(/^(?:[\w.-]+\/[\w.-]+)?#(\d+)$/);
  return m ? Number(m[1]) : null;
}

// Status update → list of gh argv arrays to run in order.
export function buildGhUpdateArgs(update) {
  const n = String(issueNumberFromRef(update.externalId));
  const cmds = [];
  if (update.to === 'done') {
    cmds.push(['issue', 'close', n, '--reason', 'completed']);
  } else if (update.to === 'active') {
    cmds.push(['issue', 'edit', n, '--add-label', 'in-progress', '--remove-label', 'blocked']);
  } else {
    // intake — a task bounced back to Backlog (usually blocked)
    cmds.push(['issue', 'edit', n, '--remove-label', 'in-progress', '--add-label', 'blocked']);
  }
  if (update.comment) cmds.push(['issue', 'comment', n, '--body', update.comment]);
  return cmds;
}

// ── thin IO (no unit tests — verified live, DD-9) ───────────────────────────

function runGh(args, cwd) {
  const res = spawnSync('gh', args, { cwd, encoding: 'utf8' });
  if (res.error) throw res.error;
  if (res.status !== 0) throw new Error(`gh ${args.join(' ')} → ${res.stderr || res.stdout}`);
  return res.stdout;
}

export function listItems({ cwd }) {
  return JSON.parse(runGh(buildGhListArgs(), cwd)).map(normalizeGhIssue);
}

export function pushUpdate({ cwd }, update) {
  for (const args of buildGhUpdateArgs(update)) runGh(args, cwd);
}
