# V2-PX PX-0.2 Major Closure Plan

Plan date: 2026-09-01

## Trigger

The first PX-0.2 independent implementation audit returned Fatal 0 / Major 4 /
Minor 0. PX-1 remains No-Go. This plan repairs only executable acceptance
tooling; no Workspace product code or public contract changes are allowed.

## Repair Sequence

1. Validate all nine schemas with Draft 2020-12 `check_schema`, then validate
   the complete FixtureSuite against Validation Contracts `$defs/FixtureSuite`.
2. Recompute exact RuleId and RequirementId sets, reject duplicates, missing
   entries, unknown warnings and registry-field mismatches before case patches
   execute.
3. Decode every PNG with a maintained PNG decoder, and require decoded width,
   height, pixels and SHA-256 to match evidence metadata. Add corrupt-IDAT and
   truncated-image tests.
4. Strengthen the frozen G4 v2 implementation with TypeScript AST handling for
   `new URL` static arguments, spaced calls, member calls and endpoint folding.
   Parse HTML through a DOM parser and scan inline module scripts and script
   source dependencies.
5. Generate an effective PX-0.2 SemanticResult that preserves the frozen
   evidence-set identifiers but replaces the PX-0.1b virtual implementation
   marker with the actual validator path/hash.
6. Compare exact RuleId, semantic RuleId, positive ID, requirement ID,
   fixture/spec/payload hashes, `failedRules` and recomputed G1-G7 against the
   effective result. Do not trust embedded booleans.
7. Add focused tests for each independent Major and rerun the full PX-0.2,
   typecheck, extension regression and build checks.
8. Request a fresh independent read-only audit. PX-1 remains No-Go until that
   audit returns Fatal 0 / Major 0.

## Contract Impact

```text
Schema change: none expected.
Validation registry change: none.
Runtime / Workspace / data_service API change: none.
Allowed dependency: test-only maintained PNG decoder.
```

## Stop Conditions

- A required repair needs a schema, RuleId, failure-code or PRD behavior change.
- Corrupt PNG bytes pass decode.
- Any G4 bypass source produces zero violations.
- The effective SemanticResult cannot bind actual source bytes without a
  self-referential artifact.
- Independent re-audit reports a new fatal or major issue.

