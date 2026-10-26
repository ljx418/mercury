# Stage B B-1..B-4 implementation exit candidate

Date: 2026-10-13. Decision: **B-1..B-4 LIMITED PASS candidate**. This is not
Stage B exit and does not override the B-5 risk stop.

## Implemented

- `EvidenceSpanAnalyzer`: deterministic opening/middle/ending availability,
  ending coverage, rolling 20% start concentration and longest chapter ratio.
- `GroundedComprehensionValidator`: 20-100 character non-transcript brief,
  2-8 evidence-closed claims, 2-12 contiguous chapters, stable failure codes,
  limitation status and zero raw-disclosure receipt counters.
- Provider V2 path: derived text only; no chunk-summary fallback; temporal and
  whole-contract regeneration remain provider operations rather than local
  rewriting.
- Private V2 persistence at the frozen task/revision/catalog-hash path, mode
  `0600`, sibling temporary file plus atomic replace, current-authority and
  current-hash check before commit.
- Historical V1 files/readers remain unchanged and readable.
- Existing API projection adds V2 brief/claims/regions and visible quality status.
- Overview renders the brief, claim-to-evidence links and an explicit limited
  state; transcript remains collapsed inspection material.

## Verification

| Check | Result |
|---|---|
| V2 quality + comprehension focused backend | 29 passed |
| Wider Runtime media regression | 58 passed |
| Workspace shell component suite | 15 passed |
| TypeScript typecheck | PASS |
| Production extension build | PASS |
| Python compile / Node syntax / diff check | PASS |
| Full frontend Vitest, 1 worker, 240 seconds | TIMEOUT with continuing progress and no reported assertion failure; not counted PASS |

The component process from the focused run was closed. No Runtime, Chrome or
temporary Stage B directory remained after real-run attempts.

## PRD review

B-1..B-4 implement the frozen user-visible mapping without expanding consent,
routes, raw-media upload or historical migration. Machine closure is stronger
than V1 and correctly rejects model output that violates the frozen brief or
chapter contract. Semantic quality remains unproven until B-5/B-6.

## Residual risks

- The real MiniMax-M3 provider repeatedly failed the frozen V2 output contract.
- Full frontend suite did not finish within 240 seconds; focused changed-surface
  tests, typecheck and build passed, but this is still a test-completeness Minor.
- Media duration is currently derived from the published evidence span because
  the task projection does not expose a separate authoritative duration field.
  B-5 cannot claim independent 90% source coverage until that source is frozen.

