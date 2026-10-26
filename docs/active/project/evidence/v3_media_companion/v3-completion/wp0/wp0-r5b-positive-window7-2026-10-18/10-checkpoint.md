# WP0 R5-B visible checkpoint, window 7

Date: 2026-10-18

Status: `R5-B PRODUCT CORRECTIVE READY / POSITIVE STILL REQUIRED / R6 IMPLEMENTATION NO-GO`

## Visible run

- Run ID: `r5b-positive-20261018T105643Z`
- Fixed source: `BV1Bb411w741`
- Production build, owned Chrome/Profile/Runtime
- Explicit `--mute-audio`; sound / Provider / visible retry: 0 / 0 / 0
- Native click reached the trusted capture action after exact element hit-testing.
- Capture grant creation returned HTTP 201 and Runtime accepted the WebSocket connection.

## Real failure

The Runtime then closed the WebSocket and the product surfaced
`V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED`. No audio stream, transcript, or terminal media result was
published, so this run is negative evidence and cannot pass R5-B.

Runtime requires an exact capture start field set including `surface`. The extension's
`TransportStartBinding` and serialized Runtime start payload omitted that field. Runtime therefore
rejected the binding with `V3_MEDIA_CAPTURE_BINDING_INVALID`; the extension normalized the close to
`V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED`.

## Corrective result

The extension now carries `surface` from the trusted capture grant through
`MediaCaptureController` into `RuntimeCaptureTransport` and the exact Runtime start payload. A new
test asserts the complete serialized field set, including `surface`, rather than only checking TypeScript
types.

The required scope digest was refrozen without changing the source/target FailureCode inventories,
schema, limits, public API, or security ownership. Baseline and mutation verifiers returned to
50/50 and 15/15.

## Next gate

One fresh, visible, muted production canary must prove the complete user path from trusted click through
audio capture, Runtime handoff, local ASR, terminal projection, cleanup, and zero secret leakage. It must
be the only visible run in that continuation. R6 remains blocked until that run passes.
