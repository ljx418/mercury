# GC-B5R B-5 Artifact Integrity Codex Review

Status: `GC-B5R B-5 AGGREGATE INTEGRITY CORRECTION NO-GO`

Date: 2026-10-24

## Decision

CI1 is accepted. The sequencer now attributes process sightings to the owning
source, retains a sighting after the process exits, stops at the first owned
leak, and only terminates descendants owned by the current sequencer.

CI2 is not closed. The aggregate can still accept a six-source positive result
without independently proving that any published V2.1 derivative exists.
It can also accept a complete publication whose mirror has the wrong schema
and whose reported Provider HTTP request count is zero.

This violates the B-5 machine exit requirement in
`v3-post-wp-b-completion-rebaseline.md` section 3.2: every successful task must
have an independent V2.1 artifact and durable receipt.

## Major 1: no artifact-byte oracle

The following facts combine into a false green:

- `REQUIRED_SOURCE_EVIDENCE` does not include a derivative artifact.
- The real runner writes the derivative under the literal filename
  `<bvid>-evidence.json`, but the aggregate never reads it.
- The positive contract-shaped stub writes no derivative artifact.
- The aggregate only checks that three declared hashes look like SHA-256 and
  that two declared derivative hashes agree. It never hashes artifact bytes.
- `receiptSha256` is format-checked but is not recomputed from the durable
  receipt representation.

Therefore two mutually consistent JSON claims are accepted as publication
evidence even when no published derivative exists.

Required correction:

1. Give every complete source a deterministic derivative evidence filename.
2. Require and parse that artifact for `complete` rows.
3. Validate the artifact against the frozen V2.1 schema using the production
   validator or an exact shared validator, not a reduced runner-only shape.
4. Hash the exact artifact bytes and compare the result with every declared
   derivative/evidence hash.
5. Recompute the receipt hash with the same canonical serialization used by
   production and compare it with the machine receipt.
6. Cross-bind artifact, receipt, task, revision, source identity, run, locked
   Provider, and endpoint wherever those fields exist in the frozen contract.
7. Make positive stubs emit real contract-shaped artifact bytes and derive all
   hashes from those bytes. Hard-coded repeated hex strings are not evidence.

Required negative cases: missing artifact, malformed JSON, wrong schema,
tampered bytes, derivative hash mismatch, receipt hash mismatch, embedded
receipt mismatch, foreign task/source/run, and stale artifact reuse.

## Major 2: zero requests and malformed mirror can pass

`frozenReceiptDefects()` accepts `requestCount === 0`. The per-row accounting
rejects unknown request counts after synthesis but does not reject zero. If the
machine receipt, mirror, and ledger all report zero, a `complete` source passes.

The mirror parser also does not require
`schemaVersion === v3-5.10-b5-3-receipt-mirror/v2`. Its locked selection fields
are optional rather than required. A locally reproduced six-row aggregate with
`attemptCount: 1`, `requestCount: 0`, zero `providerCall` ledger total, and
`schemaVersion: wrong-schema-still-accepted` returned `positive: true` with no
failures.

Required correction:

1. A complete publication must have an integer `requestCount >= 1`.
2. Any row with `attemptCount > 0` must have an integer `requestCount >= 1`.
3. Ledger totals must continue to equal the exact per-source sums.
4. Require the exact mirror schema version and exact required wrapper shape.
5. Require, rather than conditionally inspect, the locked Provider, endpoint,
   provider lock, and derived-text scope fields.
6. Add a negative case where both ledger and receipts consistently claim zero,
   plus wrong-schema and missing-wrapper-field cases.

## Verification Performed

- Evidence manifest: all 11 listed payloads verified.
- Changed-file inventory: all 50 current-file hashes and byte sizes matched.
- Focused Node suites: 56/56 passed.
- Full offline suite: 317/317 passed, exit 0.
- Independent aggregate construction reproduced the false positive described
  above.
- Chrome, Runtime media work, Provider calls, Cookie reads, downloads, and
  visible actions: 0.

## Gate

Do not rerun the six-video visible batch. Do not consume a new authorization.
The next implementation batch is the bounded artifact-integrity correction in
`01-claudecode-goal.md`.

