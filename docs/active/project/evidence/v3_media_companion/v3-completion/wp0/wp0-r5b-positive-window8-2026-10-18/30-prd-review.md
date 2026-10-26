# WP0 R5-B window 8 PRD review

Date: 2026-10-18

Decision: `CORRECTIVE IMPLEMENTATION PASS / END-TO-END ACCEPTANCE PENDING`

## Alignment

- The user still performs one visible trusted capture action; no extra permission or connection step was added.
- Background remains the sole Runtime WebSocket and security-validation owner.
- Offscreen remains a constrained PCM producer and receives no ticket, source identity, or acquisition ID.
- Readiness is now fail closed on both document liveness and validated Port ownership.
- All Chrome activity was muted and limited to one owned visible run.
- The public API, grant TTL, Origin policy, Cookie boundary, fixed BVID, model, and acceptance denominator remain unchanged.

## Still unproven

- PCM chunk/ACK flow and 15-second captured duration.
- Non-empty SenseVoice timestamped transcript.
- Acquisition success preceding product materialization.
- Ready/degraded terminal projection, revision/fence consistency, and UI leaving busy state.
- Positive-path capture marker, Offscreen, socket, artifact, profile, Runtime, and scratch cleanup.

R5-B and R5 cannot be declared PASS from this negative canary. R6 implementation remains NO-GO.
