# WP0 R5-B window 5 test results

## Visible observation

| Observation | Result |
|---|---|
| production three-route fallback | PASS |
| `awaiting_trusted_capture` | PASS |
| real playback / decoded audio | PASS / PASS |
| DPI-aware point passed owned-window guard | PASS |
| capture control state transition | FAIL, remained on initial action |
| capture / ASR | 0 / 0 |
| sound / Provider / visible retry | 0 / 0 / 0 |

## Corrective verification

- native-helper tests: 10/10 PASS.
- extension typecheck: PASS.
- bounded diff check: PASS.
- trusted control uses native centered `scrollIntoView`: PASS.
- target center is verified by `elementFromPoint`: PASS.
- old `offsetTop`/manual-scroller approximation is absent: PASS.
- any occlusion or wrong `data-testid` fails before native pointer delivery: PASS.

## Security and cleanup

- Secret scan: 105 files / 5,139,890 bytes / 0 hits.
- Owned Profile, Runtime, ports 17861/9222 and secure task root: 0 residue.

No second visible run was made in this window.
