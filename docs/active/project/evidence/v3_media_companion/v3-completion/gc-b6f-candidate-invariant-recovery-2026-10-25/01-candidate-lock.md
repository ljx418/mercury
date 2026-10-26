# GC-B6F Candidate Lock And The Changed Files

Batch: `GC-B6F CANDIDATE INVARIANT RECOVERY (OFFLINE IMPLEMENTATION)`
Date: 2026-10-25

## 1. The frozen package manifests

```text
$ cd docs/active/project/evidence/v3_media_companion/v3-completion/gc-b6e-visible-confirmation-and-b6f-handoff-2026-10-25
$ sha256sum -c PAYLOAD_MANIFEST.sha256
7/7 OK
exit 0

$ cd ../gc-b6d-codex-checkpoint-corrective-2026-10-25
$ sha256sum -c PAYLOAD_MANIFEST.sha256
6/6 OK
exit 0

$ cd ../gc-b6d-recovery-canary-capture-corrective-2026-10-25
$ sha256sum -c PAYLOAD_MANIFEST.sha256
7/7 OK
exit 0

$ cd ../gc-b6d-chapter-balance-recovery-2026-10-25
$ sha256sum -c PAYLOAD_MANIFEST.sha256
7/7 OK
exit 0
```

No historical evidence package was modified by this batch.

## 2. The changed files of this batch

| File | SHA-256 | Change |
|---|---|---|
| `services/local-runtime/navia_runtime/modules/media_companion/comprehension/diagnostics.py` | `57ebbf2ce12f6f91` | the OWNER of the complete frozen candidate contract; the privacy-safe value-domain classifiers; the structural trust decision |
| `services/local-runtime/navia_runtime/modules/media_companion/comprehension/synthesis.py` | `e01f86da98dab355` | every candidate-producing request composes the owner; the trusted repair context; the shape violation is now evaluated with the evidence |
| `services/local-runtime/navia_runtime/modules/media_companion/comprehension/quality.py` | `e4055fe33192367a` | the balance requirement statements (the count-aware and the count-unknown form) of the shared owner |
| `services/local-runtime/tests/test_v3_gc_b6f_candidate_invariants.py` | `00bc7367f2744762` | NEW: the 38 focused GC-B6F cases |
| `scripts/stage_b_b5_3/run_one_bvid.mjs` | `151a6314fde56610` | the runner's diagnostic sanitizer allowlist: the new value-domain keys, the new number keys, the new array keys and the new enums |
| `scripts/stage_b_b5_3/test/b6f_candidate_diagnostic.node-test.mjs` | `0fe0664949544619` | NEW: the 2 runner-boundary cases |
| `services/local-runtime/tests/test_v3_gc_b5r_final_offline_correction.py` | `f63a31cf9e4795d2` | the two FC4 repair-context assertions follow the new trusted-context contract, plus a new fallback case |

## 3. The two superseded FC4 assertions

The GC-B6F contract changes ONE behaviour: the repair context. The two
GC-B5R FC4 assertions pinned the previous behaviour and they were updated
to the new contract, with their INTENT preserved (the repair is always
grounded in an AUTHORIZED Provider artifact and never in an untrusted one):

| Case | Before | After |
|---|---|---|
| the initial route's shape regeneration | the extracted chunk context | the TRUSTED rejected candidate; the chunk context is the FALLBACK when the rejected candidate is untrusted (a new case proves the fallback) |
| the repair route's shape regeneration | the service's rejected candidate | the TRUSTED rejected candidate |

The frozen GC-B5R obligations themselves are untouched: the shape
enforcement, the temporal contract, the hard request bound, the diagnostic
privacy and the independent validator's authority are unchanged.

## 4. The frozen relay scope

This batch wrote NOTHING under `apps/chrome-extension/`. The relay v11 scope
files are byte-unchanged BY this batch (their modification times predate it)
and the relay v11 gate case is GREEN inside the full offline Stage B suite.

| File | SHA-256 (first 16) | Modified |
|---|---|---|
| `capture/relayContracts.ts` | `e75a1efa4eb51cfa` | 2026-10-18 |
| `capture/contracts.ts` | `18d0b5361cb84a2c` | 2026-10-15 |
| `capture/MediaCaptureController.ts` | `dc20b041647b6fcf` | 2026-10-18 |
| `capture/MediaCaptureMessageRouter.ts` | `d7d0ed7db90d12a4` | 2026-10-15 |
| `capture/MediaCaptureMessageClient.ts` | `5a2317a96d24f257` | 2026-10-15 |

(The worktree carries unrelated modifications of the relay sources from an
earlier concurrent session. They are not this batch's and they were not
touched here.)

## 5. The git state

This batch did not commit, push, reset, clean, check out or revert. The
changed-file inventory is the digest list above, because the Stage B tree is
largely UNTRACKED in git and the git diff would mix this batch with the
uncommitted Stage B work of the earlier batches.
