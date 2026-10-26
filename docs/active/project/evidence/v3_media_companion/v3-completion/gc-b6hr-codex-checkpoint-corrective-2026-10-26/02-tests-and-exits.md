# Tests And Exits

| Check | Result | Exit |
|---|---:|---:|
| `node --test test/b6hr_offline_corrective.node-test.mjs` | 34 passed | 0 |
| `node --test test/b6_lifecycle.node-test.mjs` | 11 passed | 0 |
| `node scripts/stage_b_b5_3/test/run_offline_suite.mjs` | 688 passed, 0 failed | 0 |
| Final `prepare_candidate.mjs --prepare-only` | prepared, 499 files, lock present | 0 |
| `git diff --check` | clean | 0 |

The final preparation used a fresh repository-external mode-0700 temporary root and deleted that root after verification. Its sealed tool identities were:

```text
node v22.22.1
python Python 3.12.3
playwright 1.60.0
extensionDependencyCount 169
extensionDependencyTreeSha256 f7ae8e84979eaf516be3727a51eaebd25c3c851671273f84007579813a503d7a
runtimeDependencyCount 8166
runtimeDependencyTreeSha256 f05b60c321912e1d778b4b4cf66f33799aed7951f36732791ed1638c062f99df
```

Production Python was not changed by the Codex correction, so the candidate's already completed `1330 passed / 3 skipped` Runtime run was not repeated. Relay scope was not changed; the complete Stage B offline suite retained the relay gate.

