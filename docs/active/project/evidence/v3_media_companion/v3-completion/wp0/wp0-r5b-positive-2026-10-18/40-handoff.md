# WP0 R5-B next-run handoff

Run exactly one fresh visible, muted production canary in a new disturbance window. Do not repeat headless
contract discovery and do not retry visibly after the first independent failure.

The changed condition is limited to the trusted-control helper:

- inner UIAutomation wait: 20,000 ms;
- outer PowerShell process timeout: 30,000 ms;
- enforced test: outer budget is at least inner budget + 5,000 ms;
- timeout diagnostics now include process error code or signal.
- native control lookup starts from the owned Chrome process main window rather than the desktop root;
- capture cancellation maps to the product's exact `取消` label.

The helper's bounded headless suite is 6/6 and extension typecheck is green. Do not repeat those checks as a
new discovery loop unless the helper or its callers change again.

Use the same fixed source, authorized Cookie file, production build, fresh owned Profile/Runtime/database and
explicit `--mute-audio`. A passing run must still satisfy all R5B-01..R5B-12 before Codex may write
`R5 PASS / R6 MAY START`.

Automatic development stop reason: the single approved visible disturbance window ended with a test-helper
timeout before capture. The defect is corrected headlessly, but user disturbance policy forbids an immediate
second visible run.
