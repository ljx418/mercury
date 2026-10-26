# WP0 R6 acceptance plan

## 1. Completion denominator

- Relay fixture negatives: `RLY10-N01..RLY10-N30` = 30/30.
- Owner-manifest negatives: `OM10-N01..OM10-N08` = 8/8.
- Phase/recovery dispositions: `R6P-N01..R6P-N07` = 7/7.
- Handoff injection points: `R6H-N01..R6H-N06` = 6/6.
- Real-boundary supplements: `R6B-N01..R6B-N14` = 14/14.
- Fixed behavioral denominator: **65/65**. No category may be omitted, merged or replaced by a
  horizontal gate.
- Horizontal gates: secret scan, cleanup scan, PRD review and consolidated regression. These do not count as
  fixture negatives.

## 2. Required receipt per case

Every case receipt includes case ID, execution group, source/build hash, production owner, driver type,
fresh disposition, injected boundary, pre-state, expected and observed code/state, forbidden side
effects, residual counts, process/task/run IDs where applicable, command, exit code and cleanup result.

All behavior evidence is fresh. The accepted R5-B candidate must contribute its verified payload manifest,
build-tree hash and production-source closure hash to the R6 entry receipt; all must match current state.

## 3. Oracle classes

| Class | Pass oracle |
|---|---|
| Reject before ownership | expected code, no stream/socket/sink/marker created |
| Reject after ownership | expected code, exactly one abort/terminal, all owned resources zero |
| Disconnect/restart | no old transfer resume, phase-specific owner action, no success claim |
| Handoff failure | owner unique; before barrier handler owns, after barrier transcript/recover owns |
| Durable recovery | publish only after product commit; otherwise abandoned plus four residuals zero |
| UI lifecycle | visible typed failure/retry, busy stopped, no stale yellow activity |

## 4. Anti-false-green rules

- Test names, fixture parsing, code existence, mock return values and exit 0 alone cannot satisfy a case.
- A production class/state machine must receive the mutation or real process fault.
- A case that first fails for an unrelated smaller bound does not prove its intended bound.
- Cleanup must be asserted after the terminal, not inferred from `finally` source text.
- Visible browser cases cannot be replaced by CDP-only clicks where Chrome requires user activation.
- Old R4 evidence cannot satisfy or be relabeled as fresh R6 evidence.

## 5. Regression and privacy gates

All Chrome commands include `--mute-audio`. Public evidence contains no Cookie, token, ticket, stream ID,
PCM/WAV, API key, raw transcript or absolute private path. Owned Chrome, Runtime, port, Profile, scratch,
track, context, Port, socket, sink and temporary media counts are all zero at closeout.

## 6. Stop conditions

Stop immediately for sound playback, secret/raw-media publication, cleanup uncertainty, public-contract or
security-boundary drift, inability to identify a single owner, fake process evidence, or an unchanged-input
repeat run. A failed visible run returns to headless correction and does not trigger another visible run in
the same disturbance window.

## 7. Exit decision

`R6 PASS` requires all denominator items and supplements passing, consolidated regression green, PRD review
with no drift and Codex checkpoint acceptance. ClaudeCode may only report `R6 AWAITING CODEX CHECKPOINT`.

