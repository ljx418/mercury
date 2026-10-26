# WP0 R5-B next visible-run handoff

Run exactly one fresh visible muted production canary in a new user disturbance window. Do not rerun the
completed route discovery or perform visible exploratory retries.

The changed condition is confined to the native control helper:

- search root is the main window obtained from the verified owned Chrome PID;
- descendant controls may belong to Chrome renderer processes;
- the unique candidate must be an allowlisted exact-name button;
- the candidate must be enabled, visible, have valid geometry and be fully inside the owned window;
- desktop-wide search remains prohibited;
- inner wait is 20 seconds and outer process timeout is 30 seconds.

The corrected helper has 6/6 passing tests and extension typecheck is green. Use the same fixed source,
authorized Cookie file, production build, fresh owned Profile/Runtime/database and explicit `--mute-audio`.
All R5B-01..R5B-12 must pass before Codex may write `R5 PASS / R6 MAY START`.

Automatic development stop reason: the one permitted visible run failed before capture because the helper
incorrectly equated renderer accessibility-node PID with the Chrome main PID. The deterministic correction is
verified headlessly, but the low-disturbance policy prohibits a second visible run in the same window.
