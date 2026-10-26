# O01–O12 — case to production oracle

Every obligation of `post-wp-b-rebaseline-2026-10-23/02-acceptance-plan.md` is
mapped to the case that drives it and to the production owner whose state or
resource outcome the case asserts. A string search or a fixture shape never
satisfies O03–O10 on its own.

## Python — `services/local-runtime/tests/test_v3_gc_b5r_input_authority.py`

| ID | Case | Production owner driven | State / resource oracle |
|---|---|---|---|
| O01 | `test_o01_the_inventory_names_the_live_production_symbols` | `MediaComprehensionService.synthesize` / `_require_current_input` / `_assert_current_binding` / `_save_grounded_v2_1`, `MediaInputAuthority.require_current_input`, `resolve_binding` | the inventoried symbols still exist; exactly one `synthesis_provider_factory()` call site; the atomic V2.1 write is the publication; no `fallback` / `best_of` token was introduced |
| O03 | `test_o03_the_local_binding_resolves_from_the_durable_record` | `LocalMediaImportStore.list_for_task` + `resolve_binding` | the binding carries the task, the exact identity, the generation, the import id and the `ready` state |
| O03 | `test_o03_a_mismatched_task_is_refused` | `verify_binding` | `V3_MEDIA_CROSS_TASK_REUSE` |
| O03 | `test_o03_a_mismatched_media_identity_is_refused` (3 identities: media id, playback unit, part) | `verify_binding` + `source_identity_parts` | `V3_MEDIA_TRANSCRIPT_SOURCE_MISMATCH` per identity |
| O03 | `test_o03_a_cross_run_generation_is_refused` | `verify_binding` | `V3_MEDIA_CROSS_TASK_REUSE` |
| O03 | `test_o03_a_cancelled_import_never_reaches_the_provider` | `MediaComprehensionService.synthesize` | `V3_MEDIA_IMPORT_CANCELLED`; the Provider was **not** called; no derivative published |
| O03 | `test_o03_a_mismatched_identity_never_reaches_the_provider` | `MediaComprehensionService.synthesize` | `V3_MEDIA_TRANSCRIPT_SOURCE_MISMATCH`; no Provider call; no derivative |
| O03 | `test_o03_a_cross_run_asset_never_reaches_the_provider` | `MediaComprehensionService.synthesize` | `V3_MEDIA_CROSS_TASK_REUSE`; no Provider call; no derivative |
| O03 | `test_o03_the_default_authority_is_the_production_composition` | the service-composed authority (no injection) + the real local-import store on the real Runtime database | the synthesis publishes; the projection names the locked Provider |
| O03 | `test_o03_the_default_authority_refuses_a_foreign_asset` | the service-composed authority | `V3_MEDIA_TRANSCRIPT_SOURCE_MISMATCH`; no Provider call; no derivative |
| O03 | `test_o03_the_default_authority_refuses_a_cancelled_import` | the service-composed authority | `V3_MEDIA_IMPORT_CANCELLED`; no Provider call; no derivative |
| O03 | `test_o03_a_revision_mismatch_is_refused` | `MediaInputAuthority.require_current_input` | `V3510B_TASK_REVISION_CONFLICT`; the Provider was **not** called |
| O03 | `test_o03_a_stale_source_authority_is_refused` | `MediaTaskStore.require_current_authority` | `V3_MEDIA_HISTORICAL_READ_ONLY`; no Provider call |
| O04 | `test_o04_the_automatic_routes_precede_the_explicit_local_import` | `MediaAcquisitionCoordinator.local_import_eligibility` / `record_route_failure` | the local route is closed while the automatic routes are alive; an out-of-order route failure is `V3_MEDIA_ROUTE_ORDER_INVALID`; after the three frozen failures the local route is eligible; a foreign source is `V3_MEDIA_TASK_INVALID` |
| O04 | `test_o04_tab_capture_stays_default_off` | `MediaAcquisitionCoordinator.bind_capture_grant` / `capture_eligibility` / `get` | a capture grant before the three routes is `V3_MEDIA_CAPTURE_NOT_ELIGIBLE`; the task holds **no** grant until it is explicitly bound |
| O05 | `test_o05_exactly_one_provider_is_asked_per_task` | `MediaComprehensionService.synthesize` + the V2.1 publisher | exactly **one** Provider call, **one** factory call, no repair, one `providerId`/`modelId` in the published receipt, `requestCount == 1` |
| O05 | `test_o05_a_task_without_a_provider_is_rejected` | `MediaComprehensionService.synthesize` | zero Providers is `V352_SYNTHESIS_PROVIDER_MISSING`; nothing published |
| O06 | `test_o05_the_outbound_payload_carries_only_derived_text` | the Provider boundary + the V2.1 receipt builder | the outbound payload carries only `evidenceId/kind/timestampStartMs/timestampEndMs/text`; the six upload counters are `0`; `rawMediaUploadCount == 0` |
| O06 | `test_o06_the_published_payload_carries_no_raw_media_or_local_path` | the atomic publisher | the published bytes carry no secret shape, no cookie, no API key, no local path, no media file name, no base64 blob and no private root |
| O07 | `test_o07_a_short_brief_is_rejected_by_the_production_validator` | `validate_grounded_comprehension` | `V3510B_BRIEF_LENGTH_INVALID`; nothing published |
| O07 | `test_o07_a_raw_transcript_prefix_brief_is_rejected` | `validate_grounded_comprehension` | `V3510B_BRIEF_RAW_PREFIX`; nothing published |
| O07 | `test_o07_a_broken_chapter_timeline_is_rejected` | `validate_grounded_comprehension` | `V3510B_CHAPTER_TIME_INVALID`; nothing published |
| O07 | `test_o07_an_unknown_evidence_id_is_rejected` | `validate_grounded_comprehension` | `V3510B_EVIDENCE_UNCLOSED`; nothing published |
| O07 | `test_o07_a_foreign_evidence_id_in_a_claim_is_rejected` | `validate_grounded_comprehension` | `V3510B_CLAIM_EVIDENCE_UNCLOSED`; nothing published |
| O08 | `test_o08_a_successful_publication_is_atomic_and_leaves_no_temporary` | `_save_grounded_v2_1` → `_atomic_save_grounded` | the derivative exists under the frozen path, mode `0o600`, and **no** `.tmp` survives |
| O08 | `test_o08_a_failed_publication_preserves_the_previous_bytes` | the same publisher | a failing synthesis leaves the published bytes byte-identical and no `.tmp` |
| O08 | `test_o08_the_v1_synthesis_bytes_are_never_renamed_or_deleted` | the V1/V2 paths | the legacy V1 bytes are untouched and no V2 path is created |
| O09 | `test_o09_a_cancelled_task_publishes_nothing_and_leaves_no_residue` | `MediaTaskStore.retry` → `transition(cancelled)` → `synthesize` | `V351_TASK_NOT_READY`; no Provider call; no derivative |
| O09 | `test_o09_a_cancelled_import_publishes_nothing` | the local-import store + the authority | `V3_MEDIA_IMPORT_CANCELLED`; no Provider call; no derivative |
| O09 | `test_o09_a_restart_preserves_the_published_bytes` | a fresh service over the same roots | the derivative is byte-identical after the restart; no `.tmp` |
| O09 | `test_o09_a_restart_after_a_cancellation_publishes_nothing` | a fresh service over the same roots | the closed owner is not resurrected; no Provider call; no derivative |

## Node — `scripts/stage_b_b5_3/test/gc_b5r_preflight.node-test.mjs`

| ID | Case | Production owner driven | State / resource oracle |
|---|---|---|---|
| O02 | `O02: the frozen registry file digest is the frozen one` | the frozen registry file | SHA-256 `25331486…f439` |
| O02 | `O02: readFrozenRegistry returns the six frozen identities in order` | `readFrozenRegistry` / `assertRegistryOrder` | the six `(order, bvid)` pairs, in the frozen order |
| O02 | `O02: the registry forbids substitution and cross-run reuse` | the frozen registry | `substitutionAllowed === false`, `crossRunArtifactReuseAllowed === false` |
| O02 | `O02: a substituted registry is refused, not adopted` | `readFrozenRegistry` | a digest change is a refusal, never an adoption |
| O02 | `O02: a re-ordered registry is refused` | `readFrozenRegistry` | a re-order is a refusal |
| O02 | `O02: assertRegistryOrder refuses a swapped order` | `assertRegistryOrder` | a refusal |
| O02 | `O02: the runner refuses a substituted (order, bvid) pair` | `assertFrozenIdentity` (called by `run_one_bvid.mjs`) | a substituted pair and an out-of-range order are refused |
| O05 | `O05: the locked Provider is accepted` | `providerLockOffenders` | no offender for the locked Provider |
| O05 | `O05: ZERO Providers is a refusal` | `providerLockOffenders` | `providerId=missing` / `receipt=missing` |
| O05 | `O05: TWO Providers is a refusal` | `providerLockOffenders` | `providers=2` |
| O05 | `O05: a Provider outside the lock is a refusal` | `providerLockOffenders` | `providerId=<foreign>` |
| O06 | `O06: the upload counters of a clean receipt are all zero` | the frozen hard-zero counter set | all six counters are `0` |
| O10 | `O10: the preflight plan reports every action count as zero` | `buildPreflightPlan` | all eleven action counters are `0`; `attempted === false`; `anySourcePassed === false` |
| O10 | `O10: no source is ever reported as passed` | `buildPreflightPlan` / `buildPreflightReceipt` | every source: `disposition === "preflight_only"`, `passed === false` |
| O10 | `O10: the preflight inspects only DECLARED local assets` | `inspectSource` / `buildPreflightPlan` | a declared asset is reported by `stat` only; its **content** never enters the plan; an undeclared asset is absent |
| O10 | `O10: an undeclared asset is absent, never searched for` | `inspectSource` | `localAssetConfigured === false`, `localAssetAvailable === false` |
| O10 | `O10: a missing declared manifest is a refusal, not a silent empty plan` | `readLocalAssetManifest` | a refusal |
| O10 | `O10: the preflight-only run writes a receipt and starts nothing` | the real `sequencer.mjs --preflight-only=1` | exit 0; the receipt holds the frozen registry digest, all eleven counters `0`, `attempted === false`, `anySourcePassed === false`, six sources with `passed === false`; **no** `bvid-*` directory exists; the sequencer summary is `mode: "preflight-only"` with an empty `bvids` list |

## Consolidated obligations

| ID | Oracle | Where |
|---|---|---|
| O11 | the affected Runtime suites, the affected Node suites and the two frozen relay verifiers all pass | `03-commands-and-results.md` |
| O12 | relay v11 baseline 50/50 (exit 0) and relay v11 mutations 16/16 (exit 0), with **no** self-refreeze | `03-commands-and-results.md` |
