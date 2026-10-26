# Stage B route 2 implementation exit candidate

Date: 2026-10-14. Decision: **Route 2 implementation LIMITED PASS; B-5 remains FAIL / REPLAN.**

## Implemented scope

- `quality.py` now validates the non-brief contract before selecting an ordered
  subset of two or three provider claims. Selection is deterministic, covers
  every substantive source region, adds no words, never truncates and rejects
  raw transcript excerpts.
- `service.py` keeps the bounded sequence: initial provider candidate, exactly
  one full-contract repair, then composer only for
  `V3510B_BRIEF_LENGTH_INVALID` or `V3510B_BRIEF_RAW_PREFIX`. A complete
  validation and current revision/catalog authority check still precede an
  atomic V2.1 write.
- V2.1 writes are isolated under `grounded-comprehension-v2.1`; reads prefer an
  exact-binding V2.1 artifact and retain V2/V1 compatibility.
- Workspace discloses `provider` versus `deterministic_claim_composer` and the
  number of source claims. Quality status remains validator-owned.
- The real-run harness reads the actual `product-evidence` root, accepts V2.1
  and V2, and compares the UI origin marker with the derivative.

## Automated verification

- Runtime focused Route 2 tests: 35 passed.
- Runtime media regression: 105 passed.
- Workspace component regression: 15 passed; the expanded media selection was
  16 passed across two executed files.
- TypeScript typecheck: PASS.
- WXT production build: PASS.
- Route 2 schema meta-validation and document fixtures: PASS (2 positive,
  N01/N07 schema negatives, N01..N10 registry complete).
- Every browser launched by the real runner included `--mute-audio`.

Covered implementation negatives include invalid subsets, raw transcript
claims, overlong joins, non-brief failures, one-repair cap, prior-byte
preservation and revision/catalog change before commit. No threshold was
reduced and no raw media, frame bytes, Cookie, API key or local path was added
to grounded-text cloud payloads.

## Real-source attempts

All attempts used a fresh temporary Runtime database, private roots, Chrome
profile and task, and all temporary roots were deleted on exit.

1. `20261014T053054970Z`: provider responses never produced a parseable
   contract object; Runtime returned 502 and wrote no derivative.
2. `20261014T053516101Z`: Runtime and Workspace reached grounded-model
   publication, but the harness still searched the pre-V2.1 parent directory
   and reported zero derivatives. The private run was then destroyed, so this
   is diagnostic evidence only and cannot be promoted to an accepted run.
3. `20261014T054026046Z`: the provider's bounded repair returned an invalid
   claim count. Runtime rejected it with `Claim count is invalid`; no V2.1
   artifact was published.

## Boundary

Route 2 implementation is complete within its authorization. It does not make
arbitrary malformed provider output acceptable. B-5 cannot pass until a new
documented route addresses provider contract stability without inventing
claims, lowering the 2-8 denominator or adding unbounded retries.

