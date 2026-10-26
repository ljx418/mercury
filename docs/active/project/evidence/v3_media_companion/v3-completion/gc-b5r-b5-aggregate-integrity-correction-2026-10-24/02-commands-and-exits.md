# The commands and their exits

Every command of this batch, its exit code and its result. No command of this
batch reached an external system.

## 1. The focused new Node tests

```text
$ cd <repo root>
$ node --test --test-concurrency=1 scripts/stage_b_b5_3/test/sequencer.node-test.mjs
# tests 31
# pass 31
# fail 0
exit 0
```

```text
$ node --test --test-concurrency=1 scripts/stage_b_b5_3/test/audit_finalizer.node-test.mjs
# tests 12
# pass 12
# fail 0
exit 0
```

```text
$ node --test --test-concurrency=1 scripts/stage_b_b5_3/test/provider_attempt_accounting.node-test.mjs
# tests 5
# pass 5
# fail 0
exit 0
```

```text
$ node --test --test-concurrency=1 scripts/stage_b_b5_3/test/real_branches.node-test.mjs
# tests 8
# pass 8
# fail 0
exit 0
```

## 2. The prior Codex three-file command

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

## 3. The consolidated offline suite, fully concurrent

```text
$ node scripts/stage_b_b5_3/test/run_offline_suite.mjs
===== offline suite phase: concurrent (<every offline file>) =====
# tests 317
# pass 317
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
| `sequencer.node-test.mjs` | 31 | 0 |
| `structured_failure_evidence.node-test.mjs` | 3 | 0 |
| `task_id.node-test.mjs` | 8 | 0 |
| `windows_extension_invocation.node-test.mjs` | 7 | 0 |

## 4. The targeted GC-B5R / comprehension Python tests

**NOT RUN — and deliberately so.** The batch touched NO production Python
file: the changed-file inventory of `01-changed-file-hashes.json` lists
10 modified and 1 new file, and every one of them is JavaScript under
`scripts/stage_b_b5_3/`. The corrective goal conditions the Python run on a
production Python change, and there was none.

## 5. The relay v11 baseline and mutations

No relay-scoped file was touched. The gate was run anyway as a cheap proof
that the relay scope did not drift:

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

## 6. The historical evidence packages are untouched

```text
$ cd docs/active/project/evidence/v3_media_companion/v3-completion/<package>
$ sha256sum -c PAYLOAD_MANIFEST.sha256
… every line OK
exit 0
```

The four prior B-5 packages and the three Codex review packages verify the
same way.

## 7. This package

```text
$ cd docs/active/project/evidence/v3_media_companion/v3-completion/gc-b5r-b5-aggregate-integrity-correction-2026-10-24
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
audit records the residue count: see
`08-owned-resource-cleanup-audit.md`.
