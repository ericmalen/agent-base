import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { run } from "../scripts/docs-consistency.mjs";

const BASE_ROOT = fileURLToPath(new URL("..", import.meta.url));

test("Agent Base docs are consistent (no broken links)", () => {
  const findings = run(BASE_ROOT);
  assert.deepEqual(findings, []);
});

test("gate catches a seeded broken link; resolving links pass", () => {
  const root = mkdtempSync(join(tmpdir(), "dc-seed-"));
  try {
    mkdirSync(join(root, "docs"), { recursive: true });
    writeFileSync(join(root, "docs", "other.md"), "target\n");
    writeFileSync(
      join(root, "docs", "guide.md"),
      "See [the plan](./missing.md) and [a real file](./other.md).\n"
    );
    const findings = run(root);
    assert.deepEqual(findings.map((f) => ({ check: f.check, term: f.term })), [
      { check: "broken-link", term: "./missing.md" },
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("vendored (UPSTREAM) content is exempt", () => {
  const root = mkdtempSync(join(tmpdir(), "dc-exempt-"));
  try {
    mkdirSync(join(root, ".claude", "skills", "vendored"), { recursive: true });
    writeFileSync(join(root, ".claude", "skills", "vendored", "UPSTREAM"), "pinned");
    writeFileSync(join(root, ".claude", "skills", "vendored", "SKILL.md"), "[gone](./nope.md)\n");
    assert.deepEqual(run(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("links inside code fences and inline code are ignored", () => {
  const root = mkdtempSync(join(tmpdir(), "dc-fence-"));
  try {
    mkdirSync(join(root, "docs"), { recursive: true });
    writeFileSync(join(root, "docs", "x.md"),
      "```\n[example](./not-checked.md)\n```\n\nUse `[link](./also-not.md)` as syntax.\n");
    assert.deepEqual(run(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
