# GC-B5R B-5 Codex checkpoint findings

Date: 2026-10-24

State: **GC-B5R B-5 CANDIDATE REJECTED / OFFLINE CORRECTIVE MAY START**

## Major findings

### M-B5-01 - Stage action accounting is materially incomplete

The package reports six Chrome launches for the clean batch, but its retained
logs contain at least 34 explicit `Chrome launched` records across attempts:

| Attempt | Explicit launches |
|---|---:|
| aborted-attempt-1 | 6 |
| aborted-attempt-2 | 6 |
| aborted-attempt-3 | 2 |
| aborted-attempt-4 | 2 |
| aborted-attempt-5 | 6 |
| diagnostic-attempt-6 | 6 |
| clean run | 6 |
| **minimum evidenced total** | **34** |

The original authorization allowed one consolidated visible batch and required
a later Codex decision before retrying a failed visible case. Identified code
changes explain the retries but do not turn earlier Chrome launches into zero
launches. The current action table is therefore not a truthful stage-level
ledger and cannot support closeout.

### M-B5-02 - Failure paths do not produce mandatory machine evidence

Sources 3, 4 and 5 contain only `b5-source-receipt.json`, `cleanup.json`,
`failure-diagnostic.json` and `final_disposition.txt`. They lack six files that
the aggregate itself requires: `isolation.json`, `receipt.json`,
`provider_lock.txt`, `chrome_launch.log`, `secret_scan.csv` and
`task_namespace.json`.

Consequently the aggregate also reports foreign/null Provider identity and
endpoint class. Reconstructing task identity later from console output is not
equivalent to a failure-path machine receipt. The runner must finalize audit
evidence for every disposition, without inventing a successful Provider
receipt.

### M-B5-03 - Chapter failure evidence is insufficient for the proposed contract decision

The three diagnostics expose only the final failure code/message and Runtime
call trace. They do not record the redacted candidate shape, chapter count and
field sets, chapter anchor monotonicity, or the evidence catalog's distinct
timestamp capacity. The evidence therefore cannot distinguish malformed model
output from a catalog that cannot support two strictly increasing anchors.

Codex does not authorize changing the frozen chapter rule. Frame and OCR items
sharing a timestamp do not by themselves require two chapters to share a
start. Keep the strict-increase invariant and first diagnose/harden the
Provider candidate and bounded repair path.

## Confirmed closure candidate

The receipt-extras implementation now reads `attemptId`, `requestSha256` and
`responseSha256` after the Provider request and after repair. The targeted
72-test Runtime suite passes, including the new frozen V2.1 schema gate. This
is a valid offline code fix, but B-5 still needs a future fresh publication to
produce acceptance evidence created by the corrected code.

## Independent replay

- Evidence manifest: verified.
- `node scripts/stage_b_b5_3/test/run_offline_suite.mjs`: 7/7 serial and
  229/229 concurrent, exit 0.
- Runtime authority/corrective/comprehension tests: 72 passed, exit 0.
- No Chrome, Runtime, Provider, download, Cookie injection or audio action was
  performed by this Codex checkpoint.

Fatal 0 / Major 3 / Minor 0.

