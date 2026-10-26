# WP0 R5-B window 4 test results

## Visible observation

| Observation | Result |
|---|---|
| production three-route fallback | PASS |
| `awaiting_trusted_capture` | PASS |
| real playback / decoded audio | PASS / PASS |
| exact-name calibration | PASS |
| projected native point | rejected before click due DPI-space mismatch |
| capture / ASR | 0 / 0 |
| sound / Provider / visible retry | 0 / 0 / 0 |

## Corrective verification

- native-helper tests: 9/9 PASS.
- extension typecheck: PASS.
- bounded diff check: PASS.
- UIAutomation and projected-pointer scripts both declare Per-Monitor-V2 DPI awareness: PASS.
- both generated PowerShell scripts load without parse/P/Invoke errors and stop at the expected fake owned-PID
  gate (`status=2`): PASS.
- point remains rejected unless Profile, PID and physical owned-window boundary all match: PASS.

## Security and cleanup

- Secret scan: 104 files / 4,990,876 bytes / 0 hits.
- Owned Profile, Runtime, ports 17861/9222 and secure task root: 0 residue.

No second visible run was made in this window.
