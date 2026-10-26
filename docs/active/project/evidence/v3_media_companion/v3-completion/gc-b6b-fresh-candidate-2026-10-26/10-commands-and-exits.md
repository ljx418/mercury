# GC-B6B Commands And Exits

Every command of this batch, with its exit code. The visible batch is the ONE
authorized run: it started six OWNED muted Chrome instances, six isolated
Runtimes, read the authorized Cookie, performed the media acquisition and
called the Provider. Nothing else was started.

## 1. The focused B6 tests (before the visible batch)

```text
$ cd services/local-runtime
$ .venv/bin/python -m pytest tests/test_v3_gc_b5r_chapter_diagnostics.py \
    tests/test_v3_gc_b5r_final_offline_correction.py \
    tests/test_v3_gc_b6d_chapter_balance.py \
    tests/test_v3_gc_b6f_candidate_invariants.py \
    tests/test_v3_media_comprehension.py \
    tests/test_v3_grounded_comprehension_b5_1.py \
    tests/test_v3_grounded_comprehension_b5_2.py -q
174 passed, 1 warning in 16.90s
exit 0
```

## 2. The complete Stage B offline suite (before the visible batch)

```text
$ cd <repo-root>
$ node scripts/stage_b_b5_3/test/run_offline_suite.mjs
# tests 629
# pass 629
# fail 0
OFFLINE SUITE PASSED
exit 0
```

The run MUST be executed with a CLEAN environment: an inherited
`NAVIA_B6_PRIVATE_ROOT` makes the sequencer demand six closed captures and
the offline cases (which run no capture) then fail. The first attempt of
this command inherited the batch environment and reported 13 failures; the
clean run above is the valid one. This is a property of the test harness,
not of the run.

## 3. The production zero-action preflight

```text
$ node scripts/stage_b_b5_3/production_preflight.mjs --evidence-root=<the owned preflight root>
passed: true
failedChecks: []
actions: chromeLaunch 0 / visibleWindow 0 / runtimeMediaWork 0 / providerCall 0 /
         download 0 / import 0 / mediaTask 0 / cookieInjection 0 / audio 0 /
         tabCapture 0 / focus 0 / realSourceCompletion 0
exit 0
```

34 checks, 0 failures, every external action counter at zero.

## 4. The ONE visible six-source batch

```text
$ node scripts/stage_b_b5_3/sequencer.mjs \
    --run-id=gc-b6b-20261025T175243Z \
    --evidence-root=<the owned work evidence root, outside the repository>
BVID 1/BV11t8w6oEtP disposition: limited (exit 0)
BVID 2/BV1QcYx6VEAj disposition: blocked (exit 0)
BVID 3/BV1v58B6GEan disposition: limited (exit 0)
BVID 4/BV1M5tJ6kEvw disposition: limited (exit 0)
BVID 5/BV1HTbi6LERi disposition: complete (exit 0)
BVID 6/BV1qM9fB8Eb2 disposition: complete (exit 0)
===== SEQUENCER FINISHED =====
verdict.positive: false   (complete 2 / limited 3 / blocked 1 / failed 0)
exit 1
```

The work evidence root is OUTSIDE the repository: the runner writes the raw
derivative bytes and the Provider receipt mirror into it, and neither may
enter the public evidence tree. The public package of this batch is a
hand-written, privacy-safe projection.

## 5. The post-run verification

```text
$ node <the post-run verifier: the PRODUCTION readReviewBundle() +
      validateReviewBundle() on every private bundle, the manifest
      verification, the action ledger reconciliation>
5 of 6 bundles present, 5 validated, 5 manifest-verified, 5 capture-closed
the ledger: 6 attempts / 5 completions / 20 provider calls / 6 Chrome launches /
            168 cookie injections / 56 events / 0 malformed lines
the reconciliation: the ledger's 20 outbound Provider attempts equal the sum
                     of the per-source receipts' attempt counts
exit 0
```

## 6. The public evidence scan and the manifest

```text
$ node <the production secret / absolute path / raw-media detectors over the
      public payload files>
secret hits: 0
absolute path hits: 0
raw media payload hits: 0
forbidden content probes: 0
exit 0

$ sha256sum -c PAYLOAD_MANIFEST.sha256
00-review-precommit.json: OK
01-candidate-lock.json: OK
02-production-preflight-receipt.json: OK
03-six-source-machine-results.json: OK
04-bundle-verification.json: OK
05-action-ledger-reconciliation.json: OK
06-secret-path-raw-media-scan.json: OK
07-privacy-and-cleanup-audit.md: OK
08-review-decision.md: OK
09-risks-and-next-decision.md: OK
10-commands-and-exits.md: OK
exit 0
```

The manifest is generated LAST, after every payload stabilized.
