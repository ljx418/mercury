# Relay v11 acceptance plan

## Fixed denominator

- Positive sender compatibility: `SP11-P01..SP11-P03` = 3/3.
- Negative sender/security: `SP11-N01..SP11-N14` = 14/14.
- Relay fixture negatives remain `RLY11-N01..RLY11-N30` = 30/30.
- Owner manifest negatives remain `OM11-N01..OM11-N08` = 8/8.
- Existing message/queue/restart/handoff/recovery denominators remain unchanged from v10.

The SP11 matrix is focused proof for the corrected boundary. It supplements rather than replaces the relay
fixture denominator.

## Per-case receipt

Each case records ID, production owner, pre-state, sender facts, context facts, expected/observed decision and
code, authoritative bound ID disposition, forbidden side effects, command/exit code and cleanup result. Raw IDs,
URLs beyond fixed bundled constants, secrets and private paths are not published.

## Required oracles

1. Acceptance returns a non-empty authoritative context document ID.
2. Missing sender document ID succeeds only for exactly one complete authoritative context.
3. Present sender document ID mismatch fails before Port/socket/marker ownership.
4. Ambiguity, missing context identity, origin/profile mismatch and replacement fail closed.
5. No test passes only because a fixture string or function name exists.
6. v10 historical artifacts remain byte-unchanged.
7. Production code contains no dual-version or URL-only fallback.

## Visible positive oracle

The sole visible run must prove non-empty PCM, minimum accepted duration, Runtime sink receipt, effective
SenseVoice model, acquisition success, durable `ready|degraded` materialization, consistent task/source identity,
monotonic revision/fence, UI busy cleared, secret scan zero and all owned resources zero. A trusted click or
`awaiting_trusted_capture` alone is not PASS.

## Low-disturbance policy

All preflight and correction work is headless/no-focus. A visible run occurs at most once per development batch,
uses only an owned Chrome/Profile/PID, always includes `--mute-audio`, never touches user Chrome or games, and is
cleaned immediately. A failed visible run returns to background diagnosis.

## Stop conditions

Stop on public API/FailureCode/threshold drift, v10 mutation, sender weakening, denominator shrinkage, sound,
secret/raw-media exposure, unknown cleanup, or unchanged-input visible retry.
