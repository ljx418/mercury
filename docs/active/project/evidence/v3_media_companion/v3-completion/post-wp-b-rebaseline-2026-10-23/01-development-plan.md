# GC-B5R development plan

## Objective

Prepare a stable offline production candidate that can later execute the fixed
six-video B-5 denominator using current WP-A/WP-B input capabilities without
reintroducing tabCapture as a prerequisite.

## Work breakdown

| ID | Work | Deliverable | Exit |
|---|---|---|---|
| G0 | inventory current implementation and evidence | code/contract/runner map with reuse decisions | no blind rewrite |
| G1 | source-authority composition | exact task/source binding across automatic and explicit local input | no cross-video bind |
| G2 | grounded synthesis composition | one Provider/task, current V2.1 validators and atomic publisher | no fallback/stitching |
| G3 | lifecycle and cleanup | cancellation, restart, stale authority and failed publication behavior | zero live owner/residual |
| G4 | runner hardening | fixed registry, no substitution, fresh namespaces, preflight-only mode | no Chrome/Provider in offline mode |
| G5 | anti-false-green tests | production entry-to-terminal tests and negative fixtures | explicit oracle per obligation |
| G6 | consolidated offline validation | targeted suites, build, v11 gates, evidence | awaiting Codex checkpoint |

## Implementation rules

1. Read production code and current tests before changing them. Existing B-1
   through B-4 and Route 2 behavior is presumed reusable until disproved.
2. A local file is never inferred by filename or content similarity. The real
   user action and current task/source identity establish the binding.
3. The six BVID registry SHA-256 is
   `25331486cad5d5ad251e135ae0cba59a46accbe17f37f1883a26da596ca8f439`.
   Do not edit or replace it in this workpack.
4. The grounded contract SHA-256 is
   `c03491d5f55d3950448de75d20f2c89c1195234da05d17329f3a6f19254f38b8`.
   Public contract edits require a stop.
5. Preflight may inspect declared configuration and public availability. It may
   not fetch media, use a cookie, start Chrome, call a Provider, or generate a
   success artifact.
6. If a fixed BVID is restricted and no explicitly authorized matching local
   asset exists, record `blocked`; do not ask for a substitute during offline
   implementation.

## Expected write scope

The implementation may touch the current production composition under
`services/local-runtime/navia_runtime/modules/media_companion/`, its app wiring,
the current Stage B runner under `scripts/stage_b_b5_3/`, and directly related
tests. Extension changes are allowed only if the actual WP-B-to-Stage-B
composition is missing; UI redesign is out of scope.

Do not edit frozen schemas, registries, historical evidence, public inventories,
or generated build output as source. Build output may change only as the result
of the final build and must be reported separately.
