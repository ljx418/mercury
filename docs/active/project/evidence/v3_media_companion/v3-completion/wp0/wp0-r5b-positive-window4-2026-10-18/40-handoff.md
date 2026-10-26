# WP0 R5-B next-window handoff

Run exactly one fresh visible muted production canary in a new low-disturbance window. Do not visibly retry
after its first independent failure.

The native path now has four closed driver conditions:

1. inner UIAutomation wait is shorter than the outer process timeout;
2. first exact-name owned control establishes same-session geometry calibration;
3. dynamic iframe controls use fresh CDP centers projected through that calibration;
4. UIAutomation, `GetWindowRect` and pointer coordinates all use Per-Monitor-V2 physical pixels.

Every click still requires the expected Profile, owned main PID and an in-bounds physical point. No desktop
search, fixed absolute coordinate, persisted offset or cross-run calibration is allowed.

Headless gates are helper 9/9, typecheck PASS, two Windows script-load probes PASS and bounded diff check
PASS. All R5B-01..R5B-12 must pass before `R5 PASS / R6 MAY START`.

Automatic development stop reason: the only visible run in this window exposed a deterministic DPI
virtualization mismatch before capture. The condition is corrected and verified headlessly; the disturbance
budget prohibits a second visible run in this window.
