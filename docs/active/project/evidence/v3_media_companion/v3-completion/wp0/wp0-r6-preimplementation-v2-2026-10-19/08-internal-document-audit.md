# R6 preimplementation internal document audit

Date: 2026-10-19

Decision: `DOCUMENT PASS / R5 PASS / R6 MAY START / IMPLEMENTATION NOT STARTED`

Severity: Fatal 0 / Major 0 / Minor 0.

## Scope

- accepted R5 checkpoint and its independent 12/12 machine verifier;
- relay v11 schema, fixture, 50/50 baseline and 16/16 mutation authority;
- R6 target architecture, 65-case denominator, owner registry, candidate binding, risks and handoff goal;
- current worktree anchors referenced by the production-owner registry.

## Migration review

The 2026-10-18 package was sound planning but stale in two material ways: it targeted relay v10 and still
blocked on R5-B. This immutable v2 package closes both without editing the old package:

1. all 30 relay and 8 owner-manifest fixture IDs now bind to `RLY11`/`OM11` and current v11 hashes;
2. the v11 authoritative-context rule at RLY11-N05 replaces the old document-only mutation;
3. horizontal gates require v11 50/50 and 16/16;
4. the accepted R5 payload, 99-file extension build and 23-file production closure are pinned;
5. the closure includes the capture worklet and process-audio-isolation implementation used by R5;
6. R6 Chrome negatives remain explicitly `--mute-audio`; the R5 exception is not generalized;
7. the fixed denominator remains 65 = 30 + 8 + 7 + 6 + 14 and every behavior remains fresh.

## Architecture and PRD conclusion

R6 remains a fault/recovery workpack, not a relay rewrite. Background is the sole Runtime WebSocket owner;
Offscreen is a bounded PCM producer; durable handoff is not product success; restart never resumes old
PCM/ticket/sequence; failure must settle once and clean its owner. No Chat/Know, provider, Cookie, public
Runtime API, ticket TTL, SourceAuthority or materialization policy is expanded.

The package is complete enough for ClaudeCode implementation. It does not prove any R6 behavior and does
not authorize R7. ClaudeCode must stop at `R6 AWAITING CODEX CHECKPOINT`.

Final mechanical results: package verifier 39/39 PASS; semantic mutation suite 10/10 PASS; relay v11
baseline 50/50 PASS; relay v11 mutation suite 16/16 PASS.
