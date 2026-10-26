# GC-B5R B-5 Final Closure Report

Status: **B-5 CLOSED BY CODEX**

This package closes the remaining B-5 implementation and real-run gate. It does
not by itself declare Stage B or V3 complete.

## Final real run

- Run: `gc-b5r-b5-final-r8-20261024T200217Z`
- Frozen registry digest: `9c2da2f4c4c16fc94e1e0d7dfc9362ab1177d2db53f63d4af5a81a44795c9454`
- Result: 6 complete, 0 limited, 0 blocked, 0 failed
- Aggregate verdict: positive
- Owned process sightings/leaks: 0/0
- Runtime synthesize calls: 6
- Provider HTTP attempts: 28
- Published derivatives: 6
- Raw video/audio/frame/cookie/key/path uploads: all 0
- Audio output and tab capture: 0

| Order | Source | Result | Provider requests | Derivative SHA-256 |
|---:|---|---|---:|---|
| 1 | `BV11t8w6oEtP` | complete | 7 | `67eece7e13af478fa9205e7680abda3fc6bfc025b9e9ed509ecdfc468858d473` |
| 2 | `BV1QcYx6VEAj` | complete | 6 | `837bfcb516f01777b1ff32ee820e4273cd69ba985b5d6197196ca3b3b2d0415c` |
| 3 | `BV1v58B6GEan` | complete | 4 | `a44e7b6cea88dd56b0cfdcf75cf6076fb9453bfd92cededef4bd467a8af79238` |
| 4 | `BV1M5tJ6kEvw` | complete | 3 | `e47a1b7a234e4a7e12b7513d9f5b87bbcae1fca3861a2b01abf106bf0b58ceba` |
| 5 | `BV1HTbi6LERi` | complete | 2 | `c411be3a010a3c68be891c204452fcd653d24518004906828e716e3fb1d3aa45` |
| 6 | `BV1qM9fB8Eb2` | complete | 6 | `58dc28e67e867f2a6bab5a91d1f3017fd57eb4a4327264ccfce8ed2e151c7429` |

Each row has a contract-valid V2.1 derivative, byte hash, canonical receipt
hash, machine identity, Provider lock, task namespace, privacy audit, and
cleanup receipt. The sequencer validates these facts rather than trusting the
terminal label.

## Corrective history

The final result does not erase the failed candidates:

- R5: 5 complete, 1 failed; exposed a brief value-domain defect.
- R6: 5 complete, 1 failed; exposed a malformed candidate-shape path.
- R7: stopped after four sources once bounded repair could not succeed; its
  incomplete evidence remains non-positive.
- R8: 6 complete and positive after the production fixes and strengthened
  oracles.

The corresponding summaries are retained under `corrective-candidates/`.

## Decision

Fatal 0 / Major 0 / Minor 0 within B-5. The former open R1 real six-video gate
is closed. No contract, schema, FailureCode, threshold, registry, Provider
registry, or relay-v11 freeze was changed.
