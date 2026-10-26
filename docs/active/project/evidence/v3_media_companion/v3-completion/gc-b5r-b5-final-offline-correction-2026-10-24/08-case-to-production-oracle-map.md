# The case → production-oracle map

Every case of the corrective goal, and the PRODUCTION code path that proves
it. A case that is only proven by a test-only seam is marked as such.

## FC1 — the one-shot authorization

| required proof | the production oracle | the case |
|---|---|---|
| one authorization permits all six expected children | `scripts/stage_b_b5_3/sequencer.mjs` → `consumeAuthorization` → six `verifyChildGrant` calls in `run_one_bvid.mjs` | `FC1: one sequencer authorization permits exactly the six expected children` |
| a second sequencer with the same authorization is refused BEFORE Chrome | the sequencer's authorization branch, before the loop | `FC1: a second sequencer with the same authorization is refused before Chrome` |
| two concurrent sequencers produce exactly one winner | `fs.openSync(marker, "wx")` in `lib/authorization.mjs` | `FC1: two concurrent sequencers produce exactly one winner` |
| a malformed authorization / grant state refuses | `consumeAuthorization` / `verifyChildGrant` state parsing | `FC1: a corrupt authorization state fails closed` |
| a substituted / reordered / stale / cross-run grant is refused | the grant digest + the run / registry / order / identity checks | `FC1: a substituted, reordered, stale or cross-run grant is refused` |
| every refusal branch has zero Cookie reads and zero external actions | the runner's grant gate, which precedes the Cookie inspection and Chrome | `FC1: a directly invoked child without a grant performs no external action`, `FC1: a missing authorization refuses the sequencer before any child` |
| the raw authorization value is never persisted | the digest-only marker and grant files | `FC1: the raw authorization value is never persisted` |

## FC2 — the action ledger

| required proof | the production oracle | the case |
|---|---|---|
| the exact schema for every event and its optional detail | `validateLedgerRecord` in `lib/action_ledger.mjs` | `the ledger is append-only and records the attempts and the counters` |
| an arbitrary detail object is rejected | `appendLedgerEvent` throws on an invalid record | the same case, plus `the ledger never records a value, a length or a path` |
| a malformed / truncated / unknown line sets `integrityOk=false` | `readLedgerEvents` / `readStageTotals` | `a malformed prior ledger line is skipped, not fatal` + the receipt in `04-fc2-action-ledger-proof.md` |
| and it prevents a positive aggregate verdict | `evaluateAggregate({ ledgerIntegrityOk })` → `AGG_LEDGER_INTEGRITY` | the same receipt: `verdictPositive: false` |
| the candidate totals and the stage lifetime totals are separate | `readStageTotals({ candidateRunId })` | `the stage totals and the candidate totals are different numbers` |
| the retained-log historical lower bound is ≥ 34 | `reconcileRetainedLogs` over the retained packages | `the historical retained logs give a lower bound of at least 34 launches` |
| a clearly labelled combined bound, without double counting | `sequencer.mjs` → `aggregate.actionLedger.combinedLowerBound` | `the summary reports the action ledger without double counting` (sequencer test) |
| only safe relative labels, never absolute paths | `reconcileRetainedLogs` + the collector in `lib/retained_logs.mjs` | `the historical retained logs give a lower bound of at least 34 launches` (asserts no completion root and no `/tmp/`) |
| an attempt is recorded AT the action boundary, including a failed Provider HTTP attempt | `run_one_bvid.mjs` → `ledger.record("providerCall", …)` BEFORE the fetch | the FC3 case `a structured Runtime failure produces the exact safe failure code and no path` (exactly ONE `providerCall` for the rejected attempt) |

## FC3 — the failure evidence and the monotonic finalization

| required proof | the production oracle | the case |
|---|---|---|
| the nine-file audit set | `finalizeAuditEvidence()` in `run_one_bvid.mjs` | `FC3: a structured Runtime failure produces the exact safe failure code and no path` |
| the exact safe failure code, kept from the structured Runtime response | `classifyRuntimeFailure` in `lib/privacy.mjs` | the same case |
| the attempted Provider facts, with a null publication | the receipt builder of the runner | the same case |
| an accurate ledger count | the durable stage ledger | the same case |
| no secret sample | the secret scan of the runner | the same case |
| no absolute path | `detectAbsolutePaths` over the whole audit set | the same case |
| a fresh-process re-entry never degrades a known fact | the monotonic merge of `finalizeAuditEvidence()` | `FC3: a fresh-process re-entry never degrades a known fact` |
| no arbitrary response body is stored | `classifyRuntimeFailure` returns only a code + a status | `FC3: an unallowlisted Runtime code is never stored` |
| a generic POSIX/Windows path detector with a narrow allowlist | `lib/privacy.mjs` | the seven cases of `privacy_scan.node-test.mjs` |
| the secret scan stores only classification, count and a hashed reference | the runner's secret scan | the FC3 case, plus `a file reference is a hash, never a path` |

## FC4 — the exact candidate shape

| required proof | the production oracle | the case |
|---|---|---|
| the exact key set of the top level | `candidate_shape_diagnostic` in `comprehension/diagnostics.py` | `test_fc4_a_missing_top_level_field_is_refused` |
| the exact key set of the brief | the same | `test_fc4_a_brief_with_a_missing_field_is_refused`, `..._with_an_extra_field_is_refused` |
| the exact key set of EVERY claim | the same | `test_fc4_an_extra_field_on_a_non_first_claim_is_refused`, `test_fc4_a_missing_field_on_a_non_first_claim_is_refused` |
| a non-object claim is refused | the same | `test_fc4_a_non_object_claim_is_refused` |
| the conflict flag is a real boolean | the same | `test_fc4_a_null_conflict_flag_is_refused`, `test_fc4_a_missing_conflict_flag_is_refused`, `test_fc4_a_non_boolean_conflict_flag_is_refused` |
| the exact key set of EVERY chapter | the same | `test_fc4_every_chapter_is_checked` |
| the same temporal validation and the bounded same-Provider regeneration on `repair_v2` | `_enforce_candidate` in `comprehension/synthesis.py` | `test_fc4_the_repair_route_enforces_the_temporal_contract` |
| ONE shared candidate-enforcement function | the same function called by both routes | `test_fc4_the_two_routes_issue_the_same_regeneration_contract` |
| a recovered diagnostic records a resolved outcome; only a terminal refusal says fail-closed | `_record_stage_diagnostic` + `build_stage_b_diagnostic` | `test_fc4_a_recovered_diagnostic_records_a_resolved_outcome`, `test_fc4_a_terminal_refusal_records_fail_closed` |

## FC5 — the global request cap

| required proof | the production oracle | the case |
|---|---|---|
| the cap is enforced immediately before every outbound HTTP attempt in the lowest common send path | `_guard_request_budget()` in BOTH `_complete_once` implementations | `test_fc5_the_cap_is_eight_and_is_exposed` |
| a retry after a timeout / malformed JSON / invalid response counts against the same cap | `_complete`'s retry loop + the budget check | `test_fc5_the_retries_of_one_request_count_against_the_same_cap` |
| starting at cap-1, the client is called at most once more and the recorded attempts never exceed 8 | the same | `test_fc5_a_timeout_at_the_cap_boundary_calls_the_client_once_more`, `test_fc5_a_malformed_response_at_the_cap_boundary_calls_the_client_once_more` |
| the initial extraction, the candidate generation, the shape repair, the temporal repair and `repair_v2` share ONE cap | the single `self._requests` counter of the adapter | `test_fc5_the_initial_route_and_the_service_repair_share_one_cap`, `test_fc5_the_extraction_shares_the_cap_with_the_candidate` |
| exceeding the cap preserves the frozen failure code and publishes nothing | `_guard_request_budget` + `_enforce_candidate` | `test_fc5_exceeding_the_cap_publishes_nothing` |

## The seams that remain test-only, and where they are used

| seam | what it is | where it is used | why it is acceptable |
|---|---|---|---|
| `NAVIA_B5_TEST_RUNTIME_URL` | the local Runtime double of the runner | the runner failure-evidence tests | it replaces the Runtime, not the runner's own logic; the FC3 case exercises the runner's classification, finalization and audit set against it |
| `NAVIA_B5_TEST_NO_BROWSER` | no Chrome | the runner failure-evidence tests | the runner's own flow, ledger and finalization still run |
| `NAVIA_B5_TEST_DB_PATH` | a synthetic SQLite database | the runner failure-evidence tests | the database is created by the test with synthetic rows |
| `httpx.MockTransport` | the Provider transport | every Runtime-side test | the adapter's own code (the budget, the parsing, the enforcement) is the production code |
| the STUB runner (`test/_fixtures/grant_stub_runner.mjs`, `stub_runner.mjs`) | a child that writes the evidence set without a browser | the sequencer-level tests | the sequencer's own authorization, ledger, aggregate and stop logic is the production code |

**No case above is proven by a seam that skips the behaviour under test.** The
FC3 case in particular drives the REAL structured Runtime failure through the
REAL runner; the test-only fault seam that skips the external work is NOT
sufficient for that oracle and is NOT what is used there.
