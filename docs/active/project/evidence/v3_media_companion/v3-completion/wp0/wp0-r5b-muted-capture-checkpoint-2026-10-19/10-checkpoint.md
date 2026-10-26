# WP0 R5-B muted capture checkpoint

Date: 2026-10-19

Decision: `R5-B NO-GO / R6 IMPLEMENTATION NO-GO`

Fatal 0 / Major 1 / Minor 0.

The trusted user path, relay v11 ownership boundary and real binary transport are working. The remaining
Major is an acceptance-environment conflict: every automated real-Chrome command must include
`--mute-audio`, while both Chrome for Testing 137 and installed Chrome 155 expose an all-zero tabCapture
audio stream under that switch. The Runtime correctly rejects the stream as
`V3_MEDIA_CAPTURE_EMPTY`; no transcript, acquisition success or product materialization was fabricated.

This checkpoint does not authorize R6. The existing R6 package remains planning-only until a same-candidate
positive proves non-zero real PCM, SenseVoice output and durable materialization.

## Proven facts

- fixed source: `BV1Bb411w741`, CID `61744125`, p1;
- trusted extension invocation and one-shot capture grant succeeded;
- Offscreen used AudioWorklet and had a live, non-muted track and running AudioContext;
- Background accepted, sent and received Runtime ACK for 188 chunks / 513240 bytes / 15980 ms in window 31;
- Runtime accepted the WebSocket and valid completed stop command;
- Worklet input metrics were exactly peak `0` and non-zero sample count `0` in windows 33-35;
- Chrome 137 and Chrome 155 reproduced the same zero-input result with explicit `--mute-audio`;
- secret scan and owned-process/profile/task-root cleanup passed in every run.

## Explicitly not proven

- non-zero PCM accepted by the Runtime sink;
- SenseVoice timestamped transcript;
- acquisition success before product materialization;
- same-task durable product terminal and UI busy-state exit.

