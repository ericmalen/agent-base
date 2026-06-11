// headless-guard.mjs — run/skip decision for the scheduled orchestrator
// pipelines (F4, DD-15). The CI templates (templates/ci/orchestrator-run.*)
// are thin shells: they gather inputs (parsed tasks.md, open PR branches)
// and act on this module's decision, so the whole policy is unit-testable.

// decideHeadlessRun({ tasksDoc, openBranches, branchPrefix }) →
//   { run: false, reason: 'orchestrator-pr-open' | 'backlog-empty' | 'backlog-all-blocked' }
// | { run: true,  reason: 'eligible-task', taskId }
//
// Skip rules, in order:
//   1. A previous orchestrator branch still has an open PR — never overlap
//      runs (one writer at a time, DD-11).
//   2. Backlog empty — nothing to do.
//   3. Backlog has only blocked tasks (incl. scope:triage tracker imports
//      awaiting human scoping) — dispatching them is forbidden, so don't
//      spend a pipeline run.
// Otherwise: first eligible Backlog task top-down, mirroring the
// orchestrator's own pick order.
export function decideHeadlessRun({ tasksDoc, openBranches = [], branchPrefix = 'orch/' }) {
  if (openBranches.some((b) => b.startsWith(branchPrefix))) {
    return { run: false, reason: 'orchestrator-pr-open' };
  }
  if (tasksDoc.backlog.length === 0) {
    return { run: false, reason: 'backlog-empty' };
  }
  const eligible = tasksDoc.backlog.find(
    (t) => t.blocked === null && !t.scope.includes('triage'),
  );
  if (!eligible) {
    return { run: false, reason: 'backlog-all-blocked' };
  }
  return { run: true, reason: 'eligible-task', taskId: eligible.id };
}
