# V2-PX External Brain Productization Readiness Audit

Audit date: 2026-09-01

## 1. Final Disposition

```text
V2-PX product direction, Route A and eight-page Drawio: PASS.
V2-7 active-state synchronization: PASS.

PX-0.1b executable-contract and complete audit-package closure: PASS.
Independent audit: Fatal 0, Major 0, Minor 0 on 2026-08-31.

PX-0.2 executable acceptance tooling: PASS after fifth independent audit.
PX-1 production implementation: CONDITIONAL GO after its separate plans and preimplementation audit.
PX-2+ production implementation: NO-GO until preceding stage acceptance passes.
```

The PX-0.1b independent result is recorded at `docs/active/project/evidence/v2_external_brain_productization/px-0.1b-independent-audit.md`. The final PX-0.2 result is recorded at `docs/active/project/evidence/v2_external_brain_productization/px-0.2/independent-reaudit-4.md`. PX-1 product code was not implemented by these audits.

## 2. Latest Findings And Repair Candidate

| Severity | Latest independent finding | Current local repair candidate | Gate state |
|---|---|---|---|
| Major 1 | Report screenshot path 与 metadata `imagePath`、真实图片字节闭环 | CLOSED; independent re-audit verified 29/29 |
| Major 2 | G4 必须重扫源码，不能信任 `violations=0` | CLOSED; independent re-audit verified PX-N-104..109 source-byte mutations |
| Major 3 | SemanticResult 字段与规格一致 | CLOSED; independent re-audit found no alias or self-reference conflict |
| Minor 1 | Schema bundle 原始字节 hash 可独立重算 | CLOSED; independent re-audit verified source/canonical hashes |

## 3. Frozen Local Contract Candidate

```text
Knowledge Status: existing V2 schema
Workspace Contracts: canonical $defs
Acceptance Manifest: v5
Acceptance Report: v12
Screenshot Metadata: v6
Execution Observation: v6
Human Review: v3
Validation Contracts: v4
Architecture Scan Manifest: v2
Fixture protocol: complete roots + RFC 6902
```

Key invariants:

- Report and Screenshot status observations reuse Knowledge Status. Offline is only `frontendInferredRuntimeStatus=offline + runtimeStatus=null + unchecked/unchecked/unknown`.
- Runtime `response` requires a response fingerprint. `timeout / connection_refused` forbid it and require transport error evidence.
- Layer observations are scenario-aware; absent participants cannot manufacture IDs.
- An unsaved or forgotten source cannot be restored. A saved source remains addressable by the same stable ID across reload/reopen/Back until Forget.
- `open_in_workspace` records prior context; invalid context falls back to Source Library.
- Tab reuse requires ordered attempts, the same tab ID and unchanged ingest count.
- G4 binds the acceptance commit, source tree, three canonical scan roots, tracked path index, machine-readable ruleset, non-overriding allowlist and tracked source bytes in both architecture checks. Contract fixtures carry manifest-owned inline bytes; production reads Git blobs.
- G6 uses typed axe/keyboard/viewport results and four real-size contract PNGs: Side Panel 360/420, Workspace 768/1280. Manifest, metadata and decoded pixels must agree.
- G7 requires exact set equality and executable coverage: nine schemas, 63 rules, all 41 semantic rules, 65 positive IDs and 109 mandatory-negative requirements, with raw semantic-spec/implementation/positive-payload/fixture hashes.
- Failure codes, RuleIds and mandatory requirements are closed registries; every case key/rule/layer/primary failure must match the requirement registry.
- Contract fixtures are explicitly `contract_fixture`; production acceptance must be `production_acceptance` and cannot use `virtual/*`.
- Summary, source kinds and G1-G7 are recomputed from underlying observations.

## 4. Local Validation Candidate

The repair candidate is expected to demonstrate all of the following in the rebuilt audit package:

- Nine schemas parse and pass Draft 2020-12 meta-validation.
- The positive set contains exactly 65 IDs: five complete roots, 29 Execution Observation roots, 29 Screenshot Metadata roots and two Workspace `$defs` positives.
- The fixture suite contains exactly PX-N-001..PX-N-109 and validates as RFC 6902 cases plus the mandatory requirement registry.
- All 109 patch cases produce their declared schema-valid/schema-invalid result and match their registry key/rule/layer/primary failure; all 41 semantic RuleIds have semantic coverage.
- Screenshot Metadata covers Side Panel 360/420 and Workspace 768/1280 with actual decoded PNG dimensions; composite review evidence is excluded.
- Report v12 binds the exact rule-set, semantic subset, positive-set and fixture-suite IDs/hashes plus semantic spec, validator implementation and positive raw evidence artifacts. Its 29 screenshot paths equal the paired metadata image paths.
- PX-N-104..109 patch manifest-owned source bytes and all dependent blob/tree hashes while leaving zero-violation Report results untouched; the expected failure is always `PX_ARCHITECTURE_BOUNDARY_FAILED`.
- Scenarios 27-29 each bind one Forget action and direct-open/reload/Back/reopen checks for the same source, ending in `forgotten`.
- The self-contained prototype restores a saved source across reload/reopen/Back and rejects it after Forget across the same paths.
- Drawio remains eight pages and reflects Report v12, Validation Contracts, the four screenshot viewports and the durable saved/forgotten source lifecycle.
- Existing V2 Runtime knowledge API regression remains green.
- The FixtureSuite root itself validates: its `rules` member is exactly the ordered 63-RuleId set, and every case excludes registry-only fields while matching the requirement registry.
- A bottom-up local audit recalculates all five route recovery matrices, three durable Forget chains, four named G6 variants, 144 virtual byte mappings, 29 paired screenshot paths and all structured ArtifactRef/path+hash fields instead of trusting `gateResults` booleans.

These checks are PX-0.1b documentation/prototype evidence only. They are not production Extension Workspace evidence.

## 5. Independent Re-Audit Requirements

The independent reviewer must verify the flat package under `docs/active/project/external-audit-package/`:

1. Exactly 20 flat files and 19 payload SHA-256 values.
2. No active authority contains obsolete Report/Screenshot/Execution versions.
3. Nine schema meta-validations and external-reference resolution.
4. Exact equality of the 63-rule, 41-semantic-rule, 65-positive and 109-negative sets and their raw-file hashes.
5. Four required Manifest/metadata/decoded-image matches, Side Panel/Workspace surface mapping and exclusion of review-only composites.
6. Every FixtureCase exactly matches the mandatory requirement registry; all cross-record semantic rules have isolated cases.
7. Both architecture checks bind the Architecture Scan Manifest; tracked path order, inline/Git source bytes, source tree, exact exclusions, ruleset and allowlist bytes/hashes are independently recomputable, and source-level negative patches cannot pass by trusting `violations=0`.
8. Three same-source durable Forget chains, ordered attempts and route identity in contract evidence; saved/forgotten behavior in the review prototype.
9. Contract fixture/production acceptance separation across Report and Human Review, exact path-to-byte bindings, unique source fixture bytes and claim boundary.
10. PRD, architecture, plans, ADR and Drawio consistency; PX-0.2 PASS must not be promoted to PX-1 or product acceptance.

The PX-0.1b independent result returned Fatal 0 and Major 0. The implemented PX-0.2 validator subsequently passed its fifth independent audit with Fatal 0 / Major 0 / Minor 0. PX-1 is therefore Conditional Go only after its own plans and preimplementation audit close.

## 6. Claim Boundary

Allowed now:

```text
V2-PX PX-0.1b executable-contract closure passed independent review.
PX-0.2 executable acceptance tooling passed its frozen contract-fixture suite and independent review.
PX-1 planning may begin under its own stage gate.
```

Not allowed:

```text
PX-1 implemented or accepted.
V2-PX implemented.
V2 ready / complete external brain / RAG ready.
Automatic forgetting or Knowledge Dream Cycle ready.
```
