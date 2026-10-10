# V3-2-0a 模块交接

## Module

```text
Module: V3 Media Companion / ASR Provider and Model Management
Owner Agent: current implementation session
Date: 2026-09-21
Stage Gate: V3-2-0a LOCAL LIMITED PASS / INDEPENDENT EXIT AUDIT PASSED (Fatal=0, Major=0, Minor=3)
```

## Change Summary

```text
Changed files: Runtime ASR catalog/manager/API/import/release-prep, Extension runtimeClient/Settings/UI tests/E2E, contracts, fixtures, PRD/architecture/gates/evidence.
Behavior added: closed provider/model catalog; Tiny fallback; requested/effective selection; verified remote install; progress/cancel/restart recovery; offline package; Settings resource/quality UI.
Behavior intentionally not added: media acquisition, subtitle content, tabCapture, production transcript, OCR/VLM, outline/mindmap/ask, arbitrary provider code or arbitrary URL.
```

## Contract Status

```text
Public API changed: yes, new /v1/asr/* control-plane endpoints.
Adapter contract changed: no existing V1/V2 adapter contract changed.
Data model changed: yes, new isolated V3 ASR catalog/selection/job public schemas.
Event type changed: no shared EventStore event added; install progress uses endpoint/SSE-local job records.
Review path: v3-2-0a-independent-implementation-exit-audit.md and its immutable external audit package.
```

## Evidence

```text
Unit/contract tests: Runtime 287; ASR targeted 17; Extension 293; typecheck/build PASS.
Fixture: docs/active/project/fixtures/v3-asr-model-management-positive.json
Real data: v3-2-0a-low-resource-real-data-result.json
Real install: v3-2-0a-real-install-result.json
Chrome: v3-2-0a-asr-model-management/v3-2-0a-2026-09-21T121500382Z/
PRD review: v3-2-0a-prd-review.md
```

## PRD Coverage

```text
Covered: PRD 18.5 and V3-2-0a-A01..A16.
Not covered: V3-2-A03..A20 production acquisition/transcript path; A06 remains failed.
Reason: this substage is model management and fallback only.
```

## Integration Handoff

```text
Inputs: a ready effectiveModelId from AsrModelManager; future release root containing verified Tiny.
Outputs: public model catalog, selection, installation jobs, verified ready model path for future LocalAsrAdapter.
Known assumptions: Runtime owns downloads and private storage; Extension never sees model source/path.
Known risks: final installer/container asset wiring is not frozen; no provider beyond faster-whisper is qualified.
Stop conditions: any attempt to count fallback/install as A06, accept arbitrary URL/code, expose path/secret, or start V3-2-1 before quality replanning.
```

## No-Go Self Check

- [x] Existing V1/V2 public contracts were not changed.
- [x] Frontend does not call model hosts or provider implementations.
- [x] No ad-hoc shared event string was added.
- [x] Real-data, real-install and Chrome evidence are labeled separately.
- [x] No V3-2 media or V4 capability is claimed.
