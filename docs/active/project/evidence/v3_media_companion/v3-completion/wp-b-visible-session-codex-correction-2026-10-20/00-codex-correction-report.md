# WP-B visible-session Codex correction

Status: `WP-B VISIBLE PRODUCT-SEAM IMPLEMENTATION MAY START`

This checkpoint does not pass B27, B29, B30 or WP-B. It does not authorize a
visible run. The single approved visible opportunity remains unused.

## Corrections completed by Codex

- Removed the runner TDZ failure and the guessed all-`a` extension id.
- Made the startup order executable: load the owned extension, obtain its exact
  id, configure/start the owned Runtime with that id, create a real companion
  session, read the product dependency snapshot, qualify/generate assets, then
  construct the Side Panel adapter.
- Added production-entry composition tests for success and injected failure;
  both prove Chrome/Runtime cleanup and stable redacted evidence.
- Fixed the Runtime/Chrome process-adapter contract and changed Windows Chrome
  cleanup to the owned profile marker rather than a WSL proxy pid.
- Registered transient paths automatically, rejected stable evidence under the
  owned root, and removed the owned root in failure paths.
- Requalified each generated asset with real ffprobe facts, SenseVoice and
  distinct frame hashes instead of copying the seed's qualification.
- Tightened B29/B30: only `ready` is success; progress must have multiple
  samples and end at the exact byte length; streaming, one PUT, one cleanup,
  strict ids and a readable PNG are required.
- Moved the B27 abort observation after the identity transition.
- Removed fabricated cleanup/residue values. Missing passive diagnostics now
  fail with `PRODUCT-SEAM BLOCK`.
- Runtime RSS is read from the owned Runtime process; Extension heap remains a
  CDP measurement. They are no longer the same fabricated value.

## Verification

- `node --check` for runner, orchestration and real adapters: exit 0.
- `npm run test:wp-b-visible-session`: exit 0, 35/35.
- default offline runner: exit 0, `launched:false`, `generatedAssets:0`.
- static false-green scan: no guessed id, fake cleanup/residue, duplicated heap
  as RSS, nonexistent `adapters.chrome.launch`, or old asset lookup.
- owned Runtime/Chrome processes after verification: 0.

No Chrome was launched, no window was opened, no audio was played and no large
asset was generated.

## Remaining implementation gate

The real Side Panel currently has no passive, sanitized E2E observation for
XHR progress/abort, session generation, writer slice, cleanup ownership and
owned residue. The harness also has no deterministic public user-flow driver
that reaches the last-resort local-import card, resets the product context
between B27/B29/B30, or performs the required keyboard/hit-test/peak-resource
oracles. The current adapter therefore blocks honestly instead of fabricating
values.

ClaudeCode may implement only that product/E2E seam and its offline tests. It
must stop for Codex dry review without running Chrome or generating registered
assets.
