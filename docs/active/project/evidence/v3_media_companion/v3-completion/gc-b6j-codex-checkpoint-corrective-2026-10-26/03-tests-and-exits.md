# Tests And Exit Codes

| Check | Result | Exit |
|---|---:|---:|
| B6J focused suite | 20 passed | 0 |
| Affected B6 lifecycle/H6/sequencer combination | 148 passed | 0 |
| Official `prepare_candidate.mjs --prepare-only` | 501 files, dependency parity green | 0 |
| Final full offline Stage B suite | 708 passed, external canary not run | 0 |
| Changed JavaScript syntax checks | all parse | 0 |
| `git diff --check` | clean | 0 |

The official prepare-only check used a fresh repository-external 0700 root and
removed it after the result was recorded. It did not consume authorization or
perform an external action.

