# WP0 R5-B visible checkpoint, window 9

Date: 2026-10-18

Status: `R5-B THIRD PRODUCT CORRECTIVE READY / POSITIVE STILL REQUIRED / R6 IMPLEMENTATION NO-GO`

## Single visible run

- Run ID: `r5b-positive-20261018T192100Z`
- Source: `BV1Bb411w741`
- Fresh owned production Chrome/Profile/Runtime, explicit `--mute-audio`
- Sound / Provider / visible retry: 0 / 0 / 0
- Trusted action, three-route fallback, playback, decoded audio presence, and grant creation were observed.

The run stopped at `V3_MEDIA_CAPTURE_PREPARE_FAILED` with the fixed private diagnostic
`offscreen document did not become ready`. No capture WebSocket was opened in this run.

## Root cause and correction

The previous readiness barrier exposed a second Chrome lifecycle race. A newly-created Offscreen document
can connect its Port before `chrome.runtime.getContexts({documentIds})` indexes that document. The first
lookup returns an empty array; the old implementation treated that transient absence as permanent sender
forgery, disconnected the Port, and the producer did not reconnect.

`OffscreenAudioPort.accept()` now retries only the empty-context condition within the existing bounded
1.5-second prepare window. Static sender facts must already match. A non-empty context mismatch is rejected
immediately, and exhaustion still disconnects and emits the frozen fail-closed code.

## Next gate

A later execution window must perform one fresh visible muted canary. R5-B remains unpassed until the real
Port carries PCM for at least 15 seconds through Runtime and SenseVoice to a terminal projection with full
cleanup.
