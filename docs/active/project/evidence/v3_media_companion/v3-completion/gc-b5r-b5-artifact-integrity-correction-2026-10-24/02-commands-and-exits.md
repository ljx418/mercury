# The commands and their exits

Every command of this batch, in the order the corrective goal prescribes. No
command of this batch reached an external system.

## 1. The new focused aggregate / artifact / mirror / request-count tests

```text
$ cd <repo root>
$ node --test --test-concurrency=1 scripts/stage_b_b5_3/test/artifact_integrity.node-test.mjs
# tests 12
# pass 12
# fail 0
exit 0
```

```text
$ node --test --test-concurrency=1 scripts/stage_b_b5_3/test/sequencer.node-test.mjs
# tests 45
# pass 45
# fail 0
exit 0
```

The 45 cases of the sequencer file include the nine AI1 process-level
negatives, the four AI2 process-level negatives, the ten-field mirror
wrapper case, the CI1 leak regression and the CI2 negatives.

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

The CI1 process regression is
`an OWNED descendant that exits before the closeout is still a leak` in the
sequencer test (45/45 above): the sighting stays fatal after the child exits,
only the first source runs, the owned descendant is cleaned and an unrelated
process stays alive.

## 3. The consolidated offline suite, exactly once, fully concurrent

```text
$ node scripts/stage_b_b5_3/test/run_offline_suite.mjs
===== offline suite phase: concurrent (<every offline file>) =====
# tests 343
# pass 343
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
| `artifact_integrity.node-test.mjs` | 12 | 0 |
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
| `sequencer.node-test.mjs` | 45 | 0 |
| `structured_failure_evidence.node-test.mjs` | 3 | 0 |
| `task_id.node-test.mjs` | 8 | 0 |
| `windows_extension_invocation.node-test.mjs` | 7 | 0 |

## 4. The Python tests

A Python test was added (the validator equivalence proof), so the focused
Python tests and the consolidated Runtime suite were run.

```text
$ cd services/local-runtime
$ python3 -m pytest \
    tests/test_v3_gc_b5r_v21_artifact_validator_equivalence.py \
    tests/test_v3_gc_b5r_chapter_diagnostics.py \
    tests/test_v3_gc_b5r_corrective_authority.py \
    tests/test_v3_gc_b5r_final_offline_correction.py \
    tests/test_v3_gc_b5r_input_authority.py \
    tests/test_v3_grounded_comprehension_b5_1.py \
    tests/test_v3_grounded_comprehension_b5_2.py \
    tests/test_v3_grounded_comprehension_v2.py \
    tests/test_v3_media_comprehension.py -q
164 passed in 30.24s
exit 0
```

```text
$ python3 -m pytest tests/ -q
1237 passed, 3 skipped, 4 warnings in 488.79s (0:08:08)
exit 0
```

The suite was NOT split: it ran once, in one process, without an
out-of-memory event.

## 5. The relay v11 gate — NOT re-run, the scope is byte-identical

The corrective goal runs the relay gate only when the relay scope is
touched. It was not touched, so the scope is PROVED byte-identical instead:

```text
$ python3 - <<'PY'   # the frozen relay hashes
frozen relay hashes: 12  drift: none
relay scope files: 34
newest modification: 2026-10-20 10:11:48  services/local-runtime/.../acquisition/transcript_service.py
PY
```

* the 12 frozen relay hashes of
  `docs/active/project/fixtures/v3-media-capture-internal-relay-v11-fixtures.json`
  all match;
* the 34 files under the four relay discovery roots
  (`media_companion/acquisition/**/*.py`, `media_companion/*.py`,
  `src/modules/media_companion/capture/**/*.ts`,
  `entrypoints/media-capture-offscreen/**/*.ts`) were last modified on
  2026-10-20 — before this batch and before the two previous ones;
* the comprehension package (the only production area this batch touched) is
  NOT under any relay discovery root;
* the changed-file inventory of this batch lists no relay-scoped file.

## 6. The historical evidence manifests are byte-identical

```text
$ cd docs/active/project/evidence/v3_media_companion/v3-completion/<package>
$ sha256sum -c PAYLOAD_MANIFEST.sha256
… every line OK
exit 0
```

The six prior B-5 packages and the three Codex review packages verify the
same way.

## 7. This package

```text
$ cd docs/active/project/evidence/v3_media_companion/v3-completion/gc-b5r-b5-artifact-integrity-correction-2026-10-24
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
audit records the residue count: see `09-owned-resource-cleanup-audit.md`.
