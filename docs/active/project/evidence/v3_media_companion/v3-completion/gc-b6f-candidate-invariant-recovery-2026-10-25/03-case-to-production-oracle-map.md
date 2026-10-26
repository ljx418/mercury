# GC-B6F Case To Production Oracle Map

Every obligation maps to the PRODUCTION oracle that decides it, to the test
that drives it, to the negative that proves the refusal, and to the cleanup
/ terminal state. The adapter in the tests is the REAL production adapter;
only its HTTP transport is faked.

## A. The table of the candidate-producing requests

Owner: `comprehension/diagnostics.py :: candidate_contract_requirements`,
composed by `comprehension/synthesis.py :: _candidate_contract`.

| # | Obligation | Driven by | Assertion |
|---|---|---|---|
| A1 | EVERY generation/repair task carries the complete invariant block EXACTLY once | `test_b6f1_every_generation_task_carries_the_complete_invariant_block` (parameterized over the five tasks) | the `candidateContract` key appears once; the key sets, the text ranges, the counts, the relations, the conflict flag, the boundary evidence, the anchor order and the balance thresholds are all present |
| A2 | a targeted instruction can NEVER shadow the common block | `test_b6f1_the_targeted_instructions_cannot_shadow_the_block` (the same five tasks) | the targeted list may restate a requirement, but the block is a separate value it cannot touch, and the count-independent invariant statements are IDENTICAL in every request |
| A3 | the owner is pure and stable | `test_b6f1_the_contract_owner_is_pure_and_stable` | the same evidence produces the same block |

## B. The value domains

Owner: `comprehension/diagnostics.py :: text_type_class`,
`text_length_bucket`, `evidence_ids_container_class`,
`evidence_ids_item_counts`, `brief_value_domain_diagnostic`,
`collection_value_domain_diagnostic`, `chapter_value_domain_diagnostic`.

| # | Obligation | Driven by | Assertion |
|---|---|---|---|
| B1 | the brief text bucket is EXACT and one over | `test_b6f2_the_brief_text_length_buckets_are_exact` (19/20/100/101) | the bucket is `too_short` / `in_range` / `in_range` / `too_long` and the violation class follows |
| B2 | the claim text bucket is EXACT and one over | `test_b6f2_the_claim_text_length_buckets_are_exact` (7/8/240/241) | the same |
| B3 | the chapter name bucket is EXACT and one over | `test_b6f2_the_chapter_name_length_buckets_are_exact` (3/4/80/81) | the same |
| B4 | the chapter statement bucket is EXACT and one over | `test_b6f2_the_chapter_statement_length_buckets_are_exact` (7/8/500/501) | the same |
| B5 | the text TYPE is reported without the value | `test_b6f2_the_brief_text_type_is_reported_without_the_text` | `not_a_string` and `unknown`, and the value never appears |
| B6 | the evidence-id container and item failures are reported | `test_b6f2_the_evidence_id_container_and_item_failures_are_reported` | the container class, the item count, the empty count, the non-string count |
| B7 | the unknown-reference count is reported per collection | `test_b6f2_the_unknown_reference_count_is_reported_per_collection` | the count is 1 and the id never appears |

## C. The privacy of the diagnostic

| # | Obligation | Driven by | Assertion |
|---|---|---|---|
| C1 | the diagnostic carries no content, no ids, no Provider identity, no path and no secret | `test_b6f3_the_diagnostic_carries_no_content_no_ids_and_no_provider_identity` | the secret text, an evidence id, the Provider identity, a path and a key pattern are all absent |
| C2 | the balance assessment stays privacy-safe | `test_b6f3_the_balance_assessment_stays_privacy_safe` | the counts and the ratios only |
| C3 | the runner's sanitized diagnostic carries only allowlisted structural facts | `scripts/stage_b_b5_3/test/b6f_candidate_diagnostic.node-test.mjs` → "the value-domain diagnostic survives the sanitization" | the brief, the claim and the chapter subdomain facts, the balance facts and the attempt count cross the runner boundary |
| C4 | the sanitized diagnostic carries no content, no ids and no Provider identity | the same file → "the sanitized diagnostic carries NO content, NO ids and NO Provider identity" | the secret text, a path, a rogue key, a request body, a response body and an evidence id never reach the receipt; the diagnostic itself carries no Provider identity |

## D. The scripted real trace

Owner: `comprehension/synthesis.py :: _enforce_candidate` (the ONE loop) and
`comprehension/quality.py :: chapter_balance_requirements`.

| # | Obligation | Driven by | Assertion |
|---|---|---|---|
| D1 | the observed sequence (brief_shape → brief_value_domain → temporal → brief_value_domain → temporal+balance → brief_value_domain → valid) CONVERGES inside the same budget | `test_b6f4_the_real_trace_converges_inside_the_same_budget` | the accepted candidate is the Provider's LAST candidate byte for byte (NO local mutation), the requests stay inside the hard bound and every request carried the block |
| D2 | the same sequence that never converges FAILS CLOSED at the bound | `test_b6f4_the_real_trace_fails_closed_at_the_bound` | the frozen code, at most eight outbound attempts and a `fail_closed` diagnostic |
| D3 | the terminal sequence publishes NOTHING and leaves the previous durable product byte-identical | `test_b6f4_the_terminal_sequence_publishes_nothing_and_keeps_the_product` | the service raises the frozen `V3510B_PROVIDER_RESPONSE_INVALID`, the published bytes are identical before and after, and the internal diagnostic of the final refusal exists |

## E. The route parity and the selectable adapters

| # | Obligation | Driven by | Assertion |
|---|---|---|---|
| E1 | the initial route and `repair_v2` use the SAME owner | `test_b6f5_the_initial_route_and_repair_v2_use_the_same_owner` | the key sets, the text ranges, the relations, the conflict flag and the boundary evidence are identical in both routes |
| E2 | the selectable strict adapter runs the shared repair loop | `test_b6f5_the_strict_adapter_runs_the_shared_repair_loop` | the strict adapter's schema recognizes the shape, the balance and the temporal repair tasks |
| E3 | the trust decision is STRUCTURAL only | `test_b6f5_the_trust_decision_is_structural_only` | a value defect keeps the trust; an unknown key, an invalid container type and a missing key break it |

## F. The frozen regressions

| Suite | Result |
|---|---|
| the new GC-B6F focused Python tests | 38 passed, exit 0 |
| the GC-B5R / GC-B6D comprehension focused tests | 238 passed, exit 0 |
| the FULL Runtime `pytest tests/` | 1321 passed, 3 skipped, exit 0 |
| the B6C runner / lifecycle / B6D / B6F Node focus | 45 passed, exit 0 |
| the FULL offline Stage B suite (including the relay v11 gate) | 625 passed, exit 0 |
