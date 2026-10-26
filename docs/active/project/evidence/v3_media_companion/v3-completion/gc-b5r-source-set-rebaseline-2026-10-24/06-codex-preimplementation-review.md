# Codex preimplementation review

Date: 2026-10-24

## Decision

**GC-B5R B-5 REAL-RUN IMPLEMENTATION MAY START**

The source registry, development plan and ClaudeCode goal agree on the same six
primary sources, four non-runnable reserves, fixed order, aggregate threshold,
one-visible-batch budget and stop states. No historical registry or evidence is
replaced.

## Code review finding carried into implementation

`scripts/stage_b_b5_3/sequencer.mjs` currently sets a nonzero final process exit
only for `sequencerHardFailure` or an owned-process leak. A `limited` source, a
`failed` source, or the explicit stop after a second `blocked` source can
therefore leave a semantically failing aggregate with exit code zero. The B-5
runner is not authorized for real execution until tests prove those conditions
exit nonzero.

## Gate completeness

The implementation prompt covers:

- canonical registry activation and reserve rejection;
- aggregate exit semantics and anti-false-green tests;
- Cookie-to-owned-profile composition without arbitrary file search;
- isolated Runtime and supported Provider bootstrap;
- product dependency and public metadata preflight;
- one sequential owned-Chrome run with `--mute-audio`;
- raw-media/secret/provider boundary assertions;
- no blind visible retry;
- deterministic cleanup, evidence and two exact checkpoint states.

## Review result

Fatal 0 / Major 0 / Minor 2.

1. Metadata reachability remains weaker than real playback/acquisition and must
   be rechecked by preflight.
2. The existing Cookie and isolated Provider composition paths have not yet
   been demonstrated in one fresh owned Runtime/Chrome environment.

Both are explicit fail-closed implementation gates. No further planning round
is required before ClaudeCode begins R0.

