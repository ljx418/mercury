# Commands And Exits

Every command of this batch, with its exit code. No command in this list
started Chrome, read a real Cookie, called a Provider, downloaded media or
ran a real BVID.

## 1. The original B6A package manifest (C0, before any edit)

```text
$ cd docs/active/project/evidence/v3_media_companion/v3-completion/gc-b6a-review-capture-implementation-2026-10-25
$ sha256sum -c PAYLOAD_MANIFEST.sha256
00-status-and-scope.md: OK
01-changed-file-hashes.json: OK
02-commands-and-exits.md: OK
03-case-to-production-oracle-map.md: OK
04-negative-receipts.md: OK
05-obligation-map.json: OK
06-contract-statement.md: OK
07-secret-path-raw-media-scan.json: OK
08-owned-resource-cleanup-audit.md: OK
09-zero-action-receipt.json: OK
10-prd-coverage-and-risks.md: OK
11-handoff.md: OK
exit 0
```

The submitted B6A package was INTACT before this batch and it was NOT
modified by this batch.

## 2. The B6A acceptance files, one file at a time

```text
$ cd scripts/stage_b_b5_3
$ node --test test/b6_review_bundle.node-test.mjs        # exit 0   tests 24  pass 24  fail 0
$ node --test test/b6_thumbnail_seek.node-test.mjs        # exit 0   tests 10  pass 10  fail 0
$ node --test test/b6_blind_projection.node-test.mjs     # exit 0   tests  8  pass  8  fail 0
$ node --test test/b6_lifecycle.node-test.mjs             # exit 0   tests  7  pass  7  fail 0
$ node --test test/b6_aggregate.node-test.mjs            # exit 0   tests 23  pass 23  fail 0
$ node --test test/b6_mutation_process.node-test.mjs     # exit 0   tests 13  pass 13  fail 0
$ node --test test/b6_capture_filesystem.node-test.mjs   # exit 0   tests 14  pass 14  fail 0
$ node --test test/b6_seek_closure.node-test.mjs         # exit 0   tests 13  pass 13  fail 0
$ node --test test/b6_runner_capture_gate.node-test.mjs  # exit 0   tests  5  pass  5  fail 0
```

The nine files together: 117 tests, 117 pass, 0 fail, exit 0.

## 3. The FULL offline Stage B runner suite (once)

```text
$ cd <repo-root>
$ node scripts/stage_b_b5_3/test/run_offline_suite.mjs
offline files: 34
external_not_run: canary_bvid1.node-test.mjs (real Chrome + real cookie + real Runtime)
# tests 574
# pass 574
# fail 0
OFFLINE SUITE PASSED
exit 0
```

The EXTERNAL canary is NOT part of this command and it is NOT counted as a
pass: it needs the separate real-run checkpoint.

## 4. The relevant Runtime tests (production Python was NOT changed)

```text
$ cd services/local-runtime
$ .venv/bin/python -m pytest \
    tests/test_v3_media_capture_runtime.py \
    tests/test_v3_media_product_services.py \
    tests/test_v3_media_transcript_projection.py \
    tests/test_v3_media_comprehension.py -q
50 passed, 1 warning in 12.67s
exit 0
```

The full Runtime suite is NOT required: this batch changed no production
Python. The four files above cover the PUBLIC workspace projection route and
the AUTHENTICATED thumbnail route that the capture reads.

## 5. The relay v11 gate

The relay v11 gate is the offline suite case `relay_ownership_contract.node-test.mjs`
("relay v11: unique Offscreen context is authoritative and sender documentId
is optional"). It passed inside the run of §3 (exit 0). This batch wrote
NOTHING under `apps/chrome-extension/`, so the relay sources are
byte-unchanged by this batch; see `10-prd-coverage-and-risks.md` (R3) for the
concurrent-worktree caveat.

## 6. The negative PROCESS exits (the mutation matrix)

```text
$ node test/_fixtures/b6_mutation_runner.mjs none                  # exit 3  (accepted: the control)
$ node test/_fixtures/b6_mutation_runner.mjs foreign-adapter       # exit 0  (refused)
$ node test/_fixtures/b6_mutation_runner.mjs stale-revision        # exit 0  (refused)
$ node test/_fixtures/b6_mutation_runner.mjs detached-manifest-bytes # exit 0 (refused)
$ node test/_fixtures/b6_mutation_runner.mjs false-closure         # exit 0  (refused)
$ node test/_fixtures/b6_mutation_runner.mjs wrong-counts          # exit 0  (refused)
$ node test/_fixtures/b6_mutation_runner.mjs wrong-hashes          # exit 0  (refused)
$ node test/_fixtures/b6_mutation_runner.mjs wrong-receipt-schema  # exit 0  (refused)
$ node test/_fixtures/b6_mutation_runner.mjs failed-status         # exit 0  (refused)
$ node test/_fixtures/b6_mutation_runner.mjs manifest-traversal    # exit 0  (refused)
$ node test/_fixtures/b6_mutation_runner.mjs manifest-undeclared   # exit 0  (refused)
$ node test/_fixtures/b6_mutation_runner.mjs manifest-missing      # exit 0  (refused)
$ node test/_fixtures/b6_mutation_runner.mjs provider-in-receipt   # exit 0  (refused)
```

The exit code IS the verdict: `0` = the mutation was REFUSED, `3` = the
mutation was ACCEPTED (the defect class is OPEN), `4` = the mutation itself
failed. The exact codes of every run are in `04-negative-receipts.md`.

## 7. The capture-failure scenario (a separate process)

```text
$ node test/_fixtures/b6_capture_gate_scenario.mjs
{"decision":{"allowSourceCompletion":false,"failureCode":"B6_CAPTURE_ROOT_INVALID","captureStatus":"failed"},"mergedDisposition":"failed","mergedFailureCode":"B6_CAPTURE_ROOT_INVALID","sourceCompletionCount":0,"sourceAttemptCount":0}
exit 0
```

## 8. The payload scan and the payload manifest (generated LAST)

```text
$ cd docs/active/project/evidence/v3_media_companion/v3-completion/gc-b6a-corrective-implementation-2026-10-25
$ sha256sum <the 12 payload files> > PAYLOAD_MANIFEST.sha256
$ <the production secret / absolute path / raw media scan over every payload file, this scan output and the manifest>
{"first":{"files":13,"secretHits":0,"absolutePathHits":0,"rawMediaHits":0},"second":{"files":13,"secretHits":0,"absolutePathHits":0,"rawMediaHits":0}}
$ sha256sum -c PAYLOAD_MANIFEST.sha256
00-status-and-scope.md: OK
01-changed-file-hashes.json: OK
02-commands-and-exits.md: OK
03-case-to-production-oracle-map.md: OK
04-negative-receipts.md: OK
05-obligation-map.json: OK
06-contract-statement.md: OK
07-secret-path-raw-media-scan.json: OK
08-owned-resource-cleanup-audit.md: OK
09-zero-action-receipt.json: OK
10-prd-coverage-and-risks.md: OK
11-handoff.md: OK
exit 0
```

The manifest was generated AFTER every payload stabilized, and the payload
digests are the digests of the written bytes. The FINAL scan pass over all
thirteen files (the twelve payloads, the scan output and the manifest) found
ZERO secret hits, ZERO absolute path hits and ZERO raw media hits.

