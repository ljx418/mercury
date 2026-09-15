# V2-PX PX-0.2 Acceptance

Acceptance date: 2026-09-01

## Result

```text
Local fourth-repair command set: PASS.
Fifth independent implementation re-review: PASS.
Fatal issues: 0.
Major issues: 0.
Minor issues: 0.
Product capability added: none.
PX-1 gate: CONDITIONAL GO for a separately planned workpack.
```

## Executed Evidence

| Check | Result | Evidence |
|---|---|---|
| Contract fixture CLI | PASS | `validator-result.json` |
| Deterministic repeat | PASS; byte-identical console output | `validator-run-1.log`, `validator-run-2.log` |
| Validator unit tests | PASS; 10/10 | `validator-test.log` |
| Full extension regression | PASS; 13 files, 116 tests | `full-test.log` |
| TypeScript typecheck | PASS | `typecheck.log` |
| Production extension build | PASS | `build.log` |
| Implementation binding | PASS | `implementation-sha256.txt`, `validator-result.json` |

The build retained the existing warning for a minified chunk above 500 kB. It
did not fail the build and PX-0.2 adds no production bundle dependency.

## Recomputed Contract Result

```text
Schemas: 9/9
Positive instances: 65/65
FixtureSuite roots: 1/1
Fixture validation instances: 175/175
RuleIds: 63/63
Semantic RuleIds: 41/41
Mandatory RFC 6902 fixtures: 109/109 rejected with the registered outcome
Computed G1-G7: 7/7 true
Issues: 0
```

The CLI also verifies the frozen semantic specification, fixture suite and
positive evidence payload raw-byte hashes. Its result binds the actual
validator source at:

```text
apps/chrome-extension/e2e/validate-v2-external-brain-productization-report.mjs
16947f89bb5a94812a00e80eacc8252177ea0800a7dee798261ba4b98c1e2cc6
```

## E2E Meaning

This is executable contract-fixture E2E. It proves that the validator loads the
frozen contract package, materializes evidence bytes, re-runs schema and
semantic checks, parses tracked TypeScript for G4, and rejects false-green
mutations. It does not prove that the Workspace product exists or that real
Chrome dual-container acceptance has passed.

## Major Closure Status

The first independent read-only audit found four Major false-green gaps. The
repaired candidate now closes them locally as follows:

1. FixtureSuite validates as a complete root, exact registry sets are compared,
   and malformed roots execute zero patches.
2. PNG evidence is decoded through `pngjs` with CRC and pixel-buffer checks.
3. G4 scans TypeScript AST and HTML module scripts with normalized loopback URL
   handling; focused bypass tests are included.
4. All semantic rules, G1-G7, schema/fixture counts and the actual validator
   implementation artifact are recomputed and bound to the result.

The old audit remains at `independent-audit.md`. The repaired candidate was
independently re-audited and three further false-green paths were reproduced:
strict RFC 6902 array-index validation, screenshot-metadata artifact binding and
the G4 `fetch.call` bypass. See `independent-reaudit.md`. PX-0.2 remains reopened.

The bounded second repair closes those three findings locally:

1. RFC 6902 array indices now accept only canonical decimal indices and `-`
   for append; malformed or out-of-range indices fail the whole fixture suite
   before any case result is accepted.
2. Every `screenshotMetadataPath` now resolves to hash-verified canonical JSON
   bytes and must be structurally identical to the paired out-of-band metadata.
3. G4 scans direct calls plus static `.call`, `.apply`, `.bind` and
   `Reflect.apply` wrappers, with endpoint normalization preserved.

The third independent audit reproduced all three repairs but found a new Major:
an extra valid screenshot path can be added without a paired metadata path and
the validator still returns success because it compares only index 0. See
`independent-reaudit-2.md`. PX-0.2 remains `FAIL / REOPENED`.

The third bounded repair closes this finding locally. Screenshot Metadata
uniqueness is now based on `scenarioId + captureVariantId`; every passed
scenario requires equal non-zero image/metadata path counts, and every index
pair must resolve to canonical artifact bytes, the ordered metadata object and
the same image path. Focused tests prove a valid two-pair scenario passes while
extra image, extra metadata, reordered image, cross-scenario metadata and
duplicate metadata attacks fail. PX-0.2 remains reopened pending a fourth
independent read-only audit.

The fourth independent audit reproduced the expected cardinality, ordering,
cross-scenario and duplicate-variant behavior, but found one new Major: two
metadata variants can reuse the same image path and still pass. This duplicates
one screenshot as two evidence pairs. See `independent-reaudit-3.md`.

The fourth bounded repair closes this finding locally by requiring unique
image and metadata paths inside every scenario's ordered pair set. Focused
coverage reproduces two distinct metadata variants sharing one image path and
requires rejection, while a valid two-variant case with distinct paths still
passes. PX-0.2 remains reopened pending a fifth independent read-only audit.

The fifth independent audit reproduced the complete attack matrix and returned
Fatal 0 / Major 0 / Minor 0. See `independent-reaudit-4.md`. PX-0.2 is closed;
this does not implement PX-1 or provide production Chrome evidence.
