# Orchestration decisions

Rendered from `decisions.json` — never edit this file by hand; change the
JSON and re-render.

| Decision | Value | Meaning |
| --- | --- | --- |
| TDD policy | `test-with-change` | Tests land in the same change as the code they cover. |
| Review gates | `every-merge` | Code review before anything merges. |
| Security requirements | `review-sensitive-paths` | Security review when auth, data, or dependency surfaces change. |
| QA depth | `unit-and-integration` | Unit plus integration tests. |
| Definition of done | `tests-and-review` | Done when tests pass and review is approved. |
| Human gate placement | `pre-merge` | A human approves before merge; agents never auto-merge. |
