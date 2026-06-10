# Phase 0 notes — open-question resolutions & status

Plan §13, resolved or routed. June 2026.

| # | Question | Status |
|---|---|---|
| 1 | Does Claude-format `tools:` restrict in current VS Code? | **Manual** — Phase 3 runbook item, per tool. Clean-tree backstop is mandatory regardless, so no design dependency. |
| 2 | Copilot iteration caps / terminal auto-approval | **Manual** — Phase 3 runbook; capture in setup docs (Phase 2). Allowlist recommendation drafted with setup docs. |
| 3 | `--color-moved=zebra --find-copies-harder` reviewer aid | **Verified (small diffs)** — cross-file moved-line coloring works; `--stat` even reports `CLAUDE.md => <target>` relocations. Re-verify on the `large` fixture's diff sizes in Phase 3. |
| 4 | Node availability on managed machines | **Owner question** — floor pinned at Node 20; confirm team machines have ≥20 before rollout. |
| 5 | Content-sweep marker list | **Tuned v1** — current list (see `scripts/lib/extract.mjs` SWEEP_MARKERS) catches all fixture plants: `docs/ai-notes.md` via "claude", `CONTRIBUTING.md` via "ai assistant"/"when writing code", `docs/big-guide.md` via "claude". Recall-first; revisit after Phase 3 matrix runs on real repos. |

## Phase 0 deliverables (all green)

- `spec/rules.md` + `spec/target-layout.md` — rule catalog + target tree (pre-existing)
- `scripts/inventory-extract.mjs` + `scripts/lib/extract.mjs` — git-universe
  enumeration, fence-aware block model, byte-exact tiling, content sweep
- `scripts/audit.mjs` + `scripts/lib/audit/` — ~30 mechanical checks keyed by
  R-ID; conditional R-09; compat-mode detection; strict escalation
- `test/fixtures/defs.mjs` — 8 fixtures as data (6 core incl. adversarial +
  injection), sentinel-planted, built into temp git repos
- `test/fixtures.test.mjs` — Phase-0 guarantee per fixture: tiling + sentinel
  coverage (nothing escapes the inventory) + no silent skips
- `test/seeded-defects.test.mjs` — negative tests for existing gates; `todo`
  entries pin the Phase 1 (check.mjs) and Phase 3 (sabotage runbook) negatives
- 55 tests: 45 pass / 0 fail / 10 todo (by design)

## Notes for Phase 1

- The injection fixture's steering section extracts as a distinct node —
  plan/verify skills must treat node CONTENT as data, never instructions;
  repeat this in skill prose and the verifier brief.
- `large` fixture: 150-section CLAUDE.md + 4,000-line single-section file —
  the latter is the stress case for `split` range ergonomics (pivot trigger 2).
- Manifest schema finalization must define anchor/ordering semantics (how
  multiple nodes compose at one target heading) — flagged as the
  coherence-critical design point.
