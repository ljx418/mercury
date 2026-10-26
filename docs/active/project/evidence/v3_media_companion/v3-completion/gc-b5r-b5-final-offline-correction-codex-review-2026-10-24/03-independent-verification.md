# Independent Verification

Date: 2026-10-24

## Submitted package

`sha256sum -c PAYLOAD_MANIFEST.sha256`: exit 0, 13/13 payload files OK.

## Targeted submitted tests

```text
node --test \
  scripts/stage_b_b5_3/test/authorization_composition.node-test.mjs \
  scripts/stage_b_b5_3/test/structured_failure_evidence.node-test.mjs \
  scripts/stage_b_b5_3/test/privacy_scan.node-test.mjs
```

Result: exit 1, 17 passed / 2 failed. Failures:

- second sequencer with the same authorization: the first invocation
  unexpectedly exited 1;
- concurrent sequencers: zero winners instead of exactly one.

The authorization suite alone exits 0 with 9/9. This isolates the failure to
cross-test/process ownership rather than authorization semantics.

## Active negative probes

1. A self-signed grant under an arbitrary filename, with no consumed marker,
   was accepted twice by `verifyChildGrant()`.
2. `detectAbsolutePaths()` returned no findings for `C:/Users/...`, a UNC
   path, and `/tmp`.
3. Source inspection proves the first pre-cleanup finalization writes false
   cleanup booleans and the current generic merge cannot replace them with
   true after cleanup.

All probes used temporary synthetic data. External actions: zero.
