# The exact handoff (offline corrective)

## 1. The state

**GC-B5R B-5 OFFLINE CORRECTIVE AWAITING CODEX CHECKPOINT**

The three Major findings and the three Minor findings of the Codex checkpoint
are closed. The visible batch was NOT executed: this batch performed zero
external actions, and the next visible run needs Codex's authorization.

## 2. The changed files

| Path | What it is |
|---|---|
| `scripts/stage_b5_3/lib/action_ledger.mjs` → `scripts/stage_b_b5_3/lib/action_ledger.mjs` | **new** — the durable append-only stage action ledger and the one-shot visible authorization |
| `scripts/stage_b_b5_3/lib/aggregate.mjs` | the Provider rule: a failed attempt is never misclassified as a foreign Provider |
| `scripts/stage_b_b5_3/lib/contracts.mjs` | the exact Provider lock (the selected product id + the endpoint class, no substring) |
| `scripts/stage_b_b5_3/lib/extension_fixture.mjs` | **new** — the canary's frozen pre-granted permission promotion, shared with the canary |
| `scripts/stage_b_b5_3/lib/owned_session.mjs` | **new** — the owned-session composition over the product's own helpers |
| `scripts/stage_b_b5_3/lib/preflight.mjs` | the preflight consumes the active registry and validates the declared identity and path exactly |
| `scripts/stage_b_b5_3/lib/registry.mjs` | **new** — the active v2 registry: the digest, the order, the reserves, the identity guard |
| `scripts/stage_b_b5_3/production_preflight.mjs` | **new** — the production preflight (zero visible actions) |
| `scripts/stage_b_b5_3/run_one_bvid.mjs` | the single finalizer, the ledger events, the one-shot authorization, the fault seam, the diagnostic sanitizer |
| `scripts/stage_b_b5_3/sequencer.mjs` | the active registry and the aggregate verdict |
| `scripts/stage_b_b5_3/test/action_ledger.node-test.mjs` | **new** — the ledger, the interruption, the malformed prior ledger, the duplicate identifier, the stage/candidate distinction |
| `scripts/stage_b_b5_3/test/gc_b5r_preflight.node-test.mjs` | the exact preflight matching and the exact lock |
| `scripts/stage_b_b5_3/test/production_preflight.node-test.mjs` | **new** — the cookie resolution and inspection |
| `scripts/stage_b_b5_3/test/runner_failure_evidence.node-test.mjs` | **new** — the real runner driven through all five failure milestones |
| `scripts/stage_b_b5_3/test/runner_static_check.node-test.mjs` | **new** — the static gate |
| `scripts/stage_b_b5_3/test/run_offline_suite.mjs` | the ONE offline command |
| `services/local-runtime/navia_runtime/modules/media_companion/comprehension/diagnostics.py` | **new** — the privacy-safe chapter diagnostic |
| `services/local-runtime/navia_runtime/modules/media_companion/comprehension/service.py` | the receipt extras are read after the request; the private diagnostic is written |
| `services/local-runtime/navia_runtime/modules/media_companion/comprehension/synthesis.py` | the adapter enforces the frozen shape and regenerates it with a hard request bound |
| `services/local-runtime/tests/test_v3_gc_b5r_chapter_diagnostics.py` | **new** — the C3 and C4 cases |
| `services/local-runtime/tests/test_v3_gc_b5r_corrective_authority.py` | the V2.1 schema gates, including the repair path |

The digests are in `01-changed-file-hashes.json`.

## 3. The contract changes

**None.** No public API, schema, FailureCode set, threshold, message set,
Provider registry, Origin/auth ordering, denominator or historical evidence was
changed. The relay v11 fixtures, inventories, schemas, registry and verifier
code are untouched and **nothing was refrozen**.

## 4. The commands and their exits

See `02-commands-and-exits.md`.

## 5. The C1–C5 closure evidence

| | Where |
|---|---|
| C1 — the durable stage action ledger, the one-shot authorization, the lower-bound reconciliation | `03-c1-action-ledger-proof.md`, `11-stage-action-reconciliation.json` |
| C2 — the single finalizer and the complete failure-path audit set | `04-c2-failure-finalizer-proof.md` |
| C3 — the privacy-safe chapter diagnostic | `05-c3-diagnostic-samples.json` |
| C4 — the MiniMax shape enforcement and the bounded repair | `06-c4-provider-repair-matrix.md` |
| C5 — the receipt-extras fix and the frozen V2.1 schema | `07-c5-v2.1-schema-proof.md` |

## 6. The external action counters

**All zero**: owned Chrome launches 0, visible windows 0, real media Runtime
starts 0, Provider calls 0, downloads 0, imports 0, media tasks 0, Cookie
material read or injected 0, audio outputs 0, tabCapture actions 0, focus
events 0, real BVID executions 0.

## 7. The secret scan

`08-secret-path-raw-media-scan.json`: **0** secret hits, **0** private-path
hits and **0** raw-media payload hits over the changed files and this
evidence. The four INTENTIONAL negatives are listed there.

## 8. The cleanup

The offline run owns nothing: the ledger's stage root is a temporary directory
per case, the evidence roots are temporary, the runner's scratch and profile
are removed in its `finally` path, and the preflight's own root is removed in
its `finally` path.

The final residual audit:

| Owned resource | Residual |
|---|---:|
| owned Chrome processes | **0** |
| owned Runtime processes | **0** |
| owned runner / sequencer processes | **0** |
| owned listening ports (17861) | **0** |
| owned Chrome profiles | **0** |
| owned Runtime scratch roots | **0** |
| owned temporary media assets | **0** |
| the PRODUCT's real stage root (`.navia/b5-stage`) | **absent** — the corrective batch never created one; every offline case used a temporary root and its own authorization identifier |

## 9. The severity

**Fatal 0 / Major 0 / Minor 0** in this corrective batch's own changes. The
residual risks of the rejected candidate (the cloud chapter output and its
schema-invalid derivatives) are recorded in `09-prd-coverage-and-risks.md` §4.

## 10. The stop reason

The offline corrective is complete and verified: the one offline command exits
0, the Runtime suites pass, the relay v11 baseline is 50/50 and the mutations
are 16/16, the scans are clean and the owned residue is zero. The workpack
therefore stops at the offline checkpoint, and the next visible batch — with
its fresh one-shot authorization identifier — belongs to Codex.
