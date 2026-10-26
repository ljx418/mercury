# Window 12 root cause and offline correction

## Root cause

The runner incorrectly routed every trusted capture control after `media-companion-enable` through a calibrated
Windows screen-coordinate pointer. That path is required for the capture-start user activation, but it is not
required for finish or cancel. The finish record proved geometry calculation, not event delivery; Runtime logs
proved the stop event never crossed the product boundary.

This is an E2E orchestration false negative. Relay v11 successfully established capture, but the run cannot be
promoted because the terminal user path was not observed.

## Correction

Input policy is now explicit and tested:

| Action | Input owner |
|---|---|
| `media-companion-enable` | owned PID UIAutomation calibration |
| `media-capture-start` | owned PID calibrated native pointer |
| `media-capture-finish` | exact extension-frame CDP trusted input |
| `media-capture-cancel` | exact extension-frame CDP trusted input |

Finish/cancel still click the real rendered UI control with `isTrusted` input. They do not call Controller,
Runtime, materialization, store or database APIs directly.

Changed runner files:

- `apps/chrome-extension/e2e/v3-acquisition-orchestration-e2e.mjs`
- `apps/chrome-extension/e2e/lib/r5CaptureActionInputPolicy.mjs`
- `apps/chrome-extension/e2e/lib/r5CaptureActionInputPolicy.node-test.mjs`

Offline correction proof:

- action policy plus Windows invocation suites: 15/15, exit 0;
- runner `node --check`: exit 0;
- extension typecheck: exit 0.

No product code, relay v11 contract, v10 history, public API, FailureCode or acceptance threshold changed after
the visible run.

## Remaining gate

A new visible batch must be explicitly authorized. Its sole run may reuse the same fixed video and Cookie because
the input condition changed materially: finish/cancel now use exact-frame trusted input instead of projected
screen coordinates. Until that run reaches transcription and durable materialization, R5 is NO-GO and R6 remains
blocked.

