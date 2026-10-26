# PRD coverage and risks

## 1. The contract this batch implements

`docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-grounded-comprehension-contract.md`
— SHA-256 `c03491d5f55d3950448de75d20f2c89c1195234da05d17329f3a6f19254f38b8` (re-verified).

## 2. Coverage

| Contract section | How the batch covers it | Oracle |
|---|---|---|
| Identity and persistence — the aggregate key is `(taskId, taskRevision, evidenceCatalogSha256)`; a derivative is written by temporary file plus atomic replace; a Provider failure leaves the previous published projection byte-identical | the runner read the published V2.1 derivative from the isolated Runtime's private root and recorded its digest; a refused synthesis published **nothing** and the local product stayed unchanged | `04-six-source-case-table.md`, `run/bvid-*/cleanup.json` |
| Identity and persistence — "A read returns V2 only when all three fields match current source authority" | the input authority refuses a stale authority, a moved revision, a foreign identity, a cross-run generation and a closed import **before** the Provider and again before the publication | `tests/test_v3_gc_b5r_input_authority.py` (32), `tests/test_v3_gc_b5r_corrective_authority.py` (12) |
| Evidence regions | unchanged; the frozen validator owns it | the pre-existing comprehension suite (28) |
| Brief and claims | unchanged | the pre-existing comprehension suite |
| Chapters | **the observed block**: three sources' cloud output violated the frozen chapter invariants and the product refused to publish | `04-six-source-case-table.md` |
| Status and failure codes | unchanged; the 18 frozen `V3510B_*` codes decided the outcomes | the per-source dispositions |
| Authorization and disclosure — only the derived text crosses the Provider boundary; the six upload counters are zero | the published receipts carry the six counters at zero for every source | `06-provider-and-upload-boundary.json` |
| Authorization and disclosure — no raw media, no cookie, no API key, no local path in the evidence | the per-source `secret_scan.csv` reports zero hits; the evidence carries no value, no path and no media | `08-secret-path-raw-media-scan.json` |
| API and UI mapping — no new public endpoint | the batch added no endpoint; the runner used the existing public synthesis route with a companion session | the diff of `app.py` and the service |

## 3. The goal clauses of this workpack

| Clause | Covered |
|---|---|
| R0 — the active runner consumes the canonical v2 registry; the aggregate exit is nonzero for every listed condition; the offline suite stays deterministic | `lib/registry.mjs` (the v2 digest, the order, the reserve refusal), `lib/aggregate.mjs` (the pure evaluator), the sequencer's nonzero exit, 236 offline cases |
| R1 — one production preflight with zero visible actions | `scripts/stage_b_b5_3/production_preflight.mjs`, 34 green checks, every action counter zero |
| R2 — exactly one consolidated visible batch | the clean batch in `run/`; six owned muted windows; the six sources in the registry order; the product path only |
| R3 — the consolidated regression and the evidence package | `02-commands-and-exits.md`, this package |

## 4. The contract changes

**None.** No public API, schema, FailureCode set, threshold, message set,
Provider registry, Origin/auth ordering, denominator or historical evidence was
changed. The relay v11 fixtures, inventories, schemas, registry and verifier
code are untouched, and **nothing was refrozen**.

Two INTERNAL corrections are in the tree, both of which make the product
comply with its own frozen contract:

1. **The receipt extras are read after the request.** The comprehension service
   read the Provider's receipt extras *before* the request, so the published
   V2.1 derivative carried an empty `attemptId`, `requestSha256` and
   `responseSha256` — and the frozen V2.1 schema requires those fields. The
   fix reads the extras after the request (and again after a bounded repair).
   The offline gate `test_c1_the_published_derivative_satisfies_the_frozen_v2_1_schema`
   validates the published derivative against the frozen schema and would have
   caught this.
2. **The input authority's generation comparison.** The corrective batch of
   the previous workpack (M-GCB5R-01) is closed: the global lease mirror is
   gone, the production composition injects the manager-owned resolver, and a
   local input without a verifiable current generation is refused.

**This run's evidence was produced before correction 1.** The next batch must
re-publish the derivatives to produce schema-valid evidence.

## 5. The risks

| # | Risk | Severity | Note |
|---|---|---|---|
| 1 | The cloud output violates the frozen chapter invariants for 3 of the 6 sources | **Major** | the block itself; the product refused correctly. The two candidate causes (the model's chapter choice, and the evidence catalog's timestamp shape where a frame and its OCR text share a start timestamp) are NOT separable with this run's evidence |
| 2 | The published derivative did not satisfy the frozen V2.1 schema (empty receipt extras) | **Major** | found by the run, fixed in the tree with an offline gate; the evidence of this run predates the fix |
| 3 | The runner's route observation is null in the receipts (the transcript projection did not expose a route to the runner's read) | Minor | the route is nevertheless established by the run: the credential channel + lease appear in every source's Runtime call trace, and no capture grant was ever requested — so tabCapture was not used |
| 4 | The offline suites leave their own scratch directories in the temporary root | Minor | a pre-existing test-hygiene gap, not owned run residue |
| 5 | The public metadata preflight is a reachability hint, not acceptance proof | Minor | unchanged from the rebaseline; every source still had to be acquired for real |
| 6 | Six long videos on one machine exceed the declared execution budget | Minor | the batch used ~22 minutes of the 120-minute budget |
| 7 | The provider's structured output may fail the frozen quality rules for a subset of sources | Major (same as #1) | a second batch would be needed to tell a per-source defect from a systematic one |

## 6. The severity

**Fatal 0 / Major 2 / Minor 5.**

The two Major findings are the two blocks above. Both are reported, neither is
worked around: no fake Provider, no hard-coded success, no weaker oracle, no
substituted source and no reserve was used.
