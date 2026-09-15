# V2-PX PX-0.2 Executable Acceptance Tooling Development Plan

Plan date: 2026-08-31

## Objective

Implement the frozen V2-PX semantic validator and its executable fixture runner.
This work package validates evidence; it does not add Workspace product UI,
routes, Runtime APIs or data_service integration.

## Approved Inputs

- PX-0.1b independent audit: PASS, Fatal 0 / Major 0 / Minor 0.
- Knowledge Status plus eight PX schemas.
- `px-0.1b-positive-instances.json` v10.
- `px-0.1b-positive-evidence-payload.json` v4.
- FixtureSuite v10 with 109 RFC 6902 cases.
- Validation Contracts v4: 63 RuleIds, 41 semantic RuleIds and 109 mandatory
  RequirementIds.
- Semantic rules v6 and Architecture Scan Manifest v2.

Any contract or registry change returns this work package to PX-0.1b.

## Target Files

```text
apps/chrome-extension/e2e/validate-v2-external-brain-productization-report.mjs
apps/chrome-extension/e2e/validate-v2-external-brain-productization-report.test.mjs
apps/chrome-extension/package.json
docs/active/project/evidence/v2_external_brain_productization/px-0.2/
```

## Implementation Sequence

1. Load the nine schemas, positive roots, evidence payload and FixtureSuite.
2. Meta-validate all schemas and resolve Workspace `$defs` targets.
3. Implement strict RFC 6902 `add/remove/replace` patch execution with JSON
   Pointer unescaping and failure on missing paths.
4. Implement exact virtual artifact materialization for UTF-8, canonical JSON
   and RFC 4648 base64 bytes; verify every path/hash pair.
5. Implement PNG magic, chunk-boundary, IHDR and decoded-dimension checks.
6. Implement schema-positive and schema-negative fixture execution through
   Python `jsonschema` Draft 2020-12.
7. Implement bottom-up semantic checks for the 41 frozen semantic RuleIds,
   including G1-G7 recomputation and claim/evidence boundaries.
8. Implement G4 source scanning from Architecture Scan Manifest bytes. Parse
   TypeScript with the installed TypeScript compiler API; never trust reported
   `violations`.
9. Require every semantic negative case to produce its registered primary
   failure code, allowing only its declared warnings.
10. Emit deterministic JSON and Markdown audit results with command logs and
    implementation hash.

## Ownership And Contract Impact

```text
Production Runtime API change: none.
Workspace product code change: none.
Schema/registry change: none.
Allowed package change: one npm validator command.
```

## Stop Conditions

- Positive base fails any frozen semantic rule.
- A schema-negative or semantic-negative fixture is accepted.
- A case produces an unknown or different primary failure code.
- G4 passes without parsing tracked source bytes.
- Missing/path-traversing/hash-mismatched artifacts pass.
- Contract fixture is promoted to production acceptance.
- Any active authority requires a contract change.

