# WP0 R5-B next-window handoff

Run one fresh visible muted production canary from the newly rebuilt unpacked extension. Stop at the first
independent failure and do not visibly retry in that window.

The candidate now includes a product correction:

- `TrustedTabCaptureCard` is outside the collapsed diagnostic details;
- it appears before the conversation frame as an explicit main-path action;
- the runner centers it, proves exact `data-testid` hit-test ownership, projects through same-session
  calibration and sends a bounded real OS pointer;
- all previous timeout, dynamic-UIA, DPI and window ownership protections remain.

Headless gates are source/driver 11/11, typecheck PASS, build PASS (4.66 MB) and bounded diff check PASS.
The unobserved media Vitest completion is not a green claim and should be included once in the next
consolidated checkpoint after the visible run, not repeatedly rerun now.

All R5B-01..R5B-12 must pass before `R5 PASS / R6 MAY START`.

Automatic development stop reason: the only visible run in this window proved the product action was hidden
under the composer because it lived in collapsed diagnostics. The product and build are corrected, but the
disturbance budget prohibits a second visible run in this window.
