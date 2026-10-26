# Next-batch one-click prompt

Do not execute the visible step without fresh user authorization.

```text
Continue Navia WP0 R5-B from /mnt/c/workspace/navia.

Read AGENTS.md, docs/active/project/design/project-stage-workflow.md section 5.1F, the accepted relay v11 offline
checkpoint at docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r5b-relay-v11-2026-10-18/,
and Window 12 evidence at docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r5b-positive-window12-2026-10-18/.

Independently verify the Window 12 root cause and the action-policy correction. Run only the targeted no-window,
silent checks listed in 20-root-cause-and-correction.md; do not repeat the full offline suite or external document
audit. Confirm relay v11 baseline remains 50/50 and mutations 16/16 only if relevant source authority changed.

Do not open Chrome until the user explicitly authorizes a new visible batch. After authorization, notify the user
once, launch exactly one owned production Chrome/Profile/PID with explicit --mute-audio, fixed BVID
BV1Bb411w741 and the authorized Cookie file, then execute the user-reachable Side Panel path. The runner may click
rendered controls only; it must not directly call Controller, Runtime materialize, store, database, grant or
transcript success paths. Stop on the first failure and clean immediately; do not visibly retry unchanged input.

PASS requires non-empty PCM, minimum accepted duration, Runtime sink receipt, effective SenseVoice, successful
transcription, durable ready|degraded materialization, consistent task/source identity, monotonic revision/fence,
cleared UI busy state, zero secret hits and zero owned residue. If PASS, land one R5 checkpoint, revise the R6
preimplementation package from relay v10 authority to accepted relay v11 while preserving its 65-case denominator,
verify that package, and stop before R6 implementation. If FAIL, preserve diagnostics and report R5 NO-GO.

Never play sound. Never touch the user's Chrome, game, unrelated process or pre-existing dirty worktree. Do not
commit, push, reset, clean, checkout or revert.
```

