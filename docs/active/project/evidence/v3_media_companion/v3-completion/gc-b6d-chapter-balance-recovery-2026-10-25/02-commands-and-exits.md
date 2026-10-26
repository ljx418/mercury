# GC-B6D Commands And Exits

Every command of this batch, with its exit code. No command in this list
started Chrome, read a Cookie, called a Provider, downloaded media, ran a
real BVID or consumed an authorization.

## 1. The new focused Python tests

```text
$ cd services/local-runtime
$ .venv/bin/python -m pytest tests/test_v3_gc_b6d_chapter_balance.py -q
23 passed in 1.94s
exit 0
```

## 2. The existing GC-B5R / comprehension focused tests

```text
$ .venv/bin/python -m pytest \
    tests/test_v3_gc_b5r_chapter_diagnostics.py \
    tests/test_v3_gc_b5r_final_offline_correction.py \
    tests/test_v3_gc_b5r_v21_artifact_validator_equivalence.py \
    tests/test_v3_gc_b5r_input_authority.py \
    tests/test_v3_gc_b5r_corrective_authority.py \
    tests/test_v3_media_comprehension.py \
    tests/test_v3_grounded_comprehension_b5_1.py \
    tests/test_v3_grounded_comprehension_b5_2.py -q
173 passed, 1 warning in 31.79s
exit 0
```

## 3. The FULL Runtime suite (the production Python changed)

```text
$ .venv/bin/python -m pytest tests/ -q
1279 passed, 3 skipped, 55 warnings in 743.80s (0:12:23)
exit 0
```

## 4. The B6C focused Node tests, the B6 lifecycle tests and the new runner-boundary tests

```text
$ cd scripts/stage_b_b5_3
$ node --test test/b6c_order2_canary.node-test.mjs \
           test/b6_lifecycle.node-test.mjs \
           test/b6d_balance_diagnostic.node-test.mjs
# tests 43
# pass 43
# fail 0
exit 0
```

The stable failure code `V3510B_CHAPTER_IMBALANCE` crosses the runner
boundary, so the B6C canary matrix, the B6 lifecycle matrix and the new
runner-boundary cases are run together.

## 5. The FULL offline Stage B suite

```text
$ cd <repo-root>
$ node scripts/stage_b_b5_3/test/run_offline_suite.mjs
# tests 619
# pass 619
# fail 0
OFFLINE SUITE PASSED
exit 0
```

The external canary is reported as `external_not_run` and is NOT counted as
a pass.

## 6. The relay v11 gate

No FROZEN relay-scope file was changed by this batch, and the relay v11 gate
case is GREEN inside the run of §5:

```text
ok 472 - R5-B relay v11: unique Offscreen context is authoritative and sender documentId is optional
```

## 7. The whitespace gate

```text
$ git diff --check
exit 0

$ git diff --no-index --check <an empty file> <each new file>
no diagnostic output
```

## 8. The secret / path / raw-media scan

```text
$ node <the production detectors over the six changed files>
secret hits: 0
raw media payload hits: 0
absolute path hits: 0 in the four production modules; 4 shapes in the two
test files, each of them a FORBIDDEN-token fixture or a schema version
```

The itemised result is in `06-secret-path-raw-media-scan.json`.

## 9. The cleanup audit

```text
$ ps -eo pid,cmd | grep -E "uvicorn|navia_runtime|chrome" | grep -v grep
(no output)

$ ss -ltn | grep 17861
(no output)

$ ls -d ${TMPDIR}/navia-b6*
(no output)
```

## 10. The payload manifest (generated LAST)

```text
$ cd docs/active/project/evidence/v3_media_companion/v3-completion/gc-b6d-chapter-balance-recovery-2026-10-25
$ sha256sum -c PAYLOAD_MANIFEST.sha256
00-status-and-scope.md: OK
01-candidate-lock.md: OK
02-commands-and-exits.md: OK
03-case-to-production-oracle-map.md: OK
04-zero-action-and-cleanup-audit.md: OK
05-secret-path-raw-media-scan.json: OK
06-risks-and-next-decision.md: OK
exit 0
```
