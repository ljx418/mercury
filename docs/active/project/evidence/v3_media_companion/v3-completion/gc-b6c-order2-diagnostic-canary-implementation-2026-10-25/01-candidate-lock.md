# GC-B6C Candidate Lock And The Change Inventory

Batch: `GC-B6C ORDER-2 DIAGNOSTIC CANARY IMPLEMENTATION`
Date: 2026-10-25

## 1. The manifests of the frozen packages

```text
$ cd docs/active/project/evidence/v3_media_companion/v3-completion/gc-b6b-capture-corrective-codex-2026-10-25
$ sha256sum -c PAYLOAD_MANIFEST.sha256
5/5 OK
exit 0

$ cd ../gc-b6b-fresh-candidate-blind-review-2026-10-25
$ sha256sum -c PAYLOAD_MANIFEST.sha256
10/10 OK
exit 0
```

Neither package was modified by this batch.

## 2. The Codex-hardened harness files

The `01-corrective-implementation.md` of the Codex corrective package froze
the digests of seven harness files. They were re-hashed at the end of this
batch:

| File | Codex closure digest | State |
|---|---|---|
| `lib/review_bundle.mjs` | `70132097a3dc34086fbb37042e5d74b21ffab766ac23f121af3762c910cf7b1d` | UNCHANGED |
| `lib/review_capture.mjs` | `8d72db61c86122e5fdf822100b71e28c2da1097b4715fc4a4f44562c45829869` | UNCHANGED |
| `lib/audit_finalizer.mjs` | `ba7a42033f9b2b34895508adc83c1ba0ff4975c997dbf6dd0eb68d3f91d090d1` | UNCHANGED |
| `test/b6_thumbnail_seek.node-test.mjs` | `39554d6b447d26078f3eb9b24b1650e00764261eb16f5d3a9d4932b35d438d59` | UNCHANGED |
| `test/_fixtures/seed_review_task.py` | `8c3139b2a4c48176b9ef2710e05f9d9290768024b29a197ae3ed151750361e8e` | UNCHANGED |
| `run_one_bvid.mjs` | `1c630fc9617bb18a4f173bd91e48642fb317aa19749bb529b308383452d6ab0e` | **CHANGED by this batch** → `bc594a55321f155e0af614138ec72c18add0dfa4dff2cda25a31c19e8d1229fb` |
| `test/b6_lifecycle.node-test.mjs` | `f341fdba6aa9d50454594b9718f99a1905e4cca47f3f9a7503e8b46a7ce0aa46` | **CHANGED by this batch** → `4f66a7089c647bf4f60ebb4df55d0cec9373a2e17d95e37e8efbe5292ea3e3a0` |

The two changed files are the additive canary mode of the existing owner
and the canary composition cases. The capture contract, the capture
transaction, the catalog closure, the diagnostic codes, the finalizer merge
and the Runtime composition fixture are UNCHANGED.

## 3. The new files of this batch

| File | SHA-256 |
|---|---|
| `scripts/stage_b_b5_3/lib/order2_canary.mjs` | `782ea48eda83700694fb176f1e64b7195d196921b31a4d0b224e7104f52a3ce2` |
| `scripts/stage_b_b5_3/order2_diagnostic_canary.mjs` | `7dc972d16ea8cf3a247dfe204043ce9f5bd8689058c6adf4b929e498bebf8916` |
| `scripts/stage_b_b5_3/test/b6c_order2_canary.node-test.mjs` | `662db2e626fade1cfdd99699aa5ad6749153e92586bbb196347669aedf05c53d` |
| `scripts/stage_b_b5_3/test/_fixtures/order2_observations_fixture.mjs` | `3ec126519bf72653e803460e858b2bcd6e3da71acba719e4990449e8645e4cb5` |

(The digests of the two changed files are the ones measured at the end of
this batch; the manifest of this package carries the payload digests.)

## 4. The active registry

```text
registry sha256: 9c2da2f4c4c16fc94e1e0d7dfc9362ab1177d2db53f63d4af5a81a44795c9454
order 2 identity: BV1QcYx6VEAj
reserves:         4 (never diagnosable by this canary)
```

The canary's identity guard is `lib/order2_canary.mjs ::
assertOrder2Identity`: it refuses every primary order except 2, every
reserve source and every substituted bvid BEFORE any external action.
