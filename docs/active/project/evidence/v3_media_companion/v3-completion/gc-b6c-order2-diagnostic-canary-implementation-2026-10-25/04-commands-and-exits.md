# GC-B6C Commands And Exits

Every command of this batch, with its exit code. No command in this list
started Chrome, read a real Cookie, called a Provider, downloaded media, ran
a real BVID or consumed an authorization.

## 1. The focused acceptance matrix of the canary

```text
$ cd scripts/stage_b_b5_3
$ node --test test/b6c_order2_canary.node-test.mjs
# tests 22
# pass 22
# fail 0
exit 0
```

Twenty-one numbered anti-false-green cases plus the positive control. Every
case drives the REAL entry point as a SEPARATE PROCESS and asserts the
process exit code and the durable receipt.

## 2. The lifecycle composition (the existing file plus the canary cases)

```text
$ node --test test/b6_lifecycle.node-test.mjs
# tests 10
# pass 10
# fail 0
exit 0
```

The seven existing obligations are unchanged and green; the two canary
composition cases are green.

## 3. The FULL offline Stage B runner suite

```text
$ cd <repo-root>
$ node scripts/stage_b_b5_3/test/run_offline_suite.mjs
# tests 608
# pass 608
# fail 0
OFFLINE SUITE PASSED
exit 0
```

The external canary is reported as `external_not_run` and is NOT counted as
a pass: it needs the separate real-run checkpoint.

## 4. The relevant Runtime tests

```text
$ cd services/local-runtime
$ .venv/bin/python -m pytest \
    tests/test_v3_media_capture_runtime.py \
    tests/test_v3_media_product_services.py \
    tests/test_v3_media_transcript_projection.py \
    tests/test_v3_media_comprehension.py -q
50 passed, 1 warning in 12.50s
exit 0
```

The production Python was NOT changed by this batch, so the full Runtime
suite is not required. The four files above are the ones that cover the
routes the canary reads (the public workspace projection, the authenticated
thumbnail route and the task projection).

## 5. The whitespace gate

```text
$ git diff --check
exit 0

$ git diff --no-index --check <an empty file> <each new file>
no diagnostic output: the four new files carry no whitespace error
(the no-index diff of a new file is a difference, not an error)
```

The four new files carry no trailing whitespace and no tab.

## 6. The secret / path / raw-media scan

```text
$ node <the production detectors over the six changed files>
secret hits: 0
raw media payload hits: 0
absolute path hits: 0 in the four NEW files
```

The absolute path shapes of the two CHANGED files are the pre-existing ones
(the public route shapes of the Runtime double and the secret-detector
pattern literals of the runner). They are itemised in
`07-secret-path-raw-media-scan.json`.

## 7. The zero-action and cleanup audit

```text
$ ls -d ${TMPDIR}/navia-b6c-*
(no output)

$ ps -eo pid,cmd | grep -E "run_one_bvid|sequencer.mjs|order2_diagnostic|uvicorn|navia_runtime" | grep -v grep
(no output)

$ ss -ltn | grep 17861
(no output)

$ node -e "import('./scripts/stage_b_b5_3/lib/temp_roots.mjs').then((m) => console.log(JSON.stringify(m.ownedTempRoots())))"
[]
```

## 8. The payload manifest (generated LAST)

```text
$ cd docs/active/project/evidence/v3_media_companion/v3-completion/gc-b6c-order2-diagnostic-canary-implementation-2026-10-25
$ sha256sum -c PAYLOAD_MANIFEST.sha256
00-status-and-scope.md: OK
01-candidate-lock.md: OK
02-canary-contract.md: OK
03-changed-files.md: OK
04-commands-and-exits.md: OK
05-case-to-production-oracle-map.md: OK
06-zero-action-and-cleanup-audit.md: OK
07-secret-path-raw-media-scan.json: OK
08-risks-and-next-decision.md: OK
exit 0
```
