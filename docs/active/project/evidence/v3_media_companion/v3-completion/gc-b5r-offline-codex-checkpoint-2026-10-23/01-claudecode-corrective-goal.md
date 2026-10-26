# ClaudeCode goal: GC-B5R offline single corrective batch

Work in `/mnt/c/workspace/navia`. Implement exactly one corrective batch for
the GC-B5R offline candidate. Do not start the real B-5 run.

## Current gate

The prior candidate is **not accepted**. Codex found Fatal 0 / Major 3 / Minor
3 in:

`docs/active/project/evidence/v3_media_companion/v3-completion/gc-b5r-offline-codex-checkpoint-2026-10-23/00-checkpoint-findings.md`

You are authorized to close all findings in that file and stop at:

`GC-B5R OFFLINE CORRECTIVE AWAITING CODEX CHECKPOINT`

No Chrome, Provider, cookie injection, download, media import, large asset,
audio, visible window, or six-video execution is authorized.

## Required reading

1. `AGENTS.md`
2. `docs/active/project/design/project-stage-workflow.md`, especially 5.1
3. `docs/active/project/design/v3-post-wp-b-completion-rebaseline.md`
4. every file in
   `docs/active/project/evidence/v3_media_companion/v3-completion/post-wp-b-rebaseline-2026-10-23/`
5. every file in the prior candidate directory
   `docs/active/project/evidence/v3_media_companion/v3-completion/gc-b5r-offline-implementation-2026-10-23/`
6. `00-checkpoint-findings.md` beside this prompt
7. the current production files and tests before editing

The checkpoint findings override the prior candidate's severity grading.

## C1 — durable, production-wired generation authority

Replace the process-global `DEPENDENCY_LEASES` authority seam.

Requirements:

1. `MediaDependencyManager` remains the only owner of verified dependency
   snapshots and task leases.
2. The real `app.py` composition explicitly supplies `MediaInputAuthority` with
   the production task store, local-import store, acquisition coordinator, and
   a manager-owned generation/snapshot resolver.
3. After a Runtime restart, a local binding must be compared with a newly
   verified current snapshot or fail closed before Provider invocation. A
   missing/unready/unverifiable current generation must never skip comparison.
4. Same durable task/source/import and same verified generation may proceed
   after restart. A changed generation must return an existing frozen failure
   code before Provider invocation and publish nothing.
5. A live coordinator task with another identity must be rejected. When the
   coordinator has no live in-memory entry after restart, durable task/source
   authority remains decisive; do not make valid durable terminal products
   unreadable merely because the coordinator process restarted.
6. Remove the global mirror and its stale-entry risk unless it remains only as
   non-authoritative diagnostics. Prefer removing it.

Use existing failure codes. Do not add a public endpoint, schema, threshold,
message set, or FailureCode. If no existing code can express dependency
unavailability, stop and report Codex instead of inventing one.

Required tests:

- public app composition drives the real authority, coordinator, manager and
  same Runtime database;
- fresh process/recreated manager, same generation: accepted;
- fresh process/recreated manager, changed generation: rejected before Provider;
- current generation unavailable: rejected before Provider;
- live coordinator identity mismatch: rejected before Provider;
- failed authority check publishes no V2.1 artifact and changes no counters;
- manager remains the sole lease owner and no global cross-instance bleed exists.

Tests may fake filesystem/network probes needed to construct a verified
snapshot, but may not fake the authority, manager, coordinator, task store,
local-import store, service, validator, publisher, or app composition under
test.

## C2 — exact preflight source matching

Correct `scripts/stage_b_b5_3/lib/preflight.mjs` and its tests.

For each declared asset, validate before reporting it as eligible:

- exact `portal:bilibili:<frozen BVID>:<nonempty playbackUnitId>:<nonempty partId>`;
- declaration key equals the frozen BVID and mediaId;
- path is explicitly declared, exists, is a regular file, and is not a symlink;
- malformed, missing, foreign, duplicate, or unsafe entries remain visible as
  ineligible with a stable nonsecret reason;
- no file content, digest, cookie, or arbitrary directory search is performed
  in preflight-only mode;
- every action counter remains zero and no source is marked passed.

Add negatives for a foreign BVID, wrong portal/adapter, empty unit/part, missing
identity, symlink, directory, duplicate/unknown key, and undeclared file. A
wrong identity must never yield `localAssetAvailable=true` or any equivalent
matching/eligible signal.

## C3 — exact Provider lock

Separate the concepts:

- selected product Provider ID: exact `minimax-cn-openai-vision` for this
  frozen runner candidate;
- endpoint/adapter class: exact `minimax_chat_completions`;
- one production Provider factory invocation per task, with one authoritative
  receipt. A bounded retry by that same Provider is not a second Provider.

Remove every substring or fuzzy acceptance. Do not use an optional synthetic
`providers` array as the primary oracle. The runner must reject missing or
lookalike Provider IDs, wrong endpoint classes, DeepSeek, and evidence of a
second factory/provider authority. Align constants, receipt checks, runner
evidence, and tests without changing the public V2.1 schema.

## C4 — deterministic offline runner suite

Define one offline runner test command that exits 0:

- PH0-AR-12 is a real visible/cookie/Runtime canary and must be explicitly
  classified as external/not-run in the offline command, not counted as a pass.
- PH0-AR-10 must be deterministic under the declared command. Fix ownership/
  waiting if there is a race; otherwise serialize the resource-sensitive file
  explicitly and document why. Do not increase timeouts until the race is hidden.
- New GC-B5R preflight and exact-lock tests must all run in this command.

## C5 — frozen source scope handling

You are authorized to change `services/local-runtime/navia_runtime/app.py` for
the production composition above. Do not contort production wiring to preserve
an old source hash.

Do not edit relay fixtures, inventories, schemas, registries, verifier code, or
historical evidence. Do not self-refreeze. Run the v11 baseline once after the
candidate stabilizes and report the exact failed checks. An acceptable pending
state before Codex refreeze is:

- only authorized source hash/scope drift;
- target inventory remains 20/20;
- semantic source inventory remains 40/40 when extracted from current sources;
- `unlistedBoundaryEmits` remains `{}`;
- no code, threshold, message, or public-contract drift.

If the verifier reports anything beyond authorized source-scope drift, treat it
as a real failure and fix it. Run mutations only if the canonical baseline is
green; otherwise record `not run: canonical baseline pending Codex refreeze`.

## Validation budget

Use targeted tests during edits. At the end, run one consolidated checkpoint:

1. corrected authority/restart/app-composition tests;
2. existing GC-B5R 32 tests plus affected WP-A/WP-B lifecycle tests;
3. deterministic offline Stage B runner suite, exit 0;
4. focused Runtime media suite;
5. full Runtime suite once, split deterministically only for resource limits;
6. TypeScript typecheck/build only if TypeScript or shared extension contracts changed;
7. relay v11 baseline once, with the source-drift classification above;
8. secret/private-path/raw-media scan and residual process/port/root scan.

Do not rerun the real PH0-AR-12 canary, Chrome, Provider, media, or external
audit. Do not repeat full suites after success.

## Evidence and handoff

Create a new directory:

`docs/active/project/evidence/v3_media_companion/v3-completion/gc-b5r-offline-corrective-2026-10-23/`

Include:

- correction report mapping M-GCB5R-01..03 and all three Minor findings to
  production changes and tests;
- changed-file hashes;
- production composition and fresh-process restart receipts;
- exact preflight and Provider-lock negative matrix;
- commands/exits/counts;
- relay source-drift report with semantic inventories;
- PRD/contract review;
- secret/path/raw-media and cleanup reports;
- exact handoff;
- `PAYLOAD_MANIFEST.sha256`, generated only after all evidence stabilizes and
  verified with `sha256sum -c`.

Report exact counts for Chrome, Runtime media work, Provider, download, import,
cookie, audio, visible windows and six-video runs; all must remain zero. Report
Fatal/Major/Minor honestly. Do not carry the prior candidate's evidence forward
as if it were regenerated.

## Prohibitions and stop state

- No public contract, fixed denominator, threshold, Provider authorization,
  Origin/auth ordering, WP-A/WP-B history, or historical evidence changes.
- No commit, push, reset, clean, checkout, revert, or unrelated-file cleanup.
- No real BVID attempt, normal-video substitution, generic seed reuse, Chrome,
  Provider, cookie, download, import, audio, or visible run.
- Do not refreeze relay v11.
- Do not enter B-5 real execution, B-6, B-7, Stage C, or WP-C.

When all corrections and permitted validation are complete, stop with exactly:

`GC-B5R OFFLINE CORRECTIVE AWAITING CODEX CHECKPOINT`

Do not announce GC-B5R, B-5, Stage B, or V3 PASS.
