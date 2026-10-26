# The commands and their exits

Every command of this batch, in the order the corrective goal prescribes. No
command of this batch reached an external system.

## 1. The new focused identity, semantic-disposition, schema-keyword and canonical serialization tests

```text
$ cd <repo root>
$ node --test --test-concurrency=1 scripts/stage_b_b5_3/test/machine_identity.node-test.mjs
# tests 9
# pass 9
# fail 0
exit 0
```

```text
$ node --test --test-concurrency=1 scripts/stage_b_b5_3/test/schema_keywords.node-test.mjs
# tests 11
# pass 11
# fail 0
exit 0
```

```text
$ node --test --test-concurrency=1 scripts/stage_b_b5_3/test/aggregate_identity.node-test.mjs
# tests 17
# pass 17
# fail 0
exit 0
```

```text
$ node --test --test-concurrency=1 scripts/stage_b_b5_3/test/artifact_integrity.node-test.mjs
# tests 20
# pass 20
# fail 0
exit 0
```

The canonical serialization is proven in the focused PYTHON test (section 5):
the Python and the JavaScript byte layouts are compared over the legal frozen
receipt domain.

## 2. The prior artifact-integrity, sequencer and CI1 focused suites

```text
$ node --test --test-concurrency=1 scripts/stage_b_b5_3/test/artifact_integrity.node-test.mjs
# tests 20
# pass 20
# fail 0
exit 0

$ node --test --test-concurrency=1 scripts/stage_b_b5_3/test/sequencer.node-test.mjs
# tests 61
# pass 61
# fail 0
exit 0

$ node --test --test-concurrency=1 scripts/stage_b_b5_3/test/real_branches.node-test.mjs
# tests 8
# pass 8
# fail 0
exit 0
```

The CI1 process regression is
`an OWNED descendant that exits before the closeout is still a leak` in the
sequencer suite: the sighting stays fatal after the child exits, only the
first source runs, the owned descendant is cleaned and an unrelated process
stays alive.

## 3. The previous Codex three-file combination

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

## 4. The consolidated offline suite, exactly once, fully concurrent

```text
$ node scripts/stage_b_b5_3/test/run_offline_suite.mjs
===== offline suite phase: concurrent (<every offline file>) =====
# tests 404
# pass 404
# fail 0
OFFLINE SUITE PASSED
exit 0
```

Every offline file runs CONCURRENTLY. The external canary
(`canary_bvid1.node-test.mjs`) is classified `external_not_run` by the suite
itself and is NOT counted as a pass.

## 5. The focused Python equivalence tests

```text
$ cd services/local-runtime
$ python3 -m pytest tests/test_v3_gc_b5r_v21_artifact_validator_equivalence.py -q
22 passed in 0.48s
exit 0
```

```text
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
167 passed in 36.18s
exit 0
```

The broader Runtime suite was NOT run: neither production nor shared Python
code changed in this batch, only a Python test.

## 6. The relay v11 gate — NOT re-run, the scope is byte-identical

```text
$ python3 - <<'PY'   # the frozen relay hashes and the discovery roots
frozen relay hashes: 12  drift: none
relay scope files: 34 | newest: 2026-10-20 10:11:48  services/local-runtime/.../acquisition/transcript_service.py
PY
```

* the 12 frozen relay hashes of
  `docs/active/project/fixtures/v3-media-capture-internal-relay-v11-fixtures.json`
  all match;
* the 34 files under the four relay discovery roots were last modified on
  2026-10-20 — before this batch and before the three previous ones;
* the comprehension package (the only production area this batch touched) is
  NOT under any relay discovery root;
* the changed-file inventory of this batch lists no relay-scoped file.

## 7. The historical evidence manifests are byte-identical

```text
$ cd docs/active/project/evidence/v3_media_companion/v3-completion/<package>
$ sha256sum -c PAYLOAD_MANIFEST.sha256
… every line OK
exit 0
```

Every prior B-5 package and every Codex review package verifies the same way.

## 8. This package

```text
$ cd docs/active/project/evidence/v3_media_companion/v3-completion/gc-b5r-b5-publication-semantic-binding-correction-2026-10-25
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
