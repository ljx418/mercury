# R5-B relay v11 test results

## Offline decision

`PASS`, subject to the separately authorized single visible positive run.

## Contract and focused proof

| Check | Result |
|---|---:|
| relay v11 dedicated sender-policy suite | 20/20 |
| four targeted relay suites | 96/96 |
| media companion subtree | 24 files / 255 tests |
| Windows invocation Node suite | 11/11 |
| relay static ownership gate | 45/45 |
| relay v11 baseline verifier | 50/50; source 40/40; target 20/20; unlisted `{}` |
| relay v11 mutation verifier | 16/16 |
| preimplementation document verifier | 17/17 |
| preimplementation mutation verifier | 8/8 |
| extension typecheck | exit 0 |
| extension build | exit 0; 4.67 MB |
| Runtime focused suite | 187 passed, 643 deselected |
| credential-value secret scan | 143 files / 5,151,383 bytes / 0 hits |
| owned Navia process scan before visible gate | 0 |

The sender-policy suite drives the production resolver and `OffscreenAudioPort.accept()` through three positive
and fourteen fixed negative cases, plus missing/empty context identity variants and two asynchronous validation
barrier cases.

## Full extension regression

The unsharded JSDOM command was stopped twice after prolonged continuous progress because Windows-mounted I/O
and exhausted host swap made it unsuitable as a bounded checkpoint. Neither attempt reported a test failure and
neither is counted as PASS.

The final checkpoint used Vitest's native deterministic two-shard split:

- shard 1: 34 files / 319 tests, exit 0;
- shard 2: 34 files / 275 tests, exit 0;
- total: 68 file-shards / 594 tests, all passed.

Shard 1 initially exposed that `windowsExtensionInvocation.test.mjs` was a Node `node:test` suite but matched
Vitest's collection glob. It was mechanically renamed to `windowsExtensionInvocation.node-test.mjs`, then proved
separately as 11/11 before the clean shard run. This was a test-orchestration defect, not a product failure.

The first Runtime focused command omitted `PYTHONPATH=.` and failed during collection. The corrected repository
command passed 187 tests. The first command is classified as an invocation/environment error and is not presented
as product evidence.

An initial generic text-pattern scan was invalid because it counted the approved Cookie file path and ordinary
test strings. The accepted scan derives opaque credential-value needles from the authorized Cookie file and emits
only aggregate counts; it found zero values in source, tests, build, v11 contract/fixture or public evidence.

## Anti-false-green checks

- Positive cases return the authoritative context document ID rather than accepting by URL alone.
- Missing sender document ID is accepted only with one complete matching context.
- Mismatch, ambiguity, absent context identity, origin/profile mismatch and replacement fail before ownership.
- Production source contains no relay v10 Port fallback after the atomic v11 migration.
- Build output contains v11 Port literals and no v10 Port literal.
- No visible Chrome was used to obtain the offline PASS.

