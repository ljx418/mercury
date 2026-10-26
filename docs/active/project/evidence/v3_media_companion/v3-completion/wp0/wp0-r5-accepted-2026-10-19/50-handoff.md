# R5 to R6 handoff

## Coordinate

- R0-R4: accepted.
- R5-A: accepted user path.
- R5-B: accepted 12/12 against one process-audio-isolated positive.
- R5: PASS.
- R6: may start only after the refreshed relay-v11 preimplementation package verifies.
- R7/P1: not entered.

## Candidate binding

R6 must bind to `60-payload-manifest.sha256`, the current production extension build tree and the exact
source closure declared by the R6 matrix. R6-0 recomputes all three values. A mismatch is candidate drift,
not permission to reuse this checkpoint text against a different tree.

## Contract changes

Public: none. Internal: relay v11 unique Offscreen context binding and Windows owned-process audio-isolation
test infrastructure. Relay v10 remains immutable historical evidence.

## R6 boundary

R6 owns the fixed fault matrix and fail-closed recovery behavior only. It must not change public APIs,
Cookie/provider policy, SourceAuthority semantics, ticket TTL, materialization ownership or denominator.
All browser lifecycle negatives use `--mute-audio`; the R5 process-audio exception is not inherited.
