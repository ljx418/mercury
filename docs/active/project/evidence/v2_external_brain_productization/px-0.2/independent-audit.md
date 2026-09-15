# V2-PX PX-0.2 Independent Implementation Audit

Audit date: 2026-09-01

## Disposition

```text
PX-0.2: FAIL / REOPENED.
Fatal issues: 0.
Major issues: 4.
Minor issues: 0.
PX-1+: NO-GO.
```

## Provenance

The audit was run read-only by an independent Codex worker through Orca
orchestration. The worker did not edit repository files and recomputed the
validator outputs instead of accepting local PASS fields.

```text
Run: run_67e33638c2f2
Task: task_beae592d772f
Successful audit dispatch: ctx_2dd8c82bbba6
Superseded Claude startup attempt: ctx_a7ca24472852 (no audit result)
```

## Independently Reproduced Passes

- Nine schemas meta-validated.
- The positive set, registries and fixture suite contained 65, 63, 41 and 109
  entries as declared.
- Current PNG paths, hashes and declared dimensions matched their fixtures.
- The CLI was deterministic across two executions.
- All six frozen G4 mutations were rejected.
- Targeted tests passed 3/3 and typecheck passed.
- The actual validator source SHA-256 matched `implementation-sha256.txt`.

## Major Findings

### Major 1: FixtureSuite root is not closed

`runContractFixtureSuite()` consumes an injected or on-disk suite without first
validating the `FixtureSuite` `$def`. It does not independently reject every
unexpected field, unknown warning, duplicate requirement or missing
requirement before case execution. The single malformed-suite unit test only
changes one registry field and does not prove full failure closure.

### Major 2: PNG validation is structural, not decoded

`pngDimensions()` checks signature, chunk boundaries, IEND and IHDR dimensions,
but does not inflate/decode IDAT data. Corrupt image payloads can therefore
retain plausible headers and pass.

### Major 3: G4 source scan has bypasses

The current TypeScript scan misses source forms including spaced `fetch`,
`new URL()` localhost composition and a Workspace module-script fetch case.
These can produce `scopeValid=true` and `violations=0` despite violating the
frozen frontend boundary.

### Major 4: SemanticResult binding is incomplete

Computed G1-G7 and the embedded SemanticResult are not fully compared. The
PX-0.1b positive Report still names a virtual validator artifact; the separate
CLI summary contains the actual hash, but the complete evidence result does not
yet bind that implementation as required by the PRD.

## Required Rework

1. Schema-validate FixtureSuite and verify exact closed sets before execution;
   add missing/duplicate/unexpected/warning negative tests.
2. Decode PNG image data with a proven decoder and add corrupt-IDAT tests.
3. Strengthen G4 AST/URL normalization and add raw-source bypass fixtures.
4. Generate and validate a PX-0.2 SemanticResult that binds the actual
   implementation and compares recomputed gates and coverage sets.
5. Repeat local acceptance and independent read-only audit.

