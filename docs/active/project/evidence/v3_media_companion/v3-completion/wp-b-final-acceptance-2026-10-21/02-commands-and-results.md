# Commands and results

| Command group | Exit | Result |
|---|---:|---|
| One approved owned-Chrome visible session | 0 | B27/B29/B30 PASS; failure null; all cleanup flags true |
| Runtime local-import and WP-B suites | 0 | 272 passed |
| Real hard-kill probe | 0 | 9/9 injection points; every kill exit 137; restart cleanup bounded and exactly once |
| WP0 R4 restart/security suites | 0 | 45 passed |
| Relay ownership static tests | 0 | 45 passed |
| Extension media-companion subtree | 0 | 63 files, 534 tests |
| Extension typecheck | 0 | PASS |
| Production extension build | 0 | PASS, 4.69 MB |
| Relay v11 baseline after controlled refreeze | 0 | 50/50; source 40/40; target 20/20; unlisted emits empty |
| Relay v11 adversarial mutations | 0 | 16/16 |

One initial Runtime command exited 2 during collection because system `pytest`
did not include the package root. No test executed. The corrected canonical
`PYTHONPATH` plus `python3 -m pytest` command produced the 272/272 result above.

