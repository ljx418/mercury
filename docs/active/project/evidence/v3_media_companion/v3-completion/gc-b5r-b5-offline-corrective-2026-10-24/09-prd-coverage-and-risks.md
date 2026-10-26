# PRD coverage and risks (offline corrective)

## 1. The contract this batch implements

`docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-grounded-comprehension-contract.md`
(SHA-256 `c03491d5f55d3950448de75d20f2c89c1195234da05d17329f3a6f19254f38b8`, re-verified) and
`docs/active/project/contracts/v3_media_grounded_comprehension_v2_1.schema.json`
(the frozen V2.1 schema, unmodified).

## 2. Coverage

| The contract's rule | State after this batch | Oracle |
|---|---|---|
| the chapter starts remain strictly increasing | **unchanged**; the adapter now refuses a violating candidate earlier and regenerates it with the same Provider | `test_c3_equal_chapter_anchors_remain_rejected`, `test_c4_a_temporal_invalid_first_candidate_is_regenerated` |
| the chapter count remains 2..12 | **unchanged**; the adapter enforces it before the validator sees the candidate | `test_c4_the_malformed_chapter_count_and_fields_are_distinguished` |
| the chapter fields remain exact | **unchanged**; the adapter enforces the exact key sets | the same case |
| every evidence binding remains closed | **unchanged**; the validator stays authoritative | `test_c4_the_independent_validator_stays_authoritative` |
| a Provider candidate that cannot satisfy the rules stays fail-closed | **unchanged**; the bounded regeneration ends in the frozen failure code and publishes nothing | `test_c4_a_persistently_malformed_candidate_exhausts_the_bound`, `test_c4_persistently_duplicated_anchors_fail_closed` |
| raw Provider output, transcript text and evidence text remain private | **unchanged**; the diagnostic is shape/count/enum/boolean only, and the runner sanitizes it | `test_c3_the_diagnostic_carries_no_text_no_ids_no_paths_and_no_payloads`, `C3: the redacted chapter diagnostic survives the failed finalization` |
| the published derivative satisfies the frozen V2.1 schema | the receipt extras are read after the request and after the repair | `test_c1_the_published_derivative_satisfies_the_frozen_v2_1_schema`, `test_c5_the_repair_path_also_publishes_a_schema_valid_derivative` |

## 3. The checkpoint's findings

| Finding | Closed by | The evidence |
|---|---|---|
| M-B5-01 — the stage action accounting is materially incomplete | C1 | `01-stage-action-reconciliation.json`: the stage lower bound is **34** explicit Chrome launches, reconciled from the retained logs without modifying them; the ledger's stage totals and candidate totals are different numbers |
| M-B5-02 — the failure paths do not produce the mandatory machine evidence | C2 | `04-c2-failure-finalizer-proof.md`: the five process-level negative cases each write the complete nine-file audit set and exit nonzero |
| M-B5-03 — the chapter failure evidence is insufficient | C3 + C4 | `05-c3-diagnostic-samples.json`: the shape, the chapter count, the field-set classes, the anchor counts and the evidence's temporal capacity |
| Minor 1 — the Node aggregate exits 1 and the canary is unclassified | the one offline command | the command exits 0 and classifies the canary as `external_not_run`; the PH0-AR-10 race is fixed at its ownership (a readiness marker) |
| Minor 2 — the coordinator hook is test-injected only | the production composition | `app.py` injects the REAL coordinator; the durable task/import authority stays decisive after a restart |
| Minor 3 — no self-checking manifest | `PAYLOAD_MANIFEST.sha256` | generated last and verified with `sha256sum -c` |

## 4. The residual risks

These are the risks of the REJECTED candidate. This batch does not resolve
them: it resolves the evidence and the accounting so that a future visible run
can.

| # | Risk | Severity | Note |
|---|---|---|---|
| 1 | The cloud output violates the frozen chapter invariants for 3 of the 6 sources | **Major** (unchanged) | the adapter now regenerates a malformed answer with the same Provider, but a persistent violation still fails closed. The redacted diagnostic (C3) will finally tell a malformed model answer from an evidence catalog that cannot support two strictly increasing anchors |
| 2 | The published derivatives of the rejected run carry the empty receipt extras | **Major** (unchanged) | the fix is in the tree (C5); the run's evidence predates it and is historical. A future visible run must re-publish them |
| 3 | The stage action accounting of the earlier attempts is a LOWER BOUND | Minor | 34 is what the retained logs prove; the exact number cannot be reconstructed, and no counter was guessed |
| 4 | The visible run's authorization model is new | Minor | the one-shot identifier is consumed before Chrome; the operator must issue a FRESH identifier per visible run, and a reused one is refused |
| 5 | The runner's Stage A budget is 20 minutes per source | Minor | unchanged from the rejected candidate; the six long sources need it |

## 5. The severity of this batch

**Fatal 0 / Major 0 / Minor 0** in this corrective batch's own changes. The
Major findings of the checkpoint are closed as mapped in §3; the residual risks
above belong to the rejected candidate and to the next visible run.

## 6. The contract changes

**None.** No public API, schema, FailureCode set, threshold, message set,
Provider registry, Origin/auth ordering, denominator or historical evidence was
changed. The relay v11 fixtures, inventories, schemas, registry and verifier
code are untouched, and **nothing was refrozen**: the baseline is 50/50 and the
mutations are 16/16 because this batch touched no relay source-scope file.
