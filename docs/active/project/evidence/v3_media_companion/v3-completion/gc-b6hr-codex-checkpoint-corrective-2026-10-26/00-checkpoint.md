# GC-B6H-R Codex Checkpoint

Status: `GC-B6H-R CODEX CORRECTIVE PASS / FRESH GC-B6B CANDIDATE REQUIRES NEW EXPLICIT AUTHORIZATION`.

Codex independently reproduced and closed the remaining acceptance false-green paths. This checkpoint does not declare B6, Stage B, B7, Stage C, or V3 complete. It performed no visible or external action.

## Final findings

1. A normal B6 capture could omit `NAVIA_B6_REQUIRE_SNAPSHOT` and reach authorization from the direct sequencer path. Normal B6 capture now requires a sealed snapshot before authorization, Cookie access, Chrome, or Runtime startup. The existing fully injected offline lifecycle harness remains explicitly test-only.
2. The public publisher ignored a non-positive builder result, and the validator accepted a claimed positive machine gate with zero review rows and zero sentinel receipts. Builder, pre-write validation, post-write validation, and manifest publication now all fail closed.
3. Dependency identities described package names and versions but did not bind the actual executable trees. Playwright and the Runtime virtual environment now carry executable-tree identities; tree or metadata drift invalidates the candidate.
4. Candidate authority was trusted from `sequencer-summary.json`. It is now rebuilt from raw machine receipts plus bundles re-read by the production bundle reader. The summary is only a mirror and must match exactly.
5. The repository protocol bytes were still proposals. Codex reviewed and froze the first canonical rubric and prompt bytes. The loader rejects a self-consistent replacement.

Final severity after correction: Fatal 0 / Major 0. Residual limits are recorded in `05-risks-and-boundaries.md`.

