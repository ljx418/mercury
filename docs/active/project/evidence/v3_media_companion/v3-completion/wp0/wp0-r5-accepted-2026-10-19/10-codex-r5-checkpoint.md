# WP0 R5 Codex checkpoint

Date: 2026-10-19

Decision: `R5-B PASS / R5 PASS / R6 MAY START`

Severity: Fatal 0 / Major 0 / Minor 1.

This checkpoint accepts the fixed R5B-01..R5B-12 denominator. It does not rewrite the source runner:
`public/result.json` remains `passed=false` because the subsequent `media-transcript-open` navigation did
not create a Playwright-visible canonical Workspace page. The required trusted capture, non-zero PCM,
SenseVoice terminal, durable materialization, source authority, UI terminal state, secret scan and cleanup
had already completed. Workspace navigation is outside the frozen R5-B denominator and is retained as
`m-R5B-01`, not hidden or promoted into an R5-B success claim.

## Acceptance facts

- Fixed source: Bilibili `BV1Bb411w741`, CID `61744125`, p1.
- One fresh owned Runtime, Chrome profile, secure root, task and source-authority record.
- The three automatic acquisition routes failed through production behavior before trusted capture.
- Extension action, one-shot grant and trusted tab capture were user-reachable production paths.
- Offscreen used AudioWorklet and emitted 182 non-zero chunks; Background accepted/sent/ACKed 182/182/182.
- Runtime finalized 195 chunks / 16,636 ms with 255,758 non-zero samples and peak absolute sample 16,532.
- SenseVoice reached terminal and transcript reads returned HTTP 200.
- Visual materialization returned 503; frozen transcript-grounded materialization then returned HTTP 200.
- SQLite contains one degraded revision-6 task, one published source authority, one published outline and a
  monotonic six-event revision sequence. Degraded is valid because visual evidence was unavailable.
- Side Panel observations progressed `awaiting_trusted_capture -> transcribing -> terminal` on the same
  `trusted_tab_capture_asr` route.
- Secret scan: 0 hits. Owned profile and secure temporary root were deleted; the run left no owned process.

## Audio safety exception

The user explicitly authorized one visible positive run without Chromium `--mute-audio` because that flag
zeroed tabCapture PCM on this host. Before the page video was unmuted, an owned-profile Windows Core Audio
watcher identified 16 owned Chrome processes, matched one process audio session and muted 1/1 sessions.
The watcher never changed endpoint/master volume. No audible output was observed. This exception applies
only to this R5 positive proof; R6 browser lifecycle tests remain `--mute-audio` by default.

## Minor

`m-R5B-01`: the runner's post-denominator Workspace-open discovery failed after product publication. The
source result and failure are preserved. R6 does not depend on that navigation check; the issue remains a
later harness/navigation UX observation.

## Gate

R6 may begin only against this exact checkpoint payload, extension build tree and declared production
source closure. Any digest drift returns to R5 candidate qualification. This decision does not authorize R7.
