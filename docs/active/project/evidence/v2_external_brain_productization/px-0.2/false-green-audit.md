# V2-PX PX-0.2 False-Green Audit

Audit date: 2026-09-01

## Audit Position

The validator does not accept the Report's `passed`, gate booleans,
`violations=0`, summary counters or Human Review claim as sufficient evidence.
It recomputes the frozen rules from the positive roots and raw artifact bytes.

## Attack Classes Exercised

- schema-valid but semantically false Report mutations;
- missing, traversing and hash-mismatched artifact paths;
- malformed canonical JSON and PNG dimensions;
- action, route, request, workspace, source and operation identity drift;
- duplicate ingest and invalid tab reuse attempts;
- fabricated Runtime authority while transport is unavailable;
- invalid prior-context recovery and route restoration;
- incomplete or cross-identity durable Forget sequences;
- wrong viewport/surface mapping and inaccessible UX metrics;
- contract-fixture promotion to product evidence;
- G4 tracked-source mutations while the Report still claims zero violations.

All 109 registered attacks produced their frozen schema or semantic primary
failure. Every schema-valid semantic attack also runs all 41 semantic rules;
secondary failure codes must be declared in `allowedWarnings`. A malformed
FixtureSuite root, warning, duplicate requirement, missing requirement or
registry mapping fails closed before any patch executes.

PNG checks decode IDAT data and validate CRC/pixel length instead of trusting
signature/IHDR bytes. G4 checks reparse tracked TypeScript/TSX and HTML module
scripts, normalize loopback endpoint aliases and reject source mutations even
when the Report still claims `violations=0`.

## Determinism

Two independent CLI invocations produced byte-identical summaries. The unit
test additionally compares counts, issue arrays and all 109 case results across
two in-process executions.

## Residual Risks

- Python 3 and `jsonschema` are explicit runtime prerequisites. Missing tooling
  fails closed through a non-zero CLI result.
- The G4 scanner implements the two frozen TypeScript algorithms, not a general
  security scanner. Unsupported algorithms fail closed.
- PX-0.2 uses contract fixtures. Production evidence ingestion and real Chrome
  evidence are PX-5 responsibilities and cannot be inferred from this pass.

## First Independent Findings And Local Closure

The independent worker reproduced the advertised counts but demonstrated that
the current runner can still accept inputs outside the intended frozen
contract:

1. The FixtureSuite root and complete requirement set are not schema-validated;
   malformed fields, warnings, duplicate or missing requirements can escape the
   focused registry mutation test.
2. PNG validation checks signature, chunks and IHDR dimensions but does not
   decode IDAT image data.
3. The G4 TypeScript scan misses normalized variants such as spaced `fetch`,
   `new URL` localhost construction and module-script fetch paths.
4. Computed gates and the embedded SemanticResult are not fully compared and
   the frozen positive Report still points at a virtual implementation marker.

The repaired local candidate addresses all four findings with executable tests:

- FixtureSuite `$defs` validation plus exact RuleId/RequirementId/registry
  matching gates patch execution.
- `pngjs` performs full PNG decode and corrupt/truncated IDAT tests fail.
- focused G4 tests cover spaced calls, `new URL`, element access and inline HTML
  module scripts.
- recomputed gate results, complete semantic failures, fixture warnings,
  positive IDs and actual implementation hash are compared before success.

## Current Local Finding

```text
Fatal: 0
Major: 0
Minor: 0
Disposition: fifth independent re-audit PASS. PX-0.2 contract-fixture tooling
is closed; PX-1 is only Conditional Go for a separately planned workpack.
```

## Second Independent Findings And Local Closure

`independent-reaudit.md` reproduced three Major false-green paths. The bounded
repair adds executable attacks for each one:

- RFC 6902 array operations reject nonnumeric, signed, leading-zero,
  out-of-range and unsafe-integer indices; an invalid PX-N-099 patch causes
  zero fixture case execution.
- deleting a screenshot metadata artifact, or changing its canonical bytes
  while leaving the paired metadata object unchanged, is rejected.
- tracked source containing `fetch.call`, `fetch.apply`, `fetch.bind` or
  `Reflect.apply(fetch, ...)` is rejected after tracked-source hashes are
  recomputed while the Report continues to claim zero violations.

The active acceptance plan drift reported as Minor is also corrected:
PX-0.1b is historical PASS, PX-0.2 is the reopened current gate, and the
Architecture Scan Manifest authority is v2.

## Third Independent Finding

The auditor added a second valid artifact path to a passed scenario's
`screenshotPaths` while leaving only one `screenshotMetadataPath`. The
validator checked only pair zero and returned `passed=true`, `issues=[]` and
G1-G7 all true. This violates the frozen equal-length, index-by-index pairing
rule and is recorded in `independent-reaudit-2.md` as Major 1.

## Third Repair Local Closure

The validator now requires equal non-zero image/metadata path counts and
validates each ordered pair. The focused suite includes a valid same-scenario
two-variant pair plus attacks for an extra image, extra metadata, reordered
images, cross-scenario metadata and duplicate `scenarioId + captureVariantId`
metadata. All attacks fail locally. This does not close the stage gate until an
independent auditor reproduces the result.

## Fourth Independent Finding

The auditor created two valid metadata variants for one scenario but pointed
both at the same image artifact. Cardinality and index checks passed, allowing
one screenshot to count twice. The missing unique-image-path condition is a
Major false-green path and is recorded in `independent-reaudit-3.md`.

## Fourth Repair Local Closure

The validator now rejects repeated image paths and repeated metadata paths
within a scenario before validating ordered pairs. The focused test updates the
second metadata artifact so both variants truthfully point to the same image;
the rule rejects that exact attack. Distinct fixture paths with identical
contract-fixture bytes remain allowed and are not promoted to production
evidence.

## Fifth Independent Result

The independent auditor reran the baseline and all bounded pairing attacks,
including duplicate image and metadata paths. Result: Fatal 0 / Major 0 /
Minor 0. No product or real-Chrome claim was inferred from the fixture pass.
