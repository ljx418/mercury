# Tests And Exit Codes

| Check | Result |
|---|---|
| Zero-action production preflight | exit 0, 34/34 |
| One authorized order-2 visible canary | exit 1, honest BLOCKED, no retry |
| Review bundle and capture focused set | exit 0, 76/76 |
| Final PNG and route focused set | exit 0, 39/39 |
| Full Stage B offline suite | exit 0, 623/623 |
| Product Runtime full suite before the harness-only edit | exit 0, 1282 passed / 3 skipped |

The visible canary exit 1 is expected evidence, not a passing test. It proves
the product recovery while preserving the failed B6 capture disposition.

No production Python changed after the Runtime full-suite checkpoint, so that
suite was not rerun for the JavaScript-only capture correction.
