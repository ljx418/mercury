# WP0 R5-B window 3 test results

## Visible observation

| Observation | Result |
|---|---|
| production three-route fallback | PASS |
| `awaiting_trusted_capture` | PASS |
| real playback / decoded audio | PASS / PASS |
| first exact-name UIA calibration control | PASS |
| dynamic capture control UIA lookup | FAIL, `matchCount=0` |
| capture / ASR | 0 / 0 |
| visible retries / sound / Provider | 0 / 0 / 0 |

## Corrective verification

- native-helper tests: 8/8 PASS.
- extension typecheck: PASS.
- bounded diff check: PASS.
- exact observed calibration maps local `(187, 225.1875, 310x40)` to owned native
  `rect=876,401,310,41`: PASS.
- mismatched calibration dimensions fail closed: PASS.
- missing same-session calibration fails closed: PASS.
- subsequent native click helper retains Profile, PID and owned-window bounds: PASS.

## Security and cleanup

- Secret scan: 104 files / 4,992,715 bytes / 0 hits.
- Owned Chrome Profile, Runtime, 17861/9222 ports and secure task root: 0 residue.

No second visible run was made in this window.
