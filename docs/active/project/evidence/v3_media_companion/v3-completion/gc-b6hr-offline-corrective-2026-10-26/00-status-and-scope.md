# GC-B6H-R OFFLINE CORRECTIVE — Status And Scope

Batch: `GC-B6H-R OFFLINE CORRECTIVE`
Date: 2026-10-26
Coordinate: V3 Chat + Know / V3-5.10 Stage B / B-5 machine gate CLOSED /
**GC-B6 SEMANTIC REVIEW NO-GO** / the GC-B6H OFFLINE CORRECTION NO-GO /
GC-B6H-R offline corrective AUTHORIZED.

## Exit state

```text
GC-B6H-R OFFLINE CANDIDATE AWAITING CODEX CHECKPOINT
```

It does not authorize or schedule a visible run. B7, Stage C, Stage B PASS
and V3 PASS stay blocked.

## The checkpoint findings that were closed

The GC-B6H Codex checkpoint accepted the submitted manifest and the reported
offline tests, and found one Fatal acceptance false-green, four Major
integration/privacy defects and one Minor. Every one of them is closed here,
by ONE owner per authority and without a second, parallel validator.

| Finding | Correction | Owner |
|---|---|---|
| Fatal 1 — `validatePublicEvidence()` copied the caller's booleans and could certify a negative run as positive | the public package is GENERATED from the raw production authorities, the machine gate is RECOMPUTED by the production aggregate, the private bundles are re-read with the production reader, the ledger is reconciled against the receipts, the scan is re-read, the lock and the precommit are validated, and a MISSING run id is a defect instead of a reason to skip the check | `lib/public_evidence.mjs`, `lib/source_rows.mjs`, `publish_public_evidence.mjs` |
| Major 1 — the snapshot was never the execution root and the closure was fail-open | one preparation entrypoint builds the closure, refuses every unresolved input, materializes an exclusive repository-external snapshot and verifies it; the Runtime, the extension and the child harness execute the SNAPSHOT bytes; the manifest is verified against the SNAPSHOT before the authorization, after every source and at the closeout; any failed observation is LATCHED | `lib/execution_closure.mjs`, `lib/candidate_prepare.mjs`, `prepare_candidate.mjs`, `run_one_bvid.mjs`, `sequencer.mjs` |
| Major 2 — the canonical protocol was neither operative nor fully validated | the sequencer builds and validates the v2 precommit from the repository-tracked bytes BEFORE the authorization, the run id is mandatory, the pass records are bound to the sentinel, and a caller-supplied protocol is refused | `lib/review_protocol.mjs`, `sequencer.mjs` |
| Major 3 — the Stage A and closure diagnostics never reached the durable receipts | `stageADiagnostic`, `executionClosure` and the execution-root identities are durable fields of every machine receipt, and a closure failure makes the aggregate non-positive | `run_one_bvid.mjs`, `lib/audit_finalizer.mjs`, `lib/aggregate.mjs` |
| Major 4 — a private root could leak into the public evidence | the private retention record keeps the owned root; the public projection carries a non-reversible root reference, the policy enums, the owner reference, the deadline, the digests and the deletion-receipt state, and it is validated and scanned before the package is signed | `lib/retention_ledger.mjs`, `lib/public_evidence.mjs` |
| Minor 1 — the brief coverage diagnostic understated a partial coverage | the maximum regions reached by any tested 2/3-claim subset, the number of full-region subsets before and after the length rule and a stable rejection class are recorded separately from the valid full-subset count | `comprehension/quality.py` |

## The boundaries that were preserved

- **Zero Chrome, zero visible window, zero Runtime media task, zero Cookie
  read or injection, zero Provider request, zero download, zero real BVID,
  zero blind review, zero sentinel, zero visible authorization.**
- No public contract, V2.1 schema, quality threshold, request bound,
  registry, denominator or historical evidence was changed. The eight-request
  bound is untouched.
- No reserve substitution, no historical-row merge, no local content repair
  and no reinterpretation of the negative GC-B6B run.
- The repository was not committed, pushed, reset, cleaned, checked out or
  reverted, and the unrelated dirty work of the concurrent sessions was
  preserved.

## The negative run is unchanged

The GC-B6B run `gc-b6b-20261025T175243Z` remains what it was: a NEGATIVE
candidate (2 complete / 3 limited / 1 blocked), an honest failed candidate
with no blind review and no score. This batch neither reinterprets it nor
repairs it. Its private artifacts stay outside the repository and outside
every public package.
