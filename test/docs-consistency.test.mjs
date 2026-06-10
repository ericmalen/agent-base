import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { run } from "../scripts/docs-consistency.mjs";

const KIT_ROOT = new URL("..", import.meta.url).pathname;

test("kit docs are consistent (no banned terms, no broken links)", () => {
  const findings = run(KIT_ROOT);
  assert.deepEqual(findings, []);
});

test("gate catches a seeded banned term and a seeded broken link", () => {
  const root = mkdtempSync(join(tmpdir(), "dc-seed-"));
  try {
    mkdirSync(join(root, "docs"), { recursive: true });
    writeFileSync(
      join(root, "docs", "guide.md"),
      "Run `ai-kit init` to start.\n\nSee [the plan](./missing.md).\n"
    );
    const findings = run(root);
    const checks = findings.map((f) => f.check).sort();
    assert.deepEqual(checks, ["banned-term", "broken-link"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("vendored (UPSTREAM) and docs/dev content is exempt", () => {
  const root = mkdtempSync(join(tmpdir(), "dc-exempt-"));
  try {
    mkdirSync(join(root, ".claude", "skills", "vendored"), { recursive: true });
    writeFileSync(join(root, ".claude", "skills", "vendored", "UPSTREAM"), "pinned");
    writeFileSync(join(root, ".claude", "skills", "vendored", "SKILL.md"), "uses sub-agent wording\n");
    mkdirSync(join(root, "docs", "dev"), { recursive: true });
    writeFileSync(join(root, "docs", "dev", "history.md"), "we dropped bin/ai-kit.mjs\n");
    assert.deepEqual(run(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
