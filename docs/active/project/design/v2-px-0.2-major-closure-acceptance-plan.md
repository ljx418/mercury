# V2-PX PX-0.2 Major Closure Acceptance Plan

Plan date: 2026-09-01

## Required Checks

| Finding | Exit threshold |
|---|---|
| FixtureSuite closure | Root schema-valid; exact 63/41/109 sets; unexpected field, unknown warning, duplicate and missing requirement all fail |
| PNG decode | All 29 images decode; corrupt IDAT, truncated stream and dimension mismatch fail |
| G4 | Existing PX-N-104..109 plus `fetch (new URL(...))`, member-call, concatenated endpoint and HTML module-script bypasses fail while reported violations remain zero |
| SemanticResult | Actual validator path/hash is present; exact coverage sets and hashes match; recomputed G1-G7 equals reported gates; virtual implementation marker cannot pass PX-0.2 evidence |
| Determinism | Two complete runs produce identical counts, findings and artifact hashes |
| Regression | Targeted tests, full extension tests, typecheck and production build exit 0 |

## Required Commands

```text
npm --prefix apps/chrome-extension run validate:v2-external-brain-productization -- --contract-fixtures
npm --prefix apps/chrome-extension test -- validate-v2-external-brain-productization-report.test.mjs
npm --prefix apps/chrome-extension test
npm --prefix apps/chrome-extension run typecheck
npm --prefix apps/chrome-extension run build
```

## Audit Requirements

- Update `acceptance.md`, `prd-review.md` and `false-green-audit.md` with the
  repair result and raw command evidence.
- Preserve the first independent failure in `independent-audit.md`.
- Add a separate re-audit record; do not overwrite prior findings.
- PX-1 becomes Conditional Go only if the re-audit reports Fatal 0 / Major 0.

