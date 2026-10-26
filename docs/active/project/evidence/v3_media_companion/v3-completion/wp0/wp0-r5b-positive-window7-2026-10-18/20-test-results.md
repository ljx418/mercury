# WP0 R5-B window 7 test results

Date: 2026-10-18

| Check | Result |
|---|---:|
| Extension typecheck | PASS, exit 0 |
| RuntimeCaptureTransport exact payload and behavior | PASS, 31/31 |
| Controller / Offscreen / two-end / restart / R2 invariant suites | PASS, 73/73 |
| Relay static ownership contract | PASS, 42/42 |
| Production extension build | PASS, 4.66 MB |
| Scoped `git diff --check` | PASS, exit 0 |
| Relay v10 baseline after refreeze | PASS, 50/50 |
| Relay v10 adversarial mutations | PASS, 15/15 |
| Visible production canary | FAIL before audio streaming |
| Public/private evidence secret scan | PASS, 108 files, 4,992,737 bytes, 0 hits |

The first combined Vitest invocation exceeded the 30-second tool yield while the host was under load.
It was not counted. The owned process was stopped, then the affected files were rerun with controlled
worker counts and completed successfully. No test process result was inferred from liveness alone.

The visible run proved the trusted UI action, grant creation, and WebSocket connection. It did not prove
decoded capture audio, transcript creation, terminal projection, or product cleanup after success.
