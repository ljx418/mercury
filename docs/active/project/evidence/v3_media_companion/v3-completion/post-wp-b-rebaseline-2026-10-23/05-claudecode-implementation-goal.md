# ClaudeCode goal: GC-B5R offline implementation

You are implementing exactly one Navia workpack in `/mnt/c/workspace/navia`:
**GC-B5R Grounded Comprehension Recovery, offline implementation and preflight**.

## Current gate

- WP0 media input/relay safety: PASS.
- WP-A dependency readiness: PASS.
- WP-B explicit local media import: PASS, B01-B30 30/30.
- WP-C tabCapture requalification: deferred, experimental/default-off.
- V3-5.10 Stage B B-5: not passed; this is the next mainline work.
- Authorization ends at `GC-B5R OFFLINE CANDIDATE AWAITING CODEX CHECKPOINT`.
- You may edit implementation and tests within this workpack. You may not run a
  Provider, real Chrome, cookie injection, media download/import, six-video run,
  large-asset generation, or audio output in this batch.

## Read before editing

1. `AGENTS.md`
2. `docs/active/project/01-prd.md`
3. `docs/active/project/design/project-stage-workflow.md`
4. `docs/active/project/design/v3-chat-know-product-convergence.md`
5. `docs/active/project/design/v3-5.10-media-experience-repair-plan.md`
6. `docs/active/project/design/v3-post-wp-b-completion-rebaseline.md`
7. every file in `docs/active/project/evidence/v3_media_companion/v3-completion/post-wp-b-rebaseline-2026-10-23/`
8. `docs/active/project/evidence/v3_media_companion/v3-completion/wp-b-final-acceptance-2026-10-21/00-final-report.md`
9. `docs/active/project/evidence/v3_media_companion/v3-completion/wp-b-final-acceptance-2026-10-21/06-handoff.md`
10. `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-grounded-comprehension-contract.md`
11. `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-six-video-registry.json`
12. the historical B-5 recovery development/acceptance plans in that same directory.

The historical plans explain old failures and frozen contracts. The 2026-10-23
rebaseline package controls current scope, sequence, authorization, and status.

## Required implementation

### G0: inspect and map before changing code

Read the current production chain and tests. Produce a short map from public
entry to acquisition authority, WP-A dependency snapshot, WP-B local import,
transcript/OCR/frame evidence, synthesis Provider, validators, atomic V2.1
publisher, projection, cleanup, and current runner. Mark each component reuse,
minimal fix, or missing composition. Do not reimplement code that already owns
the behavior.

### G1: close source-authority composition

Make the current Stage B chain consume automatic acquisition or explicit local
import under one exact acquisition task/source identity. A local asset is valid
only after the real WP-B user-selection lifecycle bound it to that current
identity. Reject mismatched task, mediaId, playbackUnitId, partId, revision,
catalog, stale page identity, and cross-run asset reuse before synthesis or
publication. Do not infer identity from filename, digest similarity, or a test
seed. Do not introduce a second orchestrator.

### G2: preserve grounded synthesis invariants

Use one Provider per task. Preserve the existing Provider authorization and
selection. Do not add automatic fallback, best-of-N, cross-Provider stitching,
threshold reduction, padding, truncation, paraphrase repair, or fabricated
claims. Preserve existing composer allowlist behavior and V1/V2 bytes. Publish
V2.1 only after schema, semantic/evidence, temporal, and authority validation,
using the existing atomic/durable pattern.

### G3: lifecycle and cleanup

Ensure cancellation, Runtime restart, stale authority, failed validation, and
failed atomic publication terminate the correct owner, publish no false success,
and leave zero task-private media/staging/receipt/profile/process residue. Reuse
the durable WP-B barrier and existing acquisition cleanup ownership; do not
create competing cleanup owners.

### G4: harden the runner and add preflight-only mode

Keep the exact registry order and hash. Reject substitution and generic seed
reuse. Add or repair a preflight-only path that inspects all six source
identities and explicitly configured matching local-asset availability without
starting Chrome, Runtime media work, Provider calls, downloads, imports, or
artifact generation. Its receipt must report all those action counts as zero.
Do not claim any BVID passed from preflight.

### G5: production-driven tests

Implement the twelve obligations O01-O12 from `02-acceptance-plan.md`. Every
critical test must drive the actual production authority/composition/validator/
publisher/cleanup owner and assert the state/resource outcome. External network
or browser primitives may be faked; the owner under test may not. Include
negative tests for source mismatch, substitution, generic asset reuse, two
Providers, tabCapture enablement, stale revision/catalog, raw payload leakage,
failed publication, cancel, and restart. Add exact-boundary/one-over tests for
any touched limit and fake-clock no-input tests for any touched deadline.

## Fixed boundaries

- Do not edit public API/schema, FailureCode inventories, thresholds, message
  sets, Provider registry/authorization, Origin/auth ordering, the six-video
  denominator, WP-A/WP-B evidence, relay inventories, or historical evidence.
- Do not self-refreeze any hash or verifier. If authorized implementation causes
  only source-scope hash drift, report it once with semantic inventory results.
- Do not use tabCapture in this workpack. It remains default-off.
- Do not substitute any of the six BVIDs. A normal-video list may be supplemental
  diagnostics only and cannot count in the denominator.
- Do not read Desktop, search arbitrary disks, use user Chrome/profile, or use
  undeclared cookie/media files.
- Do not commit, push, reset, clean, checkout, revert, or discard dirty worktree
  changes. Work with existing edits and leave unrelated files untouched.
- Do not alter generated build output manually.

## Validation budget

During edits run targeted tests only. At the end run one consolidated checkpoint:

1. focused Runtime comprehension/acquisition/local-import production tests;
2. affected `scripts/stage_b_b5_3/test/*.node-test.mjs` suites;
3. extension media subtree only if you changed extension production code;
4. typecheck and build when required by changed TypeScript/shared contracts;
5. relay v11 contract baseline, expected 50/50;
6. relay v11 mutation verifier, expected 16/16;
7. changed-file/evidence scan for secrets, private paths, raw media, cookies,
   tokens, keys, transcript text, and frame bytes;
8. residual scan for owned processes, ports, profiles, task roots, and assets.

Record exact commands, exit codes, case counts, and any resource-only retry.
Do not repeatedly run full repository or external audits. Do not run Chrome,
Provider, cookie, media, or audio commands.

## Evidence and handoff

Create one new evidence directory under
`docs/active/project/evidence/v3_media_companion/v3-completion/` named
`gc-b5r-offline-implementation-<date>/` containing:

- implementation report and current production map;
- changed-file SHA-256 list;
- O01-O12 case-to-production-oracle table;
- commands, exits, and counts;
- six-identity preflight receipt proving action counts are zero;
- PRD coverage and contract-change statement;
- secret/path/raw-media and cleanup reports;
- risks and exact handoff;
- payload manifest generated only after files stabilize.

Report Chrome/Provider/download/import/audio/visible-window counts explicitly;
all must be zero. Report Fatal/Major/Minor honestly. Do not mark a component or
fixture-only check as end-to-end proof.

## Stop conditions and final status

Stop immediately for any required public/security/denominator/authorization
change, inability to preserve exact source identity, or need to modify frozen
historical evidence. Otherwise complete G0-G6 and stop with exactly:

`GC-B5R OFFLINE CANDIDATE AWAITING CODEX CHECKPOINT`

Do not announce B-5, Stage B, V3, or WP-C PASS. Do not start the real six-video
run, B-6, B-7, Stage C, or any visible/browser/provider activity.
