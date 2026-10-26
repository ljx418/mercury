# WP0 R5-B window 10 test results

Date: 2026-10-18

| Check | Result |
|---|---:|
| Visible production canary | FAIL at Offscreen context discovery |
| Typecheck | PASS |
| Contract/Offscreen/R2/R3 suites | PASS, 93/93 |
| Relay static contract | PASS, 44/44 |
| Production build | PASS, 4.66 MB |
| Relay v10 baseline | PASS, 50/50 |
| Scoped diff check | PASS |
| Secret scan | PASS, 108 files, 4,992,331 bytes, 0 hits |
| Owned cleanup | PASS, zero residual processes/port |

Tests prove URL+context-type filters are sent on every lookup, fixed mismatch diagnostics contain no raw
facts, transient empty discovery is bounded, and concrete mismatches remain fail closed.
