# WP0 R5-B final visible-run handoff

## Scope

Run exactly one fresh production canary after arranging a short user-visible test window. Do not perform
additional exploratory visible runs.

## Required environment

- Fixed URL: `https://www.bilibili.com/video/BV1Bb411w741`
- Product stage: `5-1`
- In-page product surface enabled
- User-authorized Cookie path supplied through `NAVIA_V3_BILIBILI_COOKIE_FILE`
- Fresh run ID and evidence directory
- `NAVIA_CHROME_MUTE_AUDIO=1`
- No external-action wait or external-action-only diagnostic hook

## Required decision

- All R5B-01 through R5B-12 green: write `R5-B AWAITING CODEX CHECKPOINT` and stop.
- Any failure: write one new checkpoint with the first independent root cause; do not rerun visibly in the
  same user-disturbance window and do not enter R6.

## Implementation handoff

The corrected runner uses exact owned-PID UIAutomation clicks for permission enable and capture controls.
The helper waits for unique + visible + enabled + valid geometry and never searches another process.
Headless gates are green. The remaining work is a real Chrome positive, not another contract audit.

