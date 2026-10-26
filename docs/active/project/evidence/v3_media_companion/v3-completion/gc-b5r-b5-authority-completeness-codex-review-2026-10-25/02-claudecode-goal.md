# ClaudeCode Goal: GC-B5R B-5 Authority Completeness Correction

Work only in `/mnt/c/workspace/navia`.

Read first:

- `AGENTS.md`
- `docs/active/project/design/project-stage-workflow.md`
- `docs/active/project/design/v3-post-wp-b-completion-rebaseline.md`
- the frozen Stage B grounded-comprehension contract and V2.1 schema
- `00-codex-review.md` and `01-independent-reproductions.json` in this directory

## Authorization And Stop Boundary

Authorized: one bounded offline correction, focused tests, one consolidated
offline suite, and a new evidence package.

Not authorized: Chrome, Cookie access/injection, Provider/network calls, media
download/import, Runtime media tasks, visible actions, authorization
consumption, real BVID execution, relay refreeze, B-6, WP-C, commit, push,
reset, clean, checkout, or revert.

Stop at exactly:

`GC-B5R B-5 AUTHORITY COMPLETENESS CORRECTION AWAITING CODEX CHECKPOINT`

Do not claim B-5, Stage B, or V3 complete.

## AC1: Bind Every Machine Identity Field To Authority

Keep the required eleven identity fields, then close their semantic gaps:

1. Source identity must parse and equal the frozen row authority. Require
   literal portal `portal`, adapter `bilibili`, and exact row BVID. Keep
   non-empty playback-unit and part components.
2. Task namespace must satisfy the frozen task-namespace shape. The sequencer
   must parse `task_namespace.json`, reject malformed or extra/missing fields,
   and cross-bind its `taskIdNamespace`, `runId`, `order`, and `bvid` to the
   machine receipt, current run, and registry row. File presence is not proof.
3. Start and finish timestamps must denote finite valid UTC instants, not only
   match a regex. Reject impossible calendar/time values and require finish >=
   start. Do not silently normalize invalid input.

Add direct validator, pure aggregate, and real-sequencer negatives for foreign
adapter, malformed namespace, namespace-file mismatch, malformed namespace
receipt, invalid date/time, and reversed window. Assert stable internal failure
codes and nonzero process exits.

## AC2: Make Machine Disposition Mandatory

Add `disposition` to the explicit machine terminal shape. Require a string in
the frozen disposition vocabulary and compare it unconditionally to the parsed
`final_disposition.txt` result. Missing, null, wrong type, unknown value and
mismatch must all fail closed.

Preserve the shared quality mapping and publication rules. Add pure aggregate
and real-sequencer negatives for each invalid machine disposition form.
Recompute artifact hashes in semantic tests so the intended oracle is what
fails.

## AC3: Make The Schema Validation API Self-Protecting

An exported function documented as fail-closed must enforce keyword support
itself. Refactor into:

- a checked public validation entry that inventories and rejects unsupported
  keywords once; and
- a private recursive evaluator that assumes the check already passed.

Alternatively, stop exporting the unchecked evaluator and expose only a
checked API. Direct calls with `not`, `minProperties`, `exclusiveMinimum`, and
nested unsupported keywords must hard-fail. Tests must call the same public API
used by production, not only `assertSchemaKeywordSupport()`.

Retain frozen-schema cache validation, complete keyword inventory tests,
canonical serialization checks, and Python/JavaScript representative cases.

## AC4: Preserve Accepted Closures

Do not weaken:

- deterministic artifact filename and byte hashing;
- artifact task/revision/source unconditional binding;
- quality/disposition mapping and empty complete failure codes;
- exact mirror wrapper, Provider lock, positive request counts and ledger totals;
- authorization/grant ownership and latched owned-process sightings;
- public contracts, FailureCodes, thresholds, Provider registry, Origin/auth
  order, frozen denominator, relay fixtures, or historical evidence.

## Verification Order

1. Run new focused identity-authority, namespace-receipt, terminal-disposition,
   and public-schema-entry tests.
2. Re-run prior machine identity, aggregate identity, artifact integrity,
   schema keyword, sequencer, CI1 and Codex combination suites.
3. Run `node scripts/stage_b_b5_3/test/run_offline_suite.mjs` exactly once after
   focused tests are green.
4. Run the focused Python schema/canonical equivalence tests. Run broader
   Python only if production/shared Python changes.
5. Prove relay scope bytes unchanged; run relay verifiers only if scope changed.
6. Verify historical evidence manifests remain byte-identical.
7. Scan changed files/evidence for secrets, private paths, raw media, generated
   source artifacts and owned resource residue.

The evidence package must include changed-file hashes, exact commands/exits,
case-to-production-oracle mapping, process-level negative receipts, all-zero
external action counters, privacy scan, cleanup audit, remaining risks,
handoff, and a manifest generated last and verified with `sha256sum -c`.

