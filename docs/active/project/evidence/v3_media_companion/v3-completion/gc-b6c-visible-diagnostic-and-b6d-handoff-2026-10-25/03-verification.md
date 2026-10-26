# Verification

Changed harness files and final SHA-256:

- `lib/order2_canary.mjs`: `7cbd742e2593769f9bbc3b3b9e7af90ccb5dc4a21c9aed919f3890010429e593`
- `run_one_bvid.mjs`: `12c6e7e0611e187388faf2d8feae3dda30169d841f6c96181db0faadc18fe794`
- `test/b6_lifecycle.node-test.mjs`: `cab892fffe7a4d865525c89956f213b83cac99be76809bcdd946f75dda362bda`
- `test/b6c_order2_canary.node-test.mjs`: `dbfd3d2887c02757b079e65cfd8c8fc18a6a062df5fe84c3dd279c098a9aa3f0`

Commands and results:

- Node syntax checks: exit 0.
- B6C contract suite: 30/30 passed.
- B6 lifecycle suite: 11/11 passed. The added real-runner case drives an HTTP
  `V3510B_CHAPTER_IMBALANCE` failure and proves strict observation persistence,
  nonzero owner exit, zero source completion, and closed cleanup.
- Combined offline Stage B suite: 617/617 passed, exit 0.
- `git diff --check` on the changed harness files: exit 0.

No second visible run, Chrome start, Cookie read, Provider call, download,
import, audio output, tab capture, or real BVID action occurred after the
single diagnostic.
