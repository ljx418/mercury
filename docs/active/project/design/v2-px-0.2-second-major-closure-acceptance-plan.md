# V2-PX PX-0.2 Second Major Closure Acceptance Plan

Date: 2026-09-01

## Required Checks

- Invalid RFC 6902 array add indices, including non-numeric, negative,
  leading-zero and greater-than-length values, fail closed. Valid `-`, `0` and
  `length` add operations remain supported. Remove and replace require an
  existing canonical array index.
- Removing or corrupting a `screenshotMetadataPaths` artifact fails even when
  the out-of-band Screenshot Metadata object is unchanged. Parsed canonical
  metadata must equal the paired object and Report route/ID/status/viewport.
- `fetch.call`, statically representable `fetch.apply`, and `fetch.bind`
  endpoint paths are rejected after tracked-source hashes are recomputed while
  Report `violations=0` remains unchanged. The same scanner handles inline HTML
  module scripts.
- Baseline remains exactly 9 schemas, 65 positive instances, one FixtureSuite
  root, 175 fixture validations, 63 rules, 41 semantic rules and 109 negative
  requirements; recomputed G1-G7 are all true.
- Focused tests, all extension tests, typecheck and production build pass.

## Gate

Local success is not sufficient. PX-0.2 passes only after a fresh independent
read-only audit reports Fatal 0 / Major 0. Any Fatal or Major keeps PX-1 No-Go.
