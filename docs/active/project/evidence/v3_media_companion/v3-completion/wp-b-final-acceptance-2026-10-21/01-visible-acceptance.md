# Visible acceptance receipt

The authoritative redacted machine receipt is:

`../wp-b-visible-run-attempt51-2026-10-21/visible-session-receipt.json`

The owned process exited 0 with `failure: null` and cleanup booleans true for
Chrome, Runtime, generated assets, and temporary roots.

| Case | Result | Production oracle |
|---|---|---|
| B27 | PASS | Real XHR abort, Runtime DELETE observed, monotonic public state converged to `cancelled`, old import did not attach to the second identity, observable residue zero |
| B29 | PASS | 104,329,514 allocated bytes, one upload, monotonic progress, max writer slice 256,000 bytes, local transcript/frame/product path completed, cleanup exactly once, residue zero |
| B30 | PASS | 1,107,280,614 allocated bytes, one upload, monotonic progress, Runtime RSS delta 136,241,152 bytes, extension heap delta 3,530,596 bytes, 256 resource samples, cleanup exactly once, residue zero |

B30 also passed real keyboard activation and focus order, ARIA live-region
change, hit testing, and layout stability at a 360 x 759 Side Panel viewport.
Chrome was always started minimized with `--mute-audio`.

