# WP0 R5-B window 7 handoff

Date: 2026-10-18

## Changed implementation

- `capture/RuntimeCaptureTransport.ts`: `TransportStartBinding` includes `surface`.
- `capture/audioChunk.ts`: Runtime start payload serializes `surface`.
- `capture/MediaCaptureController.ts`: trusted grant surface is passed to the relay owner.
- Relay/controller test fixtures now provide `surface`.
- `RuntimeCaptureTransport.test.ts` asserts the exact serialized Runtime start payload.

## Frozen evidence update

- `v3-media-capture-internal-relay-v10-fixtures.json`: only the changed
  `MediaCaptureController.ts` scope SHA-256 was updated.
- `verify-stage-b-b5-3-background-capture-relay-v10-contract.py`: only the derived
  `sourceInventoryEvidence` digest was updated.
- Source inventory remains 40/40 and target inventory remains 20/20.

## Contract changes

Public: none.

Internal: the already-required frozen `surface` field is now actually transported to Runtime. No new
message variant, failure code, field, threshold, or owner was introduced.

## Next execution

Run one fresh production canary with a fresh owned profile and Runtime. Use the fixed Bilibili source and
the existing secure Cookie injection path. Launch Chrome with `--mute-audio`. Do not use DOM `.click()`,
Controller/materialize/database/store direct calls, fabricated PCM, or an E2E-only tab override. Require
real decoded audio, non-empty local ASR output, terminal projection, cleanup, and secret scan. Stop at the
first material failure and do not retry visibly in the same continuation.
