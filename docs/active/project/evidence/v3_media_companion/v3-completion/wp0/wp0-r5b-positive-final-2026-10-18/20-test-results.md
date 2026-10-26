# WP0 R5-B test results

## Single visible run

| Observation | Result |
|---|---|
| production three-route fallback | PASS |
| `awaiting_trusted_capture` | PASS |
| real decoded video audio | PASS |
| Cookie/private-path UI disclosure | 0 |
| native click | FAIL, `matchCount=0` before capture |
| capture / ASR | 0 / 0 |
| visible retries | 0 |
| sound / Provider requests | 0 / 0 |

## Headless correction

- `node --test e2e/lib/windowsExtensionInvocation.test.mjs`: 6/6 PASS.
- `npm run typecheck`: PASS.
- bounded `git diff --check`: PASS.
- desktop-root search absent: PASS.
- owned main-window root required: PASS.
- candidate must be fully inside the owned main-window bounds: PASS.
- descendant main-process PID equality removed: PASS.
- generated PowerShell loaded headlessly on Windows and exited at the expected nonexistent-owned-PID gate
  (`status=2`, no parse/P/Invoke error): PASS.

## Security and cleanup

- Secret scan: 104 files / 4,992,704 bytes / 0 hits.
- Owned Profile deleted: PASS.
- Secure task root deleted: PASS.
- Owned Runtime and ports 17861/9222: 0 residue.

No second visible run was performed in this disturbance window.
