# Codex correction after the visible diagnostic

## Finding

The runner only constructed `canaryObservations` after durable publication and
B6 capture. A normal synthesis failure before that point still produced the
standard machine audit set, but no canary observation file. The wrapper then
reported only `CANARY_OBSERVATIONS_MISSING`, hiding the allowlisted product
failure code.

## Correction

- Add the three frozen chapter quality codes to the canary allowlist.
- Build action counters through one ledger-backed helper.
- On a normal owner exception, latch `CANARY_OWNER_FAILED`.
- In `finally`, always emit a strict minimal observation when the rich
  observation was not reached; hard process death may still have no file.
- Permit `taskId: null` only when `CANARY_OWNER_FAILED` is latched. This state
  cannot produce READY.
- Preserve exact-key validation, hard-zero upload counters, zero
  source-completion accounting, and cleanup facts.

The historical visible run remains blocked and is not retroactively rewritten.
