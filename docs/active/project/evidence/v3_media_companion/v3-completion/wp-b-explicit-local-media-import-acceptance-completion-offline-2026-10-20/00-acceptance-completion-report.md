# WP-B acceptance completion — offline phase

**State: `WP-B ACCEPTANCE COMPLETION READY FOR ONE VISIBLE RUN`**

This is the acceptance-completion phase over the existing WP-B implementation. It
closes **AC1** (the crash-durable visual terminal), **AC2** (the fixed-denominator
oracles), **AC3** (the one owned-Chrome session for B27/B29/B30, prepared and
proven OFFLINE) and **AC4** (the honest recomputation and the re-signed
evidence).

It is **not** a WP-B PASS, it does not enter WP-C, it does not refreeze
anything, and no external document review was performed.

---

## 1. AC1 — the visual terminal is crash-durable

The defect Codex reported: the materializer committed and published the visual
product and THEN submitted the barrier's visual-terminal receipt, so a kill in
that window left `visualTerminal = false` forever — the materializer returned
the already-terminal product on the next call, and the startup reconciliation
only waited for the receipts.

**The fix, in the production code:**

* `MediaProductMaterializer.materialize_visual()` now **reconciles** the
  terminal receipt when it finds an existing terminal imported product, instead
  of returning early.
* `MediaProductMaterializer.reconcile_visual_terminal(task_id)` is the durable
  repair: it asks the durable product store whether the product is terminal and
  then submits the missing receipt.
* **There is no in-memory claim any more.** `_visual_terminal_claimed` was
  deleted; the submission is never marked as done before the hook succeeded,
  and a failed hook is retried rather than suppressed.
* `LocalImportOrchestrator.reconcile()` calls the repair for every open barrier
  whose visual receipt is missing and whose shared input has already been
  released, so the **startup** closes the window without a user retry.

**The proof** — `tests/test_wp_b_ac1_visual_terminal_durability.py` (5 cases)
forks a real child process that dies with `os._exit(137)` at the seam, after
the product commit and before the barrier receipt is durable. A fresh set of
production objects then:

* observes the existing terminal product;
* submits the missing receipt — through the startup reconciliation **and**
  through a fresh `materialize_visual()` call;
* completes the cleanup **exactly once**;
* reaches zero residual.

`03-ac1-hard-kill-and-restart-receipt.md` records the nine real kill points of
the hard-kill probe, all `rc 137`, including a kill **inside** the production
`coordinator.complete`, which the fresh process finishes exactly once.

## 2. AC2 — the fixed-denominator oracles

Every case Codex named now has a production-bearing driver. The full map with
the exact oracle each test proves is in `04-b01-b30-case-oracle-map.md`.

| case | what was added or corrected |
|---|---|
| **B01** | a new suite meta-validates all three frozen schemas, proves the Runtime's own constants EQUAL the schemas, validates the public and internal fixtures, validates the asset registry, and runs the semantic mutations. **This is the oracle that found seven real contract divergences — see §5.** |
| **B10** | a missing `Content-Length` and a chunked transfer are now driven through the **routed endpoint** and refused before the writer, with the one-shot token surviving the refusal. |
| **B11** | routed ASGI uploads at 64 KiB, 1 MiB + 1 and 8 MiB transport chunks: the writer slices stay <= 1 MiB and the cumulative bytes and digest match. |
| **B12** | the public-path interruption at 0 %, 50 % and before the EOF: the writer closes, the state settles, the staging is zero and a retry is possible. |
| **B13** | a REAL MP4, WebM **and** Matroska each pass preparation; a faked MIME and a file with no video stream fail. |
| **B14** | a **deterministic ffprobe runner** proves exactly 14,400,000 ms is allowed and +1 ms is refused, plus the exact dimension boundary and one column past it. No four-hour file is ever allocated. |
| **B15** | a missing verified tool, a digest drift, a timeout, a non-zero exit and a hostile output are all refused, and no private diagnostic leaks into the error. |
| **B16** | the disk **and the task quota** boundaries, exact and one over, with a small explicit quota and no large allocation. |
| **B19** | a mutated task, source, **dependency generation** and artifact/digest are all refused atomically. The generation is now checked against the task's leased snapshot. |
| **B24** | cancelling a REAL owner in `awaiting_upload`, `uploading`, `verifying` and `preparing` — reached through the real transitions — leaves no writer, worker, process or sandbox residue, and the task may be selected again. |
| **B25** | the cancel races against ready, bind and a consumer terminal: only the two frozen outcomes, no terminal reversal, one cleanup owner. |
| **B26** | the private `_advance()` helper is **gone** from every case that claims production recovery. Real transitions, a fresh store and the public GET now cover the four import states and the five barrier phases. |
| **B03** | mapped into the case table with the exact oracle: one active import per task, decided by the REAL coordinator eligibility. |

## 3. AC3 — the one owned-Chrome session

`05-owned-chrome-harness-readiness.md` has the detail. In summary: the session
exists, is deterministic and is owned (its own profile, PID, port and temporary
root; `--mute-audio` always; the user's Chrome and profile never referenced; the
media only from `NAVIA_WP_B_SEED_MEDIA`; the seed validated with the real
ffprobe, the real local SenseVoice and the real frame digests; the assets
generated with the frozen generator settings and refused when sparse; every owned
path removed in a `finally`).

In this offline phase it was **prepared and proven, never launched**:
`{"phase":"offline","launched":false,"generatedAssets":0,"ownedRootRemoved":true}`,
and 7 offline tests prove every rule.

## 4. AC4 — the honest recomputation

`04-b01-b30-case-oracle-map.md` lists, for every case, the exact oracle and the
named test that proves it. A case counts only when a concrete, named test
drives the production object that owns the behaviour.

* **B01–B26 and B28: 27/27 PROVEN.**
* **B27: READY_FOR_VISIBLE_RUN** — the offline harness is proven; the real
  browser run is pending.
* **B29 and B30: PENDING_VISIBLE_RUN** — they need the registry assets and the
  one approved session.

**B27, B29 and B30 are not reported as passing.**

The evidence is re-signed from the FINAL stable worktree by
`scripts/build_wp_b_acceptance_completion_evidence.py`, which hashes the
worktree, writes the hash record and the payload manifest, and then **re-hashes
every listed file and fails if anything moved** — the exact failure that
invalidated the previous candidate.

## 5. What the B01 oracle found

The meta-validation is not a formality: it found **seven real divergences**
between the implementation and the frozen contract, all of which are now fixed.

| # | the divergence | the fix |
|---|---|---|
| 1 | the durable barrier record used the invented `v3-media-local-import-barrier/v1` | it is now the frozen `v3-media-import-consumer-barrier/v1` |
| 2 | the exported barrier record carried two fields the frozen shape forbids | the record is now EXACTLY the frozen nine fields; the internal CAS sequence and the prepared-media facts moved to their own accessors |
| 3 | the barrier phase vocabulary had a `none` member and no terminal phases | it is now the frozen ten: `video_durable … transcript_terminal, visual_terminal, cleaning, cleaned, failed`, with the two consumer terminals as PHASES as well as flags |
| 4 | the visual receipt used the invented `v3-media-local-import-visual-receipt/v1` | it is now the frozen `v3-media-import-visual-receipt/v1` |
| 5 | the receipt's frame artifact ids were `frame-1`, not the frozen `artifact_<32 hex>` | the preparer now publishes the frozen ids, and the id IS the file name |
| 6 | the public `media.container` was the raw ffprobe string | it is now the frozen enum `mp4` / `webm` / `matroska` |
| 7 | the semantic validator accepted a malformed source identity | it now refuses it, exactly as the frozen schema does |

Two more real defects surfaced while the oracles were being written:

* the **preparer published JPEG bytes under a `.png` name** — the image2 muxer
  picks its default encoder from the `.part` temporary name. `-c:v png` is now
  explicit, and every frame consumer reads the PNG header.
* a **tampered receipt** was reported as an ABSENT receipt, which would have
  silently moved the local route onto the downloader path. A digest mismatch is
  now raised.

And one behavioural change the B10 oracle forced: the one-shot token is now
**verified** before the other gates and **consumed** only when the write really
starts, so a request refused before the writer leaves the token usable while a
wrong token is still refused first.

## 6. The real product receipts

From `08b-real-b21-b22-receipts.json` — the real local SenseVoice over the
authorized real media, and the real `materialize-visual` route.

| field | B21 | B22 |
|---|---|---|
| `importId` | `media_import_eb4f96a65bbe79e222362ccc9efbb088` | `media_import_8f024e385c28a324e234b4ac1bd1a28c` |
| `taskId` | `media_task_13aac627ceb9d038e3498adc798c1285` | `media_task_87842e3d7437fa0a9605a47af822ce9e` |
| `videoManifestSha256` | `5c007b86…f992c4` | `5c007b86…f992c4` |
| `visualReceiptSha256` | `e36a9fac…2915a5d2` | `f2ce022a…ca3ab4` |
| `audioOwnerReceiptSha256` | `79486a99…44c2e6` | `46bb3eab…c4d776` |
| prepared media | 105,000 ms, 1280x720, container **`mp4`** (the frozen enum) | the same |
| bytes | 101,644,359 declared and uploaded | the same |
| transcript | **9 segments, 662 characters** of real speech | the same |
| Outline / Timeline / Mindmap | — | **2 sections / 2 segments / 3 nodes** |
| evidence / thumbnails | — | **27 entries, 8 receipt-bound thumbnails** |
| downloader / credential dispatch | — | **0 / 0** |
| cleanup calls | — | **1** |
| source / sandbox residual | — | **0 / 0** |
| consumer receipts | transcript true, visual false | transcript true, visual true, phase `cleaned` |
| `outlineId` | — | `outline_73bece07ac2855a59f975091063ca03c` |

## 7. The consolidated offline regression

See `02-commands-and-exits.md`. Headlines: 267 Runtime local-import and AC
cases, 9/9 real hard kills, 51 relay and WP0 cases, 483 Runtime media-focused
cases, 512 Extension media-companion cases, a clean typecheck, a clean build, 7
owned-session cases and the relay inventory report. **No Chrome was launched and
no audio was played.**

## 8. The relay inventories

`06-relay-v11-inventory.json`: 46/50, target **20/20**, source **35/40**,
`unlistedBoundaryEmits = {}`. The drift is the frozen extractor's scope, exactly
as before. **No refreeze** of `app.py`, the coordinator, the source inventory or
the verifier — Codex owns the single refreeze after the candidate is stable.

## 9. The stop reason

`WP-B ACCEPTANCE COMPLETION READY FOR ONE VISIBLE RUN`

AC1, the offline AC2 items, the harness offline tests and the consolidated
regression are green, with no implementation Fatal or Major. B27, B29 and B30 are
explicitly pending the one approved visible session.

`09-handoff.md` states the exact command, the expected duration and storage, the
seed requirement and the cleanup plan, so Codex can request the user's single
visible-run approval.
