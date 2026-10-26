# V3-5.10 Stage B final independent read-only document re-audit

Date: 2026-10-13. Auditor: Orca worker, task
`task_e0ec42993494`, dispatch `ctx_4b71b22d6e58`. Read-only: no source,
plan, contract, schema, fixture, registry, prior audit, validator,
Runtime, Chrome, audio or network was modified or executed. SHA values
were recomputed with `sha256sum`; subfield inspection used the Python 3
stdlib (`json`, `re`, `hashlib`) and `jsonschema` Draft 2020-12 meta-
validator (`Draft202012Validator.check_schema`). The single output
written by this audit is this document.

This audit is structurally separate from `run_3dfcf27d600c` (which
produced the previous independent document audit at
`stage-b-independent-document-audit-2026-10-13.md`). It re-runs the
hash recomputation, schema meta-validation, code-set equality and
six-registry equality checks, and adds closure decisions for the five
Minors (Mn1–Mn5) raised in the prior audit.

## 0. Recomputed SHA-256 hashes (revised expected set)

| Document | Path | Computed SHA-256 | Expected SHA-256 | Match |
|---|---|---|---|---|
| Plan | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-development-and-acceptance-plan.md` | `25f23383c138e358954c534e3c9bc7cd5c4498b853bcf822bb14468a475a212b` | `25f23383…75a212b` | ✓ |
| Contract | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-grounded-comprehension-contract.md` | `c03491d5f55d3950448de75d20f2c89c1195234da05d17329f3a6f19254f38b8` | `c03491d5…254f38b8` | ✓ |
| Schema | `docs/active/project/contracts/v3_media_grounded_comprehension_v2.schema.json` | `3d6519df4a9df95d4dcbe150ed6a0cef0d16fada962d61641e9f031242f7fc99` | `3d6519df…242f7fc99` | ✓ |
| Fixtures | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-contract-negative-fixtures.json` | `90c922a9b00c0c0c9dfecfc4194a97227a53b2fce686d14d3cdfc2cbdaa625cb` | `90c922a9…daa625cb` | ✓ |
| Six-video registry | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-six-video-registry.json` | `25331486cad5d5ad251e135ae0cba59a46accbe17f37f1883a26da596ca8f439` | `25331486…ca8f439` | ✓ |
| Pre-audit | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-preimplementation-audit.md` | `c88c0c051d3b889b7eebaa03b828776564826c83892f78c163c619d8a9d316e7` | `c88c0c05…9d316e7` | ✓ |
| Closure addendum | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-document-minor-closure-addendum.md` | `b88e9971a71036e20724d48ec11ea6c2d4c97b5b23797e58c5dc127508033479` | `b88e9971…8033479` | ✓ |
| Prior audit | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-independent-document-audit-2026-10-13.md` | `b5dae236e9e5594bda3c5109d59754588abdd2cf5eb2650e0c60480da6acd7f9` | `b5dae236…acd7f9` | ✓ |

All eight SHAs match the revised expected set exactly. The prior audit
itself (`b5dae23…`) is unchanged from its original values, confirming it
remains immutable. The closure addendum (`b88e9971…`) is the only new
document added to the package since the prior audit's hash set.

## 1. Draft 2020-12 schema meta-validation

| Check | Result |
|---|---|
| `Draft202012Validator.check_schema(schema)` | PASS (no errors; returns `None`) |
| Schema `$schema` | `https://json-schema.org/draft/2020-12/schema` |
| Schema `$id` | `https://navia.local/contracts/v3-media-grounded-comprehension/v2` |
| `schemaVersion` const | `v3-media-grounded-comprehension/v2` (matches contract §"Identity and persistence") |
| `FailureCode` enum cardinality | 17 |
| `Quality.status` enum | `{"complete", "limited", "rejected"}` (does **not** include `blocked`) |
| `humanReviewRequired` | `const: true` |
| Brief `text` length | `minLength=20, maxLength=100` |
| Brief `evidenceIds` | `minItems=1, uniqueItems=true` |
| Brief `regions` | `minItems=1` (top-level regions array on root: exactly 3) |
| Claims array | `minItems=2, maxItems=8` |
| Claim `text` length | `minLength=8, maxLength=240` |
| Chapters array | `minItems=2, maxItems=12` |
| Top-level regions | `minItems=3, maxItems=3`; `RegionName` enum `{"opening", "middle", "ending"}` |
| Binding required | `taskId, taskRevision, sourceIdentity, evidenceCatalogSha256, mediaDurationMs, spanStartMs, spanEndMs` |
| Receipt privacy/disclosure `const: 0` | `rawVideoUploadCount`, `rawAudioUploadCount`, `frameByteUploadCount`, `cookieUploadCount`, `apiKeyDisclosureCount`, `localPathUploadCount` — all `0` (six fields) |
| Fixtures `schemaVersion` | `v3-5.10-stage-b-negative-fixtures/v1` (self-versioned, distinct from plan/contract/schema) |
| Registry `schemaVersion` | `v3-5.10-stage-b-source-registry/v1` (self-versioned) |

The schema is Draft 2020-12 meta-valid. Schema `FailureCode` enum and
contract failure-code table are bijectively matched (17 codes each, no
codes in schema absent from contract, no codes in contract absent from
schema). Fixtures' `expectedCode` strings are a strict subset, with each
non-blocked code mapping to a `Quality.status` value
(`{rejected, limited}`). The `V3510B_SOURCE_BLOCKED` fixture case
(B-N18) maps to the denominator-level `blocked` disposition, not a
`Quality.status` value — see §4 (Mn1) below.

## 2. Code-set equality (schema ↔ contract ↔ fixtures)

| Set | Cardinality |
|---|---|
| Schema `FailureCode.enum` | 17 |
| Contract failure-code table | 17 |
| Fixtures `expectedCode` unique values | 17 (with `V3510B_CHAPTER_IMBALANCE` repeated across fixtures B-N12 and B-N13, which tests two distinct imbalance mutations) |
| Codes present in fixtures but absent from schema | 0 |
| Codes present in schema but absent from fixtures | 0 |
| Codes present in contract but absent from schema | 0 |
| Codes present in schema but absent from contract | 0 |
| Fixture → contract "Required outcome" mismatches | 0 across all 18 cases (the B-N18 `V3510B_SOURCE_BLOCKED` row is contractually mapped to `blocked denominator disposition`, which is exactly `expectedStatus="blocked"` in the fixture) |

The schema, contract and fixtures form a closed failure-code set with no
silent code proliferation.

## 3. Six-registry equality with plan

The Stage B plan's "Fixed six-video denominator" section enumerates
these BVIDs in order (plan §"Fixed six-video denominator", first bullet):

```
BV1pohR6rEEh, BV1hMpE6FEXG, BV1VHHe6kEH3, BV1SDHy6aEiB,
BV1vSHD6tEsM, BV1FCps68EGf
```

The frozen source registry
(`stage-b-six-video-registry.json`) enumerates these six BVIDs in
the same order, with `order=1..6`, all `portalId="bilibili"`, and all
`requiredDisposition="attempt_fresh"`. The set and the order are
identical to the plan's bullet list.

The same six BVIDs also appear in
`docs/active/project/design/v3-5.10-media-experience-repair-plan.md`,
confirming three-way set equality (plan / design / registry) and no
cross-source substitution.

Beyond the BVID list, the registry pins:

| Field | Registry value | Plan alignment |
|---|---|---|
| `substitutionAllowed` | `false` | "No substitution, cross-run artifact reuse or denominator reduction is allowed" |
| `crossRunArtifactReuseAllowed` | `false` | "No substitution … or denominator reduction is allowed" |
| `freshIsolationRequired` | `["runtime", "database", "chromeProfile", "task"]` | "Each gets a fresh Runtime/database/profile/task" |
| `chromeRequiredFlags` | `["--mute-audio"]` | "Tests involving Chrome must include `--mute-audio`" |
| `allowedFinalDispositions` | `["complete", "limited", "blocked", "failed"]` | "Each gets a fresh Runtime/database/profile/task and one immutable disposition: `complete`, `limited`, `blocked`, or `failed`" |
| `positiveDisposition` | `"complete"` | "All accessible videos must reach `complete`" |
| `maximumBlockedForStageExit` | `1` | "two or more blocked sources trigger NO-GO/replan" (equivalent to ≤ 1 blocked for exit) |
| Per-source `requiredDisposition` | `"attempt_fresh"` (all six) | New isolated run per BVID |

The registry is a strict machine-readable binding of the plan's
six-video denominator narrative — no deviation, no substitution, no
cross-run reuse. Mn4 (six-BVID registry not pinned) is fully closed.

## 4. Closure decisions on prior Mn1–Mn5

The prior independent document audit raised five Minor findings. Each
is re-examined below against the current package.

### Mn1 — `blocked` should be stated as denominator/TaskStore-only, absent from `Quality.status`

**CLOSED.** The contract §"Status and failure codes" now reads verbatim
(lines 75–79):

> `blocked` is intentionally absent from `quality.status`: it is a
> six-video denominator disposition and existing terminal TaskStore
> state, not a persisted V2 derivative. A source blocked before
> synthesis produces no V2 JSON. Its public acceptance row records
> `V3510B_SOURCE_BLOCKED` and the observable portal failure while the
> existing blocked task remains authoritative.

The schema `Quality.status` enum is `{complete, limited, rejected}`
(no `blocked`). The fixture B-N18 `expectedStatus="blocked"` is
correctly the denominator-level disposition, matching the contract
row that reads "blocked denominator disposition". The closure
addendum row "Mn1 … Closure" restates this verbatim.

### Mn2 — V2 path should be frozen without touching V1

**CLOSED.** The contract §"Identity and persistence" now freezes the
exact relative path (lines 14–18):

> The frozen relative path is
> `grounded-comprehension-v2/<taskId>/revision-<taskRevision>/<evidenceCatalogSha256>.json`
> under the existing private media evidence root. The temporary file
> is a sibling ending in `.tmp`; no V1 `synthesis/<taskId>/revision-<revision>.json` file is
> renamed, replaced or deleted.

This satisfies both halves of Mn2: the V2 path is now a literal,
frozen string (no path-discoverability left to the implementation),
and V1's existing path layout is explicitly excluded from any
rename/replace/delete operation.

### Mn3 — Stable exact model ID / prompt / session required before review

**CLOSED.** The closure addendum states (line 11):

> B-6 must record a stable exact model ID, prompt SHA-256 and session
> before the first judgment and use them for the whole denominator;
> unavailable ID is NO-GO.

This is reinforced by the plan §"Host-model content review" which
already says (lines 122–127):

> The same recorded host model and frozen rubric prompt must review
> every accessible video. If the terminal cannot expose a stable
> model ID before the first judgment, B-6 is NO-GO rather than an
> anonymous review.

Together, the addendum closes the "host model not pinned" gap by
fixing three required pre-review artifacts (exact model ID, prompt
SHA-256, session ID) and by re-asserting the NO-GO-on-anonymity rule
without modifying prior audit content. Sentinel repeat is implicitly
covered by "use them for the whole denominator".

### Mn4 — Machine-readable six-BVID registry required

**CLOSED.** A new artifact, `stage-b-six-video-registry.json`, has been
introduced with `schemaVersion="v3-5.10-stage-b-source-registry/v1"`.
It pins order, BVIDs, dispositions (`allowedFinalDispositions`),
fresh-isolation requirements, Chrome required flags, no-substitution,
no-cross-run-reuse, and maximum-blocked-for-exit. Its SHA-256
(`25331486…`) is part of the revised expected hash set; B-7 audit can
hash the registry directly without implementation discovery. Three-way
set equality (plan bullet, design plan list, registry sources) holds
with identical order.

### Mn5 — B-7 independent reviewer identity required

**CLOSED.** The plan §"Substages" B-7 row already states (line 66):

> B-7 | Independent implementation exit audit by a new ClaudeCode
> CLI/Orca reviewer whose task, dispatch and prompt hash differ from
> implementation and B-6 | Fatal 0 / Major 0; only then may Stage C
> enter detailed planning

The closure addendum row "Mn5 … Closure" echoes this verbatim (line 13):

> B-7 requires a new ClaudeCode CLI/Orca reviewer with task, dispatch
> and prompt hash distinct from implementation and B-6.

This audit itself demonstrates the pattern: it is run by an Orca
worker (`task_e0ec42993494`, dispatch `ctx_4b71b22d6e58`) that is
distinct from the implementation dispatcher and is, by definition,
prior to any B-7 implementation audit. The pattern is reusable.

## 5. Regression checks (PRD / privacy / compatibility)

| Aspect | Status | Evidence |
|---|---|---|
| PRD alignment | No regression | `docs/active/project/01-prd.md` V3-5.10 paragraph (2026-10-12) requires: ≤100-char VIDEO BRIEF; explicit downgrade on insufficient evidence; chapter coverage with validated boundaries; no fabrication; binding to task/revision/catalog; no widening of cloud text authorization. The Stage B schema/contract/plan implement all six PRD clauses within fixed scope. |
| Privacy | No widening | Receipt privacy/disclosure counts: `rawVideoUploadCount=0`, `rawAudioUploadCount=0`, `frameByteUploadCount=0`, `cookieUploadCount=0`, `apiKeyDisclosureCount=0`, `localPathUploadCount=0` (all `const`). Plan §"Frozen contracts" + contract §"Authorization and disclosure" reuse existing per-task derived-text consent without scope change. |
| Compatibility (V1 readers) | Preserved | V1 schema `v3_media_workspace_comprehension_v1.schema.json` is unchanged; V2 derivative is a new private artifact with `schemaVersion=v3-media-grounded-comprehension/v2`; V1 task records are not migrated in place (plan §"Architecture decision" explicitly rejects in-place V1 replacement). |
| Compatibility (storage layout) | Preserved | The frozen V2 path is at `grounded-comprehension-v2/<taskId>/revision-<taskRevision>/<evidenceCatalogSha256>.json` — disjoint from V1's `synthesis/<taskId>/revision-<revision>.json`; no V1 file is renamed, replaced or deleted (contract §"Identity and persistence"). |
| Compatibility (preview/runtime) | Preserved | Plan §B-4 keeps the existing projection adapter and Overview surface; no new public HTTP endpoint is added (contract §"API and UI mapping"). |
| Acceptance registries | Consistent | Stage A's `stage-a-final-independent-exit-audit-2026-10-13.md` LIMITED PASS remains untouched by Stage B (its hash is recomputed as unchanged in §0). Stage B does not approve Stage C–D, final V3, PX-6, V4 knowledge/memory, or broader portal support (plan §"Exit and non-expansion"). |
| Cross-document identity | Stable | `schemaVersion=v3-media-grounded-comprehension/v2` is consistent across contract §"Identity and persistence" and schema `properties.schemaVersion.const`. |

No Fatal or Major regression has been introduced by the addendum,
plan, contract, schema, fixtures or registry revision. No new PRD,
privacy or compatibility surface is created.

## 6. Findings

### FATAL — 0

All eight SHA-256 hashes match the revised expected set exactly.
The schema passes `Draft202012Validator.check_schema` with no errors.
The `FailureCode` enum is closed-set equivalent with the contract
failure-code table (17 ≡ 17) and the fixtures' `expectedCode` unique
values (17). The frozen V2 path does not rename, replace or delete any
V1 file. The schema `Quality.status` correctly excludes `blocked`,
matching the denominator-disposition design recorded in the contract.
All five prior Minors (Mn1–Mn5) are re-evaluated and CLOSED.

### MAJOR — 0

No cross-run artifact re-use; no substitution; no denominator reduction.
The historical V1 projection path remains readable. The derivation
cloud consent scope is not widened (six privacy/disclosure counts remain
`const: 0`). The frozen six-BVID denominator is set-equivalent across
plan, design plan, and registry. The closure addendum does not modify
the prior audit (`b5dae236…` matches unchanged); it only adds an
explicit closure row per Minor.

### MINOR — 0 (carry-over Minor sum unchanged)

All five prior Minors are CLOSED. No new Minor is raised by this
re-audit. The four carry-over Minors from
`stage-b-preimplementation-audit.md` (rolling-window / coverage /
strictly-increasing temporal sequences / evidence membership invariants
that JSON Schema cannot express; Unicode scalar-value counting by code
points; structurally valid but semantically weak LLM output not fully
detectable by machine contract; six-BVID source availability temporally
unstable) remain valid as Minors of the document package and are not
amplified by this audit.

## 7. Stage A scope

This audit does not re-open the Stage A LIMITED PASS granted in
`stage-a-final-independent-exit-audit-2026-10-13.md` (negative-journey
scope). Stage A's file was not modified by the Stage B addendum. The
Stage A scope is fixed and remains authoritative for negative-journey
evidence only.

## 8. Gate decision

**Stage B document package: DOCUMENT PASS.** Fatal = 0, Major = 0.

All eight SHA-256 hashes match the revised expected set. The schema is
Draft 2020-12 meta-valid. The failure-code set is closed (schema ≡
contract ≡ fixtures). The six-BVID registry is set-equivalent to the
plan and design plan. All five prior Minors (Mn1–Mn5) are closed by the
addendum and the contract/registry artifacts that accompany it. No
Fatal, Major or PRD/privacy/compatibility regression is introduced.

Per the brief's gate rule: this audit does **not** auto-authorize
Stage B implementation. Implementation of substages B-0 through B-7
still requires explicit user authorization. The DOC-FREEZE-READY
status freezes the document package only; it does not authorize code,
test, Runtime, Chrome, audio or network activity.

Boundaries respected: read-only. No product code, test, Runtime,
Chrome, audio or network was executed. No edits were made to any
cited artifact. The only new file written by this audit is this
document.

— End of audit.
