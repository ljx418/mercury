# R5-B relay v11 visible positive receipt

## Decision

`R5-B VISIBLE POSITIVE NO-GO / RUNNER FINISH-ACTION FALSE NEGATIVE CORRECTED OFFLINE`

Run ID: `r5b-positive-v11-20261018T141723Z`

This was the single visible attempt authorized for the batch. It used an owned Chrome/Profile/PID, the production
extension build, explicit `--mute-audio`, fixed BVID `BV1Bb411w741` and the authorized local Cookie file. No same-
batch visible retry was performed.

## Proven real facts

- primary start action accepted;
- all three acquisition routes reached the expected real failure boundary;
- decoded page audio and continued playback were observed;
- trusted capture start succeeded;
- Runtime issued the capture grant and accepted `/v1/media/capture-stream` WebSocket;
- relay v11 did not reproduce Window 11 `document_id_missing`;
- secret scan passed with zero credential-value hits;
- owned profile and secure task root were deleted.

## Failed gate

After 15 seconds of capture, the runner recorded a screen-coordinate click on `media-capture-finish`, but Runtime
received no stop/transcription request and the UI remained `capturing`. The runner failed with:

`expected visible transcribing state, received capturing`

No transcript, terminal acquisition or durable product result was claimed.

## Cleanup

The runner `finally` path stopped its Runtime, closed its owned Chrome, deleted its owned profile and removed its
secure media root. A post-run process/port check found no surviving owned Navia process or listening test port.
The unrelated pre-existing `.tmp/navia-t01-profile-linuxdebug1` directory was not touched.

