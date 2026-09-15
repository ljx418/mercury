# V2-PX PX-0.2 Fourth Major Closure Acceptance Plan

Date: 2026-09-01

## Required Checks

- Baseline one-pair and valid two-pair scenarios pass.
- Two metadata variants sharing one `imagePath` fail.
- Repeating one metadata artifact path fails.
- Distinct image paths may share identical fixture bytes only in the
  contract-fixture evidence class; path identity, metadata identity and pair
  ordering must still remain distinct. Production byte uniqueness is deferred
  to PX-5 real evidence policy and is not claimed here.
- Existing unequal cardinality, reordering, cross-scenario, duplicate variant,
  missing artifact and hash mismatch attacks continue to fail.
- Baseline remains 9 schemas, 65 positive instances, one FixtureSuite root,
  175 fixture validations, 63 rules, 41 semantic rules and 109 requirements;
  G1-G7 remain true.
- Validator output is deterministic across two runs. Focused tests, all
  extension tests, typecheck and production build pass.

## Gate

Local success is not sufficient. PX-0.2 passes only after a fresh independent
read-only audit reports Fatal 0 / Major 0. Any Fatal or Major keeps PX-1 No-Go.
