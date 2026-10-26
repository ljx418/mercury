# PRD and contract review (corrective)

## 1. The change-control decision this batch works under

The Codex checkpoint states:

> ClaudeCode is authorized to modify `app.py` for the real internal
> composition. This is an internal wiring correction, not a public contract
> change.

This batch therefore changes `services/local-runtime/navia_runtime/app.py` to
compose the input authority, and changes nothing that a client, a schema, a
threshold or a registry can observe.

## 2. Contract-change statement

**There is no public contract change.**

| Surface | Changed? | Why |
|---|---|---|
| Public HTTP API (routes, request bodies, response shapes, status codes) | **no** | the authority is an internal guard inside the existing synthesize path; the refusal is reported through the existing error envelope with an existing frozen code |
| Public schemas (V2.1 grounded, local import, barrier, relay v11) | **no** | untouched |
| FailureCode inventories | **no** | the batch uses `V3_MEDIA_DEPENDENCY_NOT_READY` (already in the frozen media inventory), `V3_MEDIA_CROSS_TASK_REUSE`, `V3_MEDIA_TRANSCRIPT_SOURCE_MISMATCH` and `V3510B_TASK_REVISION_CONFLICT` — all pre-existing |
| Thresholds | **no** | the brief length, the claim/chapter counts, the coverage ratio, the upload counters and the registry size are unchanged |
| Message sets | **no** | the refusal messages are new strings for existing codes; the frozen `V3510B_*` message set is untouched |
| Provider registry / authorization | **no** | the selection and the authorization are untouched; the runner now records the two frozen Provider facts it already used |
| Origin / auth ordering | **no** | untouched |
| The six-video denominator | **no** | the registry file is byte-identical; its digest is verified before the inspection |
| WP-A / WP-B history, relay inventories, historical evidence | **no** | untouched |
| Public V2.1 receipt schema | **no** | the receipt fields are unchanged; the runner only compares `providerId` and `endpointClass` more strictly |

### The two internal surfaces that did change

1. `MediaComprehensionService.__init__` accepts an optional `input_authority`.
   It is an internal composition argument, not a public API: the HTTP surface
   does not expose it, and the Runtime supplies it in the composition root.
2. `MediaInputAuthority` is a new internal module and
   `LocalMediaImportStore.list_for_task` is a new internal read method. No
   table, column, state, transition or semantic rule of the durable store was
   changed.

## 3. PRD / contract coverage after the corrective

The frozen contract is
`stage-b-grounded-comprehension-contract.md`
(SHA-256 `c03491d5f55d3950448de75d20f2c89c1195234da05d17329f3a6f19254f38b8`,
re-verified in this batch).

| Contract section | Requirement | How the corrective batch satisfies it | Oracle |
|---|---|---|---|
| Identity and persistence | "A read returns V2 only when all three fields match current source authority" | the authority now checks the CURRENT source authority AND the CURRENT dependency generation, before the Provider and again before the publication | `test_c1_*` (11 cases), `02-production-composition-and-restart-receipts.md` |
| Identity and persistence | "Revocation or stale authority before commit rejects the write" (Authorization and disclosure) | a stale authority, a moved revision, a foreign identity, a cross-run generation, a closed import and an unverifiable generation are all refused before the Provider and before the publication | `test_c1_a_changed_generation_is_refused_before_the_provider`, `test_c1_an_unverifiable_generation_is_refused_before_the_provider`, `test_c1_a_failed_authority_check_publishes_nothing` |
| Authorization and disclosure | "The request may contain only evidence ID, kind, timestamps and derived text … the counts are fixed at zero" | unchanged; the outbound payload and the six counters are still asserted | `test_o05_the_outbound_payload_carries_only_derived_text`, `test_o06_the_published_payload_carries_no_raw_media_or_local_path` |
| API and UI mapping | "No new public endpoint is required" | no new endpoint; the authority is internal | the existing comprehension suite (28 cases) passes unchanged |

### The GC-B5R goal clauses

| Goal clause | After the corrective |
|---|---|
| G1 — one exact acquisition task/source identity; the local asset is valid only after the real WP-B lifecycle bound it to the current identity; mismatches are rejected before synthesis or publication | **now durably enforced**: the production composition injects the real coordinator, the real stores and the manager-owned generation seam; a restart re-verifies the snapshot instead of losing the check |
| G2 — one Provider per task; no fallback, best-of-N, stitching, threshold change, padding or repair change | unchanged; the one-Provider proof is the production factory invocation count (1) and one authoritative receipt |
| G3 — cancellation, restart, stale authority, failed validation and failed publication settle the right owner and leave no residue | unchanged and extended: the restart case is now refused-or-accepted on evidence, never skipped |
| G4 — the exact registry order and hash; the preflight-only path with zero action counts | unchanged and strengthened: the preflight now validates the declared identity exactly and reports a stable ineligible reason |
| G5 — the twelve obligations O01–O12 | the offline candidate's 32 cases + the corrective's 11 cases + the 31 Node cases cover them; the Codex findings are the corrective's closure list |

## 4. What this batch still does not claim

* It does not claim that B-5, Stage B, V3 or WP-C passed.
* It does not claim that any of the six BVIDs passed, or ran.
* It does not claim the relay v11 baseline is green: it is 46/50 with the
  authorized `app.py` source-scope hash drift, and the semantic inventories
  prove the drift is scope-only (40/40, 20/20, 59/59, `unlistedBoundaryEmits`
  `{}`).
* It does not claim a real Chrome, Provider, cookie, download, import, audio
  or visible-window proof. Every one of those counts is zero.
