# The commands and their exits

Every command of this batch, its exit code and its result. No command of this
batch reached an external system.

## 1. The consolidated offline Stage B runner suite (fully concurrent)

```text
$ cd <repo root>
$ node scripts/stage_b_b5_3/test/run_offline_suite.mjs
===== offline suite phase: concurrent (<every offline file>) =====
# tests 307
# pass 307
# fail 0
OFFLINE SUITE PASSED
exit 0
```

Every offline file runs CONCURRENTLY. The external canary
(`canary_bvid1.node-test.mjs`) is classified `external_not_run` by the suite
itself and is NOT counted as a pass.

### The per-file counts

| file | pass | fail |
|---|---|---|
| `action_ledger.node-test.mjs` | 10 | 0 |
| `audit_finalizer.node-test.mjs` | 12 | 0 |
| `authorization_composition.node-test.mjs` | 15 | 0 |
| `canary_bvid1.node-test.mjs` | EXTERNAL_NOT_RUN | — |
| `canary_cookie_contract.node-test.mjs` | 19 | 0 |
| `canary_purity_contract.node-test.mjs` | 10 | 0 |
| `contracts.node-test.mjs` | 48 | 0 |
| `cookie_prereq.node-test.mjs` | 24 | 0 |
| `gc_b5r_preflight.node-test.mjs` | 33 | 0 |
| `integration_runtime_api.node-test.mjs` | 6 | 0 |
| `privacy_scan.node-test.mjs` | 12 | 0 |
| `production_preflight.node-test.mjs` | 8 | 0 |
| `provider_attempt_accounting.node-test.mjs` | 5 | 0 |
| `real_branches.node-test.mjs` | 8 | 0 |
| `relay_ownership_contract.node-test.mjs` | 45 | 0 |
| `runner_failure_evidence.node-test.mjs` | 11 | 0 |
| `runner_static_check.node-test.mjs` | 2 | 0 |
| `sequencer.node-test.mjs` | 21 | 0 |
| `structured_failure_evidence.node-test.mjs` | 3 | 0 |
| `task_id.node-test.mjs` | 8 | 0 |
| `windows_extension_invocation.node-test.mjs` | 7 | 0 |

## 2. The previously failing Codex command

```text
$ node --test \
  scripts/stage_b_b5_3/test/authorization_composition.node-test.mjs \
  scripts/stage_b_b5_3/test/structured_failure_evidence.node-test.mjs \
  scripts/stage_b_b5_3/test/privacy_scan.node-test.mjs
# tests 30
# pass 30
# fail 0
exit 0
```

It failed with 2..4 failures before this batch.

## 3. The targeted GC-B5R and comprehension Runtime tests

```text
$ cd services/local-runtime
$ python3 -m pytest \
    tests/test_v3_gc_b5r_chapter_diagnostics.py \
    tests/test_v3_gc_b5r_corrective_authority.py \
    tests/test_v3_gc_b5r_final_offline_correction.py \
    tests/test_v3_gc_b5r_input_authority.py \
    tests/test_v3_grounded_comprehension_b5_1.py \
    tests/test_v3_grounded_comprehension_b5_2.py \
    tests/test_v3_grounded_comprehension_v2.py \
    tests/test_v3_media_comprehension.py -q
145 passed in 38.75s
exit 0
```

## 4. The full Runtime test suite (run once, on the final state)

```text
$ cd services/local-runtime
$ python3 -m pytest tests/ -q
1218 passed, 3 skipped, 4 warnings in 531.21s (0:08:51)
exit 0
```

The suite was NOT split: it ran once, in one process, without an
out-of-memory event.

## 5. The relay v11 baseline (the relay scope was NOT touched)

```text
$ cd <repo root>
$ python3 docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v11-contract.py
{ … "summary": { "total": 50, "passed": 50, "failed": 0 }, "failedChecks": [] }
exit 0
```

## 6. The relay v11 mutation set

```text
$ python3 docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v11-mutations.py
{ "passed": true, "cases": [ … 16 cases, all "passed": true … ] }
exit 0
```

16 cases, 16 passed, 0 failed.

## 7. The historical evidence packages are untouched

```text
$ cd docs/active/project/evidence/v3_media_companion/v3-completion/gc-b5r-b5-real-run-2026-10-24
$ sha256sum -c PAYLOAD_MANIFEST.sha256
… every line OK
exit 0
```

The two other historical packages of the B-5 stage verify the same way.

## 8. This package

```text
$ cd docs/active/project/evidence/v3_media_companion/v3-completion/gc-b5r-b5-runner-closure-correction-2026-10-24
$ sha256sum -c PAYLOAD_MANIFEST.sha256
… every line OK
exit 0
```

The manifest is generated LAST, after every other file of this package is
final.

## The external action ledger of the batch

The batch wrote NO ledger line for an external action, because it performed
no external action. The ledgers that the offline tests wrote live inside the
TEMPORARY roots of those tests, and those roots are removed when the test
process exits (`scripts/stage_b_b5_3/lib/temp_roots.mjs`). The cleanup
audit records the residue count: see `10-owned-resource-cleanup-audit.md`.
