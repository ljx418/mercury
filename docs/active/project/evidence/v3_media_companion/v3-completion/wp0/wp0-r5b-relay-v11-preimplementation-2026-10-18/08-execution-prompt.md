# One-click implementation prompt after authorization

> DO NOT EXECUTE until the user explicitly authorizes relay v11 implementation.

Status: `IMPLEMENTATION NO-GO PENDING EXPLICIT AUTHORIZATION`.

```text
Implement Navia R5-B relay v11 sender compatibility in /mnt/c/workspace/navia.

Read AGENTS.md, docs/active/project/design/project-stage-workflow.md section 5.1, the complete package at
docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r5b-relay-v11-preimplementation-2026-10-18/,
and Window 11 evidence at
docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r5b-positive-window11-2026-10-18/.

First verify both package scripts and AUDIT_MANIFEST.md. Preserve relay v10 historical files unchanged. Create a
versioned relay v11 internal schema/fixture/verifier and atomically migrate Background and Offscreen to the v11
Port. Implement exact unique authoritative Offscreen context binding exactly as 01-target-architecture.md states.
Do not add URL-only acceptance, dual-version fallback, public API/FailureCode/threshold changes or new user steps.

Drive all 3 positive and 14 negative sender cases through production classes, preserve 30 relay and 8 owner
manifest negatives, then execute one consolidated offline checkpoint from 02-development-plan.md. All work before
the visible canary must be no-window, no-focus and silent.

After offline PASS, stop and notify the user before the sole visible run. Launch only an owned production Chrome
and Profile with explicit --mute-audio, never touch user Chrome/games, and run the fixed user-reachable R5-B path
once. Stop at the first independent failure and clean immediately; do not visibly retry in the same batch.

Land receipt, tests, PRD review, secret/cleanup evidence and payload manifest. Do not enter R6. Final status may be
R5-B AWAITING CODEX CHECKPOINT or R5-B NO-GO only.
```
