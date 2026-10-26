# ClaudeCode goal: GC-B5R B-5 offline corrective

Copy the complete prompt below into ClaudeCode CLI as one task.

```text
Work in /mnt/c/workspace/navia.

Implement the GC-B5R B-5 OFFLINE corrective only. Do not launch Chrome, do not
start a real media Runtime, do not call a Provider, do not download media, do
not read or inject Cookie material, do not play audio and do not execute the
six real BVIDs. Stop at a Codex checkpoint after offline verification.

CURRENT DECISION

The previous real-run candidate is rejected for this checkpoint. Read the
entire directory:

docs/active/project/evidence/v3_media_companion/v3-completion/
gc-b5r-b5-codex-checkpoint-2026-10-24/

Also read:

- AGENTS.md
- docs/active/project/design/project-stage-workflow.md section 5.1
- the source-set rebaseline package
- the complete gc-b5r-b5-real-run-2026-10-24 evidence package
- scripts/stage_b_b5_3 and its tests
- comprehension/service.py, comprehension/quality.py and
  comprehension/synthesis.py plus their tests
- the frozen grounded-comprehension contract and V2.1 schema

Do not edit historical evidence. Write new corrective evidence only to the
path specified below.

CONTRACT DECISION

Keep the frozen V2.1 rules unchanged. Chapter starts remain strictly
increasing, chapter count remains 2..12, chapter fields remain exact and all
evidence bindings remain closed. Do not refreeze a schema, verifier, inventory,
threshold or failure-code set. Do not add a fallback Provider. Do not create,
delete, merge, reorder or rewrite semantic chapters locally merely to make a
candidate pass.

C1 - DURABLE STAGE ACTION LEDGER

1. Add a runner-owned append-only action ledger that is created before the
   first external action and finalized in a finally path.
2. Record attempts and counters for owned Chrome launches, visible windows,
   Runtime starts, Provider calls, downloads, imports, media tasks, Cookie
   injections, audio outputs, tabCapture actions, focus events and source
   attempts. Never record Cookie values, secret lengths, private paths or raw
   payloads.
3. Distinguish lifetime/stage totals from one candidate run's totals. Reports
   must never present candidate-only counts as stage totals.
4. Reconcile the retained old logs without modifying them. The correction must
   state that they prove at least 34 prior Chrome launches (6+6+2+2+6+6+6).
   If an exact counter cannot be reconstructed, report a lower bound and the
   reason; never write a guessed exact value.
5. Add an explicit one-shot authorization identifier to visible execution.
   Reusing a consumed identifier must fail before Chrome. Offline tests must
   prove the refusal. Do not consume or create a real authorization in this
   corrective batch.
6. Tests must cover normal finalization, process interruption, malformed prior
   ledger, duplicate authorization id and the distinction between stage and
   candidate counts.

C2 - COMPLETE FAILURE-PATH EVIDENCE

1. Refactor run_one_bvid.mjs so a single finalizer writes the mandatory audit
   set for complete, limited, blocked and failed dispositions.
2. A Provider/validator failure after Chrome launch must still write:
   final_disposition.txt, b5-source-receipt.json, isolation.json, receipt.json,
   provider_lock.txt, chrome_launch.log, secret_scan.csv, cleanup.json and
   task_namespace.json.
3. Failure receipts must distinguish selectedProviderId/selectedEndpointClass,
   attempted Provider facts and published Provider receipt facts. Do not fill
   an absent published receipt with successful values. The aggregate must not
   misclassify an honest failed attempt as a foreign Provider merely because
   publication did not occur.
4. Preserve the failure code, task/source/revision/generation identity, upload
   hard-zero counters, mute flag, ownership and cleanup facts that are known.
5. Write atomically where practical and make the finalizer idempotent. A second
   finalization must not overwrite a stronger durable fact with null.
6. Add process-level negative tests that drive the real runner with injected
   failures before Chrome, after Chrome, after task creation, during Provider
   rejection and during cleanup. Assert the complete file set and nonzero
   process exit.

C3 - PRIVACY-SAFE CHAPTER DIAGNOSTICS

Add an internal diagnostic owned by the Runtime/runner. It must not change a
public endpoint or schema and must contain no Provider response, transcript,
evidence text, title, Cookie, key, path, raw media or evidence ID.

For initial candidate, temporal repair and bounded repair, record only facts
such as:

- validation stage and frozen failure code;
- candidate top-level key names or their stable allowlisted classification;
- chapters container type and chapter count;
- per-chapter field-name sets, invalid chapter indexes and relation enum
  validity;
- evidence count, distinct timestamp-start count, duplicate-start group count,
  maximum duplicate multiplicity, first/last timestamp and whether at least
  two strictly increasing anchors exist;
- chapter anchor count, duplicate/non-increasing anchor count and boundary
  inclusion booleans;
- repair attempt count and final fail-closed outcome.

Prefer enum/count/boolean fields. If a value is not needed to distinguish the
failure, omit it. Add a scanner test proving forbidden text/IDs/paths/payloads
cannot enter the diagnostic.

Tests must prove:

- frame and OCR evidence may share a start timestamp while a valid candidate
  still passes when two or more distinct temporal anchors exist;
- equal chapter anchors remain rejected;
- an evidence catalog with fewer than two distinct starts is diagnosed as
  insufficient temporal capacity and remains fail-closed;
- malformed chapter count and malformed chapter field sets are distinguished;
- diagnostics survive the runner's failed finalization and are redacted.

C4 - MINIMAX CANDIDATE SHAPE AND BOUNDED REPAIR

Investigate the production adapter rather than assuming the catalog is at
fault. The current MiniMax JSON-mode prompt has a soft outputSchema, while the
independent validator requires an exact object.

1. Enforce the frozen top-level and nested candidate shape inside the MiniMax
   adapter before returning a candidate to MediaComprehensionService.
2. Use bounded retries/regeneration by the same selected Provider for malformed
   JSON shape, chapter count/fields and temporal-anchor violations. Preserve a
   hard request bound and expose it in tests/receipts.
3. Include an explicit redacted temporal index/allowed-anchor constraint in the
   repair request. Do not expose raw text beyond the already authorized derived
   text boundary.
4. Do not silently normalize semantic content, invent a second chapter, drop a
   chapter, substitute evidence, or turn an invalid model answer into a local
   deterministic success. Persistent invalid output must retain the existing
   frozen failure code and publish nothing.
5. Do not assume the endpoint supports JSON-schema response_format. If using a
   structured-output feature, prove support through the existing adapter and
   keep a fail-closed path; do not add a new endpoint class or Provider.
6. Add fake-client tests for malformed-first/valid-next, temporal-invalid-first/
   valid-next, persistent malformed, persistent duplicate anchors, request
   bound, receipt request count/digests and no publication on exhaustion.
7. Keep the independent quality validator authoritative and unchanged unless a
   correctness bug is proven. No test may weaken its existing negative cases.

C5 - RECEIPT-EXTRAS FIX

Retain the existing fix that reads attemptId/requestSha256/responseSha256 after
the Provider request and after repair. Keep the test that validates the final
published derivative against the frozen V2.1 schema. Add a repair-path schema
case if it is not already covered.

VERIFICATION

Use targeted tests during edits, then one consolidated offline checkpoint:

- node scripts/stage_b_b5_3/test/run_offline_suite.mjs must exit 0;
- all new ledger/finalizer/diagnostic anti-false-green tests;
- Runtime GC-B5R authority, corrective and comprehension tests;
- relevant full Runtime media-focused tests if production Python changes;
- relay v11 baseline 50/50 and mutations 16/16 if any relay source-scope file
  changes; do not self-refreeze;
- secret/private-path/raw-media scan;
- zero owned process/port/profile/temp-root residue.

Do not run the visible canary or any real BVID. All external-action counters for
this corrective batch must be zero.

EVIDENCE

Write only:

docs/active/project/evidence/v3_media_companion/v3-completion/
gc-b5r-b5-offline-corrective-2026-10-24/

Include status, changed-file hashes, commands/exits, C1 action-ledger proof, C2
failure-finalizer proof, C3 diagnostic samples/schema, C4 Provider repair
matrix, C5 V2.1 schema proof, scans, cleanup, PRD review, handoff and a
PAYLOAD_MANIFEST.sha256 generated last and verified.

WORKTREE AND STOP RULES

- Do not commit, push, reset, clean, checkout, revert or overwrite unrelated
  dirty changes.
- Public contract changes are not authorized. If one becomes unavoidable,
  stop and report it rather than changing or refreezing anything.
- Do not announce B-5, Stage B or V3 PASS. Do not enter B-6/B-7.
- Stop in exactly this state when the offline corrective is green:

  GC-B5R B-5 OFFLINE CORRECTIVE AWAITING CODEX CHECKPOINT

- If any corrective cannot be closed without a public/security contract
  change, stop as:

  GC-B5R B-5 OFFLINE CORRECTIVE BLOCKED AWAITING CODEX DECISION

The final response must list changed files, contract changes or none, all test
commands/exits, C1-C5 closure evidence, all external action counters (zero),
severity, cleanup and exact stop reason.
```

