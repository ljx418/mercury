# GC-B5R B-5 Publication Semantic Binding Codex Review

Status: `GC-B5R B-5 ARTIFACT INTEGRITY CORRECTION NO-GO`

Date: 2026-10-24

## Accepted Closures

The prior artifact-presence and request/mirror defects are materially closed:

- the sequencer reads one deterministic derivative file;
- the aggregate hashes its bytes and validates the current frozen V2.1 schema;
- receipt and derivative hashes are recomputed;
- complete publications require positive request counts;
- mirror version, exact wrapper shape, Provider lock and ledger totals are
  enforced;
- CI1 process-sighting behavior remains intact.

The evidence manifest verifies, all 54 listed source files match their recorded
hashes and sizes, the focused Node suites pass 57/57, the Python validator
suite passes 19/19, and the consolidated offline suite passes 343/343.

## Major 1: Missing Machine Identity Fields Disable Cross-Binding

`checkArtifactIntegrity()` compares task id, task revision and source identity
only when both values exist. A missing machine value executes `continue`, so
absence is treated as permission to skip the binding.

The aggregate also treats several machine identity fields as optional. It does
not require `taskRevision` or `sourceIdentity`; `bvid`, `order`, `taskId`, and
`taskNamespace` are likewise mostly guarded only when present.

Independent reproduction:

1. create six otherwise valid complete rows with real contract-shaped artifact
   bytes, mirrors and exact ledger totals;
2. delete `taskRevision` and `sourceIdentity` from every machine receipt;
3. call the production `evaluateAggregate()`;
4. observed result: `positive: true`, `failures: []`.

This reopens stale/cross-source artifact reuse: removing the machine declaration
turns the intended equality proof off. It also contradicts the delivery claim
that task revision and source identity are cross-bound.

Required correction:

- define and enforce the complete machine-receipt identity shape;
- require, with type/pattern checks, at least run, registry, order, BVID, task
  id, task namespace, task revision, source identity and dependency generation;
- compare artifact task/revision/source to machine values unconditionally;
- bind the source identity's BVID component to the frozen row BVID;
- reject absence as `AGG_ARTIFACT_IDENTITY_MISMATCH`, never skip it;
- add pure and real-sequencer negatives for every missing identity field and
  for a foreign artifact combined with a deleted machine identity.

## Major 2: Artifact Quality Is Not Bound To Final Disposition

The byte oracle validates artifact shape but never compares
`artifact.quality.status` with the row or machine disposition. The aggregate
also does not require `receipt.disposition === row.disposition`.

Independent reproduction:

1. start from six valid complete rows;
2. change one artifact's `quality.status` to `limited`;
3. recompute its exact artifact/evidence hashes and update the mirror;
4. retain `complete` in the row and machine receipt;
5. observed result: `positive: true`, `failures: []`.

The frozen Stage B contract states that `limited` is not a Stage B positive.
Byte authenticity alone cannot turn a limited product into a complete result.

Required correction:

- require machine disposition to equal the parsed final disposition;
- require every complete row's artifact quality status to be `complete`;
- require the complete quality object to carry no failure codes, matching the
  production quality evaluator;
- retain the frozen mapping: `complete -> complete`, `limited -> limited`, and
  a blocked pre-synthesis source has no published derivative;
- add process-level negatives for quality/disposition disagreement and machine
  disposition disagreement.

## Major 3: Shared Schema Validator Is Not Fail-Closed On Unknown Keywords

The validator comment says an unknown JSON Schema keyword is a hard error, but
the implementation has no keyword-inventory check. Independent calls using
`not`, `minProperties`, and `exclusiveMinimum` all returned `ok: true` while
their constraints should reject the supplied values.

The current frozen schema happens to use the implemented subset, so this does
not invalidate its current artifact fixtures. It does invalidate the claimed
fail-closed contract-drift behavior: the finite 22-fixture comparison does not
guarantee that a newly introduced constraint is exercised and cannot make an
unknown keyword fail loudly by itself.

Required correction:

- inventory schema keywords structurally before accepting the frozen schema;
- distinguish schema keywords from property/definition names;
- permit known annotation keywords explicitly;
- throw/fail closed on every unsupported assertion/applicator keyword;
- add direct negatives for unsupported keywords at root, `$defs`, `items`,
  `properties`, and `if/then` depths;
- make the equivalence test assert the schema keyword inventory, rather than
  relying only on hand-selected value fixtures.

## Gate

Do not consume a visible-run authorization and do not rerun the six videos.
Complete the bounded offline correction in `01-claudecode-goal.md`, then return
to Codex checkpoint.

