# ClaudeCode CLI Goal: continue the same WP-B corrective batch through C3-C7

Continue in `/mnt/c/workspace/navia`. Do not restart planning, repeat the prior code audit, or create a
new external document review. This is the unfinished remainder of the already-authorized WP-B
corrective implementation.

## Read first

1. `AGENTS.md`
2. `docs/active/project/design/project-stage-workflow.md` section 5.1
3. `docs/active/project/evidence/v3_media_companion/v3-completion/wp-b-explicit-local-media-import-corrective-gate-2026-10-20/00-codex-checkpoint.md`
4. `docs/active/project/evidence/v3_media_companion/v3-completion/wp-b-explicit-local-media-import-corrective-gate-2026-10-20/01-corrective-plan.md`
5. `docs/active/project/evidence/v3_media_companion/v3-completion/wp-b-explicit-local-media-import-corrective-implementation-2026-10-20/10-receipt.md`
6. `00-codex-continuation-decision.md` in this directory
7. the three frozen `docs/active/project/contracts/v3_media_local_import_*_v1.schema.json` files and
   local-import fixtures/asset registry

Gate: `SAME CORRECTIVE BATCH MAY CONTINUE`. WP-A remains PASS; WP-B and WP-C remain unpassed/locked.

## Preserve completed work, repair its remaining oracle

- Retain C1 and the C2 sync/async implementation fix unless a production test proves a regression.
- Do not rerun broad suites now. First add a routed HTTP test using the actual ASGI app/transport so
  router, privileged Origin middleware, bearer, one-shot token and endpoint execute together.
- Replace the vacuous digest assertion with an exact expected SHA-256 assertion against the durable
  owner manifest/receipt and prove the same digest is consumed at T1/T3.

## Implement continuously in this order

### C3 eligibility before allocation

- Introduce a production eligibility query owned by the acquisition coordinator/source authority.
- Before creating an import record, token, quota reservation, sandbox or writer, prove exact taskId +
  sourceIdentity, all three automatic routes failed, no selected input, no active capture/import and no
  terminal authority.
- Add real coordinator tests for each rejection and one eligible success. Do not use a fake with a
  different signature.

### C5 durable barrier foundation

- Persist the frozen `consumerBarrier` shape in a separate durable table/record; do not add fields to
  the frozen 15-column storeRecord.
- Persist audio owner receipt digest, visual receipt digest, transcriptTerminal, visualTerminal,
  phase/sequence and updatedAt using FULL/CAS transactions.
- Make barrier operations call only real coordinator APIs with their real signatures. Remove calls to
  nonexistent release methods.
- Make the second durable consumer terminal claimant own exactly-once cleanup. A fresh process must
  observe prior terminal receipts and must not repeat cleanup.

### C4 production orchestration

- Compose one Runtime-owned local-import orchestrator during production app startup.
- After durable EOF, execute verified ffprobe/ffmpeg preparation and canonical owner/visual receipts.
- Enforce T1 video durable -> T2 inputs prepared -> T3 coordinator input bound -> audio owner receipt
  durable -> original video deletion -> T4 video deleted -> transcript worker start.
- `bind_local_import` must place the selected local audio/input in the same production coordinator
  structure read by `audio_reference()` and transcript service.
- Attach the real transcript terminal callback and real receipt-bound visual materializer callback to
  the durable barrier. Do not let either consumer delete shared input.
- Public `ready` requires frozen `media` projection plus correct durable handoff; failures are terminal
  and use only the frozen 18 codes.

### C5 startup recovery

- Invoke local-import reconciliation from production Runtime startup.
- Reconcile every nonterminal import using durable manifests/receipts. Never restore token or old
  worker; never delete source/WAV/frames before their required durable handoff.
- At each frozen hard-kill point, start a fresh Runtime process and assert public status, barrier phase,
  receipt digests, retained/deleted artifacts, residual count and exactly-once cleanup.

### C6 Extension production reachability

- OPTIONS must include exact `Access-Control-Allow-Origin` plus frozen methods/headers and no-store.
- Use the existing authenticated Runtime base URL/session transport. XHR must target Runtime HTTP,
  carry companion bearer and one-shot import token, and never expose file path/name/hash.
- Track live XHR objects. Unmount, source/generation change and cancel must call `xhr.abort()`, then
  DELETE and poll by sequence to `ready|failed|cancelled`.
- Mount `LocalMediaImportCard` in the real eligible-blocked acquisition surface. It must be absent for
  ineligible, active and terminal tasks. Do not place it only in tests or diagnostics.

### C7 production proof

- Replace permissive fakes and direct SQL phase fabrication wherever a case claims production
  behavior.
- B21: through public import API and real coordinator/barrier, prove imported audio reaches real
  SenseVoice transcript terminal.
- B22: prove receipt-bound selected frames reach the real product materializer and both consumers
  finish before shared-input cleanup.
- Prove routed HTTP PUT success/failure, exact CORS/auth order, durable digest, restart GET visibility,
  XHR abort, polling, production parent rendering and all hard-kill recovery outcomes.
- Recompute B01-B28 from production drivers/oracles; do not inherit the rejected 25/30 count.

## Constraints

- Do not modify schemas, the 18-code closed set, thresholds, B01-B30 denominator, T1-T4, Origin/auth
  order, asset registry, WP-A hashes or relay v11/v10 frozen evidence.
- Do not stop merely because relay v11 is 46/50 from authorized source hash drift. Report source/target
  inventories and unlisted emits; Codex owns the eventual single refreeze.
- Do not request or process B29/B30 seed media until C3-C7 and B01-B28 are closed.
- Tests must be silent. Default to no-window/no-focus. Do not start visible Chrome without notifying the
  user after all offline gates pass; if needed use one owned profile/PID with explicit `--mute-audio`
  and `finally` cleanup.
- Do not commit, push, reset, clean, checkout, revert, or overwrite unrelated dirty-worktree changes.

## Test budget

During implementation run affected tests only. After all C3-C7 findings are closed, run one consolidated
checkpoint regression: local-import schema/fixture mutations, Runtime media-focused suite, Extension
media subtree, typecheck, build, production hard-kill/restart probe, B01-B28, relay v11 inventory report,
secret/path/raw-media scan and cleanup. Do not run that broad set after each edit.

## Evidence and final state

Continue evidence in a new immutable directory:

`docs/active/project/evidence/v3_media_companion/v3-completion/wp-b-explicit-local-media-import-corrective-continuation-2026-10-20/`

Include changed files/SHA, commands/exits, production IDs, T1-T4 and consumer receipts, restart outcomes,
B01-B28 results, relay inventory/hash status, PRD review, secret scan, cleanup and manifest.

Finish as:

- `WP-B CORRECTIVE CONTINUATION AWAITING CODEX CHECKPOINT` only when C3-C7 are closed, no Fatal/Major
  remains, and B01-B28 are production-proven; B29/B30 may then be listed as the sole external-input
  blocker if no compliant seed exists; or
- `WP-B CORRECTIVE CONTINUATION NO-GO` only for a newly discovered blocker, with a minimal failing
  production test and explanation why the frozen contract cannot resolve it.

Do not announce WP-B/V3 PASS, enter WP-C, perform Claude document external review, or self-refreeze.
The final reply must include state, changed files, contract changes, commands/exits, B01-B30 status,
real IDs/receipts, relay inventory, Chrome/audio counts, secret/cleanup results, severities, evidence
directory and exact stop reason.

