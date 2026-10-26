# R5 handoff

## Required decision before another canary

Do not rerun `BV1pohR6rEEh` under the same conditions. It deterministically selects `credentialed_subtitle` and cannot prove relay PCM or SenseVoice.

Codex should revise the R5 acceptance input in one of these ways:

1. Recommended: add one frozen, verified Bilibili video with no usable subtitle as the relay/ASR canary while retaining `BV1pohR6rEEh` as the credentialed-subtitle canary.
2. Split R5 into R5-A subtitle product path and R5-B relay/ASR fallback path, with separate fixed denominators.
3. Only if PRD explicitly requires it: add a user-facing route preference. Do not add a hidden test-only route override to production.

After the gate is revised, run exactly one new visible muted canary, then the single consolidated closeout regression. Stop at `R5 AWAITING CODEX CHECKPOINT`; do not enter R6.

## Evidence

- `screenshots/01-ui-terminal.png`: fixed video with the real in-page Navia panel showing `视频已就绪` and terminal status.
- No Cookie values, raw media, transcript text, bearer token, or private path is included.

