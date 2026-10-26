# WP0 R5-B single-window test results

## Headless preflight

| Gate | Result |
|---|---|
| typecheck | PASS |
| native helper before correction | 4/4 PASS |
| production build | PASS, 4.66 MB |
| relay static contract | 42/42 PASS |
| v10 baseline | 50/50 PASS |
| v10 mutations | 15/15 PASS |

## Visible run

| Observation | Result |
|---|---|
| production three-route fallback | PASS |
| `awaiting_trusted_capture` visible | PASS |
| real decoded video audio track | PASS |
| Cookie/private-path UI disclosure | 0 |
| native capture click | FAIL before capture, outer timeout shorter than inner wait |
| capture / ASR | 0 / 0 |
| secret scan | PASS, 104 files / 4,992,288 bytes / 0 hits |
| owned Profile and secure task root deleted | PASS |
| owned Chrome/Runtime/port residue | 0 |

## Corrective verification

- `node --test e2e/lib/windowsExtensionInvocation.test.mjs`: 6/6 PASS.
- `npm run typecheck`: PASS.
- exact product cancel label (`取消`) is accepted and the obsolete label is rejected: PASS.
- UIAutomation root is the owned Chrome main window, not the desktop root: PASS.
- `git diff --check` for the bounded R5-B/R6-preimplementation change set: PASS.

No second visible run was performed in the same user-disturbance window.
