# V2-PX PX-0.1b Static Contract And Package Audit

Audit date: 2026-08-31

## 1. Disposition

```text
Local PX-0.1b repair candidate: STATIC CHECKS PASS.
Independent re-audit: PASS, Fatal 0 / Major 0 / Minor 0.
PX-0.1b gate: PASS.
PX-0.2: CONDITIONAL GO. PX-1+: NO-GO.
```

This is a documentation, schema, fixture, Drawio and review-prototype audit. The independent result is recorded separately in `evidence/v2_external_brain_productization/px-0.1b-independent-audit.md`; neither audit approves PX-1 product implementation.

## 2. Scope

Checked inputs:

- PRD, architecture, development plan, acceptance plan and stage gate.
- Gap companion, eight-page Drawio, lifecycle ADR and Workspace hosting ADR.
- Knowledge Status plus eight PX schemas, including Validation Contracts and Architecture Scan Manifest.
- Complete positive roots and RFC 6902 fixture suite.
- Editable prototype, assets, QA metadata and generated self-contained audit artifact.

Production files under `apps/` and `services/` are outside this documentation closure.

## 3. Contract And Fixture Checks

| Check | Required result |
|---|---|
| Nine schemas parse and pass Draft 2020-12 meta-validation | PASS |
| Acceptance Manifest v5 complete root | PASS |
| Acceptance Report v12 complete root | PASS |
| Screenshot Metadata v6 complete roots with Report refs | PASS |
| Execution Observation v6 complete roots | PASS |
| Human Review v3 complete root | PASS |
| Validation Contracts v4 registry and FixtureSuite v10 | PASS |
| Architecture Scan Manifest v2 complete root | PASS |
| Two Workspace contract `$defs` positives | PASS |
| Knowledge Status offline root and cross-field constraints | PASS |
| Exact positive ID set | PASS: 65 unique IDs |
| Exact rule set | PASS: 63 unique IDs, 41 semantic / 22 schema |
| Exact mandatory-negative set | PASS: PX-N-001..109 |
| FixtureSuite root contract | PASS: `rules` is exactly 63 RuleId strings; all 109 cases contain only FixtureCase fields and validate against `$defs/FixtureSuite` |
| 109 RFC 6902 cases match declared schema outcomes | PASS |
| Semantic rule fixture coverage | PASS: all 41 semantic RuleIds have semantic cases |
| Screenshot image bytes | PASS: four distinct decodable PNGs have real dimensions 360x900 / 420x900 / 768x900 / 1280x900 and matching SHA-256 |
| Screenshot Metadata widths | PASS: all 29 width/height pairs match Manifest and decoded PNG dimensions |
| Named G6 capture variants | PASS: `viewport_sidepanel_360/420` map to Side Panel and `viewport_workspace_768/1280` map to Workspace; other scenario screenshots do not satisfy or replace these four named variants; review-only composite is excluded |
| Durable Forget roots | PASS: scenarios 27-29 each have 5 attempts, 4 same-source reopen modes and final forgotten status |
| Cross-record causality | PASS: request IDs, route IDs, prior-context outcomes and attempt ordering are covered by semantic rules and negative cases |
| Exact virtual artifact bytes | PASS: path map freezes once-parsed UTF-8 or canonical JSON bytes; 29/29 Report screenshot paths equal paired metadata image paths and resolve to the same real-size PNG bytes |
| Human Review claim level | PASS: contract fixture and production acceptance use different schema-enforced signed claims |
| Successful route recovery | PASS: five routes cover direct-open/reload/Back/reopen with route and stable-ID checks |
| Architecture scan proof | PASS: Manifest v2 freezes commit, tracked path/mode/blob/inline bytes, exact scan roots, source-tree/path-index bytes and exclusions; canonical ruleset declares import-AST and Call/New/endpoint-normalization algorithms; PX-N-104..109 mutate raw source plus dependent hashes while Report remains zero violations, and all require `PX_ARCHITECTURE_BOUNDARY_FAILED` |

False-green checks include:

- wrong action/route and extension-host URL;
- passed report with a failed child, command or human review;
- partial semantic rule, positive instance or negative fixture execution;
- unknown semantic primary failure code;
- nonparticipant layers carrying IDs;
- timeout carrying a fake response fingerprint or missing transport evidence;
- invalid prior context and incorrect tab reuse;
- missing structured G4/G6 checks;
- missing 360/768 Screenshot Metadata;
- decodable PNG dimensions or capture surface inconsistent with the declared viewport;
- action/background request ID, route identity or prior-context causality mismatches;
- durable Forget checks that switch workspace/source or use duplicate/reversed attempts;
- incomplete mandatory requirement registry or case-to-registry mismatch;
- architecture scans against the wrong commit, roots, path index, ruleset or allowlist;
- contract-only fixture promoted to production acceptance;
- Human Review evidence class or signed claim promoted beyond the Report claim level;
- successful Back/reopen losing route, workspaceId or sourceId, or missing from the five-route recovery matrix;
- architecture source-tree/path-index bytes that omit Workspace, change order or exclude a required source root;
- tracked source bytes containing forbidden imports, normalized direct data_service calls or frontend fact creation while the Report still claims zero violations;
- Report screenshot paths that differ from paired Screenshot Metadata image paths or have no byte mapping;
- missing or mismatched artifact hashes;
- offline state carrying online downstream authority;
- summary/source-kind/outcome mismatches.

The fixture suite is contract-only. It is not real product acceptance evidence.

## 3.1 Bottom-Up Gate Recalculation

The local audit recalculates this contract-fixture candidate from Manifest, Report child records, Execution Observations, Screenshot Metadata and typed command results. It does not trust the seven `gateResults` booleans as evidence.

| Gate | Recalculated contract-fixture facts | Local result |
|---|---|---|
| G1 | Unique successful scenarios: `open_workspace=2`, `view_source=3`, `open_in_workspace=2`; the three view-source scenarios reference distinct `trace_ready` sources and their entry actions are trusted user gestures | PASS |
| G2 | `source_library`, `source_detail`, `ask`, `graph` and `permissions` each have `direct_open`, `reload`, `back` and `reopen`; all 20 declarations have matching route-event kind, canonical path, `workspaceId` and applicable `sourceId`; recoverable invalid/forbidden samples = 3 | PASS |
| G3 | Four-layer cross-container ID samples = 7; tab reuse uses two ordered attempts, the same tab ID and zero ingest delta; Permission samples = 3; Forget samples = 3, each with one Forget plus four same-workspace/same-source recovery attempts ending in `forgotten` | PASS |
| G4 | Both required checks bind the same Architecture Scan Manifest, commit, three roots, path index, source tree, ruleset and allowlist; three inline tracked sources re-hash to their blobs; both frozen AST algorithms produce zero violations on the positive base; six source-level patches remain schema-valid after blob/tree rehashing and are assigned `PX_ARCHITECTURE_BOUNDARY_FAILED` without changing Report `violations=0` | PASS for contract fixture shape only |
| G5 | Exactly one deterministic sample covers each required fault: Runtime offline, Adapter blocked, data_service unreachable and source failed; status authority combinations validate against Knowledge Status | PASS |
| G6 | Four named viewport variants bind Manifest, Screenshot Metadata, decoded image dimensions and the correct product surface; Axe serious/critical = 0; keyboard assertions = 12/12 with focus return, Escape and reduced-motion; all typed viewport blockers = 0 | PASS for contract fixture shape only |
| G7 | Nine schema IDs, 63 RuleIds, 41 semantic RuleIds, 65 positive IDs and 109 requirement IDs are exact sets; FixtureSuite root and 109 patches validate; all Report screenshot paths and ArtifactRefs resolve to exact bytes and matching hashes | PASS for contract fixture shape only |

The five-route success matrix is derived from `routeEvents`; durable Forget recovery is a separate failure-recovery chain and is not counted as normal Back/reopen success. Contract-fixture G4/G6 results verify the evidence model only. Production checks still require the actual Git tree, extension entrypoints, real Chrome, real screenshots and human review in PX-5/PX-6.

## 4. Prototype Checks

| Check | Required result |
|---|---|
| Editable and self-contained inline JavaScript compilation | PASS |
| Nine images and icon dependency embedded | PASS |
| Self-contained prototype readiness and zero console errors | PASS |
| Prototype package manifest hashes | PASS |
| Unsaved current source direct-open | `SOURCE_NOT_FOUND` |
| Saved current source route/title/breadcrumb | same stable source ID |
| Saved source full reload/reopen/Back | same Source Detail |
| Forget then reload/reopen/Back/direct-open | `SOURCE_NOT_FOUND` |
| Graph removal | exact source ID |
| Invalid context open-in-workspace | Source Library fallback |
| Valid Graph context open-in-workspace | Graph preserved |
| Browser processes created by checks | cleaned up |

The saved-source registry and tombstones are review-only prototype state. Production authority remains Runtime. These checks do not prove the real extension route, tab reuse, accessibility or production data lifecycle.

## 5. Drawio And Authority Checks

| Check | Required result |
|---|---|
| Drawio XML / page count / unique IDs / page bounds | PASS / 8 / PASS / PASS |
| Lifecycle | retry only; cancel/resume unsupported |
| Runtime restart | re-query stable IDs; no old-operation recovery promise |
| Contract versions | Manifest v5 / Report v12 / Screenshot v6 / Execution v6 / Human v3 / Validation v4 / Architecture Scan Manifest v2 |
| G6 | Manifest- and decoded-image-matching product-surface evidence: Side Panel 360/420 and Workspace 768/1280 |
| G7 | exact 9 schemas / 63 rules / 41 semantic rules / 65 positives / 109 negatives plus raw artifact hashes |
| Phase order | PX-0 -> PX-0.1 -> PX-0.1b -> PX-0.2 -> PX-1..PX-6 |
| Gate state | PASS / PX-0.2 Conditional Go / PX-1+ No-Go |

The rebuilt external package must contain exactly 20 flat files: 19 manifest-listed payloads plus `AUDIT_MANIFEST.md`.

## 6. Remaining Gate Risk

The independent review confirmed the following without new fatal, major or minor findings:

1. Every active authority uses the frozen versions and exact set rules.
2. The positive fixture genuinely satisfies all Gate calculations, including viewport/capture and durable Forget, not only Schema shape.
3. The 109 negative cases cover every semantic RuleId and every machine-readable mandatory registry requirement without an unmodelled false-green path.
4. The self-contained prototype behavior and embedded provenance are reproducible.
5. The claim boundary is preserved.

PX-0.2 has not yet been implemented. PX-1 product code has not been approved or implemented by this closure.

## 7. Claim Boundary

Allowed:

```text
V2-PX PX-0.1b passed reproducible local static checks and independent
document/contract/prototype re-audit with Fatal 0 / Major 0 / Minor 0.
```

Not allowed:

```text
PX-0.2 implemented.
PX-1 ready or implemented.
V2-PX complete.
V2 / RAG / automatic forgetting / Dream Cycle ready.
```
