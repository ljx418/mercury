# WP0 R5-B next-window handoff

Run one fresh visible muted production canary in a new disturbance window. Do not retry visibly after its
first independent failure.

Use the same fixed source, authorized Cookie, production build and fresh owned Profile/Runtime/database.
The native path is now:

1. exact-name UIAutomation click on `启用并分析当前视频` inside the verified owned main window;
2. verify native and CDP control dimensions differ by no more than three pixels;
3. derive an in-memory same-session screen offset;
4. for later trusted controls, read a fresh CDP center and project it through that offset;
5. send a real OS pointer click only after the existing Profile/PID/main-window-boundary checks;
6. never persist/reuse the calibration and never search the desktop tree.

Headless gates are native helper 8/8, typecheck PASS and bounded diff check PASS. All R5B-01..R5B-12 still
must pass in one run before Codex may write `R5 PASS / R6 MAY START`.

Automatic development stop reason: the only visible run in this window proved the dynamic capture button is
absent from the top-level UIAutomation subtree. The safe same-session calibrated-pointer correction is
verified headlessly, but the low-disturbance policy forbids another visible attempt in this window.
