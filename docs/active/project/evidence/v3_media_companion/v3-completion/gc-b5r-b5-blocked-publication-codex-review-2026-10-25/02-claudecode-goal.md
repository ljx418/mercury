# ClaudeCode Goal: GC-B5R B-5 Blocked Semantics And Schema Root Correction

Work only in `/mnt/c/workspace/navia`.

Read first:

- `AGENTS.md`
- `docs/active/project/design/project-stage-workflow.md`
- `docs/active/project/design/v3-post-wp-b-completion-rebaseline.md`
- the frozen Stage B grounded-comprehension contract and V2.1 schema
- `00-codex-review.md` and `01-independent-reproductions.json` in this directory

## Authorization And Stop Boundary

Authorized: one bounded offline runner/oracle correction, focused tests, one
consolidated offline suite, and a new evidence package.

Not authorized: Chrome, Cookie access/injection, Provider/network calls, media
download/import, Runtime media tasks, visible actions, authorization
consumption, real BVID execution, relay refreeze, B-6, WP-C, commit, push,
reset, clean, checkout, or revert.

Stop at exactly:

`GC-B5R B-5 BLOCKED SEMANTICS CORRECTION AWAITING CODEX CHECKPOINT`

Do not claim B-5, Stage B, or V3 complete.

## BP1: Make Row Validation Disposition-Aware

Define one explicit row-state matrix used by fixtures and the production
aggregate:

- every row: exact registry order/BVID, current run and registry, valid terminal
  disposition, valid source authority, valid attempt window, zero upload/audio/
  tabCapture violations, and clean ownership;
- complete: full task identity, namespace receipt, dependency generation,
  positive synthesis/Provider counts, exact publication/mirror, and valid V2.1
  derivative bytes;
- blocked before synthesis: zero synthesis and Provider requests, no published
  Provider receipt, no derivative bytes, no published mirror, and no artifact
  receipt;
- blocked task identity: either all task-bound fields are absent because no task
  was created, or the complete task-bound identity is present and validated.
  A partial task identity must fail closed.

Do not force a blocked pre-task source to fabricate task IDs, namespaces,
dependency generations, artifacts, or receipts merely to satisfy the complete
row schema. If the frozen evidence denominator requires a `receipt.json`, give
the blocked state an explicit non-publication audit shape and never make it look
like a frozen V2.1 publication receipt.

Move/commonize authority validation so a blocked row cannot carry a foreign
adapter, foreign BVID, stale run/registry, malformed timestamps, or contradictory
task namespace while remaining positive.

Correct `writeContractShapedEvidence()` and the existing one-blocked positive
test. Add pure and real-sequencer negatives for:

- blocked + foreign adapter/source/run/registry;
- blocked + partial task identity or mismatched namespace receipt;
- blocked + derivative file;
- blocked + `provider.published`;
- blocked + published mirror/artifact receipt;
- blocked + nonzero synthesis or Provider ledger count.

The truthful one-blocked case must remain positive; two blocked, any limited,
or any failed source must remain non-positive.

## BP2: Close The Effective Schema Root

The public validator must not expose any route to an unchecked schema graph.
Prefer removing the public `{root, path}` override if no production caller needs
it. Otherwise inventory and validate both the entry schema and the entire
effective root exactly once before traversal, and reject references outside the
checked graph.

Add direct tests for:

```js
validateAgainstSchema(
  { $ref: "#/$defs/X" },
  {},
  { root: { $defs: { X: { type: "object", not: {} } } } },
);
```

plus nested and chained `$ref` forms. Every unsupported keyword reachable by
evaluation must hard-fail. Retain the ordinary root/nested keyword tests and the
real frozen V2.1 artifact validation.

## BP3: Preserve Accepted Closures

Do not weaken:

- authorization/grant one-time ownership and exact stage action accounting;
- complete-row identity, namespace, timestamp and terminal validation;
- artifact byte/hash/receipt binding and quality/disposition mapping;
- exact complete mirror wrapper, Provider lock and positive request counts;
- latched owned-process sightings and owned-only cleanup;
- public API/schema/FailureCode/threshold/message/Provider registry,
  Origin/auth order, frozen denominator, relay fixtures, or historical evidence.

## Verification Order

1. Run new focused blocked-state matrix and alternate-root schema tests.
2. Re-run machine identity, aggregate identity, schema keyword, artifact
   integrity, sequencer, CI1 and previous Codex combination suites.
3. Run `node scripts/stage_b_b5_3/test/run_offline_suite.mjs` exactly once after
   focused tests are green.
4. Run focused Python schema/canonical tests only if their shared behavior or
   fixtures changed; run broader Python only if production/shared Python changed.
5. Prove relay scope bytes unchanged; run relay verifiers only if scope changed.
6. Verify historical evidence manifests remain byte-identical.
7. Scan changed files/evidence for secrets, private paths, raw media, generated
   source artifacts and owned resource residue.

The evidence package must include changed-file hashes, exact commands/exits,
case-to-production-oracle mapping, process-level negative receipts, all-zero
external action counters, privacy scan, cleanup audit, remaining risks,
handoff, and a manifest generated last and verified with `sha256sum -c`.

