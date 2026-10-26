# GC-B5R offline implementation report — Grounded Comprehension Recovery

Date: 2026-10-23
Workpack: GC-B5R (offline implementation + preflight only)
Status: **GC-B5R OFFLINE CANDIDATE AWAITING CODEX CHECKPOINT**

Nothing in this batch started Chrome, started the Runtime media work, called a
Provider, downloaded media, imported media, generated an artifact for a real
BVID, or produced audio. The counts are in `03-commands-and-results.md` and
they are all zero.

---

## 1. The production map (G0)

The map below is the result of reading the current chain before changing any
code. Every row names a production symbol, not a plan.

| # | Stage of the chain | Production owner (symbol) | Disposition |
|---|---|---|---|
| 1 | public entry (HTTP) | `navia_runtime/app.py` → `POST /v1/media/tasks/{id}/comprehension/synthesize` | **reuse** |
| 2 | acquisition authority | `MediaAcquisitionCoordinator` (`acquisition/coordinator.py`), `MediaTaskStore.require_current_authority` (`task_store.py`) | **reuse** |
| 3 | WP-A dependency snapshot | `MediaDependencyManager.acquire_snapshot` / `leased_snapshot` (`dependencies/manager.py`) | **minimal fix** (the process-level lease mirror, see §3) |
| 4 | WP-B local import | `LocalMediaImportStore` (`local_import/store.py`), `LocalImportOrchestrator` (`local_import/orchestrator.py`), `LocalMediaConsumerBarrier` (`local_import/consumer_barrier.py`) | **reuse** |
| 5 | transcript / OCR / frame evidence | `MediaProductMaterializer` (`product_materializer.py`), `media_evidence_refs` / `media_outlines` | **reuse** |
| 6 | synthesis Provider | `MediaComprehensionService.synthesize` → `MiniMaxGroundedSynthesisProvider` / `DeepSeekStrictGroundedSynthesisProvider` (`comprehension/synthesis.py`) | **reuse** |
| 7 | validators | `validate_grounded_comprehension` (`comprehension/quality.py`), 18 frozen `V3510B_*` codes | **reuse** |
| 8 | atomic V2.1 publisher | `MediaComprehensionService._save_grounded_v2_1` → `_atomic_save_grounded` (`<private>/grounded-comprehension-v2.1/<taskId>/revision-<rev>/<catalogSha>.json`) | **reuse** |
| 9 | projection | `MediaComprehensionService.get` → `v3-media-workspace-comprehension-projection/v2` | **reuse** |
| 10 | cleanup | the WP-B barrier owns the shared-input cleanup (`LocalMediaConsumerBarrier._run_cleanup_if_claimed`); the acquisition coordinator owns the acquisition cleanup | **reuse** — no competing owner was created |
| 11 | current runner | `scripts/stage_b_b5_3/sequencer.mjs`, `scripts/stage_b_b5_3/run_one_bvid.mjs` | **minimal fix** (the preflight-only mode and the frozen-identity refusal) |

### The gap G0 found

Every owner above already existed and already owned its behaviour. The ONE
missing composition was the **provenance of the input**: nothing tied a
published local-import product back to the *current* task, the *current*
source identity and the *current* dependency generation. The comprehension
chain read the evidence of whatever task it was given, and the local-import
binding was never re-verified at the synthesis point.

That gap is a **missing composition**, not a missing behaviour, so this
workpack added the composition and re-used the owners. Nothing was
reimplemented.

---

## 2. What was implemented

### 2.1 `media_companion/local_import/binding.py` (new)

The durable binding between a local import and its acquisition task, read from
the durable import record only. It never infers an identity from a file name,
a digest, a similarity or a test seed.

* `resolve_binding(store, task_id)` — the live import of THIS task, read from
  `LocalMediaImportStore.list_for_task`. A `ready` import DOES own the current
  input of its task; a `cancelled`/`failed` import owns nothing and closes the
  local route. Two live imports for one task are two owners of one input and
  are refused.
* `verify_binding(binding, task_id, source_identity, dependency_generation)` —
  refuses a foreign task (`V3_MEDIA_CROSS_TASK_REUSE`), a foreign identity in
  ANY component (`V3_MEDIA_TRANSCRIPT_SOURCE_MISMATCH`) and a foreign
  dependency generation (`V3_MEDIA_CROSS_TASK_REUSE`).
* `source_identity_parts(source_identity)` — the exact
  `portal:<adapter>:<mediaId>:<playbackUnitId>:<partId>` split, so a mismatch
  in the media id, the playback unit or the part is a mismatch of the whole
  media.

Every failure code is an **existing** code of the frozen media inventory. No
inventory, threshold, message set or schema was edited.

### 2.2 `media_companion/input_authority.py` (new)

The ONE composition point between an acquisition input and the grounded
comprehension chain. It composes the durable owners and verifies that they
agree:

* the task store's source authority (`require_current_authority`),
* the task revision,
* the local-import binding (task, identity, generation),
* the coordinator's acquisition task, when a coordinator is injected.

`MediaInputAuthority.for_task_store(task_store)` is the **production**
composition: the local-import store lives in the SAME Runtime database as the
task store, and the current dependency generation is the task's lease.

### 2.3 `media_companion/comprehension/service.py` (modified)

`MediaComprehensionService` now refuses a task whose input is not the current
task's own input — **before any Provider is asked** and **again immediately
before the publication**. The refusal codes are the frozen ones; the mapping
is a closed set in `_INPUT_REFUSAL_MESSAGES`.

When no authority is injected, the service composes the default one from the
durable owners of the same Runtime (`_default_authority`). The historical
constructor signature and the historical composition keep working unchanged.

### 2.4 `media_companion/dependencies/manager.py` (minimal fix)

The manager now mirrors every task lease into the existing module-level
`DEPENDENCY_LEASES` map, and releases it with the lease. This lets a component
that only knows the Runtime database path read the CURRENT generation of a
task without a second composition root and without a second orchestrator. The
manager remains the only owner; the map is a copy, never an owner.

### 2.5 `media_companion/local_import/store.py` (minimal fix)

One read-only method was added, `list_for_task(task_id)`. The existing
`list_incomplete()` hides the `ready` records, and a ready record is the one
that owns the current input of a task, so the binding lookup needs the whole
history of the task. No table, column, state or transition was changed.

### 2.6 `scripts/stage_b_b5_3/` (the runner)

* `lib/preflight.mjs` (new) — the PREFLIGHT-ONLY inspection. It reads the
  frozen registry (digest verified), inspects the six identities and the
  explicitly configured local-asset availability with `stat` only, and reports
  all eleven action counters as zero. It never attempts a source and never
  claims a pass: the disposition is `preflight_only` and `passed` is `false`.
* `sequencer.mjs` — the frozen six now come from the frozen registry file
  (digest verified) instead of a local copy, and `--preflight-only=1` writes
  the receipt and returns before the run loop.
* `run_one_bvid.mjs` — refuses a substituted `(order, bvid)` pair before
  anything starts, and the task Provider lock now rejects zero Providers and
  two Providers (`providerLockOffenders`).
* `lib/contracts.mjs` — `providerLockOffenders`, the testable form of the
  runner's Provider lock.

### 2.7 The composition point was moved out of `app.py` on purpose

The first implementation wired the authority in `navia_runtime/app.py`. That
file's SHA-256 is frozen in the relay-v11 evidence
(`v3-media-capture-internal-relay-v11-fixtures.json`), and the change made the
relay-v11 baseline verifier report 46/50 (the file is skipped on a hash
mismatch, which cascades into the semantic inventory). The wiring was
therefore moved into the media_companion package, where the durable owners
already live, and `app.py` was restored to its frozen byte-for-byte state
(`d7d2c438b6bf3fb71e9a541fd66a22d90718ffbc2f4ebaf8219e7d3ac08e5f9d`). The
relay-v11 baseline is 50/50 and the mutation verifier is 16/16 again. No hash
and no verifier was refrozen.

---

## 3. What was NOT done (G2, G3, the fixed boundaries)

* **No second orchestrator.** The acquisition coordinator, the WP-B
  orchestrator, the barrier and the dependency manager keep their ownership.
  The new authority only READS them.
* **No Provider fallback, no best-of-N, no cross-Provider stitching, no
  threshold reduction, no padding, no truncation, no paraphrase repair, no
  fabricated claims.** The one bounded repair route and the deterministic
  composer allowlist of `comprehension/service.py` are untouched.
* **No new failure code.** Only existing frozen codes are used:
  `V3_MEDIA_TRANSCRIPT_SOURCE_MISMATCH`, `V3_MEDIA_CROSS_TASK_REUSE`,
  `V3_MEDIA_IMPORT_CANCELLED`, `V3_MEDIA_IMPORT_WRITE_FAILED`,
  `V3510B_TASK_REVISION_CONFLICT`.
* **No public API, schema, threshold, message set, Provider registry,
  Origin/auth ordering, denominator or historical evidence was edited.**
* **tabCapture was not used.** It remains default-off; the route-order test
  proves that a capture grant cannot be bound before the three automatic
  routes failed, and that a task never holds a grant without an explicit bind.
* **No BVID was substituted** and no generic seed was reused.
* **No Desktop, no disk search, no user Chrome/profile, no undeclared cookie
  or media file** was read.
* **Nothing was committed, pushed, reset, cleaned, checked out, reverted or
  discarded.** The dirty worktree was left as it was, and no unrelated file
  was touched.
* **No generated build output was edited.**

---

## 4. Honest report of what is proven and what is not

* The authority, the validators, the atomic publisher, the cleanup owners and
  the preflight path are driven by **production owners** in the tests. The
  Provider is the only faked boundary, and it is faked at the network edge.
* The **production** authority path is proven by the three
  `test_o03_the_default_authority_*` cases, which build the service exactly
  as the Runtime does (no injected authority, one shared Runtime database).
* The coordinator check inside the authority is an **optional injection** and
  is exercised by a test double only. The production path does not inject a
  coordinator, because the identity binding it would check is already
  enforced by durable owners: the acquisition coordinator refuses to rebind a
  task id to another source (`V3_MEDIA_TASK_INVALID`), the projection's
  identity IS the coordinator's immutable task identity, and the local route
  is bound through `coordinator.bind_local_import` at T3. This is reported as
  a defence-in-depth hook, **not** as a production-enforced check.
* The current-generation comparison applies when the task holds a lease. After
  a Runtime restart the leases are empty, and the comparison is then skipped —
  exactly the rule the WP-B orchestrator already applies (its B19 check uses
  the same `leased_snapshot` seam). This is a real limitation, listed in
  `07-risks-and-handoff.md`.
