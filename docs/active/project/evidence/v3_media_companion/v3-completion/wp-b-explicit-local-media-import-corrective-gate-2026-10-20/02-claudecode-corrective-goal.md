# ClaudeCode CLI Goal: WP-B production-path corrective implementation

Work in `/mnt/c/workspace/navia`. This is one consolidated corrective implementation batch. Do not
perform an independent document audit and do not repeatedly stop on relay source-hash drift.

## Authority and required reading

Read, in order:

1. `AGENTS.md`
2. `docs/active/project/design/project-stage-workflow.md`, especially section 5.1
3. `docs/active/project/01-prd.md` section 18.13
4. `docs/active/project/design/v3-media-companion-risk-adr.md` ADR-V3-14
5. every file in
   `docs/active/project/evidence/v3_media_companion/v3-completion/wp-b-explicit-local-media-import-preimplementation-2026-10-19/`
6. implementation evidence in
   `docs/active/project/evidence/v3_media_companion/v3-completion/wp-b-explicit-local-media-import-implementation-2026-10-19/`
7. `00-codex-checkpoint.md` and `01-corrective-plan.md` in this directory
8. the three `docs/active/project/contracts/v3_media_local_import_*_v1.schema.json` files and all
   `docs/active/project/fixtures/v3-media-local-import-*` fixtures

The current gate is `WP-B NO-GO / CORRECTIVE IMPLEMENTATION MAY START`. WP-A remains PASS. WP-C is
locked.

## Goal

Close all two Fatal and six Major findings in `00-codex-checkpoint.md`, in C0-C8 order from
`01-corrective-plan.md`. This is product implementation, not another document review.

The critical end-to-end path must be real:

`eligible blocked acquisition -> mounted Extension card -> authenticated POST -> authenticated raw
PUT -> durable upload -> verified preparation -> T1/T2/T3 -> audio owner receipt -> original deletion
-> T4 -> real transcript task/worker -> receipt-bound visual materialization -> two durable terminal
receipts -> exactly-once cleanup -> public ready/failed/cancelled status`.

## Non-negotiable corrections

- Fix the PUT coroutine/iterator defects and prove one successful production ASGI upload.
- Compose preparer, consumer barrier, transcript and materializer in Runtime production startup.
- Bind local input into the actual coordinator input consumed by `audio_reference()`.
- Persist barrier receipts and terminal flags; wire startup recovery; use real coordinator signatures.
- Conform every public/internal payload to the frozen schemas and IDs.
- Enforce task/source eligibility before writer/import allocation.
- Fix exact CORS, Runtime base URL/bearer, XHR ownership/abort, polling and production card mounting.
- Replace fake/direct-SQL false-green tests with production composition and restart oracles.

Do not change the 18-code set, schemas, B01-B30 denominator, thresholds, T1-T4 order, asset registry,
Origin/auth order, WP-A tools/hashes or relay v11 contract. Do not modify v10 historical evidence.
The current relay v11 source hash mismatch is expected during authorized edits; report it but do not
self-refreeze and do not stop solely for it. Stop only if the code inventory/public security contract
must change.

## Test discipline

Write failing targeted tests first. During edits run only affected tests. When the candidate is stable,
run exactly one consolidated checkpoint regression: Runtime media-focused tests, Extension media
subtree, typecheck, build, local-import schema/fixture mutation verifier, hard-kill/restart probe,
B01-B28 production matrix, relay v11 baseline/mutations for inventory reporting, secret/path/raw-media
scan and cleanup check.

No test may play sound. Default to headless/no-window/no-focus execution. Do not start visible Chrome
unless every offline gate is green and the user has first been notified. If required, use only an owned
profile/PID, explicit `--mute-audio`, one concentrated session and `finally` cleanup.

B29/B30 require `NAVIA_WP_B_SEED_MEDIA` pointing to a private >=30,000 ms real-speech media with
dynamic frames. Do not scan user directories, persist the path, pad/truncate/sparsify media, or use a
mock. If the variable is absent after B01-B28 and all implementation findings are closed, record one
external-input blocker and stop; do not relabel implementation defects as seed limitations.

## Evidence and stop condition

Write a fresh corrective evidence directory:

`docs/active/project/evidence/v3_media_companion/v3-completion/wp-b-explicit-local-media-import-corrective-implementation-2026-10-20/`

Include receipt, changed files with SHA-256, all commands/exits, case results, real run/task/import IDs,
durable T1-T4 and consumer receipts, restart outcomes, PRD review, secret/path/raw-media scan, cleanup,
handoff and a manifest. Explicitly distinguish product defects, environment blockers and missing seed.

Finish with exactly one of:

- `WP-B CORRECTIVE AWAITING CODEX CHECKPOINT` when all implementation findings are closed and B01-B30
  pass; or
- `WP-B CORRECTIVE NO-GO` with one reproducible blocker and preserved evidence.

Do not announce WP-B/V3 PASS. Do not enter WP-C. Do not perform Claude document external review. Do not
commit, push, reset, clean, checkout, revert or overwrite unrelated dirty-worktree changes.

Your final reply must list: state; changed files; public/internal contract changes; commands and exit
codes; B01-B30 denominator; real IDs and durable receipts; relay inventory/hash status; Chrome/audio
counts; secret and cleanup results; Fatal/Major/Minor; evidence directory; exact stop reason.

