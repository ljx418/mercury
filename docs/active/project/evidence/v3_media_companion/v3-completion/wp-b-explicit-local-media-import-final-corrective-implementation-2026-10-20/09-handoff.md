# WP-B final corrective — handoff

**State: `WP-B FINAL CORRECTIVE AWAITING CODEX CHECKPOINT`**

## What this package is

The final limited correction of the already-authorized WP-B implementation. It
closes the seven blocking findings of the Codex checkpoint (F1–F7) in the
mandated order FC1 → FC7, and recomputes B01–B28 from case-bearing production
drivers.

It is **not** a WP-B PASS, it does not enter WP-C, it does not refreeze
anything, and no external document review was performed.

## Where the work lives

| area | files |
|---|---|
| Runtime local import | `services/local-runtime/navia_runtime/modules/media_companion/local_import/{store,consumer_barrier,orchestrator,runtime,contracts,preparer}.py` |
| Runtime acquisition | `services/local-runtime/navia_runtime/modules/media_companion/acquisition/{coordinator,transcript_service}.py` |
| Runtime product | `services/local-runtime/navia_runtime/modules/media_companion/product_materializer.py` |
| Runtime wiring | `services/local-runtime/navia_runtime/app.py` |
| Runtime probe | `services/local-runtime/scripts/v3_media_local_import_wp_b_probe.py` |
| Extension | `apps/chrome-extension/src/modules/media_companion/{LocalMediaImportClient.ts,localImportEntry.ts,createLocalImportRuntimeClient.ts,settings/LocalMediaImportCard.tsx,MediaCredentialWorkspacePage.tsx}`, `apps/chrome-extension/src/runtimeClient.ts` |

The exact SHA-256 of every changed file is in `10-changed-file-hashes.json`.

## Contract changes

**None.** No schema, no 18-code set, no threshold, no B01–B30 denominator, no
T1–T4 order, no Origin/auth order, no asset registry, no WP-A digest and no
v10/v11 historical evidence changed.

What was added is **internal**: a second durable table
(`media_local_import_barriers_v1`) beside the frozen 15-column storeRecord, a
`prepared_media` column in that same internal table, an explicit
`defer_to_barrier(task_id)` registration on the transcript service, a
`createLocalImportRuntimeClient()` factory in the Extension, and a
`localImportEntryEligible()` predicate in the Extension.

## What the next owner should know

1. **The governed vision Provider is a real external input.** The B22 proof
   used the user's own configured and verified `minimax-cn-openai-vision`
   provider, with the key resolved from the Windows Credential Vault. The
   frames of the imported media were sent to that provider. If a future
   environment has no verified vision Provider, `materialize_visual()` fails
   closed with `VISION_PROVIDER_UNAVAILABLE` — that is the frozen behaviour
   and it was deliberately not weakened.

2. **The real media seed is external input too.** B21/B22 need
   `NAVIA_WP_B_SEED_MEDIA` to point at a compliant container (mp4/webm/mkv,
   both streams, 30–300 s, real speech). The test skips with an exact
   `EXTERNAL-INPUT BLOCK` message when it is absent. Nothing searches for a
   substitute.

3. **The preparer now names the PNG encoder explicitly.** The image2 muxer
   used to pick its default (mjpeg) from the `.part` temporary name, so the
   published "PNG" frames were JPEG bytes. `-c:v png` is now explicit. A
   consumer that reads the PNG header would have caught it; the materializer
   does.

4. **`_visual_terminal` belongs to the VISUAL product, not the transcript
   product.** It is invoked after the visual commit **and** the source-authority
   publication are durable, exactly once per task.

5. **The barrier owns the release.** The `cleaning` restart path now runs the
   real `MediaAcquisitionCoordinator.complete(task_id)`; an absent original
   video is not proof that the WAV, the frames, the selected input and the
   SourceAuthority were released.

6. **The startup hook runs two recoveries.** Imports with **no** barrier become
   a persisted `RUNTIME_RESTARTED`; imports with an **open** barrier are
   reconciled by the orchestrator. No token, writer or worker is restored.

7. **The relay v11 inventory is still 46/50 with `unlistedBoundaryEmits = {}`.**
   The drift is in the frozen extractor's scope. **No refreeze was performed**:
   not of `app.py`, not of the coordinator, not of the source inventory, not of
   the verifier. Codex owns the single refreeze after the candidate is stable.

8. **B29 and B30 were not run.** They are the two registry-asset cases and
   remain an external-input blocker by the standing gate. They are reported as
   NOT RUN, never as passing.

9. **The WP0 R4 oracle was corrected, test only.** The production capture and
   transcript timing are unchanged. The oracle now bounded-waits through the
   production transcript status and then makes the same final zero-residual
   assertion.

## Boundaries that were not crossed

- No visible Chrome; no browser was launched at all.
- No audio was played; no test opened an audio output device.
- Nothing was committed, pushed, reset, cleaned, checked out or reverted.
- No unrelated dirty-worktree change was overwritten.
- The misspelled `corective` evidence directory and the frozen v10/v11 evidence
  were not modified.
