# WP0 R5-B corrective test results

## Headless and no-focus gates

| Gate | Result |
|---|---|
| TypeScript typecheck | PASS |
| R5-B native invocation helper | PASS, 4/4 |
| Relay targeted assertions | PASS, 120/120 executed assertions (115/115 plus isolated 5/5) |
| Production extension build | PASS, 4.66 MB |
| Relay static contract | PASS, 42/42 |
| v10 baseline verifier | PASS, 50/50 |
| v10 mutation verifier | PASS, 15/15 |
| JavaScript syntax and diff check | PASS |

The initial combined Relay run executed 115 passing assertions but Vitest could not start one worker in
time. The unstarted five-test file was then run alone with one worker and passed 5/5. This is recorded as
an environment worker-start timeout, not as a product assertion failure.

## Visible muted attempts

| Run | Outcome | Capture / ASR |
|---|---|---|
| `r5b-final-20261018T095821Z` | Native permission prompt absent after a non-trusted enable click | 0 / 0 |
| `r5b-final-20261018T100012Z` | Exact native enable control observed before it became actionable | 0 / 0 |

Both runs used an owned fresh Chrome profile with explicit `--mute-audio`. Both deleted the profile and
secure task root, reported zero secret-scan hits, and left no owned Chrome or Runtime process. They are
corrective diagnostics and do not satisfy R5B-05 through R5B-10.

