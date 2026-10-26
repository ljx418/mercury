# Findings And Corrections

## Major 1: normal owned processes were latched as leaks

The wrapper called `ownedProcesses.leaks()` while the runner was still alive.
That method reports live recorded descendants, so the normal owned Runtime and
Chrome could be latched and make every real canary BLOCKED. The wrapper now
records descendants while the owner runs and classifies survivors only after
the owner exits, matching the sequencer ownership model.

## Major 2: the child did not receive the resolved stage root

An explicit `--stage-root` was used to create authorization state but was not
forwarded through `NAVIA_B5_STAGE_ROOT`. The child could verify against a
different default root. The resolved root is now explicitly passed to the
child environment.

## Major 3: stale or failed-owner observations could become READY

The wrapper ignored the child exit status and accepted a pre-existing source
directory. A failed child could therefore leave or reuse apparently ready
observations. The source directory must now be fresh before authorization is
consumed; spawn/exit failure adds `CANARY_OWNER_FAILED`; observations are bound
to the requested run and a strict task id; undeclared fields fail closed.

## Major 4: offline fixtures could emit a real READY receipt

The offline test entry accepted fixture observations and exited 0 with
`ORDER2 DIAGNOSTIC READY FOR CODEX`. READY is now valid only for
`mode=visible` and `executed=true`. Offline positive input proves the verdict
logic but exits `CANARY_NOT_EXECUTED` with a BLOCKED non-candidate receipt.

## Additional hardening

- A failed visual HTTP status blocks even when no product code is returned.
- Unknown terminal codes are dropped and replaced by a stable canary code.
- Observation, capture, cleanup, action, upload, and PNG-code shapes are exact.
- READY requires exact one-source action accounting and hard-zero prohibited actions.
- Receipt write failure exits as a contract violation and does not disclose a path.
- Refusal receipts persist only stable codes, not free-form details.
