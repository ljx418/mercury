# WP0 R5-B next-window handoff

Run one fresh visible muted production canary in a new low-disturbance window and stop at its first independent
failure. Do not perform exploratory visible retries.

The native driver now closes five observed failure classes:

1. outer process timeout exceeds inner UIAutomation wait;
2. exact-name first control establishes same-session calibration;
3. dynamic controls use fresh CDP geometry rather than UIAutomation discovery;
4. all compared coordinates use Per-Monitor-V2 physical pixels;
5. each target is centered with `scrollIntoView` and its center must hit the exact requested `data-testid`.

Profile, owned main PID, physical main-window bounds, exact allowlist and same-session calibration remain
mandatory. No desktop search, persisted offset, fixed absolute coordinate or synthetic success is allowed.

Headless gates are helper 10/10, typecheck PASS and bounded diff check PASS. All R5B-01..R5B-12 must pass
before `R5 PASS / R6 MAY START`.

Automatic development stop reason: the only visible run in this window delivered an in-bounds pointer but did
not prove the DOM target received it. The scroll and hit-test correction is verified headlessly; the user
disturbance budget prohibits another visible run in this window.
