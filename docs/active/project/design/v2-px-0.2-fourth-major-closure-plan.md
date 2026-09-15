# V2-PX PX-0.2 Fourth Major Closure Development Plan

Date: 2026-09-01

## Objective

Close the duplicate-image evidence false green found by the fourth independent
PX-0.2 audit. This work remains executable acceptance tooling only and must not
implement PX-1 product behavior.

## Fixed Scope

1. Require unique `screenshotPaths` within each scenario.
2. Require unique `screenshotMetadataPaths` within each scenario.
3. Preserve valid multi-variant evidence only when every pair has a distinct
   image artifact path, metadata artifact path and capture variant identity.
4. Add focused attacks for duplicate image and metadata paths, plus a boundary
   test showing that distinct contract-fixture paths may share fixture bytes
   without being counted as the same path identity.

No product API, JSON Schema, RuleId, FailureCode, RequirementId, Workspace,
Side Panel, Runtime, Adapter or data_service behavior may change.

## Implementation Order

```text
per-scenario path uniqueness
-> focused duplicate-evidence tests
-> deterministic validator and full local acceptance
-> PRD and false-green review
-> independent read-only re-audit
```

PX-1 remains No-Go throughout this work.
