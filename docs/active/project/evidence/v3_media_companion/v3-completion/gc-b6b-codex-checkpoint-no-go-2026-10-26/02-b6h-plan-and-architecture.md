# GC-B6H Offline Correction Plan And Architecture

## Objective

Make the next real B6 candidate reproducible, protocol-bound, diagnostically
actionable, and mechanically evidenced before spending another visible run. This
package does not attempt to manufacture six complete sources.

## H1 - Sealed Execution Closure

Create one owner for an execution-closure manifest. It must include the Runtime
launcher/entrypoint, acquisition and comprehension modules, extension source and
the exact built extension bytes, harness modules, active schemas/contracts,
registry, dependency/provider configuration identities, and tool versions used by
the run. Resolve transitive local imports mechanically rather than maintaining a
hand list.

Materialize the candidate into a uniquely owned, repository-external snapshot.
The runner must execute only that snapshot. Verify the manifest before any
external action, after every source, and at closeout. Missing files, extra
executed files, symlinks, mutable paths, or digest drift invalidate the candidate.

## H2 - Canonical Review Protocol

Add repository-tracked, versioned canonical rubric and prompt files plus a strict
precommit schema and builder. The builder loads only those files, records exact
byte count and SHA-256, and refuses caller-provided replacements.

Use distinct fields:

- `registryOrder`: immutable six-row source order;
- `reviewOrder`: random presentation order;
- two distinct review session ids;
- sentinel source and distinct positions;
- exact protocol schema/version and canonical byte hashes.

Mutation tests must reject protocol byte drift, self-hashed alternatives,
mislabelled order, missing files/bytes, repeated session ids, and invalid sentinel
placement.

## H3 - Deterministic Evidence Builder

Generate lock, precommit, machine rows, bundle verification, ledger
reconciliation, decision, cleanup, retention, and scan outputs from validated raw
receipts. Hand-authored narrative may explain a result but may not supply machine
facts. Validate strict schemas, cross-bind run/source identities, then generate
the payload manifest last.

## H4 - Stable Stage A Diagnostics

Replace literal timeout prose with values derived from constants. Add stable
internal codes for authority timeout/block/unexpected, outline POST failure, and
media-task timeout/block. Preserve assigned code and reason through catch/finalize.
Parse and compare the full source identity exactly.

Add privacy-safe observations: poll count, elapsed bucket, authority row count,
exact-match count, state class, enable/permission state, resolve response status
class, and stable code. Store no response body, text, Cookie, path, token, or
Provider identity.

## H5 - Quality Diagnostics Without Contract Relaxation

For brief coverage, record only structural facts: eligible claim count, region
coverage sets/counts, tested 2/3-claim combination counts, length buckets, and a
stable reason that no valid subset exists. Keep the frozen 2..3 claim-reference
limit.

For unresolved conflict, record the boolean conflict outcome, bounded repair
attempt count, and stable terminal reason. Do not force the flag false, locally
rewrite content, lower thresholds, expand the request budget, or publish a
rejected result.

## H6 - Retention Lifecycle

Create a machine-readable retention record for the current private roots:
diagnosis-only, never eligible for candidate or blind-review input, named owner,
deadline, and deletion-receipt requirement. Future execution must reject any path
or artifact digest from a spent/negative run.

## H7 - Verification And Exit

Required checks:

1. focused Node mutation/process tests for H1-H4 and H6;
2. focused Python tests for H4-H5;
3. full Runtime tests when production Python changes;
4. complete Stage B offline suite;
5. relay baseline/mutations if any relay-scope byte changes;
6. secret/path/raw-media scan and owned-resource cleanup;
7. zero-action receipt proving no Chrome, Cookie, Provider, download, real BVID,
   blind review, or authorization consumption.

Exit state: `GC-B6H OFFLINE CANDIDATE AWAITING CODEX CHECKPOINT`. It does not
authorize or schedule a visible run.

## Ownership

- ClaudeCode: H1-H7 implementation, focused/full tests, evidence candidate.
- Codex: requirement interpretation, independent false-green review, canonical
  protocol byte freeze, and decision on whether another real candidate is worth
  its cost.
- Human: supplies explicit authorization and private inputs only after Codex GO;
  never signs machine or semantic-review results by proxy.
