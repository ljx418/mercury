# WP0 R5-B window 7 PRD review

Date: 2026-10-18

Decision: `CORRECTIVE IMPLEMENTATION PASS / USER-PATH ACCEPTANCE PENDING`

## Confirmed

- The capture action is on the main user path and is not hidden inside diagnostic details.
- The action is reachable by a real trusted native pointer click with exact element hit-testing.
- The Browser-to-Runtime binding preserves the grant surface and remains owned by Background.
- Offscreen remains an audio producer and receives no ticket, source identity, or acquisition record.
- Runtime exact-field validation remains fail closed.
- No public endpoint, origin, ticket TTL, Cookie/provider boundary, source authority, or result threshold changed.
- Tests and browser execution were silent; visible Chrome was explicitly launched with `--mute-audio`.

## Not yet confirmed

- A real positive capture containing decoded audio reaches Runtime.
- SenseVoice produces a non-empty transcript from that capture.
- The user sees a terminal task projection and can continue to the media result.
- Positive-path temporary artifacts, capture marker, profile, and owned processes are all removed.

These are mandatory R5-B acceptance facts. They cannot be replaced by unit tests or the failed visible run.
Therefore R5-B is not PASS and R6 implementation remains NO-GO.
