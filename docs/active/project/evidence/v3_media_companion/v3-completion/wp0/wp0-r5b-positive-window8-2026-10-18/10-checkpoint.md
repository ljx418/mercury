# WP0 R5-B visible checkpoint, window 8

Date: 2026-10-18

Status: `R5-B SECOND PRODUCT CORRECTIVE READY / POSITIVE STILL REQUIRED / R6 IMPLEMENTATION NO-GO`

## Single visible run

- Run ID: `r5b-positive-20261018T191300Z`
- Source: `BV1Bb411w741`
- Fresh owned production Chrome/Profile/Runtime
- Chrome used explicit `--mute-audio`; sound / Provider / visible retry: 0 / 0 / 0
- The trusted action, three-route fallback, real playback, decoded audio presence, capture grant, and
  Runtime WebSocket acceptance were observed.

The run stopped at the first material failure with
`V3_MEDIA_CAPTURE_PORT_DISCONNECTED`. It did not retry visibly.

## Root cause

`ensureOffscreenDocument()` treated a successful Offscreen `ping` as producer readiness. The document
can answer that stateless ping while `OffscreenAudioPort.accept()` is still awaiting the asynchronous
`chrome.runtime.getContexts()` sender security check. The Controller then called `sendStart()` before the
validated Background-owned Port was bound.

This was a production composition race. Class-level tests previously awaited `accept()` directly and
therefore could not reproduce the false-ready interval.

## Correction

Production now accepts Offscreen readiness only when both conditions hold:

1. the document answers the existing stateless `ping`; and
2. `offscreenAudioPort.connected` proves sender validation completed and the Background owner bound the Port.

No sender rule was relaxed, no protocol message was added, and Offscreen still owns no Runtime connection.

## Next gate

One later execution window must run one fresh visible muted canary. It must prove non-empty PCM through
the validated Port, at least 15 seconds of capture, SenseVoice transcript, terminal projection, and cleanup.
R6 remains blocked until that positive evidence exists.
