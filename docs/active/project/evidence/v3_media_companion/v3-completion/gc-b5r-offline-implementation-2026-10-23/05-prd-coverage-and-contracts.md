# PRD coverage and contract-change statement

## 1. The frozen contract this batch implements against

`docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-grounded-comprehension-contract.md`
— SHA-256 `c03491d5f55d3950448de75d20f2c89c1195234da05d17329f3a6f19254f38b8`
(re-verified in this batch).

## 2. Coverage of the contract's normative sections

| Contract section | Requirement | How this batch satisfies it | Oracle |
|---|---|---|---|
| Identity and persistence | The aggregate key is `(taskId, taskRevision, evidenceCatalogSha256)`; a derivative is written by temporary file plus atomic replace; a stale or invalid derivative is ignored for reads and cannot overwrite V1; a Provider failure leaves the previous published projection byte-identical | unchanged: the publisher is the existing `_save_grounded_v2_1` → `_atomic_save_grounded`; the new authority runs **before** the publication, so a foreign input can never be published, and a failure leaves the bytes untouched | `test_o08_*` (3 cases) |
| Identity and persistence | "A read returns V2 only when all three fields match current source authority" | the new authority checks the CURRENT task authority and the CURRENT revision before the Provider is asked; the existing `_assert_current_binding` still guards the commit | `test_o03_a_stale_source_authority_is_refused`, `test_o03_a_revision_mismatch_is_refused` |
| Evidence regions | the thirds, the `substantive` availability, the `spanEnd / mediaDuration >= 0.90` rule, `limited` with `V3510B_ENDING_EVIDENCE_MISSING` | unchanged: the frozen validator owns it; this batch added no region rule | `test_o07_*` (5 cases) |
| Brief and claims | the 20–100 character brief, the raw-excerpt refusal, the closed claim set, the evidence closure | unchanged: the frozen validator owns it | `test_o07_a_short_brief_is_rejected_by_the_production_validator`, `test_o07_a_raw_transcript_prefix_brief_is_rejected`, `test_o07_an_unknown_evidence_id_is_rejected`, `test_o07_a_foreign_evidence_id_in_a_claim_is_rejected` |
| Chapters | the frozen chapter shape, the strictly increasing starts, the first chapter at the evidence span | unchanged: the frozen validator owns it | `test_o07_a_broken_chapter_timeline_is_rejected` |
| Status and failure codes | 18 frozen `V3510B_*` codes; a rejected invariant dominates and prevents publication | unchanged; the new refusals use the media codes of the frozen inventory, not new `V3510B_*` codes | `test_o07_*`, `test_o08_*` |
| Authorization and disclosure | the request may contain only evidence ID, kind, timestamps and derived text; raw video/audio/frame bytes, browser Cookie, provider key and local path counts are fixed at zero; "Revocation or stale authority before commit rejects the write" | the outbound payload is asserted to carry only the five derived fields; the six upload counters are `0`; the authority refuses a stale authority before the commit and before the Provider | `test_o05_the_outbound_payload_carries_only_derived_text`, `test_o06_the_published_payload_carries_no_raw_media_or_local_path`, `test_o03_a_stale_source_authority_is_refused` |
| API and UI mapping | no new public endpoint; the existing routes expose the derivative through the existing projection adapter | **no new public endpoint.** The service constructor gained an optional `input_authority` argument, and the Runtime composes the default authority itself — the HTTP surface, the request body, the response shape and the projection are unchanged | the existing `tests/test_v3_media_comprehension.py` (28 cases) still passes unchanged |

## 3. The GC-B5R goal clauses

| Goal clause | Covered by |
|---|---|
| G1 — one exact acquisition task/source identity; a local asset is valid only after the real WP-B user-selection lifecycle bound it to the current identity; mismatched task, mediaId, playbackUnitId, partId, revision, catalog, stale page identity and cross-run reuse are rejected before synthesis or publication; no identity is inferred from a filename, a digest or a test seed; no second orchestrator | `media_companion/local_import/binding.py` + `media_companion/input_authority.py` + the two refusal points in `comprehension/service.py`; cases in §O03 of `02-o01-o12-case-to-production-oracle.md` |
| G2 — one Provider per task; the existing Provider authorization and selection preserved; no fallback, best-of-N, cross-Provider stitching, threshold reduction, padding, truncation, paraphrase repair or fabricated claims; the existing composer allowlist behaviour and the V1/V2 bytes preserved; the V2.1 publication only after the schema, semantic/evidence, temporal and authority validation, through the existing atomic/durable pattern | nothing of the synthesis path was changed except the two refusal calls; cases in §O05, §O07, §O08 |
| G3 — cancellation, Runtime restart, stale authority, failed validation and failed atomic publication terminate the correct owner, publish no false success and leave zero task-private residue; the durable WP-B barrier and the existing acquisition cleanup ownership are reused; no competing cleanup owner | the refusals happen before the Provider and before the publication; the cleanup owners were not touched; cases in §O09 |
| G4 — the exact registry order and hash are kept; substitution and generic seed reuse are rejected; a preflight-only path inspects all six source identities and the explicitly configured matching local-asset availability without starting Chrome, Runtime media work, Provider calls, downloads, imports or artifact generation; the receipt reports all those action counts as zero; no BVID is claimed to have passed | `scripts/stage_b_b5_3/lib/preflight.mjs` + the sequencer branch + `assertFrozenIdentity` in the runner; the receipt in `04-preflight-receipt.md` |
| G5 — the twelve obligations O01–O12, each critical test driving the actual production owner and asserting the state/resource outcome, with the negative cases and the boundary/one-over and fake-clock rules | `02-o01-o12-case-to-production-oracle.md` |

### On the boundary, one-over and fake-clock rules

No **limit** was changed by this batch: the brief length (20–100), the claim
count (2–8), the chapter count (2–12), the chapter start rule, the upload
counters (0), the `requestCount` range, the registry size (6) and the
preflight action counters (0) are all frozen values that this batch did not
touch, so no new exact-boundary or one-over case is owed for a *changed*
limit. The frozen values that the new code path reaches are exercised at their
boundary by the existing validator cases and by the new preflight cases: a
zero counter (boundary) and a non-zero counter (one over) in
`O06: the upload counters of a clean receipt are all zero` and in the
production receipt assertions; the six-source registry at its exact size in
`O02: readFrozenRegistry returns the six frozen identities in order` and a
seven-source registry (one over) is refused by `assertRegistryOrder`.

No **deadline** was touched by this batch: the batch introduces no timeout, no
retry window and no polling interval. The existing frozen timeouts
(`STARTUP_DEADLINE_MS`, `CHILD_TERM_TIMEOUT_MS`, `CHILD_KILL_TIMEOUT_MS`) are
unchanged, so no fake-clock no-input test is owed for a changed deadline. The
existing `wait(ms)` case in the Node contract suite and the existing
timeouts of the runner remain the owners.

## 4. Contract-change statement

**There is no contract change.**

* No public API was added, removed or changed. The HTTP surface, the request
  bodies, the response shapes and the error codes are unchanged.
* No public schema was added, removed or changed. The V2.1 schema, the local
  import schema, the barrier schema and the relay-v11 schema are untouched.
* No FailureCode inventory was edited. The four media codes this batch raises
  (`V3_MEDIA_TRANSCRIPT_SOURCE_MISMATCH`, `V3_MEDIA_CROSS_TASK_REUSE`,
  `V3_MEDIA_IMPORT_CANCELLED`, `V3_MEDIA_IMPORT_WRITE_FAILED`) and the one
  Stage B code (`V3510B_TASK_REVISION_CONFLICT`) already existed in the
  frozen media inventory.
* No threshold was changed: the brief length, the claim and chapter counts,
  the coverage ratio, the upload counters and the registry size are unchanged.
* No message set was changed: the refusal messages are new *strings* for
  existing codes, and the frozen `V3510B_*` message set is untouched.
* No Provider registry or authorization was changed. The Provider lock in the
  runner keeps the same value (`minimax_chat_completions`) and the Runtime
  keeps the same selection.
* No Origin/auth ordering was changed.
* The six-video denominator was not changed: the registry file is byte-identical
  and its digest is verified before the inspection.
* No WP-A or WP-B evidence was edited, no relay inventory was edited and no
  historical evidence was edited.
* No hash and no verifier was self-refrozen.
