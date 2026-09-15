# V2-PX PX-0.2 Third Major Closure Acceptance Plan

Date: 2026-09-01

## Required Checks

- A passed scenario with one image and one canonical metadata artifact passes.
- A synthetic passed scenario with two correctly paired image/metadata entries
  passes when both metadata objects are independently represented.
- An extra image, extra metadata, missing pair, duplicate metadata scenario,
  reordered image path or cross-scenario metadata path is rejected by
  `PX_RULE_SCREENSHOT_METADATA_MISMATCH` or the corresponding screenshot
  evidence rule.
- Every metadata artifact path resolves, passes its stored raw-byte hash,
  parses as canonical JSON and equals the paired out-of-band metadata object.
- Every paired `screenshotPaths[i]` equals the corresponding metadata
  `imagePath`; route, resolved path, IDs, status and viewport remain aligned.
- Baseline remains exactly 9 schemas, 65 positive instances, one FixtureSuite
  root, 175 fixture validations, 63 rules, 41 semantic rules and 109 negative
  requirements; recomputed G1-G7 are all true.
- Validator output is deterministic across two runs. Focused tests, all
  extension tests, typecheck and production build pass.

## Gate

Local success is not sufficient. PX-0.2 passes only after a fresh independent
read-only audit reports Fatal 0 / Major 0. Any Fatal or Major keeps PX-1 No-Go.
