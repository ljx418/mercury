# GC-B5R B-5 Final Offline Correction: Codex Review

Date: 2026-10-24

Decision: **REJECTED - RUNNER CLOSURE CORRECTION MAY START**

FC4 and FC5 are substantially implemented. FC1-FC3 and the evidence boundary
still contain production defects, so the visible six-video run is not
authorized.

## Major findings

### M1 - a self-signed child grant bypasses the one-shot authorization

`verifyChildGrant()` validates the digest stored inside the grant, but it does
not recompute and compare the expected grant id, require a matching consumed
authorization marker, compare the `--authorization-digest` supplied by the
sequencer, or consume the child grant. A caller with a writable stage root can
create an arbitrary self-signed grant without ever consuming an authorization.
The same grant can then be replayed.

Codex reproduced this with a temporary stage root: a grant using an arbitrary
authorization digest and arbitrary filename returned `ok:true` twice.

References: `lib/authorization.mjs:168-213`,
`run_one_bvid.mjs:729-750`. The existing tamper tests mutate a legitimate
grant without recomputing its digest and therefore do not cover forgery.

### M2 - the finalizer permanently preserves pre-cleanup false values

The runner finalizes once before cleanup and again after cleanup. The generic
merge only fills null fields and never replaces an existing primitive. Thus
`cleanup.runtimeScratchDeleted=false` and `profileRootDeleted=false` written by
the first finalization cannot become true after successful cleanup.

The sequencer explicitly rejects `cleanupComplete === false`, so a real source
can be cleaned correctly and still fail the aggregate audit.

References: `run_one_bvid.mjs:235-350`, `1450-1489` and
`lib/aggregate.mjs:255-276`. The fresh-process test checks failure-code
retention but not cleanup false-to-true convergence.

### M3 - Provider action accounting counts synthesize endpoints, not outbound requests

The runner appends exactly one `providerCall` immediately before the Runtime
synthesize endpoint. The Runtime adapter may issue up to eight outbound
Provider HTTP requests for extraction, retries, regeneration, and repair.
Success receipts already expose `requestCount`; failure diagnostics expose
repair/request counts, but the stage ledger ignores them. Consequently the
ledger undercounts both successful and rejected cloud actions.

References: `run_one_bvid.mjs:1254-1258`, `1390-1397` and the adapter request
cap. The current FC3 test only asserts one Runtime endpoint attempt.

### M4 - process ownership audit is global and causes real cross-run false failures

The sequencer process audit matches every `run_one_bvid.mjs` process rather
than only PIDs owned by the current sequencer. Codex ran the three submitted
target suites together and got 17/19: the second-sequencer and concurrent-race
tests failed because another test's owned runner was classified as this run's
leak. The authorization test passes alone, demonstrating an isolation defect,
not a deterministic product oracle.

### M5 - generated test copies leak local paths and are absent from the payload inventory

`test/_fixtures/sequencer_alt.mjs` and `sequencer_grant_alt.mjs` remain in the
repository after testing and contain hard-coded `/mnt/c/workSpace/navia`
imports. They are not listed in `01-changed-file-hashes.json`, while the
submitted source scan claims to cover the changed source set. This invalidates
the changed-file and cleanup claims.

### M6 - absolute-path detection is not generic

The detector misses Windows forward-slash paths (`C:/Users/...`), UNC paths,
and one-segment POSIX absolute paths such as `/tmp`. Codex reproduced all
three as empty detections. The evidence gate can therefore publish private
paths while claiming zero findings.

## Minor findings

- `action_ledger.mjs` still exports the superseded raw-authorization,
  read-then-append implementation and persists raw authorization ids. It is
  dead on the current sequencer path but contradicts the single-owner model.
- `--authorization-digest` is passed to children but never consumed by the
  production runner.

## Confirmed positive work

- Submitted evidence manifest verifies.
- Candidate nested-shape enforcement now covers every claim/chapter and the
  boolean conflict flag.
- Initial and repair paths use shared shape/temporal enforcement.
- Provider request guards are present in both lowest send paths and share the
  adapter request counter.
- No external action was performed by this Codex review.
