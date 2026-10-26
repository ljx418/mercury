# WP0 R5-B window 11 test results

Date: 2026-10-18

| Check | Result |
|---|---:|
| Visible production canary | FAIL at Offscreen sender validation |
| Trusted user action accepted | PASS |
| Real three-route acquisition failure reached | PASS |
| Runtime route to `awaiting_trusted_capture` | PASS |
| Positive non-empty PCM | NOT REACHED |
| SenseVoice and product terminal | NOT REACHED |
| Secret scan | PASS, 108 files, 4,992,632 bytes, 0 hits |
| Runtime cleanup | PASS, graceful shutdown |
| Owned Chrome/Profile/ports cleanup | PASS, zero residual owned processes/ports |
| Provider calls / sound / visible retry | 0 / 0 / 0 |

The public result records `startActionAccepted=true`, `realThreeRouteFailure=true`, `realDecodedAudio=true`,
`realPlayback=true`, `profileDeleted=true`, `secureTaskRootDeleted=true`, and overall `passed=false`. These facts
prove the route reached trusted capture eligibility; they do not prove PCM delivery or ASR success.

No product code or frozen relay material was changed in this checkpoint.
