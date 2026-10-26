# Tests And Exits

| Check | Result |
|---|---|
| Review-bundle focused suite | 31/31, exit 0 |
| Capture-focused combined suite | 86/86, exit 0 |
| Full Stage B offline suite | 629/629, exit 0 |
| Final zero-action preflight | 34/34, exit 0; every action counter zero |
| Final order-2 visible canary | exit 0; `ORDER2 DIAGNOSTIC READY FOR CODEX` |
| Private manifest | all entries verified, exit 0 |
| Production read + validation | `ok:true`; 73 evidence, 8 thumbnails, 6 chapters |
| `git diff --check` | exit 0 |

The first two visible confirmations were blocked and remain blocked. They are
recorded because each exposed a deterministic harness defect that the next run
proved closed. The third run was declared in advance as the final visible
single-source confirmation regardless of outcome.

