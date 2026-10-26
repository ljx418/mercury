# Capture Corrective Implementation

## Catalog closure

`evidenceCatalogSha256()` now exactly follows the production ordering:

```text
timestampStartMs, timestampEndMs, evidenceId
```

The production Runtime composition fixture now contains 96 evidence records,
matching the failed real source's cardinality: 84 transcript records and four
frame/OCR/caption triples. It includes same-start/different-end ties that would
fail under the former harness ordering. The test drives the production store,
outline generator, workspace route, authenticated thumbnail route, private
derived-text reads, bundle transaction, reread, and validation.

## Attributable capture failures

Capture outcomes now carry a sorted, deduplicated `diagnosticCodes` array.
Validation failures use the bundle validator's stable `B6_BUNDLE_*` codes;
other failures use their stable `B6_CAPTURE_*` code. Details remain process
local and are never persisted.

The runner writes these codes as `reviewCaptureFailureCodes` beside the
unchanged five-key public capture receipt. The audit finalizer treats the
array as a current-run observation. A runner-level regression proves that a
catalog refusal durably records both the catalog mismatch and its receipt
closure consequence, with no content or identifier in the array.

## Files changed

| File | SHA-256 |
|---|---|
| `lib/review_bundle.mjs` | `70132097a3dc34086fbb37042e5d74b21ffab766ac23f121af3762c910cf7b1d` |
| `lib/review_capture.mjs` | `8d72db61c86122e5fdf822100b71e28c2da1097b4715fc4a4f44562c45829869` |
| `lib/audit_finalizer.mjs` | `ba7a42033f9b2b34895508adc83c1ba0ff4975c997dbf6dd0eb68d3f91d090d1` |
| `run_one_bvid.mjs` | `1c630fc9617bb18a4f173bd91e48642fb317aa19749bb529b308383452d6ab0e` |
| `test/b6_lifecycle.node-test.mjs` | `f341fdba6aa9d50454594b9718f99a1905e4cca47f3f9a7503e8b46a7ce0aa46` |
| `test/b6_thumbnail_seek.node-test.mjs` | `39554d6b447d26078f3eb9b24b1650e00764261eb16f5d3a9d4932b35d438d59` |
| `test/_fixtures/seed_review_task.py` | `8c3139b2a4c48176b9ef2710e05f9d9290768024b29a197ae3ed151750361e8e` |

All paths are relative to `scripts/stage_b_b5_3/`.

Contract changes: **none**. The new diagnostic array is internal machine
evidence; the public capture receipt, product API, frozen schemas, FailureCode
inventory, registry, rubric, prompt, thresholds, and relay scope are unchanged.

