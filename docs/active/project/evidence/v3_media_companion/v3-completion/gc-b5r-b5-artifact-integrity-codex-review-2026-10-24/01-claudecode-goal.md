# ClaudeCode Goal: GC-B5R B-5 Artifact Integrity Correction

You are implementing one bounded offline correction in `/mnt/c/workspace/navia`.

Read first:

- `AGENTS.md`
- `docs/active/project/design/project-stage-workflow.md`
- `docs/active/project/design/v3-post-wp-b-completion-rebaseline.md`
- `docs/active/project/evidence/v3_media_companion/v3-completion/gc-b5r-b5-artifact-integrity-codex-review-2026-10-24/00-codex-review.md`
- the immediately preceding aggregate-integrity evidence package and handoff

## Authorization And Stop Boundary

Authorized: offline implementation, focused tests, one consolidated offline
suite, and evidence generation for the findings below.

Not authorized: Chrome launch, Cookie read/injection, Provider/network call,
media download/import, Runtime media task, visible action, new BVID execution,
authorization consumption, relay refreeze, B-6, WP-C, commit, push, reset,
clean, checkout, or revert.

Stop at exactly:

`GC-B5R B-5 ARTIFACT INTEGRITY CORRECTION AWAITING CODEX CHECKPOINT`

Do not claim B-5 or V3 complete.

## AI1: Prove Published Artifact Bytes

For every `complete` source, require a deterministic durable derivative
artifact in the source evidence set. The aggregate must read the actual bytes,
parse them, and validate the frozen
`v3-media-grounded-comprehension/v2.1` contract with a production/shared exact
validator. Do not create a reduced duplicate schema merely for the runner.

Compute SHA-256 from the exact durable artifact bytes and compare it to every
machine/mirror derivative or evidence hash. Recompute the receipt hash with the
same canonical serialization used by production and compare it to the machine
receipt. Cross-bind all available task id, revision, source identity, run,
receipt, Provider, and endpoint identities. Missing or malformed evidence must
fail closed.

Replace the literal `<bvid>-evidence.json` filename with one deterministic
contracted filename, or make the aggregate resolve the exact declared filename
without directory search or ambiguity. Preserve secret/private-path rules.

Update the positive contract-shaped stub to write a real V2.1 artifact and to
derive hashes from bytes. It must not use repeated-character placeholder hashes.

Add process-level negative tests for at least:

- missing derivative file;
- malformed derivative JSON;
- wrong derivative schema;
- byte tampering after receipt creation;
- derivative/evidence hash mismatch;
- receipt hash mismatch;
- embedded receipt mismatch;
- foreign task/source/run identity;
- stale artifact reuse.

Each negative must make the real sequencer exit nonzero.

## AI2: Close Request And Mirror False Greens

Enforce all of the following:

- a `complete` publication has integer `requestCount >= 1`;
- any `attemptCount > 0` has integer `requestCount >= 1`;
- candidate ledger `runtimeSynthesize` and `providerCall` totals exactly match
  the sums of source facts;
- the mirror schema version is exactly
  `v3-5.10-b5-3-receipt-mirror/v2`;
- the mirror has the exact required wrapper key set;
- locked Provider id, endpoint class, provider lock, and derived-text scope are
  required and exact, not optional conditional checks.

Add negatives where receipts and ledger consistently claim zero requests,
where mirror schema is wrong, where each required wrapper field is absent, and
where an extra wrapper field is present. These must fail the real sequencer.

## AI3: Preserve CI1 And Existing Boundaries

Keep the accepted leak-sighting behavior unchanged. Its process-level
regression must still show that a sighting remains fatal after the child exits,
only the first source runs, the owned descendant is cleaned, and an unrelated
process remains alive.

Do not change public API/schema/FailureCode/threshold/message/Provider registry,
Origin/auth order, frozen source denominator, or historical evidence. Do not
weaken existing validators or rewrite expected output to fit the implementation.

## Verification Order

1. Run the new focused aggregate/artifact/mirror/request-count tests.
2. Run the prior Codex three-file combination and the CI1 process regression.
3. Run `node scripts/stage_b_b5_3/test/run_offline_suite.mjs` exactly once after
   focused tests are green.
4. Run Python tests only if production Python or a shared Python validator is
   touched; then run focused tests followed by the appropriate consolidated
   Runtime suite.
5. Run relay v11 baseline/mutations only if relay scope is touched; otherwise
   prove the scoped files are byte-identical.
6. Verify all historical evidence manifests remain byte-identical.
7. Scan the final changed files and new evidence for secrets, private paths,
   raw media, generated source-tree artifacts, and owned resource residue.

The evidence package must include changed-file hashes, commands/exits, a
case-to-production-oracle map, exact counter totals (all external actions zero),
negative process exits, privacy scan, cleanup audit, remaining risks, handoff,
and a manifest generated last and verified with `sha256sum -c`.

