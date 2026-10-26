# WP-B consolidated corrective plan

This is one corrective batch. Do not create separate audit rounds for each item.

## C0 Preserve authority

- Treat the three local-import schemas, 18-code closed set, B01-B30 denominator, T1-T4 order,
  thresholds, exact Origin/bearer/token order, and asset registry as frozen.
- Keep relay v11 on its WP-A accepted hashes while editing. A red source hash is expected until the
  candidate is stable; it is not a reason to undo authorized implementation.
- Add failing production-composition tests before changing implementation.

## C1 Contract and durable store

- Make public status/API and internal store/barrier records validate against the frozen schemas.
- Use `v3-media-local-import/v1`, `media_import_<32 hex>`, required `recoverable` and `media` fields,
  `v3-media-local-import-store/v1`, and the complete durable barrier fields/phases.
- Persist transcript/visual terminal receipts and barrier progress with SQLite FULL/CAS semantics;
  terminal state must survive a fresh manager/process.

## C2 Authenticated streaming API

- Fix PUT to call synchronous manager methods synchronously or use its async `stream()` correctly;
  consume `request.stream()` with `async for`.
- On all exceptions, close handles, remove live sessions and perform manifest-aware cleanup without
  leaking raw paths or exceptions.
- OPTIONS must return exact `Access-Control-Allow-Origin` and the frozen methods/headers. Origin,
  bearer, token and header rejection must occur before writer creation.
- Add a real successful PUT test through the ASGI endpoint, including a transport chunk larger than
  1 MiB and proof that internal writer slices stay <=1 MiB.

## C3 Eligibility and authority binding

- POST create must query the production acquisition coordinator/source authority and prove the same
  task/source has three automatic-route failures, no selected input, no active capture/import and no
  terminal authority before allocating an import or quota.
- `bind_local_import` must store the local selected input in the same coordinator structure consumed
  by `audio_reference()` and the downstream transcript service. No second SourceAuthority is allowed.
- Tests must use the real coordinator signature and state transitions, not a permissive fake.

## C4 Production orchestration and T1-T4

- Compose one Runtime-owned orchestrator from upload EOF through ffprobe/ffmpeg preparation,
  canonical receipts, coordinator bind, transcript creation/start and product materialization.
- Enforce durable order: T1 video durable -> T2 inputs prepared -> T3 input bound -> audio owner
  receipt durable -> delete original -> T4 video deleted -> ASR worker start.
- Selected frames must use the existing governed visual evidence path. Raw media, WAV and unselected
  frames never leave local ownership.
- Do not return `ready` until the frozen public media payload is durable and both consumers are
  correctly attached.

## C5 Cleanup and restart recovery

- Make the barrier the sole shared-input cleanup owner. Persist audio receipt digest, visual receipt
  digest, transcript terminal and visual terminal; second terminal claimant performs cleanup once.
- Use real coordinator APIs. Do not call nonexistent release methods or pass incompatible arguments.
- Runtime startup must reconcile every active import. Recovery may delete only artifacts proven owned
  and must never delete source/WAV/frames before the corresponding durable handoff.
- Hard-kill probes must start a new process and assert status, receipts, retained/deleted artifacts,
  residual count and no resumed token/worker for each injection point.

## C6 Extension production path

- Use the existing authenticated Runtime transport/base URL for JSON and XHR. Send companion bearer
  and one-shot upload token; never send path/name/hash metadata.
- Track every live XHR and make unmount, identity/generation change and cancel call `xhr.abort()` then
  DELETE and await a terminal status.
- Poll GET by sequence until `ready|cancelled|failed`; show truthful upload/verifying/preparing states.
- Mount `LocalMediaImportCard` in the production eligible-blocked acquisition surface only. Prove it is
  absent for ineligible, active and terminal tasks.

## C7 Anti-false-green tests

- Replace fake signatures and direct SQL phase fabrication with production classes/routes wherever the
  case claims production behavior.
- B21 must prove an imported input reaches real SenseVoice transcript terminal through the production
  coordinator/barrier. B22 must prove product materialization uses receipt-bound selected frames and
  neither consumer cleans shared input early.
- API tests must assert exact CORS headers, real successful PUT, writer cleanup on exception and store
  visibility after a fresh Runtime instance.
- UI tests must render through the real production parent, assert actual Runtime URLs/auth, actual XHR
  abort, polling and terminal state.

## C8 Evidence and concentrated regression

- Inner loop: only affected tests.
- Stable candidate: one Runtime media-focused regression, one Extension media subtree regression,
  typecheck and build, schema/fixture mutations, B01-B28, hard-kill/restart and secret/cleanup scan.
- B29/B30 run only when `NAVIA_WP_B_SEED_MEDIA` names a private registry-compliant >=30 s real-speech,
  dynamic-frame asset. Do not scan user directories or persist its path. No padding, sparse files,
  truncation, metadata-only or mocks.
- Do not run visible Chrome unless all offline gates are green and the user is notified. Any owned
  Chrome must use `--mute-audio`, avoid focus stealing, run once, and be cleaned in `finally`.

## Exit

Required before the next Codex checkpoint:

- Fatal/Major/Minor from this checkpoint: 0/0/0.
- B01-B28 use production drivers and oracles and pass.
- B29/B30 either pass with a compliant private seed or remain one explicit external-input blocker;
  they must not conceal any implementation gap.
- Relay source/target inventories and unlisted emits are reported. ClaudeCode does not refreeze.
- No owned process, port, profile, sandbox, raw media or secret remains.

