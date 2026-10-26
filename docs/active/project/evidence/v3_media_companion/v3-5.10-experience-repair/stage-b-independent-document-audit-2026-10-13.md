# V3-5.10 Stage B independent read-only document audit

Date: 2026-10-13. Auditor: Orca worker, task
`task_d6f18b560388`, dispatch `ctx_d534cffde4ec`. Read-only: no source,
plan, contract, fixture, candidate, prior audit, validator, Runtime, Chrome,
audio or network was modified or executed. SHA values were recomputed with
`sha256sum`; subfield inspection used the Python 3 stdlib (`json`, `re`,
`hashlib`) and `jsonschema` Draft 2020-12 meta-validator. The single output
written by this audit is this document.

## 0. Documents and recomputed hashes

| Document | Path | Computed SHA-256 | Expected SHA-256 | Match |
|---|---|---|---|---|
| Plan | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-development-and-acceptance-plan.md` | `a027b5dfcdeb7ab85c9c2b891a743436ece5bec5ffd4ac21285d7abd6b192024` | `a027b5df…b192024` | ✓ |
| Contract | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-grounded-comprehension-contract.md` | `c4bd08fa4a19f6ab7c11a093378e0d395a74f68369d1dbec39c1ee9d0d5a4079` | `c4bd08fa…d5a4079` | ✓ |
| Fixtures | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-contract-negative-fixtures.json` | `90c922a9b00c0c0c9dfecfc4194a97227a53b2fce686d14d3cdfc2cbdaa625cb` | `90c922a9…daa625cb` | ✓ |
| Pre-audit | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-preimplementation-audit.md` | `ebff6e6fefcb1815a75c30a0b7907de599768eb543a2171c887dbdca7557aa86` | `ebff6e6f…57aa86` | ✓ |
| Schema | `docs/active/project/contracts/v3_media_grounded_comprehension_v2.schema.json` | `3d6519df4a9df95d4dcbe150ed6a0cef0d16fada962d61641e9f031242f7fc99` | `3d6519df…242f7fc99` | ✓ |

All five SHAs match. The pre-audit's own internal check (Fatal 0 / Major 0 /
Minor 4 for document readiness) is preserved verbatim; this independent audit
adds one further Minor (Mn5) and confirms Mn1–Mn4 as still applicable without
modifying prior audit content.

## 1. Meta-validation and cross-document parity

| Check | Result |
|---|---|
| `Draft202012Validator.check_schema` on the schema | PASS (Draft 2020-12 meta-valid) |
| Schema `FailureCode` enum cardinality | 17 |
| Fixtures `cases` cardinality | 18 |
| Codes present in fixtures but absent from schema | 0 |
| Codes present in schema but absent from fixtures | 0 |
| Fixture `expectedStatus` values | `{"limited", "rejected", "blocked"}` |
| Schema `Quality.status` enum | `{"complete", "limited", "rejected"}` (does **not** include `blocked`) |
| Fixture → contract `required outcome` mismatches | 0 across 18 cases |
| `schemaVersion` constant in schema | `"v3-media-grounded-comprehension/v2"` (matches contract §"Identity and persistence") |
| Fixtures `schemaVersion` | `"v3-5.10-stage-b-negative-fixtures/v1"` (self-versioned, distinct from plan/contract) |

The schema, contract and fixtures form a closed failure-code set: every schema
enum code maps to exactly one fixture case, every fixture case pairs with the
contract's "Required outcome", and vice versa. No silent code proliferation.

## 2. Schema ↔ contract ↔ plan cross-consistency

| Field / invariant | Schema | Contract | Plan | Verdict |
|---|---|---|---|---|
| Brief text length | `minLength=20, maxLength=100` | "20-100 Unicode scalar values" | "20-100 Unicode characters" | aligned, see Mn1 |
| Brief evidence IDs | `minItems=1, uniqueItems` | "known, direct and collectively touch every substantive region" | "every substantive third referenced" | schema can't express the "collectively touch every substantive region" invariant; code required |
| Claims count | `2..8` | "2-8 unique claims" | "2-8 nonduplicate claims" | aligned |
| Claim text length | `minLength=8, maxLength=240` | "8-240 characters" | "8-240 characters" | aligned |
| Chapters count | `2..12` | "2-12 semantic chapters" | "2-12 chapters" | aligned |
| Chapter `startMs` strictly increasing, `endMs` binding | not expressible | "startMs strictly increase; endMs equals next chapter start, and the final end equals spanEnd" | same | contract + code only |
| 20% rolling window concentration | not expressible | "rolling window equal to 20% … at most ceil(chapterCount/2) starts" | "rolling 20% time window contains more than ceil(chapterCount/2) chapter starts" | contract + code only |
| 60% chapter span | not expressible | "no chapter may exceed 60% of the substantive span" (≥4 chapters + 3 substantive regions) | "no chapter consumes more than 60% of the substantive span" | contract + code only |
| Region array | exactly 3 items, name in `{opening,middle,ending}`, availability enum | "half-open thirds", `substantive` vs `empty_or_unavailable` | "thirds" | aligned |
| Ending evidence ratio | `mediaDurationMs` exposed but no ratio constraint | "spanEnd / mediaDuration >= 0.90" required for `complete`; otherwise `limited` with `V3510B_ENDING_EVIDENCE_MISSING` | "source evidence reaches at least 90% of it" | contract + code only |
| Quality.status enum | `{complete, limited, rejected}` | same | implicit (positive `complete` listed) | aligned; `blocked` deliberately absent — see Issue A |
| Quality.failureCodes codes | bound to the 17 FailureCode enum | "Stable failure codes" table | "Stable failure codes" | aligned |
| humanReviewRequired | `"const": true` | "host review must confirm sampled text-to-evidence entailment" | "Machine PASS cannot override a failed semantic review." | aligned |
| Binding fields | `taskId` + `taskRevision` + `sourceIdentity` + `evidenceCatalogSha256` + `mediaDurationMs` + `spanStartMs/EndMs` | "(taskId, taskRevision, evidenceCatalogSha256) aggregate key" + regions | "bound to one taskId + taskRevision + evidenceCatalogSha256" | aligned |
| Receipt `*UploadCount` and disclosure fields | all `const: 0` | "raw video/audio/frame bytes, browser Cookie, provider key and local path counts are fixed at zero" | "Existing cloud authorization is unchanged" | aligned |

JSON Schema cannot enforce rolling-window, coverage, "every third cited",
strictly-increasing temporal sequences, short-prefix detection, or Unicode
scalar counting. The contract's semantic validator + fixtures are the only
places these invariants can be asserted; the pre-audit already flags this as
Minor (Mi1) and it is restated here as Mn1/Mn2 below.

## 3. Code feasibility (read-only inspection)

Files inspected (no execution):

- `services/local-runtime/navia_runtime/modules/media_companion/comprehension/synthesis.py`
  (587 lines; current `MiniMaxGroundedSynthesisProvider`, `_result_from_partials`, `_compress_chapters`, `validate_synthesis`).
- `services/local-runtime/navia_runtime/modules/media_companion/comprehension/service.py`
  (476 lines; current `MediaComprehensionService.get` returning
  `v3-media-workspace-comprehension-projection/v1` (local) or `/v2`
  (synthesized); `_save_synthesis` writing
  `synthesis/{taskId}/revision-{revision}.json` with
  `schemaVersion=v3-grounded-media-synthesis/v1` via temp+atomic-replace).
- `services/local-runtime/navia_runtime/modules/media_companion/product_materializer.py`
  (488 lines; `MediaProductMaterializer` writes
  `v3-media-outline-taskstore/v2` projections, never touches the
  comprehension projection).
- `services/local-runtime/navia_runtime/modules/media_companion/task_store.py`
  (`MEDIA_OUTLINE_SCHEMA_VERSIONS` migration table; per-task revision column;
  `require_current_authority` already raises
  `V3_MEDIA_HISTORICAL_READ_ONLY` for stale authority).
- `services/local-runtime/navia_runtime/modules/media_companion/outline.py`
  (`DeterministicExtractiveOutlineGenerator.blocked` already publishes
  `state="blocked"` with `terminalFailureCode`; this is the current
  `blocked` disposition path, expressed as a task-store state, not a
  `Quality.status`).
- `services/local-runtime/tests/test_v3_media_comprehension.py`
  (493 lines; tests `v3-media-workspace-comprehension-projection/v1` and
  `/v2` flows including stale-revision, session, consent, unknown evidence,
  retries, partial fallback).
- `docs/active/project/contracts/v3_media_workspace_comprehension_v1.schema.json`
  (v1 projection schemaVersion `const`, lock for historical readers).

Feasibility observations (not raised as defects, recorded only):

- F1. Task-store already exposes per-task `revision` and a
  `require_current_authority(task_id)` guard. B-3 ("Add revision-scoped atomic
  V2 persistence and stale-authority guards") has a clean addition path: a
  new `comprehension_v2/{taskId}/revision-{revision}.json` write site
  mirroring `_save_synthesis`'s temp+`replace`+`chmod(0o600)` pattern, gated
  by the same authority check used today.
- F2. The existing `MediaComprehensionService.get` returns a workspace
  projection schema. The V2 grounded-comprehension derivative is a private
  artifact consumed by the projection adapter; the architecture block
  (plan §"Architecture decision") places this in
  `MediaComprehensionService projection adapter`, and B-4 explicitly accepts
  the surface change. No new public HTTP endpoint is added; the existing
  comprehension read path can be the projection adapter.
- F3. `DeterministicExtractiveOutlineGenerator.blocked` already exists at
  `outline.py:175`, so the `blocked` disposition path used by fixture B-N18
  (`portal_reports_restricted_source → V3510B_SOURCE_BLOCKED`) has an
  established precedent in the task store and is not a new mechanism; it
  populates `task.state="blocked"` rather than a V2 derivative file.
- F4. The current V1 schema (`v3-media-workspace-comprehension-projection/v1`
  with `schemaVersion: const "v3-media-workspace-comprehension/v1"` for the
  workspace candidate schema) remains readable; the V2 contract adds a new
  private derivative beside it, so old projection/API readers are not
  mutated in place.
- F5. Existing tests assert V1-projection field shapes that Stage B does not
  promise to preserve (e.g. `askBenchmark`, `playbackObservations`,
  `uiVerification`, `resourceVerification` from the V1 workspace schema);
  V1 readers do not need to learn the V2 brief/claims/regions. New V2
  fixtures/tests will be required because no test currently exercises
  `brief.text`, `claims`, `regions`, or `Quality.status="limited"`.
- F6. The current `validate_synthesis` accepts `summary` 20-4000 chars and
  chapters 2-12; the new V2 brief caps at 100 chars and adds
  `regions`/`claims`. Existing prompts reference `summary`; the new prompt
  schema is meant to replace the V1 brief prompt (B-2 explicitly revises
  prompt + parser).
- F7. `SynthesisReceipt` and `_save_synthesis` schemaVersion
  `v3-grounded-media-synthesis/v1` are V1 storage; V2 grounded-comprehension
  derivative is a separate on-disk format with schemaVersion
  `v3-media-grounded-comprehension/v2`. The plan's "private revision-scoped
  V2 derivative" is therefore expected to be written by a new path, not by
  the existing `_save_synthesis`, but the path string is not frozen (see Mn2
  below).

## 4. Explicit challenges requested by the brief

### 4.1 Whether `blocked` is a denominator disposition rather than a persisted derivative status

**Finding.** Yes, the documents consistently treat `blocked` as one of four
record-level dispositions (alongside `complete`, `limited`, `failed`) used
to populate the fixed six-BVID denominator (plan §"Fixed six-video
denominator", lines 71-86), not as a value of `Quality.status`. The
schema's `Quality.status` enum is `{complete, limited, rejected}` and the
receipt does not carry `blocked`. The contract's failure-code table maps
`V3510B_SOURCE_BLOCKED → "blocked denominator disposition"` (contract §
"Status and failure codes", line 89). The task-store code already
implements a separate `blocked` task state (`outline.py:174-192`
`DeterministicExtractiveOutlineGenerator.blocked` writes
`state="blocked"` with `terminalFailureCode` and no published projection).
The disposition lives at the run/portal-adapter boundary, not in the V2
derivative.

**Verdict.** Not a defect. There is one soft documentation gap (Mn1 below)
where the contract does not restate that `blocked` is intentionally absent
from `Quality.status`.

### 4.2 Whether the thresholds only detect extremes and do not mechanically segment

**Finding.** Correct, and the documents state this explicitly. The contract
chapter "Chapters" (lines 46-61) names two thresholds and ends with
"These thresholds detect severe clustering; they do not prescribe
equal-duration chapters or replace semantic review." The plan's
"Architecture decision" promise of "no first-minute excerpt may be
promoted to a whole-video claim" is enforced separately by the
`brief.evidenceIds` invariant ("collectively touch every substantive
region") and by host-review, not by the rolling-window threshold. The
thresholds also rely on the substantive span being well-defined
(`spanStart`/`spanEnd`, media duration ≥ 90% for `complete`). For 6
chapters the rolling window allows 3 starts; for 12 it allows 6; for 4+
chapters with all three substantive regions, no chapter may exceed 60% of
substantive span. These are coarse imbalance detectors, not segmentation
rules. B-1's exit ("Unit tests for opening/middle/ending availability,
ending coverage, 20%-window concentration and longest-chapter ratio") is
correctly scoped to extreme detection only.

**Verdict.** Aligned. No defect.

### 4.3 Whether `rejected` / `limited` persistence semantics are unambiguous

**Finding.**
- `rejected` is unambiguous: contract §"Status and failure codes" says
  "no V2 result is published"; identity-and-persistence § says "A stale
  or invalid V2 file is ignored for reads and cannot overwrite V1.
  Provider failure leaves the previous published projection
  byte-identical." Plan §B-3 exit repeats "failed synthesis leaves prior
  projection byte-identical." For `rejected`, the validator returns the
  failure code, no V2 derivative file is written, and the V1 projection
  remains the published view.
- `limited` is unambiguous as a stage-scope statement: contract says
  "limited means a truthful result can be displayed with a visible
  limitation, but it is not a Stage B positive"; plan §"Fixed six-video
  denominator" says "`limited` and `failed` never count as a positive
  output." However, the plan does **not** explicitly say whether a
  `limited` V2 derivative file is written (vs a transiently rendered
  result). B-3's "Old V1 remains readable; stale revision/hash rejected;
  failed synthesis leaves prior projection byte-identical" only covers
  the `rejected`/failure path. This is the soft gap recorded as Mn1.
- `complete` is unambiguous: positive machine invariants all pass.

**Verdict.** Substantively unambiguous. One minor docs gap (Mn1) for the
`limited` write/no-write decision and the `blocked`-status absence.

### 4.4 Whether old projection/API readers can remain compatible

**Finding.** Yes.
- `v3_media_workspace_comprehension_v1.schema.json` keeps
  `schemaVersion: const "v3-media-workspace-comprehension/v1"`; existing
  readers that pin to that exact string continue to parse existing
  projections.
- The V2 derivative is a new private artifact
  (`v3-media-grounded-comprehension/v2`); it does not mutate the V1
  workspace projection's field set.
- Plan §"Frozen contracts" explicitly says "V1 historical projections
  remain readable. V2 is selected only when its task, revision and
  evidence-catalog hash exactly match current authority." Plan
  §"Architecture decision" rejects the alternative "replacing V1 outline
  fields in place" precisely because it would break historical readers.
- The existing comprehension read/synthesize routes already gate V2
  selection by revision (`service.py:69` raises `TASK_REVISION_CONFLICT`
  on a stale `expected_revision`); B-3's "stale-authority guards" extend
  the same pattern to the new path.

**Verdict.** Compatible. New writes are version-stamped and revision-
scoped; V1 readers and old task records are not migrated.

### 4.5 Whether the plan is complete enough for B-0..B-7 automation

**Finding.** Most substages are well-bounded. B-0 through B-7 each carry
implementation scope, exit conditions, and explicit "exit before next
stage" gating. Six-BVID denominator, blocked-source policy, sentinel
repeat and independent exit are pre-committed.

Gaps visible from outside the implementation:

- **Substage B-3** does not freeze the on-disk path string of the new
  V2 derivative. Plan §"Architecture decision" says
  "private revision-scoped V2 derivative (atomic replace)"; the existing
  `service.py:_save_synthesis` writes to
  `synthesis/{task_id}/revision-{revision}.json`. Without a frozen
  naming convention for the new derivative, B-7 audit cannot hash
  directly without relying on implementation detail. (See Mn2.)
- **Substage B-4** says "limited results cannot display a complete badge"
  but does not pin the badge component/version. The plan §"Architecture
  decision" references the projection adapter; the B-4 substaging
  implies the adapter is part of B-4. This is implied, not named.
- **Substage B-5** says "Six dispositions retained" but does not name the
  schema or registry binding each disposition. The records-list in
  plan §"Fixed six-video denominator" (BVID, source identity, task ID,
  revision, evidence catalog hash, media duration, source evidence span,
  region availability, provider/model, authorization receipt, brief
  hash, claim/evidence map, chapter intervals, quality failures and
  public secret-scan result) is the natural registry, but no contract
  file pins it. (See Mn4.)
- **Substage B-6** says "Host-model content review and one sentinel
  repeat" but does not name the host (Stage A uses "the current Codex
  host"). The plan does not name the host-LLM model. This is a process
  choice that does not block implementation; carried as Mn3.
- **Substage B-7** references "separate independent audit" without naming
  the audit procedure. Stage A's pattern (separate Orca task/dispatch
  performing recomputed-SHA + raw-subfield check) is implied; not
  spelled out. (See Mn5.)

None of these five gaps rises to a Major defect because:
- (B-3 path string) The implementation must pick a path; the hash in B-7
  is derived from the written file regardless of the literal path
  chosen.
- (B-4 badge) The projection adapter is in scope by plan text and the
  existing service exposes exactly one adapter boundary.
- (B-5 registry) The plan §"Fixed six-video denominator" enumerates the
  record fields.
- (B-6 host) Choosing a host does not change the contract. Cycle already
  pins MiniMax-M3 elsewhere.
- (B-7 audit) The pre-audit explicitly depends on this document being
  the independent document audit.

**Verdict.** Plan is sufficiently bounded for B-0..B-7 implementation
gating. The five items above are absorbed as Minors Mn2-Mn5.

## 5. Findings

### FATAL — 0

No fatal defect. All five SHA-256 hashes match. The schema is
Draft 2020-12 meta-valid. The schema's `FailureCode` enum, the contract's
failure-code table and the fixtures' `expectedCode` sets are bijectively
matched. The schema's `Quality.status` correctly does not include
`blocked`, matching the plan's "denominator disposition" claim.

### MAJOR — 0

No major defect. No cross-run re-use, no substitution, no denominator
reduction. The historical V1 path is preserved by schema-version
constancy rather than by migration. The contract never widens the
existing derived-text cloud consent (raw media/cookie/key/local-path
counts are all `const: 0` in the V2 receipt). The frozen six-BVID
denominator is consistent across the plan and the design plan (the same
six BVIDs appear in `design/v3-5.10-media-experience-repair-plan.md`
table B). The B-3 "stale revision/hash rejected; failed synthesis leaves
prior projection byte-identical" invariant is implementable against the
existing `require_current_authority` guard and the existing
temp+atomic-replace pattern.

### MINOR — 5

Mn1 (`stage-b-grounded-comprehension-contract.md:65-92`, "Status and
failure codes"). The contract enumerates only three `Quality.status`
values (`complete`, `limited`, `rejected`) but the text does not state
explicitly that `blocked` is intentionally absent from this enum because
it is the denominator disposition. The schema confirms the design
intent; the prose does not. *Suggested edit:* add one line — "`blocked`
lives at the run/portal-adapter boundary; it is intentionally not a
value of `Quality.status`."

Mn2 (`stage-b-development-and-acceptance-plan.md:55-66`, B-3). The
substage's exit does not freeze the on-disk path convention for the V2
derivative. The existing implementation writes
`synthesis/{task_id}/revision-{revision}.json`; whether the V2
derivative reuses that path, uses
`grounded_comprehension/{task_id}/revision-{revision}.json`, or chooses
another layout is left to the implementation. The pre-audit's Mi2
already flagged unrelated Unicode scalar-count concerns (carried) but
not this path question. *Suggested edit:* add one line in B-3 fixing
the literal relative path used by the V2 derivative, so that B-7 hash
checks do not need implementation-discovery.

Mn3 (`stage-b-development-and-acceptance-plan.md:111-123`,
"Host-model content review"). The plan does not pin the model that
will perform the rubric review. The frozen MiniMax-M3 / M3.1 and
GPT-4.1-mini provider/model list (PRD §3-3) suggests one of those; the
plan treats selection as free. *Suggested edit:* add one line fixing
the host-LLM model that will be used for the rubric review, or
explicitly state "host model selection is reopened at B-6; no model
contract is changed".

Mn4 (`stage-b-development-and-acceptance-plan.md:71-86`,
"Fixed six-video denominator"). The plan enumerates the per-disposition
record fields inline but does not pin a contract (schema) or registry
filename. The pre-audit acknowledges that frozen contract files
accompany the plan; this is a soft gap because the records are written
once per run, but B-7 audit will need to validate them. *Suggested
edit:* add a line naming the registry file (e.g.
`v3-5.10-experience-repair/stage-b-six-video-run.json` schema-required
inside this evidence folder) or contract
`v3_media_510_run_manifest.schema.json`.

Mn5 (`stage-b-development-and-acceptance-plan.md:64-66`, B-7).
"separate independent audit" is not named. Stage A's independent
audit pattern is a separate Orca task/dispatch that recomputes SHAs and
raw subfields; the plan's B-7 references this audit without naming the
authority. *Suggested edit:* add one line stating the B-7 independent
audit format and the audit authority (e.g. "Orca worker dispatched
into evidence folder with that path, recomputing SHAs from raw
artifacts only").

(Carry-over Minors from `stage-b-preimplementation-audit.md` remain
valid as Minors of the document package and are not duplicated here:
cross-field JSON-Schema cannot express rolling windows / coverage /
strictly-increasing temporal sequences / evidence membership; Unicode
scalar-value counting must use code points not UTF-16 code units;
structurally valid but semantically weak LLM output cannot be fully
detected by the machine contract; six-BVID source availability is
temporally unstable. None of these are amplified by this audit.)

## 6. Independent re-decision on Stage A and on this package

- Stage A: this audit does not re-open the LIMITED PASS granted in
  `stage-a-final-independent-exit-audit-2026-10-13.md`. Stage A scope is
  fixed negative-journey evidence; that file was not modified.
- This audit's scope is this Stage B document package only:
  plan, contract, schema, fixtures, pre-audit, and the existing
  `synthesis.py`, `comprehension/service.py`, `task_store.py`,
  `product_materializer.py`, `v1 workspace schema`, focused tests for
  feasibility. No Stage B implementation was authorized, no B-0..B-7
  code was written, no fixture was modified.

## 7. Gate decision

**Stage B document package: DOCUMENT FREEZE-READY.** Fatal=0, Major=0.

Per the brief's gate rule: the audit does not auto-authorize Stage B
implementation. Implementation of B-0..B-7 may begin only after the user
explicitly authorizes it. The five Minors above are documented
improvements that the implementer may address inline during B-0..B-7,
or carry as accepted limitations into the implementation-exit audit;
none is blocking.

The five SHA-256 hashes, the schema's `FailureCode` enum and the
fixtures' `expectedCode` set are validated closed sets. The historical
V1 projection readers continue to read `v3-media-workspace-comprehension/v1`
because the V2 derivative is a new private artifact with a new
schemaVersion, revision-scoped, atomic-replace, gated by the existing
authority check. The existing derived-text cloud consent scope is not
widened (raw media/cookie/key/local-path counts are `const: 0`).
Blocked is correctly a denominator disposition, not a `Quality.status`.
Thresholds are extreme-only detectors with host review mandatory. The
six-BVID denominator is identical to `design/v3-5.10-media-experience-repair-plan.md`
and is non-substitutable. Stale authority leaves the V1 prior projection
byte-identical.

Boundaries respected: read-only, no product code/test/Runtime/Chrome/
audio/network executed, no edits to any cited artifact. Only one new
output was written: this document.

— End of audit.
