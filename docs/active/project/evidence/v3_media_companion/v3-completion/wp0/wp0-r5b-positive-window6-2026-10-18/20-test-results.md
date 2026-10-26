# WP0 R5-B window 6 test results

## Visible observation

| Observation | Result |
|---|---|
| production three-route fallback | PASS |
| `awaiting_trusted_capture` | PASS |
| real playback / decoded audio | PASS / PASS |
| exact target center hit-test | FAIL CLOSED, hit `explain-selection` |
| unintended native pointer | 0 |
| capture / ASR | 0 / 0 |
| sound / Provider / visible retry | 0 / 0 / 0 |

## Product correction verification

- native-helper and source-bound interaction tests: 11/11 PASS.
- extension typecheck: PASS.
- bounded diff check: PASS.
- exactly one `TrustedTabCaptureCard` render exists: PASS.
- capture card appears after the diagnostic `</details>` and before `messages-frame`: PASS.
- capture card is non-shrinking and above ordinary composer content: PASS.
- production extension build: PASS, 4.66 MB.

The three requested media Vitest files completed, but the orchestrating tool lost their final exit payload;
their result is not claimed as acceptance evidence and was not rerun in this disturbance window.

## Security and cleanup

- Secret scan: 104 files / 4,990,790 bytes / 0 hits.
- Owned Profile, Runtime, ports 17861/9222 and secure task root: 0 residue.

No second visible run was made in this window.
