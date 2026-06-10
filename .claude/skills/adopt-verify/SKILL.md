---
name: adopt-verify
description: Phase 4 of ai-kit adoption — independent verification and final human gate. Use after materialization converged, in a fresh session.
---

# adopt-verify

Independent judgment over the converged result, then the final human gate.
You orchestrate; the verification itself runs in the adoption-verifier agent
with FRESH context each invocation — never verify in this session yourself.

Preconditions: `check.mjs` and `audit.mjs` both exit 0 (re-run to confirm);
`.adoption/report.md` is current.

## Procedure

1. **Invocation ① — conformance.** Invoke the `adoption-verifier` agent:
   "Rubric pass: walk every judgment rule in
   .claude/skills/ai-kit-check/references/rubric.md against the generated
   files; emit the rule x asset PASS/FAIL matrix; review assembled-document
   coherence."
2. **Mechanical backstop (mandatory, after EVERY invocation):**
   `git status --porcelain` must be empty. If not: `git checkout -- .`,
   record the incident for the user, and re-run the invocation.
3. **Invocation ② — adversarial loss-hunt.** Fresh invocation:
   "Loss-hunt per the rubric's adversarial brief: judge every merge/supersede
   side-by-side in .adoption/report.md, every drop reason, every out-of-scope
   ruling. Verdict per entry: KEEP / RESTORE / ESCALATE."
4. Fix accepted findings via manifest/literal edits → re-materialize →
   re-converge gates → re-verify (fresh invocations) until clean.
5. **Prepare the merge state:** remove adoption-time tooling in a final
   commit — `git rm -r .adoption`, remove `.claude/ai-kit-adoption/`,
   `.claude/skills/adopt-*`, and `.claude/agents/adoption-verifier.md`.
   KEEP `.claude/skills/ai-kit-check/` (permanent) and the kit marker.
6. **USER GATE 2:** present `.adoption/report.md` content (from the last
   pre-removal commit), the verifier matrices, and review instructions:
   `git diff main...ai-kit-adoption --color-moved=zebra --find-copies-harder`
   (per-iteration commits are individually reviewable). The USER merges and
   deletes the branch — never merge on their behalf.

Abort at any point: `git checkout main && git branch -D ai-kit-adoption`.
