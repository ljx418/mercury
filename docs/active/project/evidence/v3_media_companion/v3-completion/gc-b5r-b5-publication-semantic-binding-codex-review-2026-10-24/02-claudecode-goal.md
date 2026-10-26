# ClaudeCode Goal: GC-B5R B-5 Publication Semantic Binding Correction

Work only in `/mnt/c/workspace/navia`.

Read first:

- `AGENTS.md`
- `docs/active/project/design/project-stage-workflow.md`
- `docs/active/project/design/v3-post-wp-b-completion-rebaseline.md`
- the frozen Stage B grounded-comprehension contract and V2.1 schema
- `docs/active/project/evidence/v3_media_companion/v3-completion/gc-b5r-b5-publication-semantic-binding-codex-review-2026-10-24/00-codex-review.md`
- `01-independent-reproductions.json` in the same directory

## Authorization And Stop Boundary

Authorized: one bounded offline correction, focused tests, one consolidated
offline suite and a new evidence package.

Not authorized: Chrome, Cookie access/injection, Provider/network calls, media
download/import, Runtime media tasks, visible actions, authorization
consumption, real BVID execution, relay refreeze, B-6, WP-C, commit, push,
reset, clean, checkout, or revert.

Stop at exactly:

`GC-B5R B-5 PUBLICATION SEMANTIC BINDING CORRECTION AWAITING CODEX CHECKPOINT`

Do not claim B-5, Stage B, or V3 complete.

## SB1: Make Machine Identity Presence Mandatory

Create one explicit validator for the complete machine-receipt identity. For a
complete publication require valid, non-null values for:

- run id and active registry digest;
- frozen order and BVID;
- task id and task namespace;
- integer task revision;
- source identity;
- dependency generation;
- fresh start and finish timestamps.

Do not use truthy conditional comparisons for required fields. Absence, null,
wrong type, malformed value, or mismatch must fail closed.

Pass the expected row identity and run identity into the artifact integrity
oracle. Require exact equality for artifact binding task id, task revision and
source identity against the machine receipt. Parse the source identity and
require its portal/adapter/BVID components to belong to the frozen row. A
missing machine field must never disable a comparison.

Add pure and real-sequencer negative cases for every required identity field,
plus a foreign artifact whose machine source/revision declaration was removed.
Each real-sequencer case must exit nonzero with a stable internal aggregate
failure code.

## SB2: Bind Artifact Quality To Disposition

Use the production mapping already present in `run_one_bvid.mjs` as the single
rule:

- artifact `quality.status=complete` maps to disposition `complete`;
- artifact `quality.status=limited` maps to disposition `limited`;
- a blocked pre-synthesis source publishes no derivative;
- rejected/invalid publication cannot be a positive complete row.

Require all of these to agree:

- parsed final disposition;
- machine receipt disposition;
- artifact quality status;
- publication presence/absence.

A complete artifact must have an empty `quality.failureCodes`, matching the
production quality evaluator's construction. Add byte-level and process-level
negatives for limited-as-complete, rejected-as-complete, nonempty failures on a
complete result, and machine/row disposition mismatch. Recompute hashes in the
tests so failures prove semantic binding, not an incidental hash mismatch.

## SB3: Make Schema Keyword Handling Fail-Closed

Before caching or using the frozen schema, recursively inventory its schema
keywords. Distinguish keyword positions from names under `properties` and
`$defs`. Explicitly allow the annotation/meta keywords used by the contract.
Every unsupported assertion, applicator, validation, or unevaluated keyword
must throw or return a hard validation failure. Never silently ignore it.

Add focused negatives placing unsupported keywords at:

- the root;
- a `$defs` schema;
- an `items` schema;
- a property schema;
- an `if`, `then`, or `else` schema.

Update the Python/JavaScript equivalence proof to assert the complete keyword
inventory of the actual frozen schema. Keep representative accept/reject value
fixtures, but do not describe a finite fixture list as a universal equivalence
proof.

Also constrain the canonical receipt serialization claim to the legal frozen
receipt domain. Add a Python-vs-JavaScript byte comparison covering every legal
receipt field type and representative Unicode strings.

## SB4: Preserve Accepted Closures

Retain all AI1/AI2/CI1 behavior:

- deterministic artifact filename and byte hashing;
- receipt and derivative digest recomputation;
- exact mirror wrapper and Provider lock;
- positive request counts and exact ledger totals;
- latched owned-process sightings and owned-only cleanup.

Do not change public API/schema/FailureCode/threshold/message/Provider registry,
Origin/auth order, frozen denominator, relay fixtures, or historical evidence.

## Verification Order

1. Run new focused identity, semantic-disposition, schema-keyword and canonical
   serialization tests.
2. Run the prior artifact-integrity, sequencer and CI1 focused suites.
3. Run the previous Codex three-file combination.
4. Run `node scripts/stage_b_b5_3/test/run_offline_suite.mjs` exactly once after
   focused tests are green.
5. Run the focused Python equivalence tests. Run broader Python only if
   production/shared Python code changed.
6. Prove relay scope hashes unchanged; run relay verifiers only if scope changed.
7. Verify all historical evidence manifests remain byte-identical.
8. Scan changed files and evidence for secrets, private paths, raw media,
   generated source-tree artifacts and owned resource residue.

The new evidence package must contain changed-file hashes, exact commands and
exits, case-to-production-oracle mapping, the process-level negative receipts,
all-zero external action counters, privacy scan, cleanup audit, remaining
risks, handoff, and a manifest generated last and verified with
`sha256sum -c`.

