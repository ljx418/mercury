# R5-B relay v11 handoff

## Current coordinate

`WP0 / R5-B / relay v11 offline implementation complete / visible positive pending`

## Visible command boundary

Use the production build and fixed inputs only:

- product stage `5-1`;
- in-page trusted extension surface enabled;
- BVID `BV1Bb411w741`;
- authorized Cookie file `/mnt/c/Users/Administrator/Desktop/myCk.txt`;
- owned Chrome/Profile/PID only;
- helper-enforced explicit `--mute-audio`;
- one visible attempt in this batch, then immediate cleanup.

PASS requires non-empty PCM, minimum duration, Runtime receipt, effective SenseVoice model, acquisition success,
durable `ready|degraded` publication, consistent task/source identity, monotonic revision/fence, cleared UI busy
state, zero secret hits and zero owned residue. A trusted click or `awaiting_trusted_capture` alone is insufficient.

## Stop rules

- On first visible failure, preserve diagnostics, clean owned resources and stop without a same-batch visible retry.
- On success, issue a single R5 checkpoint, revise the R6 preimplementation package from relay v10 authority to
  accepted relay v11, verify its fixed 65-case denominator, and stop before R6 implementation.
- Do not edit or delete prior R5/R5-B evidence directories.

## Integration notes

The v11 change is intentionally local to capture relay identity. Runtime routes, ticket issuance, acquisition,
transcription and materialization are unchanged, so downstream integration should treat the accepted relay as a
versioned internal authority rather than a new product route.

