# WP0 R5-B window 9 test results

Date: 2026-10-18

| Check | Result |
|---|---:|
| Visible production canary | FAIL at transient Offscreen context registration |
| Extension typecheck after correction | PASS |
| Offscreen/two-end/R2/R3 behavior suites | PASS, 73/73 |
| Relay ownership static contract | PASS, 44/44 |
| Production extension build | PASS, 4.66 MB |
| Relay v10 baseline | PASS, 50/50 |
| Scoped diff check | PASS |
| Secret scan | PASS, 108 files, 4,991,894 bytes, 0 hits |
| Owned process/port cleanup | PASS, zero residuals |

The new behavior case returns an empty context list once and then the exact matching Offscreen context. It
proves the same Port is accepted after two lookups. The static gate fixes the retry bound at 30 attempts x
50 ms and proves non-empty mismatches are not retried.
