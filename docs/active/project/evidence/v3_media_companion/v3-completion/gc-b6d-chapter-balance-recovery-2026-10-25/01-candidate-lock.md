# GC-B6D Candidate Lock And The Changed Files

Batch: `GC-B6D CHAPTER-BALANCE RECOVERY (OFFLINE IMPLEMENTATION)`
Date: 2026-10-25

## 1. The frozen package manifests

```text
$ cd docs/active/project/evidence/v3_media_companion/v3-completion/gc-b6c-visible-diagnostic-and-b6d-handoff-2026-10-25
$ sha256sum -c PAYLOAD_MANIFEST.sha256
5/5 OK
exit 0

$ cd ../gc-b6c-codex-checkpoint-corrective-2026-10-25
$ sha256sum -c PAYLOAD_MANIFEST.sha256
4/4 OK
exit 0

$ cd ../gc-b6b-capture-corrective-codex-2026-10-25
$ sha256sum -c PAYLOAD_MANIFEST.sha256
5/5 OK
exit 0

$ cd ../gc-b6c-order2-diagnostic-canary-implementation-2026-10-25
$ sha256sum -c PAYLOAD_MANIFEST.sha256
9/9 OK
exit 0

$ cd ../gc-b6b-fresh-candidate-blind-review-2026-10-25
$ sha256sum -c PAYLOAD_MANIFEST.sha256
10/10 OK
exit 0
```

No historical evidence package was modified by this batch.

## 2. The changed files of this batch

Six files. The digests are the digests of the written bytes.

| File | SHA-256 | Change |
|---|---|---|
| `services/local-runtime/navia_runtime/modules/media_companion/comprehension/quality.py` | `5176111a75394616fddf37fae5d940100cded47247052e77310ab1ab5aec6155` | the SOLE owner of the chapter-balance semantics: the pure assessment, the frozen constraints, the anchor helper and the region helper; the independent validator calls the owner |
| `services/local-runtime/navia_runtime/modules/media_companion/comprehension/synthesis.py` | `af8531bd8f3a893c30dc1d78ff786807f2f9c402b6be0f9c1716d7942922ec79` | the adapter's ONE enforcement loop now checks the balance; the balance repair payload; the per-refusal diagnostics; the frozen failure code of a persistent imbalance |
| `services/local-runtime/navia_runtime/modules/media_companion/comprehension/diagnostics.py` | `b6ce36c429e19fcd4a3b6eddeff4fd340e380fbb1567e42f02f19209f35c8505` | the privacy-safe `chapterBalance` facts of the INTERNAL diagnostic |
| `services/local-runtime/navia_runtime/modules/media_companion/comprehension/service.py` | `f8c13c13cf391410f27a3564057032086f91b04c3f73d1e64163321a3e4c4d17` | the diagnostic of the FINAL refusal of the bounded repair, so the runner can retrieve it |
| `services/local-runtime/tests/test_v3_gc_b6d_chapter_balance.py` | `7584097402c424ee6a299e6f78ceef894d90460f58ec25ffe0396d6257cd5676` | NEW: the 23 focused GC-B6D cases |
| `scripts/stage_b_b5_3/test/b6d_balance_diagnostic.node-test.mjs` | `dc5c529d347e83dea61cd56900b9a8f94fa5f9a5b66c42126cde7ca0a4ad542a` | NEW: the 2 runner-boundary cases |

## 3. The frozen relay scope

This batch wrote NOTHING under `apps/chrome-extension/`: the relay v11
sources, the capture contract and the e2e harnesses are byte-unchanged by
this batch. The relay v11 gate case (`relay_ownership_contract.node-test.mjs`
→ "R5-B relay v11: unique Offscreen context is authoritative and sender
documentId is optional") is GREEN inside the full offline Stage B suite
(`619/619`). The worktree carries unrelated modifications of the relay
sources from a CONCURRENT session; they are not this batch's and they were
not touched here.

## 4. The production Python that changed

Only the four comprehension modules above. The product's HTTP surface, its
task store, its acquisition, its materializer, its Provider adapter and its
public schemas are UNCHANGED.

## 5. The git state

This batch did not commit, push, reset, clean, check out or revert. The
changed-file inventory is the digest list above, because the Stage B tree is
largely UNTRACKED in git and the git diff would mix this batch with the
uncommitted Stage B work of the earlier batches.
