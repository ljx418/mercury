# The exact handoff

## 1. The state

**GC-B5R B-5 REAL RUN BLOCKED AWAITING CODEX DECISION**

The real six-video batch RAN (six fresh sources, in the registry order, each
with its own owned muted Chromium, owned Runtime, database, profile, task
namespace, source identity and dependency lease). The machine-positive
candidate requires `complete >= 5`, `blocked <= 1`, `limited = 0`, `failed = 0`.
The batch produced **complete 3 · limited 0 · blocked 0 · failed 3**, so the
aggregate verdict is not positive and the sequencer exited **1**.

## 2. The changed files

| Path | What it is |
|---|---|
| `scripts/stage_b_b5_3/lib/registry.mjs` | **new** — the ACTIVE v2 registry: the digest, the order, the reserves and the identity guard |
| `scripts/stage_b_b5_3/lib/aggregate.mjs` | **new** — the PURE aggregate evaluator (every failure condition of R0.3) |
| `scripts/stage_b_b5_3/lib/owned_session.mjs` | **new** — the owned-session composition: the product's cookie reader, the product's Provider metadata helper, the product's dependency preflight, the authorized cookie resolution and the product paths |
| `scripts/stage_b_b5_3/lib/extension_fixture.mjs` | **new** — the canary's frozen pre-granted permission promotion, shared with the canary |
| `scripts/stage_b_b5_3/lib/preflight.mjs` | the preflight now consumes the v2 registry and validates the declared identity and path exactly |
| `scripts/stage_b_b5_3/lib/contracts.mjs` | the exact Provider lock (`SELECTED_PROVIDER_ID` + `endpointClass`, no substring) |
| `scripts/stage_b_b5_3/sequencer.mjs` | the v2 registry, the aggregate verdict and the nonzero exit |
| `scripts/stage_b_b5_3/run_one_bvid.mjs` | the frozen-identity refusal, the pre-granted fixture, the owned Provider bootstrap, the cookie injection, the companion session, the frozen Runtime port, the machine receipt and the redacted call trace |
| `scripts/stage_b_b5_3/production_preflight.mjs` | **new** — the R1 production preflight |
| `scripts/stage_b_b5_3/test/gc_b5r_preflight.node-test.mjs` | the v2 registry, the exact preflight matching and the exact lock |
| `scripts/stage_b_b5_3/test/production_preflight.node-test.mjs` | **new** — the cookie resolution and inspection (no value, no value length, no path) |
| `scripts/stage_b_b5_3/test/runner_static_check.node-test.mjs` | **new** — the static gate (no undefined identifier, no block-scoped read) |
| `scripts/stage_b_b5_3/test/sequencer.node-test.mjs` | the v2 six and the aggregate negative matrix (the PROCESS EXIT, not a summary field) |
| `scripts/stage_b_b5_3/test/real_branches.node-test.mjs` | the v2 identity, the machine receipt in the stub, the PH0-AR-10 readiness fix |
| `scripts/stage_b_b5_3/test/canary_bvid1.node-test.mjs` | the canary now shares the fixture builder |
| `scripts/stage_b_b5_3/test/run_offline_suite.mjs` | the ONE offline command (serial phases, the external canary classified as `external_not_run`) |
| `services/local-runtime/navia_runtime/modules/media_companion/comprehension/service.py` | the receipt extras are read AFTER the request (the published derivative now satisfies the frozen V2.1 schema) |
| `services/local-runtime/tests/test_v3_gc_b5r_corrective_authority.py` | the offline gate that validates the published derivative against the frozen V2.1 schema |

The digests are in `01-changed-file-hashes.json`.

## 3. The contract changes

**None.** No public API, schema, FailureCode set, threshold, message set,
Provider registry, Origin/auth ordering, denominator or historical evidence
was changed. No relay fixture, inventory, schema, registry or verifier code was
edited and **nothing was refrozen**. The two internal corrections are listed
in `09-prd-coverage-and-risks.md` §4.

## 4. The commands and their exits

See `02-commands-and-exits.md`.

## 5. The per-source disposition

See `04-six-source-case-table.md` and `05-per-source-receipts.json`.

| Order | BVID | Disposition |
|---:|---|---|
| 1 | `BV11t8w6oEtP` | complete |
| 2 | `BV1QcYx6VEAj` | complete |
| 3 | `BV1v58B6GEan` | failed — `V3510B_CHAPTER_TIME_INVALID` |
| 4 | `BV1M5tJ6kEvw` | failed — `V3510B_PROVIDER_RESPONSE_INVALID` (chapter count) |
| 5 | `BV1HTbi6LERi` | failed — `V3510B_PROVIDER_RESPONSE_INVALID` (chapter fields) |
| 6 | `BV1qM9fB8Eb2` | complete |

## 6. The action counts

| Action | Count |
|---|---:|
| owned Chrome launches | **6** |
| visible windows | **6** (the user's Chrome was never touched) |
| Runtime starts | **6** |
| Provider synthesis attempts | **6** (14 HTTP requests in total, the bounded repair route included) |
| product downloads | **6** |
| imports | **0** |
| media tasks created by the product | **6** |
| Cookie injections (into the owned ephemeral profile only) | **156** (26 per source; no value printed, recorded or persisted) |
| audio outputs | **0** |
| tabCapture actions | **0** |
| focus events | **6** (each on the runner's OWN owned window) |
| real-source completions | **3** |
| BVID substitutions | **0** |
| reserve substitutions | **0** |
| relay v11 refreezes | **0** |

## 7. The secret scan

`08-secret-path-raw-media-scan.json`: **0** secret hits, **0** private-path
hits and **0** raw-media payload hits over the changed files and the evidence.
The four INTENTIONAL negatives are listed there: the explicitly authorized
Windows Desktop cookie path (in the code, never in the evidence), the canary's
Playwright browser path, and the product's own DeepSeek/MiniMax model names.

The per-source `secret_scan.csv` reports zero hits for all six sources.

## 8. The cleanup

`07-process-ownership-and-cleanup.md`: **0** owned processes, ports, profiles,
Runtime scratches, media task roots and temporary media assets after the batch.
The sequencer's own process-group audit reports `leakedBefore 0 ·
leakedAfter 0 · ok true`. All six sources' cleanup receipts report the scratch
and the profile deleted.

## 9. The severity

**Fatal 0 / Major 2 / Minor 5** — see `09-prd-coverage-and-risks.md` §5.

## 10. The residual risks

See `09-prd-coverage-and-risks.md` §5. The two that matter for the next
decision:

* the cloud output's chapter violations (the block),
* the published derivative of THIS run predates the receipt-extras fix, so it
  is not schema-valid.

## 11. The smallest valid reopening condition

1. **The receipt-extras fix is in the tree and is gated offline.** Nothing
   else is needed for the published derivatives to satisfy the frozen V2.1
   schema. The next batch re-publishes them.
2. **The chapter failures need a Codex decision**, because the two candidate
   causes are not separable with this run's evidence:
   * if the cause is the model's chapter choice, the Provider's structured
     output contract has to change (a product change, and the frozen contract
     would need a new revision);
   * if the cause is the evidence catalog's timestamp shape (a frame and the
     OCR text of the same frame share a start timestamp, so two chapters that
     cite them cannot strictly increase), the chapter-start rule has to
     tolerate an equal start (a threshold/contract change) — and the smallest
     diagnostic that separates the two is ONE line in the runner's diagnostic:
     the evidence catalog's timestamp monotonicity.
3. **One more consolidated owned visible batch** after the decision, with the
   same preflight (which is green ✓) and the same owned isolation.

## 12. The stop reason

The machine-positive candidate requires six fresh attempts with `complete >= 5`
and `failed = 0`. The batch produced three complete and three failed, and the
three failures are the frozen V2.1 chapter invariants refusing the cloud
output. The product refused correctly, published nothing for those sources and
kept the local result unchanged. The batch therefore stops in the BLOCKED
state, and it does not enter B-6, B-7, Stage C, WP-C, V3-6 or V3-7.
