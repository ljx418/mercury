# Next Gate

The next executable gate is one fresh sealed GC-B6B six-source candidate, but
it is not authorized by this checkpoint.

Required before execution:

1. New explicit user authorization for the visible six-source run.
2. Fresh run id, authorization id, stage root, private root and evidence root.
3. Entry only through `prepare_candidate.mjs`; no direct sequencer or runner.
4. Frozen primary registry order; no retry, reserve, replacement or historical
   artifact reuse.
5. Machine-negative means immediate stop with no projection or blind review.
6. Machine-positive permits only the frozen independent host review and the
   order-3 two-session sentinel.

B7, Stage C and V3 PASS remain blocked.
