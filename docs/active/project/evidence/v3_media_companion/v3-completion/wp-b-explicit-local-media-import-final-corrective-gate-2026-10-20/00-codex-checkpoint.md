# WP-B final corrective checkpoint

**Decision: `WP-B CORRECTIVE CONTINUATION NO-GO / FINAL CORRECTIVE MAY START`**

This is one consolidated Codex checkpoint over the C3-C7 continuation. It does not reopen C1/C2,
does not authorize WP-C, does not refreeze relay v11, and does not repeat an external document audit.

## Accepted progress

- C3 eligibility-before-allocation, the separate durable barrier table, T1-T4 orchestration foundation,
  startup reconciliation, routed local-import API, and real hard-kill harness are substantive product work.
- The reported local-import focused suites, real SenseVoice run, and seven hard-kill exits are useful
  implementation evidence.
- Local-import CORS middleware/OPTIONS includes the exact privileged Origin path, methods, headers and
  no-store behavior. This part of C6 is not being reopened.
- Relay target inventory remains 20/20 and `unlistedBoundaryEmits` remains empty. The current 46/50 is
  source-scope hash drift, but refreeze is deferred until the WP-B product candidate is stable.

## Blocking findings

### F1 - Extension rejects the real Runtime schema and omits PUT bearer (Major)

`LocalMediaImportClient.ts` validates `v3-media-local-import-status/v1`, while the frozen public schema
and Runtime emit `v3-media-local-import/v1`. Its tests repeat the wrong value, so the 20/20 result is a
false green.

The XHR PUT sends `X-Navia-Import-Token` and `Content-Type`, but not the companion
`Authorization: Bearer ...` required by `_local_import_authorize()`. The real Extension upload therefore
cannot pass the production endpoint. It also parses the response as `{import}` while the Runtime returns
the standard `{ok,data:{import}}` envelope. C6 is not closed.

### F2 - B22 bypasses the real visual materializer (Fatal)

`test_wp_b_c7_production.py` reads the imported receipt and then calls
`orchestrator.visual_terminal(task_id)` manually. It never invokes the production visual-materialize
route or `MediaProductMaterializer.materialize_visual()`, and it does not assert the required
Overview/Outline/Timeline/Mindmap projection or a real thumbnail.

The bypass hides two production defects:

1. `MediaProductMaterializer._visual_terminal` is wired but never invoked.
2. `_materialize_visual()` requires downloader/credential dependencies and resolves credentials before
   considering the imported receipt, although the frozen local route must use neither downloader nor
   credential.
3. The imported receipt is a dictionary but is passed as the `ArtifactRef` inside `VisionMediaBinding`;
   the real `FrameExtractor` dereferences artifact identity fields and will fail.

C4/B22 is therefore not closed. The final correction must make the actual materializer own its durable
terminal callback after product commit, while preserving fail-closed cleanup and idempotence.

### F3 - Restart and orchestration failures can publish false completion or hang (Major)

The `cleaning` restart path advances to `cleaned` when the original video is already absent without
calling the real coordinator cleanup. It can therefore leave WAV/frame/task-sandbox or SourceAuthority
residue while claiming success. The current hard-kill probe fabricates phases with a private advance
helper and does not prove that production cleanup.

Production startup reconciles open barriers but does not call the manager's existing restart recovery
for `awaiting_upload/uploading/verifying` imports that have no barrier yet. In addition, the background
orchestration future has no exception callback/terminal failure mapping, so ffprobe/ffmpeg/bind/stage
errors can leave public state polling forever.

### F4 - Five fixed-denominator cases were incorrectly reported as undefined (Major)

B08, B09, B17, B23 and B27 are defined in the authoritative
`wp-b-explicit-local-media-import-preimplementation-2026-10-19/05-acceptance-plan.md`. They must be
production-driven and recomputed; `23/28` cannot satisfy the B01-B28 checkpoint.

### F5 - The real-speech test uses an unapproved cross-project absolute path (Major)

`test_wp_b_c7_production.py` hardcodes `/mnt/c/workspace/cyberWife/...`. This violates the repository's
no-default-local-file-access boundary and leaks a private project/path into the report. Replace it with
the explicit `NAVIA_WP_B_SEED_MEDIA` input. Never scan for media or silently select another project's
asset. Absence of the environment variable is an external-input block, not permission to substitute.

### F6 - Evidence package is incomplete (Major)

The reported continuation directory contains eight files and no payload manifest, despite the handoff
claiming a verified manifest. The final immutable evidence directory must include a real SHA-256
manifest and must not repeat the misspelled `corective` path.

### F7 - WP0 receipt assertion is a stale oracle, not a product cleanup failure

The websocket `completed` frame returns a transcript in `queued` state immediately after durable
handoff; the daemon worker later reaches terminal and releases the owner receipt. The frozen relay
model already treats this frame as handoff, not product terminal. Therefore the synchronous
`rows == []` assertion in `test_wp0_r4_restart_and_security.py` races the worker.

Authorize a test-only correction: at the completed frame assert no secret/path/raw PCM leak and a
durable queued handoff; then bounded-wait for transcript terminal and assert the receipt is removed.
Do not change production behavior to delete the receipt early and do not weaken the final zero-residual
oracle.

## Frozen boundaries

- No schema, 18-code set, threshold, B01-B30 denominator, T1-T4 order, Origin/auth order, asset
  registry, WP-A digest, or v10/v11 historical evidence change.
- No relay refreeze in this corrective implementation. Codex performs one refreeze only after the
  product candidate and B01-B28 are stable.
- No visible Chrome is required for this correction. Tests remain silent and must not access an audio
  output device.
- B29/B30 remain external-input blocked until an explicitly authorized registry-compliant media seed
  with at least 30 seconds of real speech is supplied. They may not be padded, sparsified, truncated,
  synthesized from silence, or replaced by a mock.

## Exit condition

ClaudeCode may stop at `WP-B FINAL CORRECTIVE AWAITING CODEX CHECKPOINT` only after F1-F7 and
B01-B28 are closed with production-bearing evidence. It must not claim WP-B PASS, enter WP-C,
self-refreeze, or perform external document review.
