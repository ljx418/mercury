# WP0 R5-B low-disturbance checkpoint

Date: 2026-10-18

Status: `R5-B CORRECTIVE READY / VISIBLE POSITIVE STILL REQUIRED / R6 NO-GO`

## Decision

The R5-B production relay positive has not passed. Two fresh owned-browser attempts stopped before
capture and transcription, so neither attempt is acceptance evidence. Both exposed test-infrastructure
problems in the trusted-input path and were followed by targeted corrections.

No R6 implementation is authorized by this checkpoint.

## Corrective facts

1. The first attempt used a CDP click for the optional Cookie permission request. Chrome did not treat
   it as a trusted user gesture, so no native permission prompt appeared.
2. The enable action now uses a native pointer click restricted by owned Profile, exact Chrome main PID,
   exact allowlisted button name, control type and unique match.
3. The second attempt found the exact enable control but the helper stopped while it was still in a
   disabled/offscreen transition state.
4. The helper now waits up to 20 seconds for a unique, visible, enabled control with a non-empty bounding
   rectangle. Timeout output is diagnostic only and contains no credential value.
5. Enable, capture-start, capture-finish and capture-cancel are the only allowlisted native controls.

## Gate

One fresh visible, muted, owned-browser run remains necessary because Chrome user activation and
`tabCapture` cannot be proven by unit tests or CDP-only input. It must be scheduled as one consolidated
user-disturbance window after all headless gates are green.

