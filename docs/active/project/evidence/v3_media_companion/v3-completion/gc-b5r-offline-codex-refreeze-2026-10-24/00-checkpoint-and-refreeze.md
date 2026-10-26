# GC-B5R offline Codex checkpoint and limited relay-v11 refreeze

Date: 2026-10-24

Decision: **GC-B5R OFFLINE PASS / B-5 REAL RUN INPUT-BLOCKED**

## Checkpoint result

The corrective candidate closes M-GCB5R-01..03 and the three prior Minor
findings. Codex found no remaining Fatal or Major in the authorized offline
scope.

Independent replay:

| Check | Result |
|---|---|
| corrective authority + existing GC-B5R/comprehension tests | 64/64, exit 0 |
| exact preflight and Provider-lock tests | 31/31, exit 0 |
| deterministic offline runner, serial phase | 7/7, exit 0 |
| deterministic offline runner, concurrent phase | 209/209, exit 0 |
| real Chrome/cookie/Runtime canary | external_not_run, not counted as pass |
| corrective evidence manifest | 21/21 OK |

The candidate-reported full Runtime result remains 1175 passed / 3 skipped;
Codex did not repeat that already successful full suite.

## Limited refreeze

The implementation stabilized with exactly one authorized source-scope drift:
`services/local-runtime/navia_runtime/app.py` changed from
`d7d2c438...` to
`afbf76a0d3a7e11186b5a9257fb1108254972148bd37bb179754a2750bde23c1`
to wire the real input authority, local-import store, acquisition coordinator
and dependency-manager generation resolver.

Codex changed only:

1. the `app.py` source SHA-256 in
   `docs/active/project/fixtures/v3-media-capture-internal-relay-v11-fixtures.json`;
2. the verifier's canonical `sourceInventoryEvidence` digest, from
   `311d8687...` to
   `f67e59ecf608d4ba035eeea84fd5b25b3fa3cb02a4deddf93d559f49ecfd1126`.

No scope, extractor, source/target inventory, FailureCode, schema, threshold,
message set, public API declaration, registry, historical evidence or verifier
logic changed.

Post-refreeze results:

| Gate | Result |
|---|---|
| relay v11 baseline | 50/50, exit 0 |
| source inventory | 40/40 |
| target inventory | 20/20 |
| unlistedBoundaryEmits | `{}` |
| relay v11 mutations | 16/16, exit 0 |

Frozen artifact hashes after the limited refreeze:

| Artifact | SHA-256 |
|---|---|
| relay-v11 fixture | `1eddd4989ee1ef513eba7166a9a6d9e3d209605d82a504781dc47fe8e3fbd763` |
| relay-v11 verifier | `04b61dbc9188496d79bff765aeca557ecea39e27de7a41b39a0e6ff7aeb340d5` |

Historical candidate and failure evidence remains unchanged.

## Residual Minors

Fatal 0 / Major 0 / Minor 4.

1. A ready dependency generation remains bounded by the frozen dependency
   catalog and installed content.
2. Fresh-process behavior is exercised with a newly constructed manager over
   the same durable files rather than an OS child process.
3. PH0-AR-10 uses the stub runner's readiness marker as its deterministic
   signal; this remains an offline process-lifecycle oracle.
4. The optional manifest `mediaId` property is rejected when present and
   mismatched, but absence is accepted. This is non-blocking because the exact
   required `sourceIdentity` independently contains and validates the same
   frozen BVID. Before a future manifest schema freezes `mediaId` as required,
   the redundant field should either become mandatory or be removed.

## External-action counts

Chrome 0; visible windows 0; Runtime media runs 0; Provider calls 0; downloads
0; imports 0; real BVID products 0; cookie injection 0; audio output 0;
six-video runs 0; BVID substitutions 0.

No commit, push, reset, clean, checkout or revert was performed.

