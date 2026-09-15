# V2-PX PX-0.2 Second Major Closure Development Plan

Date: 2026-09-01

## Objective

Close the three Major false-green findings and one active-authority Minor from
the second independent PX-0.2 audit. This work remains executable acceptance
tooling only and must not implement PX-1 product behavior.

## Fixed Scope

1. Enforce strict RFC 6902 array indices for add, remove and replace.
2. Bind every Report screenshot metadata path to canonical raw artifact bytes
   and to the corresponding parsed Screenshot Metadata object.
3. Detect `call`, static-array `apply` and `bind` wrappers around forbidden G4
   frontend calls in TypeScript/TSX and inline HTML module scripts.
4. Synchronize the active acceptance plan with PX-0.1b PASS and Architecture
   Scan Manifest v2.

No product API, JSON Schema, RuleId, FailureCode, RequirementId, Workspace,
Side Panel, Runtime, Adapter or data_service behavior may change.

## Implementation Order

```text
strict patch protocol
-> metadata raw-artifact binding
-> G4 wrapper normalization
-> focused negative tests
-> full local acceptance
-> PRD and false-green review
-> independent read-only re-audit
```

PX-1 remains No-Go throughout this work.
