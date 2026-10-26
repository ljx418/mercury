# WP0 R5-B window 8 test results

Date: 2026-10-18

| Check | Result |
|---|---:|
| Visible production canary | FAIL at validated Port readiness race |
| Extension typecheck after correction | PASS, exit 0 |
| Offscreen/controller/R3 composition suites | PASS, 32/32 |
| Relay ownership static contract | PASS, 43/43 |
| Production extension build | PASS, 4.66 MB |
| Relay v10 baseline | PASS, 50/50 |
| Scoped diff check | PASS, exit 0 |
| Secret scan | PASS, 108 files, 4,992,762 bytes, 0 hits |
| Owned residual processes and port | PASS, zero |

The new behavior case holds `getContexts()` unresolved and proves `OffscreenAudioPort.connected` remains
false until the security validation resolves. The new production-source gate proves the Offscreen ping
cannot satisfy readiness without that validated Port state.

The previous window's v10 mutation result remains 15/15. This correction changed no frozen source scope,
fixture, verifier, failure-code inventory, or schema; the baseline was rerun once and remained 50/50.
