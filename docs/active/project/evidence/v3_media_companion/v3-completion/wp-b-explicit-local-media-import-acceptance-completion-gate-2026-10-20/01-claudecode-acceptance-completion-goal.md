# ClaudeCode CLI Goal: WP-B acceptance completion, offline phase

Work in `/mnt/c/workspace/navia` and preserve the dirty worktree. This is a limited acceptance-completion
phase over the existing WP-B implementation. Do not restart planning or repeat document external review.

## Read first

1. `AGENTS.md`
2. `docs/active/project/design/project-stage-workflow.md`, section 5.1
3. `docs/active/project/evidence/v3_media_companion/v3-completion/wp-b-explicit-local-media-import-preimplementation-2026-10-19/05-acceptance-plan.md`
4. `docs/active/project/evidence/v3_media_companion/v3-completion/wp-b-explicit-local-media-import-acceptance-completion-gate-2026-10-20/00-codex-checkpoint.md`
5. the final-corrective implementation evidence directory and its handoff

Gate: `WP-B ACCEPTANCE COMPLETION OFFLINE MAY START`. WP-B/WP-C remain unpassed. Relay refreeze remains
Codex-only and is not authorized in this phase.

## AC1 - Make the visual terminal crash-durable

- Add a production test that kills/restarts after the visual product terminal commit but before the
  barrier's visual-terminal receipt is durable. The fresh process must observe the existing terminal
  product, idempotently submit the missing receipt, complete cleanup exactly once and reach zero residue.
- A materializer call that finds an existing terminal imported product must reconcile its terminal
  receipt instead of returning early. Startup reconciliation must also close this window without a user
  retry.
- Do not rely on `_visual_terminal_claimed` process memory. Never mark an in-memory claim before a hook
  succeeds. Duplicate callbacks are acceptable only because the durable barrier is idempotent.
- Do not change public states, schemas, failure codes, T1-T4 or product contracts.

## AC2 - Replace label coverage with fixed-oracle coverage

Add the missing production-bearing tests from the authoritative B01-B28 table:

- B01: meta-validate all three schemas; validate public/internal fixtures and the asset registry; run
  semantic mutations.
- B10: missing Content-Length and chunked transfer through the routed endpoint, refused before writer.
- B11: routed ASGI uploads with 64 KiB, 1 MiB+1 and 8 MiB transport chunks; writer slices remain <=1 MiB
  and cumulative bytes/digest match.
- B12: public-path interruption at 0%, 50% and EOF-before-complete; writer closed, terminal state,
  staging zero, retry possible.
- B13: real MP4, WebM and MKV each pass preparation; fake MIME and no-video fail.
- B14: use a deterministic ffprobe runner to prove exactly 14,400,000 ms allowed and +1 ms rejected,
  plus exact/over dimensions. Do not allocate a four-hour media file.
- B15: missing verified tool, digest drift, timeout, non-zero exit and hostile output; process/sandbox
  cleanup and no private diagnostics.
- B16: disk and task-quota exact/one-over boundaries without large allocation.
- B19: task, source, dependency generation and artifact/digest mutation all fail atomically.
- B24: cancel real owners in awaiting/uploading/verifying/preparing; prove XHR/writer/worker/process and
  both sandboxes zero, terminal cancelled, retry possible.
- B25: drive cancel races against ready, bind and consumer terminal; accept only the frozen two outcomes,
  with no terminal reversal and one cleanup owner.
- B26: remove direct `_advance()` from every case claiming production recovery. Use real transitions,
  a fresh process/store and public GET for four import states and five barrier phases.

B03 must map the existing real coordinator eligibility suite into the case table. Do not count a test
because its name contains a case ID; list the exact oracle each test proves.

## AC3 - Prepare B27/B29/B30 without launching Chrome

- Build or repair one deterministic owned-Chrome harness that will later run B27, B29 and B30 in a
  single session. It must load the production extension, use the Side Panel/File input/public Runtime
  API, use an owned profile/PID, pass `--mute-audio`, avoid the user's Chrome/profile, and guarantee
  cleanup in `finally`.
- B27 must use a real Extension `XMLHttpRequest` and real Runtime DELETE/status, not `FakeXhr` or mocked
  transport.
- B29/B30 must derive assets only from explicit `NAVIA_WP_B_SEED_MEDIA`, validate real speech and three
  distinct frames, generate registry-compliant 100 MB and 1 GB non-sparse assets, and collect the frozen
  RSS/heap, progress, product, UX and accessibility oracles.
- In this offline phase, do not generate the large assets and do not launch Chrome. Prove harness
  configuration, ownership, mute flag, asset validator and cleanup logic with offline tests.

## AC4 - Recompute and re-sign honestly

- Recompute B01-B28 only after the exact missing oracles pass. B27 remains `READY_FOR_VISIBLE_RUN`, not
  PASS, until the real browser run.
- Regenerate changed-file hashes from the final stable worktree; fail the evidence builder if any listed
  file changes afterward.
- Create a new immutable evidence directory:
  `docs/active/project/evidence/v3_media_companion/v3-completion/wp-b-explicit-local-media-import-acceptance-completion-offline-2026-10-20/`
- Include changed hashes, commands/exits, per-case oracle map, AC1 kill/restart receipt, harness readiness,
  relay inventories, secret/path scan, cleanup, handoff and a verified SHA-256 manifest.

## Validation budget

Run affected tests during implementation. At the end run one consolidated offline regression: schema/
fixture mutations, local-import Runtime suites, AC1 recovery, Runtime media-focused shards, Extension
media subtree, typecheck, build, relay inventory report, secret/path/raw-media scan and cleanup. Do not
repeat broad suites after every edit.

## Constraints

- No visible/headless Chrome launch in this phase; no focus events and no audio playback.
- Do not read Desktop, other repositories or arbitrary drives for media. Missing
  `NAVIA_WP_B_SEED_MEDIA` is an external-input block.
- Do not modify schemas, 18-code set, thresholds, B01-B30 denominator, T1-T4, Origin/auth order, asset
  registry, WP-A hashes or historical relay evidence.
- Do not refreeze, commit, push, reset, clean, checkout, revert or overwrite unrelated changes.
- Do not announce WP-B/V3 PASS or enter WP-C.

## Stop state

Stop at `WP-B ACCEPTANCE COMPLETION READY FOR ONE VISIBLE RUN` only when AC1, all offline AC2 items,
harness offline tests and the consolidated regression are green, with B27/B29/B30 explicitly pending.
Then report the exact one-session Chrome command/runner, expected duration/storage, seed requirement and
cleanup plan so Codex can request the user's single visible-run approval.

Otherwise stop at `WP-B ACCEPTANCE COMPLETION OFFLINE NO-GO` with one minimal failing production test.
The handoff must include changed files/hashes, contract changes or `none`, commands/exits, B01-B30 state,
real IDs/receipts, remaining severities, relay inventory, Chrome/audio counts, secret/path scan, cleanup,
evidence directory and exact stop reason.
