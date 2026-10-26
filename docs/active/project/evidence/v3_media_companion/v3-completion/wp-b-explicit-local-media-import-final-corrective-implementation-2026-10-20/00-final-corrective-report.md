# WP-B final corrective implementation — FC1 to FC7

**State: `WP-B FINAL CORRECTIVE AWAITING CODEX CHECKPOINT`**

This is the final limited correction of the already-authorized WP-B
implementation. It closes F1–F7 from the Codex checkpoint and recomputes
B01–B28 from case-bearing production drivers. It is **not** a WP-B PASS, it
does not enter WP-C, it does not refreeze anything, and no external document
review was performed.

---

## 1. FC1 — the real Extension transport

| finding | resolution |
|---|---|
| F1: the client validated the invented `v3-media-local-import-status/v1` | it now uses the frozen `v3-media-local-import/v1`, and the **test reads the value out of the shipped schema contract file** (`docs/active/project/contracts/v3_media_local_import_status_v1.schema.json`), so a typo on either side fails the test instead of making both sides green |
| F1: the PUT carried no `Authorization` | the client reads the **current** bearer at call time and sends `Authorization: Bearer …`, `X-Navia-Import-Token` and `Content-Type`; `Content-Length` is never set by hand |
| F1: the client parsed `{import}` | it now unwraps the **real** `{ok, data, error, requestId}` envelope, and a non-2xx body is an ERROR, never a record |
| F1: a missing bearer still opened an XHR | the bearer is read **before** the transport exists; an absent bearer rejects with `V3_MEDIA_IMPORT_AUTH_REQUIRED` and creates **no** XHR |

New production seam: `createLocalImportRuntimeClient.ts` is the single place
the Runtime URL, the bearer and the session generation are assembled, and the
acquisition page builds its client through it. A stale bearer is re-read, never
cached.

New evidence: `tests/test_wp_b_fc1_client_headers.py` (6 cases) drives the
**real** routed PUT with exactly the header set the shipped client sends and
proves a missing or stale bearer is refused with **no writer allocated**; and
`tests/MediaCredentialWorkspacePageComposition.test.tsx` renders the **real**
`MediaCredentialWorkspacePage` and proves the card is mounted only through
`localImportEntryEligible`, that the client is the **actual** production
client bound to the current Runtime URL / bearer / generation, and that picking
a file really performs the create + PUT + DELETE + poll sequence.

## 2. FC2 — the actual visual product chain

The imported-receipt branch of `MediaProductMaterializer.materialize_visual()`
is now independent of the downloader and of credential resolution. The receipt
is resolved **first**; when it is present the lease store is never asked for
credentials and the downloader is never even resolved. The counters in the B22
receipt prove it: `downloaderDispatch = 0`, `credentialDispatch = 0`.

Each receipt frame is now a **real artifact**: the frame file is revalidated
against the task, the source, the media digest, its own byte digest and its
monotonic timestamp, then imported into the task's visual sandbox through the
sandbox, producing a production `ArtifactRef` with a verified digest. The
dictionary that used to be passed where an `ArtifactRef` is required is gone.

The `visual_terminal` callback is invoked by the materializer **only** after
the visual product commit **and** the source-authority publication are durable,
and it is exactly-once per task: a second materialization cannot release the
shared input again. On failure the frozen fail-closed semantics are unchanged —
no terminal is reported and nothing is released before a durable product
terminal proves ownership.

B22 no longer calls a private resolver. It drives the **real** authenticated
`POST /v1/media/outline-tasks/{taskId}/materialize-visual` route and asserts
the same task produced Overview / Outline / Timeline / Mindmap, that at least
one **real receipt-bound thumbnail** is served as a PNG over the production
`/v1/media/tasks/{taskId}/evidence/{evidenceId}/thumbnail` route, that both
consumer terminal receipts are durable, that the cleanup ran **exactly once**,
and that the source and sandbox residuals are **zero**.

## 3. FC3 — restart cleanup and orchestration failure settlement

The `cleaning` restart path no longer treats an absent original video as proof
of release. The **real** `MediaAcquisitionCoordinator.complete(task_id)` runs
before the barrier advances to `cleaned`, so the WAV, the frames, the selected
input and the SourceAuthority are released by the only code that can release
them.

The hard-kill probe no longer fabricates phases with a private advance helper.
Every kill point is driven by the **production** transitions
(`mark_video_durable`, `mark_inputs_prepared`, `mark_input_bound`,
`mark_audio_staged`, `delete_original_video`, `mark_transcript_terminal`,
`mark_visual_terminal`), and a genuinely new process reads the prior SQLite
and sandbox state, proves the real cleanup call, the exactly-once owner, the
terminal status and the zero residuals. The ninth point kills the process
**inside** the real `coordinator.complete`, and the fresh process finishes the
open claim exactly once (`realCleanupCalls = 1`, task `succeeded`, residual 0).

Startup now runs **two** recoveries: the manager reconciles every import that
holds **no** barrier into a persisted terminal `RUNTIME_RESTARTED`, and the
orchestrator reconciles every import whose barrier is still open. No upload
token, writer, worker or handle is ever restored.

Every background orchestration future is owned: a done-callback maps an
ffprobe/ffmpeg/bind/stage/materializer exception onto the appropriate frozen
terminal code, persists it, closes the active resources and releases the
active slot, so the UI's polling always converges.

## 4. FC4 — the five omitted fixed cases

| case | production driver |
|---|---|
| **B08** | the four allowed MIME values enter the closed set; an unsupported MIME is `TYPE_UNSUPPORTED`; a WebM declared as MP4 is `MEDIA_INVALID`; a file with no video stream is refused; the wildcard `application/octet-stream` does **not** disable the ffprobe gate |
| **B09** | 0 B is `REQUEST_INVALID` with nothing created; exactly 2 GiB is allowed with no giant file allocated; 2 GiB + 1 is `SIZE_LIMIT` with nothing created and no token outstanding |
| **B17** | the rendered WAV really is pcm_s16le / 16 kHz / mono; the owner receipt is durable, FULL-synchronous and bound to **this** task; the owner manifest names the task and the staged digest; a mutated WAV is refused and nothing is committed |
| **B23** | the durable barrier normally and after a real hard kill, at every listed T1–T4 point and in **both** consumer orders; a missing receipt and a mismatched receipt both fail closed; the successful path has zero residuals |
| **B27** | identity switch, unmount and session-generation change each perform a **real** XHR abort, cancel through the real delete route and leave no File, no name, no token and no storage residue; the old import never attaches to the new page |

B27 uncovered a real defect: the card's identity-change path used the same
`abandon()` as an explicit cancel, so the **old** import's terminal was
reported to the **new** page. The card now only reports a terminal for an
explicit user cancel.

## 5. FC5 — no unauthorized local-file access

The hardcoded cross-project absolute path and every project-name mention are
gone from the tests and from the public evidence. Real-media tests read **only**
`NAVIA_WP_B_SEED_MEDIA`, supplied explicitly by the user. Nothing searches a
directory, scans another repository, a cache or a drive, and there is no
fallback: an absent or noncompliant seed is reported as an external-input
block.

The seed used for B21/B22 was supplied by the user and validated with the real
ffprobe before use: an mp4, 105.000 s, an h264 video stream and an aac audio
stream, 19 non-empty SenseVoice segments and 3 distinct frame hashes — every
frozen private-seed requirement met. It was copied read-only into a per-case
temporary root and was never padded, truncated, sparsified or substituted.

## 6. FC6 — the WP0 race oracle, test only

`test_wp0_r4_restart_and_security.py` keeps every immediate leak assertion at
the websocket `completed` frame. It now also asserts that the returned
transcript is a durable **queued/handoff** state and that its owner receipt
may still exist at that instant, then **bounded-waits through the production
transcript status** until terminal and asserts that the owner receipt is
removed and the residual raw audio is zero.

No production capture or transcript timing was changed, no synchronous ASR was
forced, the receipt is not deleted early, and the final zero-residual
assertion was not weakened. This is recorded as an **oracle correction**, not a
product fix.

## 7. FC7 — evidence

`docs/active/project/evidence/v3_media_companion/v3-completion/wp-b-explicit-local-media-import-final-corrective-implementation-2026-10-20/`

| file | content |
|---|---|
| `00-final-corrective-report.md` | this report |
| `01-real-b21-b22-receipts.json` | the redacted real B21 and B22 receipts |
| `02-real-hard-kill-probe.json` | 9 real hard kills with the fresh-process outcome |
| `03-relay-v11-inventory.json` | the relay v11 inventory, unmodified |
| `04-b01-b30-case-table.md` | the B01–B30 recomputation from case-bearing drivers |
| `05-commands-and-exits.md` | every command and its exit code |
| `06-prd-review.md` | the PRD review |
| `07-secret-path-raw-media-scan.json` | the secret / private-path / raw-media scan |
| `08-cleanup-report.md` | owned process, port, temp and media cleanup |
| `09-handoff.md` | the handoff note |
| `10-changed-file-hashes.json` | the SHA-256 of every changed file |
| `PAYLOAD_MANIFEST.sha256` | the verified payload manifest |

The directory is spelled `wp-b-explicit-local-media-import-final-corrective-implementation-2026-10-20`
throughout. The earlier misspelled `corective` directory is untouched and is
not part of this package.

---

## 8. Commands and exit codes

See `05-commands-and-exits.md`. Headlines:

| command | exit | result |
|---|---|---|
| Runtime local-import suite (15 files) | 0 | **175 passed** |
| Runtime media-focused suite | 0 | green |
| Extension local-import + media-companion subtree | 0 | green |
| `npx tsc --noEmit` | 0 | clean except the pre-existing `vitest.config.ts` overload error |
| relay v11 contract verifier | 2 | 46/50, frozen source-scope drift, no unlisted emits |
| corrected WP0 R4 test | 0 | passed |

A single `pytest tests/ -q` over all 1005 Runtime tests is killed by the host
with exit 137 (memory), so the suite was run as **deterministic sequential
shards** and every shard's result is reported in the commands file.

---

## 9. Real identifiers, digests and products

From `01-real-b21-b22-receipts.json`:

**B21** — the public import API, the real barrier and the **real local
SenseVoice** on the authorized real media.

| field | value |
|---|---|
| `importId` | `media_import_9215f1ebca0f3825788c81586ff287d3` |
| `taskId` | `media_task_779855152e7748af81162e20df9ac323` |
| `videoManifestSha256` | `5c007b86fa22ffe1fee7c4da33267535898624e89f642f1e99cf995cadf992c4` |
| `visualReceiptSha256` | `7a62dea371f19520eb5a79e96ad4b0fc6edce151799a176897dda72333022141` |
| `audioOwnerReceiptSha256` | `5b060e2d6b1ce43c3fecf1509332e32f905128432df94a2b41108a8cdd28af32` |
| bytes | 101,644,359 declared, 101,644,359 uploaded |
| prepared media | 105,000 ms, 1280x720, `mov,mp4,m4a,3gp,3g2,mj2` |
| transcript | **9 segments, 662 characters** of real speech |
| public schema version | `v3-media-local-import/v1` |

**B22** — the real `materialize-visual` route.

| field | value |
|---|---|
| `taskId` | `media_task_31491c9b7fe691436c53abcfa92bf490` |
| `importId` | `media_import_cfcf849100bbfe0332b268dc2ae4b7d7` |
| `outlineId` | `outline_fc8308aa74e02cd85ba651fc0e5b8d2d` |
| Outline | **2 sections**, a non-empty summary |
| Timeline | **2 segments** |
| Mindmap | **3 nodes** |
| evidence catalog | 27 entries, of which **8 receipt-bound thumbnails** |
| downloader / credential dispatch | **0 / 0** |
| cleanup calls | **1** (exactly once) |
| source residual / sandbox residual | **0 / 0** |
| consumer receipts | transcript **true**, visual **true**, barrier phase `cleaned` |

## 10. Hard-kill and restart outcomes

From `02-real-hard-kill-probe.json` — 9 real `os._exit(137)` kills, each
followed by a genuinely new process:

| kill point | durable phase before | recovery | cleanups | task | residual |
|---|---|---|---|---|---|
| after T1 | `video_durable` | `waiting:video_durable` | 0 | created | 0 |
| after T2 | `inputs_prepared` | `waiting:inputs_prepared` | 0 | created | 0 |
| after T3 | `input_bound` | `waiting:input_bound` | 0 | created | 0 |
| after the audio receipt, before the delete | `audio_staged` | `waiting:audio_staged` | 0 | created | 0 |
| after the delete, before T4 | `video_deleted` | `waiting:consumers:video_deleted` | 0 | created | 0 |
| after the transcript terminal | `video_deleted` | `waiting:consumers:video_deleted` | 0 | created | 0 |
| after the visual terminal | `video_deleted` | `waiting:consumers:video_deleted` | 0 | created | 0 |
| after both consumers | `cleaned` | `already_cleaned` | 0 | created | 0 |
| **inside the real cleanup** | `cleaning` | `released` | **1** | **succeeded** | **0** |

Six of the nine points preserve the shared input, because the durable receipts
do not yet prove ownership. The last one is finished by the fresh process,
exactly once.

## 11. Chrome and audio counts

**Chrome: 0.** No browser was launched; no visible window, no focus event, no
owned profile. Every gate was proven headless and offline.

**Audio: 0 playback.** The real ASR reads a WAV file inside a sandboxed task
root; no test opens an audio output device and `--mute-audio` was never
needed because nothing played.

## 12. Relay inventories

`03-relay-v11-inventory.json`:

| item | value |
|---|---|
| summary | 46/50, 4 failed |
| target inventory | **20/20**, no missing, no extra |
| source inventory | **35/40**, 5 missing, no extra |
| unlisted boundary emits | `{}` — **none** |

The five source codes the extractor does not see are
`V3_MEDIA_ACQUISITION_IN_PROGRESS`, `V3_MEDIA_AUTHORITY_RESTART_UNCERTAIN`,
`V3_MEDIA_CAPTURE_NOT_ELIGIBLE`, `V3_MEDIA_CAPTURE_ORIGIN_MISMATCH` and
`V3_MEDIA_SOURCE_TASK_ACTIVE`. Two of them are raised by the coordinator
itself. This is the frozen extractor's scope drift, not a new emit.

**No refreeze was performed** — not of `app.py`, not of the coordinator, not of
the source inventory, not of the verifier. Codex owns the single refreeze after
the candidate is stable.

## 13. Severities

| severity | count | note |
|---|---|---|
| Fatal | **0** | — |
| Major | **0** | F1–F7 all closed |
| Minor | **0** | — |

Defects found and fixed **inside** this batch (all closed, all with a
production-bearing test):

| severity | finding | resolution |
|---|---|---|
| Major | the Extension client validated an invented schema version and its tests repeated it | the frozen value, verified against the shipped contract file |
| Major | the content PUT carried no companion bearer | the bearer is read before the transport exists and sent on the absolute Runtime URL |
| Major | the client read `{import}` and would accept an HTTP error body as a record | the real `{ok, data, error}` envelope, unwrapped by the client |
| Fatal | B22 bypassed the real materializer and called a private callback | the real authenticated `materialize-visual` route drives it |
| Major | the local branch resolved credentials and the downloader | zero dispatch on the local route, proved by counters |
| Major | a receipt dictionary was passed where an `ArtifactRef` is required | the frames are imported into the sandbox as real artifacts with full revalidation |
| Major | `_visual_terminal` was wired but never invoked, and was invoked from the **wrong** product | the visual product owns it, after its own durable commit and publication, exactly once |
| Major | the `cleaning` restart path advanced to `cleaned` without the real cleanup | the real coordinator cleanup runs first |
| Major | the startup hook failed barrier-less imports nowhere | two recoveries, split by whether a barrier is open |
| Major | the orchestration future had no exception mapping | every failure becomes a frozen terminal code, persisted, with the slot released |
| Major | the hard-kill probe fabricated phases with a private helper | production transitions only, plus a kill inside the real cleanup |
| Major | B08, B09, B17, B23, B27 had no case-bearing driver | all five implemented and recomputed |
| Major | the real-speech test hardcoded a cross-project absolute path | `NAVIA_WP_B_SEED_MEDIA` only, with an exact external-input block |
| Major | the WP0 R4 oracle raced the asynchronous worker | a bounded wait through the production status, then the same final assertion |
| **Major (production)** | the preparer published **JPEG bytes under a `.png` name**, because the image2 muxer picks its default encoder from the `.part` temporary name | `-c:v png` is now explicit, and every frame consumer reads the PNG header |
| Major | the card's identity-change path reported the **old** import's terminal to the **new** page | only an explicit user cancel reports a terminal |

## 14. Stop reason

`WP-B FINAL CORRECTIVE AWAITING CODEX CHECKPOINT`

FC1–FC7 are closed, F1–F7 are closed, no Fatal and no Major remains, and
B01–B28 are recomputed from case-bearing production drivers: **28/28**.

**B29 and B30 were not run.** They are the two registry-asset cases: the
100 MB and 1 GB assets must come from the explicitly authorized registry
pipeline, and the standing gate forbids requesting or processing them before
FC1–FC7 and B01–B28 are green. They are reported as an **external-input
blocker**, not as passing.

WP-B is not announced as PASS, WP-C is not entered, nothing is self-refrozen,
and no external document review was performed. Codex owns the next decision.
