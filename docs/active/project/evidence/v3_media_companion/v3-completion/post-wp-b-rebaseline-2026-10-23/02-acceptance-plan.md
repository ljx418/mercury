# GC-B5R offline acceptance plan

## Fixed denominator

The offline batch has twelve obligations. All twelve must pass before the real
six-video run can be proposed.

| ID | Obligation | Required oracle |
|---|---|---|
| O01 | current authority inventory | every reused/replaced path cites production symbol and test |
| O02 | registry immutability | exact six BVIDs/order/hash; substitution rejected |
| O03 | source binding | mismatched source identity/local asset is rejected before bind |
| O04 | route order | automatic routes precede explicit local import; tabCapture remains default-off |
| O05 | task Provider lock | zero or two Providers rejected; no fallback/best-of-N/stitching |
| O06 | derived-text-only upload | raw media/frame/audio/cookie/key/path counters and payload scan are zero |
| O07 | V2.1 validation | schema, evidence, temporal, brief and authority gates drive production code |
| O08 | atomic publication | drift/failure leaves no published derivative and preserves V1/V2 bytes |
| O09 | lifecycle cleanup | cancel/restart/failure settles owner and leaves zero private residual |
| O10 | preflight purity | six identities inspected with Chrome/Provider/download/import counts all zero |
| O11 | compatibility regression | affected Runtime/Extension tests, typecheck and build pass |
| O12 | relay preservation | v11 baseline 50/50 and mutations 16/16; no self-refreeze |

## Anti-false-green requirements

Each obligation maps to `production entry -> owner/composition -> terminal or
rejection -> state/resource oracle -> negative case`. String search and fixture
shape may supplement but cannot satisfy O03-O10. Tests may mock external
network/browser primitives, but not the production authority, router,
orchestrator, validator, publisher, or cleanup owner under test.

Exact-boundary and one-over tests are required for any touched limit. Timeout
tests use fake time with no subsequent input. Failure tests assert no bind,
publish, queue, counter advance, owner leak, or residual.

## Consolidated command classes

ClaudeCode determines the exact existing commands after G0 and records them,
but the final checkpoint must include:

1. focused Runtime comprehension/acquisition/local-import tests;
2. all `scripts/stage_b_b5_3/test/*.node-test.mjs` tests affected by the runner;
3. extension media subtree only if extension code changed;
4. TypeScript typecheck and extension build if extension or shared contracts changed;
5. relay v11 baseline and mutation verifiers with expected 50/50 and 16/16;
6. secret/private-path/raw-media scan over changed files and new evidence;
7. owned process, port, profile, task root, and temporary asset residual scan.

No real Chrome, Provider, cookie injection, media download, large asset,
audio-output device, or visible window is part of this offline acceptance.

## Stop conditions

Stop immediately and report Codex if implementation requires a public schema,
FailureCode, threshold, registry, fixed denominator, upload authorization,
Origin/auth ordering, or security-boundary change. Also stop if a fixed BVID can
only pass by substitution, generic seed reuse, or a source-identity override.

Successful implementation status is exactly:
`GC-B5R OFFLINE CANDIDATE AWAITING CODEX CHECKPOINT`.
