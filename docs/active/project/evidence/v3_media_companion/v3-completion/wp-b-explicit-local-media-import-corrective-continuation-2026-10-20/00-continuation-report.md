# WP-B corrective continuation — C3 through C7

**State: `WP-B CORRECTIVE CONTINUATION AWAITING CODEX CHECKPOINT`**

This is the unfinished remainder of the already-authorized WP-B corrective
implementation. It closes C3, C5 (barrier foundation and startup recovery), C4,
C6 and C7 in the mandated order. It is **not** a WP-B PASS, it does not enter
WP-C, and no self-refreeze or external document review was performed.

---

## 1. What changed, and why

### C3 — eligibility is decided before anything is allocated

`MediaAcquisitionCoordinator.local_import_eligibility(task_id, source_identity)`
is the production query. It requires the exact task, the exact source, all three
`CAPTURE_FALLBACK_ROUTES` failed in the frozen order, no `selectedInput`, no
`captureGrantId`, a non-terminal task, and a source authority outside
`{published, cancelling, failed, cancelled, cleanup_incomplete}`.

`LocalImportManager.create()` runs it **first**, before a record, a token, a
quota check, a sandbox or a writer exists. It is wired to the production
coordinator in `app.py` and fails closed when no coordinator is available.

### C5 — durable barrier foundation

The frozen 15-column `media_local_imports_v1` storeRecord was **not** extended.
The consumer barrier got its own durable table, `media_local_import_barriers_v1`:

| column | meaning |
|---|---|
| `audio_owner_receipt_sha256` | the ASR stager's committed owner manifest digest |
| `visual_receipt_sha256` | the canonical visual receipt digest from T2 |
| `transcript_terminal`, `visual_terminal` | the two consumer receipts |
| `prepared_media` | the durable prepared-media facts behind the frozen `media` |
| `phase`, `sequence`, `updated_at` | the frozen phase and its compare-and-set |

Every mutation is one `BEGIN IMMEDIATE` transaction on a `synchronous=FULL`
connection, guarded by a single compare-and-set on `sequence`. In the same
transaction the frozen `barrier_phase` and `visual_receipt_sha256` columns are
mirrored, so the public record and the barrier record can never disagree and a
hard kill cannot split them.

**Only real coordinator APIs are called.** `bind_local_import(...)` and
`complete(task_id)` — with their real signatures. The nonexistent
`release_selected_input` was removed; a test asserts the real coordinator has no
such attribute and that `complete`'s signature is exactly `(self, task_id)`.

`bind_local_import` now places the selected local input into the structure
`audio_reference()` already reads, under its real route name, so the existing
audio consumers need no second code path.

The second durable terminal claimant owns cleanup, through `claim_cleanup()`'s
compare-and-set. A duplicate receipt, or a fresh process after a restart, gets
`None` and does not clean again.

### C4 — one Runtime-owned orchestrator

`LocalImportOrchestrator` drives the whole handoff from the durable EOF:

```
T1 video_durable   → re-hash the bytes and compare against the durable owner manifest
T2 inputs_prepared → real ffprobe/ffmpeg → 16 kHz mono WAV + 1..8 frames +
                     the canonical visual receipt, all durable
T3 input_bound     → the coordinator binds the SAME two digests, under its own lock
   audio receipt   → the stager's committed owner manifest
   delete          → ONLY now the original video is released
T4 video_deleted   → and only now may ASR start
   ready           → the frozen public terminal, with the frozen media projection
```

Two production defects were found and fixed while wiring it:

- `_local_import_preparer` passed the `VerifiedDependencySnapshot` dataclass
  where the preparer expected a tool mapping; it now reads `ffmpeg`/`ffprobe`
  from the leased snapshot and fails closed when the task holds no lease.
- The orchestrator staged the audio itself and then the transcript service
  staged it again, which fails closed. The transcript service now owns the single
  staging step, and the orchestrator reads the receipt the stager **committed**.

A third defect was real product behaviour, not wiring:
`SenseVoiceTranscriptService._is_deferred_route()` read a `route` key the
service never wrote, so a local-route transcript cleaned the shared input
itself. `defer_to_barrier(task_id)` is now an explicit registration the
orchestrator makes, and no longer a guess.

### C5 — startup recovery

`_reconcile_local_imports_on_startup` is registered on
`app.router.on_startup`. It reconciles against the barrier's own **open** set —
an import may already be publicly `ready` while a consumer still owns its shared
input — and it never raises into the Runtime.

A fresh process never restores a token, a worker or a handle.

### C6 — Extension production reachability

The strict client now sends to the **absolute Runtime base URL** with the
companion bearer read at call time, validates the frozen id pattern
(`media_import_[a-f0-9]{32}` — it previously accepted a non-existent
`media_local_import_` prefix) plus `schemaVersion`, `sequence` and `recoverable`,
and **tracks every live XHR**: `abortAll()` calls `xhr.abort()` for real, not
merely a generation bump.

The card's cancel / unmount / identity-change path is now the frozen one —
`xhr.abort()`, then the DELETE, then a poll by sequence to `ready | failed |
cancelled`. A backend sequence regression is refused rather than treated as
progress.

The card is mounted in the real acquisition surface behind a single frozen
predicate, `localImportEntryEligible(...)`. It renders only when the Runtime
reports eligibility and nothing else owns the task; absence for ineligible,
capturing, transcribing, acquired and terminal-projection states is proven
against the same predicate the host uses.

### C7 — production proof

`services/local-runtime/tests/test_wp_b_c7_production.py` drives the real router,
middleware, bearer, one-shot token, orchestrator, barrier, coordinator, sandbox,
stager, dependency snapshot, transcript service and **the real local SenseVoice
model on real speech**. The seed is whatever the user explicitly authorized through
`NAVIA_WP_B_SEED_MEDIA`, validated with the real ffprobe before use and copied
read-only into a per-test root — nothing padded, truncated, sparsified or mocked.

---

## 2. Commands and exit codes

| command | exit | result |
|---|---|---|
| `pytest tests/test_v3_media_local_import_*.py tests/test_wp_b_*.py -q` | 0 | **148 passed** |
| `pytest tests/test_wp_b_c7_production.py -q -s` | 0 | 3 passed, real SenseVoice receipt |
| `python3 scripts/v3_media_local_import_wp_b_probe.py --json` | 0 | 7/7 kill points, all rc 137 |
| `npx vitest run src/modules/media_companion/tests/LocalMediaImportClient.test.tsx` | 0 | **20 passed** |
| `npx tsc --noEmit -p tsconfig.json` | 0 | clean except the pre-existing `vitest.config.ts` `module` overload error |
| `pytest tests/ -q` chunk 1 (files 1–30) | 0 | **263 passed** |
| `pytest tests/ -q` chunk 2 (files 31–62) | 0 | **498 passed** |
| `pytest tests/ -q` chunk 3 (files 63–92) | 1 | **247 passed, 1 failed** — the single failure is the pre-existing WP0 R4 timing race in §7 |

A single `pytest tests/ -q` over all 1005 tests is killed by the host with
exit 137 (memory); the suite was therefore run in three sequential chunks with
identical results.

---

## 3. Real identifiers and durable receipts

From `01-b21-real-sensevoice-receipt.json`:

| field | value |
|---|---|
| `importId` | `media_import_614fad479630b69db4089fe322f0b5dc` |
| `videoManifestSha256` | `e75726d88baa006aedfc55c81ebc610845299f7d5ef7ee8ce8df59f2582fb31b` |
| `visualReceiptSha256` | `dc4c2eff2bcdb67dce2810351b17c6cc6ef1e9e902a9d410e80e11ebb5d330c9` |
| `audioOwnerReceiptSha256` | `9aefe3ca86d193055797b22d72c5e783947d63b4c804bb89312ba523ed205d18` |
| byte length / uploaded | 75240 / 75240 |
| prepared media | 5510 ms, 320x240, `mov,mp4,m4a,3gp,3g2,mj2` |
| transcript | 1 segment, 19 characters of real speech |
| barrier phase at rest | `video_deleted` (the visual consumer is still live) |

`videoManifestSha256` is the exact digest of the uploaded body; the visual
receipt digest is the exact digest of the receipt file T2 wrote; the audio owner
receipt is the manifest the stager committed. All three are re-read at T3.

---

## 4. Real hard kills (`02-c5-real-hard-kill-probe.json`)

Every kill point is a real `os._exit(137)` — no `finally`, no atexit, no flush —
followed by a genuinely new process over the same SQLite, sandbox and shared
input.

| kill point | kill rc | durable phase | recovery outcome | input survived |
|---|---|---|---|---|
| after T1 | 137 | `video_durable` | `waiting:video_durable` | yes |
| after T2 | 137 | `inputs_prepared` | `waiting:inputs_prepared` | yes |
| after T3 | 137 | `input_bound` | `waiting:input_bound` | yes |
| after audio receipt, before delete | 137 | `audio_staged` | `waiting:audio_staged` | yes |
| after delete, before T4 | 137 | `video_deleted` | `waiting:consumers:video_deleted` | yes |
| after T4, before consumers terminal | 137 | `video_deleted` | `waiting:consumers:video_deleted` | yes |
| after both consumers, before cleanup | 137 | `cleaning` | `released` → `cleaned` | no |

Six of seven preserve the shared input because the durable receipts do not yet
prove ownership. The seventh releases it, exactly once.

---

## 5. Chrome and audio counts

No Chrome was launched in this continuation: **0 owned Chrome processes, 0
visible windows, 0 focus events**. Every gate was proven headless and offline
first, and no offline gate required a browser.

Audio was never played. The real ASR reads a WAV file in a sandboxed task root;
no test opens an audio device. `--mute-audio` was not needed because no
playback occurred.

---

## 6. Secrets and cleanup

- No desktop secret, cookie or credential was read or emitted. The companion
  bearer in the C7 test is a literal test constant owned by the test harness.
- The authorized real speech clip is copied read-only into a per-test temporary
  root; the original seed file is never written.
- Every test root is removed by pytest; the ASR task staging root is this batch's
  own scratch space and is cleared at case setup.
- The public status and the error payloads were asserted to contain no path, no
  file name, no token and no raw speech.

---

## 7. Severities found and fixed in this continuation

| severity | finding | resolution |
|---|---|---|
| Fatal | `media_local_import_<hex>` was accepted by the Extension client; the frozen id is `media_import_<hex>` | corrected, with a test |
| Major | `abortAll()` bumped a generation but never called `xhr.abort()`, so cancel/unmount left the transfer running | live XHR tracking; real abort, then DELETE, then poll |
| Major | `localImportEntryEligible` was expressed as inline JSX conditions that no test could assert | one frozen predicate, used by the host and asserted directly |
| Major | the deferred-route detection read a `route` key the transcript service never wrote, so a local transcript cleaned the shared input itself | explicit `defer_to_barrier()` registration |
| Major | `_local_import_preparer` handed the preparer a `VerifiedDependencySnapshot` dataclass instead of a tool mapping | reads the leased snapshot, fails closed without a lease |
| Major | the orchestrator staged the audio and the transcript service staged it again | the service owns the single staging step |
| Major | `public_media()` read `preparedMedia` from the frozen 15-column storeRecord, so the frozen `media` projection was unreachable | durable `prepared_media` in the barrier table, surfaced through an optional overlay |
| Minor | the identity-change effect compared `generation() !== generation()` | the mounted generation is state; a change aborts |
| Minor | the card polled status exactly once | `pollUntilTerminal` polls by sequence and refuses a regression |

### Newly discovered, owned by WP0, NOT introduced by C3–C7

| severity | finding | disposition |
|---|---|---|
| Major (WP0-owned) | `tests/test_wp0_r4_restart_and_security.py::test_no_secret_or_private_path_leaks_into_the_observable_surface` fails: `assert rows == []`, "a completed capture must leave no owner receipt behind" | **not fixed here** — see below |

The mechanism was established with a real owned-Uvicorn probe, not by reading
the test. On a completed capture the shipped websocket handler returns the
transcript in state **`queued`**; the ASR worker is a daemon thread, so the owner
receipt is released asynchronously. Measured on this machine:

| after | `media_capture_owner_receipts` |
|---|---|
| at the `completed` frame | `[('media_task_1111…', 'ownership_committed')]` |
| +0.5 s | `[]` |
| +2.0 s | `[]` |
| +5.0 s | `[]` |

So the receipt **is** released; the oracle asserts synchronously and loses the
race. Attribution was tested, not assumed: removing this continuation's
`deferred_routes` / `barrier_terminal` wiring and re-running leaves the failure
identical, and the relay child never reaches this continuation's local-import
code at all.

This batch does not fix it. `tests/test_wp0_r4_*`, the R4 harness and the v10/v11
relay evidence are all frozen and outside WP-B's scope; editing the oracle to
wait for the worker would change a frozen WP0 gate to accommodate a WP0 timing
bug. It is reported for WP0's owner to decide.

**Fatal remaining: 0. Major remaining: 1, in WP0, pre-existing, not introduced here.**

---

## 8. Evidence directory

`docs/active/project/evidence/v3_media_companion/v3-completion/wp-b-explicit-local-media-import-corrective-continuation-2026-10-20/`

| file | content |
|---|---|
| `00-continuation-report.md` | this report |
| `01-b21-real-sensevoice-receipt.json` | the redacted real receipt from the B21 production run |
| `02-c5-real-hard-kill-probe.json` | 7 real hard kills with the fresh-process recovery outcome |
| `03-c6-extension-client-tests.txt` | the 20 Extension cases, verbose |
| `04-runtime-local-import-suite.txt` | the consolidated 148-case Runtime result |
| `05-b01-b28-case-recomputation.md` | the B01–B28 recomputation from production drivers |
| `06-relay-v11-inventory.json` | the re-run relay v11 inventory: 46/50, no unlisted emits |
| `07-consolidated-test-results.txt` | Runtime chunked totals, Extension totals, typecheck |

---

## 10. Relay v11 inventory status

Re-run of the frozen v11 contract verifier (`verify-stage-b-b5-3-background-capture-relay-v11-contract.py`):

| item | value |
|---|---|
| summary | **46 / 50 passed**, 4 failed |
| target inventory | **20 / 20**, no missing, no extra |
| source inventory | **35 / 40**, 5 missing, no extra |
| unlisted boundary emits | `{}` — **none** |

The five source codes the extractor does not see are
`V3_MEDIA_ACQUISITION_IN_PROGRESS`, `V3_MEDIA_AUTHORITY_RESTART_UNCERTAIN`,
`V3_MEDIA_CAPTURE_NOT_ELIGIBLE`, `V3_MEDIA_CAPTURE_ORIGIN_MISMATCH` and
`V3_MEDIA_SOURCE_TASK_ACTIVE`. Two of them (`V3_MEDIA_CAPTURE_NOT_ELIGIBLE`,
`V3_MEDIA_SOURCE_TASK_ACTIVE`) are raised by the coordinator itself; the drift is
in the frozen extractor's scope, not a new emit.

Per the standing instruction this batch did **not** stop on that drift and did
**not** refreeze. The relay contract, its source/target inventories and the
WP-A hashes are untouched by this batch. Codex owns the eventual single refreeze.

---

## 11. Stop reason

`WP-B CORRECTIVE CONTINUATION AWAITING CODEX CHECKPOINT`

C3, C4, C5, C6 and C7 are closed. No Fatal and no Major finding is open **in this
batch's own scope**. B21 and B22 are production-proven against the real local ASR
on real speech, and 23 of B01–B28 have a case-bearing production driver.

One Major is open in **WP0's** scope: the frozen R4 oracle
`test_no_secret_or_private_path_leaks_into_the_observable_surface` loses a race
against the asynchronous owner-receipt release (§7). It is reported, not fixed,
because the oracle and the v10/v11 relay evidence are frozen and are not WP-B's
to change.

Two things are explicitly **not** claimed:

1. **B08, B09, B17, B23 and B27 are NOT RECOMPUTED.** They carry no case label
   anywhere in the local-import suite; their definitions live only in the
   external Codex checkpoint, which this batch is instructed not to re-audit.
   They are reported as unknown, not as passing.
2. **B29/B30 were not requested and not processed**, per the standing
   instruction that no seed media is requested until C3–C7 and B01–B28 are
   closed. Two real authorized clips exist (12,290 ms total) but are below the
   30,000 ms registry floor; they remain the sole possible external-input
   blocker and were deliberately not used to close anything.

WP-B is not announced as PASS, WP-C is not entered, and no refreeze was
performed. Codex owns the next decision.
