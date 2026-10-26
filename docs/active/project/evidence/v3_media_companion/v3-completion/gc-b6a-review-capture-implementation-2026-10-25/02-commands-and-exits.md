# The commands and their exits

Every command of this batch, in the order the corrective goal prescribes. No
command of this batch reached an external system.

## 1. The new focused tests (the 54 fixed obligations, group by group)

```text
$ cd <repo root>
$ node --test --test-concurrency=1 scripts/stage_b_b5_3/test/b6_review_bundle.node-test.mjs
# tests 24
# pass 24
# fail 0
exit 0
```

```text
$ node --test --test-concurrency=1 scripts/stage_b_b5_3/test/b6_thumbnail_seek.node-test.mjs
# tests 10
# pass 10
# fail 0
exit 0
```

```text
$ node --test --test-concurrency=1 scripts/stage_b_b5_3/test/b6_blind_projection.node-test.mjs
# tests 8
# pass 8
# fail 0
exit 0
```

```text
$ node --test --test-concurrency=1 scripts/stage_b_b5_3/test/b6_lifecycle.node-test.mjs
# tests 7
# pass 7
# fail 0
exit 0
```

```text
$ node --test --test-concurrency=1 scripts/stage_b_b5_3/test/b6_aggregate.node-test.mjs
# tests 11
# pass 11
# fail 0
exit 0
```

The 54 FIXED obligations are mapped group by group in
`05-obligation-map.json`; the extra cases (the real route composition, the
private ref resolution, the capture boundary, the sentinel position and the
machine gate) are ADDITIONAL.

## 2. The prior Codex three-file combination and the CI1 process regression

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

The CI1 process regression lives in the sequencer suite
(`an OWNED descendant that exits before the closeout is still a leak`) and it
is unchanged and green.

## 3. The consolidated offline suite, once, fully concurrent

```text
$ node scripts/stage_b_b5_3/test/run_offline_suite.mjs
===== offline suite phase: concurrent (<every offline file>) =====
# tests 517
# pass 517
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
| `aggregate_identity.node-test.mjs` | 36 | 0 |
| `artifact_integrity.node-test.mjs` | 20 | 0 |
| `audit_finalizer.node-test.mjs` | 12 | 0 |
| `authorization_composition.node-test.mjs` | 15 | 0 |
| `b6_aggregate.node-test.mjs` | 11 | 0 |
| `b6_blind_projection.node-test.mjs` | 8 | 0 |
| `b6_lifecycle.node-test.mjs` | 7 | 0 |
| `b6_review_bundle.node-test.mjs` | 24 | 0 |
| `b6_thumbnail_seek.node-test.mjs` | 10 | 0 |
| `canary_bvid1.node-test.mjs` | EXTERNAL_NOT_RUN | — |
| `canary_cookie_contract.node-test.mjs` | 19 | 0 |
| `canary_purity_contract.node-test.mjs` | 10 | 0 |
| `contracts.node-test.mjs` | 48 | 0 |
| `cookie_prereq.node-test.mjs` | 24 | 0 |
| `gc_b5r_preflight.node-test.mjs` | 33 | 0 |
| `integration_runtime_api.node-test.mjs` | 6 | 0 |
| `machine_identity.node-test.mjs` | 18 | 0 |
| `owned_chrome.node-test.mjs` | 4 | 0 |
| `privacy_scan.node-test.mjs` | 12 | 0 |
| `production_preflight.node-test.mjs` | 8 | 0 |
| `provider_attempt_accounting.node-test.mjs` | 5 | 0 |
| `real_branches.node-test.mjs` | 8 | 0 |
| `relay_ownership_contract.node-test.mjs` | 45 | 0 |
| `runner_failure_evidence.node-test.mjs` | 11 | 0 |
| `runner_static_check.node-test.mjs` | 4 | 0 |
| `schema_keywords.node-test.mjs` | 13 | 0 |
| `sequencer.node-test.mjs` | 78 | 0 |
| `structured_failure_evidence.node-test.mjs` | 3 | 0 |
| `task_id.node-test.mjs` | 8 | 0 |
| `windows_extension_invocation.node-test.mjs` | 7 | 0 |

## 4. The Python tests

The production Python of the comprehension package was changed in the dirty
worktree (by an earlier batch and by a concurrent session) while this batch
was running, so the targeted pytest suites were run:

```text
$ cd services/local-runtime
$ python3 -m pytest \
    tests/test_v3_gc_b5r_chapter_diagnostics.py \
    tests/test_v3_gc_b5r_corrective_authority.py \
    tests/test_v3_gc_b5r_final_offline_correction.py \
    tests/test_v3_gc_b5r_input_authority.py \
    tests/test_v3_gc_b5r_v21_artifact_validator_equivalence.py \
    tests/test_v3_grounded_comprehension_b5_1.py \
    tests/test_v3_grounded_comprehension_b5_2.py \
    tests/test_v3_grounded_comprehension_v2.py \
    tests/test_v3_media_comprehension.py -q
183 passed in 29.97s
exit 0
```

```text
$ python3 -m pytest tests/ -q
1256 passed, 3 skipped, 4 warnings in 442.25s (0:07:22)
exit 0
```

## 5. The relay v11 baseline and the mutations

```text
$ python3 docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v11-contract.py
{ … "summary": { "total": 50, "passed": 50, "failed": 0 }, "failedChecks": [] }
exit 0
```

```text
$ python3 docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v11-mutations.py
{ "passed": true, "cases": [ … 16 cases, all "passed": true … ] }
exit 0
```

16 cases, 16 passed, 0 failed.

## 6. The historical evidence manifests are byte-identical

```text
$ cd docs/active/project/evidence/v3_media_companion/v3-completion/<package>
$ sha256sum -c PAYLOAD_MANIFEST.sha256
… every line OK
exit 0
```

Every prior B-5 package, every Codex review package and the WP-B packages
verify the same way.

## 7. This package

```text
$ cd docs/active/project/evidence/v3_media_companion/v3-completion/gc-b6a-review-capture-implementation-2026-10-25
$ sha256sum -c PAYLOAD_MANIFEST.sha256
… every line OK
exit 0
```

The manifest is generated LAST, after the final source edit and after the
final scan.

## The external action ledger of the batch

The batch wrote NO ledger line for an external action, because it performed
no external action. The ledgers that the offline tests wrote live inside the
TEMPORARY roots of those tests, and those roots are removed when the test
process exits (`scripts/stage_b_b5_3/lib/temp_roots.mjs`). The zero-action
receipt is `09-zero-action-receipt.json`.
