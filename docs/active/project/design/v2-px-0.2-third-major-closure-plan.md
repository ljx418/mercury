# V2-PX PX-0.2 Third Major Closure Development Plan

Date: 2026-09-01

## Objective

Close the screenshot image/metadata cardinality false green found by the third
independent PX-0.2 audit. This work remains executable acceptance tooling only
and must not implement PX-1 product behavior.

## Fixed Scope

1. Require every passed scenario to have equal, non-zero
   `screenshotPaths` and `screenshotMetadataPaths` lengths.
2. Resolve and validate every index pair rather than only pair zero.
3. Require each metadata artifact to match its parsed Screenshot Metadata
   object and each paired image path to match that object's `imagePath`.
4. Reject missing, extra, duplicated, reordered or cross-scenario pairings.
5. Add focused single-pair, multi-pair and adversarial tests.

No product API, JSON Schema, RuleId, FailureCode, RequirementId, Workspace,
Side Panel, Runtime, Adapter or data_service behavior may change.

## Implementation Order

```text
equal non-zero cardinality
-> index-by-index artifact/object/image validation
-> focused positive and negative tests
-> deterministic validator and full local acceptance
-> PRD and false-green review
-> independent read-only re-audit
```

PX-1 remains No-Go throughout this work.
