# ClaudeCode CLI Goal: WP-B final limited correction

Work in `/mnt/c/workspace/navia`. Continue the existing dirty worktree. This is the final limited
correction of the already-authorized WP-B implementation, not a new planning round.

## Read first

1. `AGENTS.md`
2. `docs/active/project/design/project-stage-workflow.md`, especially section 5.1
3. `docs/active/project/evidence/v3_media_companion/v3-completion/wp-b-explicit-local-media-import-preimplementation-2026-10-19/05-acceptance-plan.md`
4. `docs/active/project/evidence/v3_media_companion/v3-completion/wp-b-explicit-local-media-import-final-corrective-gate-2026-10-20/00-codex-checkpoint.md`
5. `docs/active/project/evidence/v3_media_companion/v3-completion/wp-b-explicit-local-media-import-corrective-continuation-2026-10-20/00-continuation-report.md`
6. the three frozen `docs/active/project/contracts/v3_media_local_import_*_v1.schema.json` files and the
   local-import fixture/asset registry

Gate: `WP-B FINAL CORRECTIVE MAY START`. WP-B and WP-C remain unpassed/locked. Preserve accepted C1-C5
work unless a production-bearing test proves a defect.

## Implement in this order

### FC1 - Repair the real Extension transport

- Use the frozen public status schema version `v3-media-local-import/v1` everywhere. Remove the invented
  `v3-media-local-import-status/v1` value; tests must consume a fixture/value independent from the
  implementation constant so the same typo cannot make both sides green.
- Before creating/opening/sending an upload XHR, read the current companion bearer. If absent, reject
  with `V3_MEDIA_IMPORT_AUTH_REQUIRED` and create no XHR.
- Set `Authorization: Bearer <current bearer>`, `X-Navia-Import-Token`, and `Content-Type` on the absolute
  Runtime PUT. Never set `Content-Length` manually and never persist/log the bearer or upload token.
- Parse the Runtime's real success/error envelope (`{ok,data:{import}}`), including non-2xx responses;
  do not treat an HTTP error body as a successful local-import record.
- Add a routed integration test proving the production client headers pass the real Runtime PUT auth
  and that a missing/stale bearer fails before writer allocation.
- Add a production-parent composition test proving `MediaCredentialWorkspacePage` mounts the card only
  through `localImportEntryEligible`, uses the current Runtime URL/bearer/generation, and executes the
  actual client rather than a direct test-only component.

### FC2 - Close the actual visual product chain

- Make the imported-receipt branch of `MediaProductMaterializer.materialize_visual()` independent of
  downloader and credential resolution. The local route must call downloader/credential/capture zero
  times; non-local routes retain their current governed behavior.
- Convert each imported frame receipt into the exact production artifact/binding type expected by
  `FrameExtractor`; do not pass a dictionary where an `ArtifactRef` is required. Revalidate task,
  source, media digest, relative reference and frame digest before reading it.
- Invoke the wired visual-terminal callback from the production materializer only after the terminal
  product commit and source-authority publication are durable. Make it idempotent; a duplicate
  materialization/callback cannot repeat cleanup.
- On materialization failure, preserve the frozen fail-closed terminal/cleanup semantics. Do not report
  visual terminal or release shared input before a durable product terminal proves ownership.
- Replace B22's manual `orchestrator.visual_terminal()` with the real authenticated
  `/v1/media/outline-tasks/{taskId}/materialize-visual` route, or the exact production trigger that owns
  that route. Do not call private resolver/callback methods as the success oracle.
- B22 must prove the same task produces Overview, Outline, Timeline and Mindmap, at least one real
  receipt-bound thumbnail is readable/jumpable, downloader/credential/capture dispatch is zero, both
  consumer terminal receipts are durable, cleanup occurs exactly once after the second terminal, and
  residual source/WAV/frame artifacts are zero.

### FC3 - Repair restart cleanup and orchestration failure settlement

- In the `cleaning` restart path, call the same real coordinator/task-sandbox cleanup used in normal
  completion before advancing to `cleaned`. An absent original video is not proof that WAV, frames,
  selected input or SourceAuthority were released.
- Replace hard-kill phase fabrication with production transitions. A genuinely new process must read
  the prior SQLite/sandbox state and prove the real cleanup call, exactly-once owner, terminal status
  and zero residuals.
- At Runtime startup, invoke both manager recovery for imports without a barrier and orchestrator
  reconciliation for imports with an open barrier. Never restore upload tokens, writers or workers.
- Own every background orchestration future. Map ffprobe/ffmpeg/bind/stage/materializer exceptions to
  the appropriate frozen terminal failure code, persist it, close active resources, and release the
  active slot. UI polling must always converge.

### FC4 - Drive the five omitted fixed cases

Implement production-bearing case tests exactly from the authoritative acceptance plan:

- B08: four allowed MIME values plus unsupported MIME; MIME never substitutes for ffprobe truth.
- B09: 0 B, exactly 2 GiB, and 2 GiB + 1 without allocating giant files.
- B17: pcm_s16le/16 kHz/mono WAV, task-bound durable hash/owner receipt, mutation rejected.
- B23: normal and fresh-process hard-kill coverage for all listed T1-T4 points and both consumer orders;
  fail closed on missing/mismatched receipt, success residual zero.
- B27: identity switch, unmount and session-generation change perform real XHR abort/cancel; old import
  never attaches to the new page and File/name/token/storage residue is zero.

Recompute B01-B28 from case-bearing production drivers. Do not inherit `23/28` or count source/fixture
presence as a pass.

### FC5 - Remove unauthorized local-file access

- Delete the hardcoded `/mnt/c/workspace/cyberWife/...` path and any project-name/path mention from
  tests and public evidence.
- Real-media tests may read only `NAVIA_WP_B_SEED_MEDIA`, supplied explicitly by the user/harness. Do
  not search Desktop, other repositories, caches or drives for media.
- Validate the explicit seed with ffprobe and the required speech/frame oracles before use. If absent or
  noncompliant, report the exact external-input block; do not synthesize/pad/truncate/sparsify it.
- Never copy an absolute private path, filename, transcript text or raw media into evidence.

### FC6 - Correct the WP0 race oracle, test only

- In `test_wp0_r4_restart_and_security.py`, keep all immediate leak assertions at the websocket
  `completed` frame.
- Assert the returned transcript is a durable queued/handoff state and that its owner receipt may still
  exist at that instant.
- Bounded-wait through the production transcript status until terminal, then assert the owner receipt
  is removed and residual raw audio is zero.
- Do not modify production capture/transcript timing, force synchronous ASR, delete the receipt early,
  or weaken the final cleanup assertion. Record this as an oracle correction, not a product fix.

### FC7 - Evidence repair and final self-verification

- Create a new immutable evidence directory:
  `docs/active/project/evidence/v3_media_companion/v3-completion/wp-b-explicit-local-media-import-final-corrective-implementation-2026-10-20/`
- Include receipt, changed-file hashes, commands/exits, B01-B30 table, product IDs/digests, real B22
  product assertions, hard-kill outcomes, relay inventory, PRD review, secret/path/raw-media scan,
  cleanup report, handoff, and a verified SHA-256 payload manifest. Do not claim a manifest unless the
  file exists and verifies.
- Use the correctly spelled `corrective` path consistently.

## Validation budget

During edits run only affected tests. Once FC1-FC7 and B01-B28 are closed, run one consolidated
checkpoint regression:

1. local-import schema/fixture/semantic mutation suites;
2. local-import Runtime tests including routed HTTP, actual visual materialization, barrier/restart and
   hard-kill probes;
3. Extension local-import tests plus the media-companion subtree;
4. Runtime media-focused suite, typecheck and build;
5. corrected WP0 R4 test and affected relay static tests;
6. relay v11 inventory report only, without modifying frozen evidence;
7. secret/private-path/raw-media scan and owned process/port/temp cleanup.

If a full suite exceeds memory, run deterministic sequential shards once and report each shard and the
resource reason. Do not repeatedly rerun broad suites after individual edits.

## Hard constraints

- Do not change the three schemas, 18-code closed set, thresholds, B01-B30 denominator, T1-T4 order,
  Origin/auth order, asset registry, WP-A hashes, or v10/v11 historical evidence.
- Do not refreeze `app.py`, `coordinator.py`, source inventory or relay verifier. Codex owns one later
  refreeze after candidate stability.
- Do not commit, push, reset, clean, checkout, revert, or overwrite unrelated dirty-worktree changes.
- Do not start visible Chrome. Tests must be silent and must not access an audio output device. If a
  later browser proof becomes indispensable, stop and notify the user first; any owned Chrome must use
  `--mute-audio`, one owned profile, and `finally` cleanup.
- Do not request/process B29/B30 until FC1-FC7 and B01-B28 are green. B29/B30 require an explicitly
  authorized registry-compliant seed with at least 30 seconds of real speech.
- Do not perform Claude document external review, announce WP-B/V3 PASS, or enter WP-C.

## Stop state and handoff

Stop as `WP-B FINAL CORRECTIVE AWAITING CODEX CHECKPOINT` only when FC1-FC7 and B01-B28 are genuinely
closed with no implementation Fatal/Major. List B29/B30 as an external-input blocker if no compliant
seed was explicitly supplied. Otherwise stop as `WP-B FINAL CORRECTIVE NO-GO` with one minimal failing
production test and exact frozen-contract reason.

The final reply must include state, changed files/hashes, contract changes or `none`, every command and
exit code, B01-B30 status, real task/import/product IDs and receipt digests, B22 production projections
and thumbnail count, hard-kill/restart outcomes, relay inventories, Chrome/audio counts, secret/path
scan, cleanup, severities, evidence directory, and exact stop reason.
