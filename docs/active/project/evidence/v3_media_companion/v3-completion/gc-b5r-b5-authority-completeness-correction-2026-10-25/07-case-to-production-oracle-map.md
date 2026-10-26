# The case → production-oracle map

Every case of the corrective goal, and the PRODUCTION code path that proves
it.

## AC1 — every machine identity field is bound to the authority

| the required correction | the production oracle | the proving case |
|---|---|---|
| the source identity must PARSE and equal the frozen row authority | `parseSourceIdentity()` + `machineIdentityDefects()` in `lib/machine_identity.mjs` | `AC1: the source portal and adapter are the FROZEN authority` |
| the literal portal `portal` and adapter `bilibili` | `FROZEN_SOURCE_PORTAL`, `FROZEN_SOURCE_ADAPTER` | the same case |
| the exact row BVID | the identity validator's source comparison | the same case and `SB1: the source identity must name the frozen row` |
| the non-empty playback-unit and part components | the same validator | `AC1: the playback unit and the part must be present` |
| the task namespace must satisfy the frozen task-namespace shape | `TASK_ID` in `lib/machine_identity.mjs` | `AC1: the task namespace must satisfy the FROZEN shape` |
| the sequencer must PARSE `task_namespace.json` | `collectSourceRows()` in `sequencer.mjs` → `row.namespaceReceipt` | `AC1: a MALFORMED namespace receipt is not a positive candidate` (pure and process level) |
| reject a malformed or extra/missing namespace field | `taskNamespaceReceiptDefects()` | `AC1: the task namespace RECEIPT is parsed and bound` |
| cross-bind the namespace, run id, order and bvid | the same function, called with the machine receipt, the run id and the row | `AC1: a NAMESPACE FILE MISMATCH is not a positive candidate` |
| the file's presence is not proof | the aggregate reads the PARSED receipt | `AC1: an ABSENT namespace receipt is not a positive candidate` |
| the timestamps must denote finite, valid UTC instants | `isFiniteUtcInstant()` | `AC1: the timestamps must be FINITE, REAL UTC instants` |
| reject impossible calendar/time values | the same function (the day is checked against the real month length) | the same case |
| require `finish >= start` | `machineIdentityDefects()` | `AC1: a reversed window is a defect` |
| no silent normalization | the validator never rewrites a value | the same cases |
| direct, pure AND real-sequencer negatives | the three test files | the AC1 cases of `machine_identity`, `aggregate_identity` and `sequencer` |
| stable internal failure codes and non-zero process exits | `AGG_MACHINE_IDENTITY_INVALID`, `AGG_NAMESPACE_RECEIPT_INVALID` | every AC1 case asserts the code |

## AC2 — the machine disposition is mandatory

| the required correction | the production oracle | the proving case |
|---|---|---|
| `disposition` joins the explicit machine terminal shape | `MACHINE_TERMINAL_FIELDS`, `machineTerminalDefects()` | `AC2: the disposition is a REQUIRED, typed terminal field` |
| a string in the frozen vocabulary | `MACHINE_DISPOSITIONS` | the same case |
| compare it unconditionally with the parsed final disposition | `machineDispositionMismatch()` + the aggregate | `AC2: the machine disposition is compared with the parsed final disposition` |
| missing, null, wrong type, unknown and mismatch all fail closed | the aggregate's terminal block | the five pure cases and the five process-level cases |
| the shared quality mapping and the publication rules are preserved | `QUALITY_STATUS_TO_DISPOSITION` | `SB2: the production mapping is the single rule` |
| the hashes are recomputed in the semantic tests | the shared stub derives every hash from the bytes | the SB2 cases |

## AC3 — the public schema entry point is self-protecting

| the required correction | the production oracle | the proving case |
|---|---|---|
| a CHECKED public validation entry | `validateAgainstSchema()` in `lib/v21_artifact.mjs` | `AC3: the PUBLIC validation entry point is fail-closed on its own` |
| a PRIVATE recursive evaluator | `evaluateSchema()` (not exported) | the same case |
| the inventory runs once, not per recursion | the public entry calls `assertSchemaKeywordSupport()` once | the same case |
| direct calls with `not`, `minProperties`, `exclusiveMinimum` and NESTED unsupported keywords hard-fail | the public entry | `SB3: the unsupported keywords are never silently ignored` and the five placement cases |
| the tests call the same public API production uses | the test files | every placement case now calls `validateAgainstSchema` |
| the frozen-schema cache validation is retained | `frozenV21Schema()` | `SB3: the real artifact validator refuses an unsupported frozen schema` |
| the complete keyword inventory tests | `inventorySchemaKeywords()` | `SB3: the frozen schema's keyword inventory is fully supported` |
| the canonical serialization checks | `canonicalJson()` + the Python `_canonical()` | the Python byte comparison case |
| the Python/JavaScript representative cases | the shared validator + the production `jsonschema` | the Python equivalence cases |

## AC4 — the preserved closures

| the required property | the production oracle | the proving case |
|---|---|---|
| the deterministic artifact filename and the byte hashing | `V21_ARTIFACT_FILENAME` + `sha256Hex` | the AI1 cases |
| the artifact task/revision/source unconditional binding | `checkArtifactIntegrity()` step 6 | the AI1 identity cases |
| the quality/disposition mapping and the empty complete failure codes | `QUALITY_STATUS_TO_DISPOSITION` + the aggregate | the SB2 cases |
| the exact mirror wrapper, the Provider lock, the positive request counts and the ledger totals | `MIRROR_REQUIRED_KEYS` + `DERIVED_TEXT_SCOPE` + the accounting block | the AI2 and CI2 cases |
| the authorization/grant ownership and the latched owned-process sightings | `lib/authorization.mjs` + `lib/process_ownership.mjs` | `an OWNED descendant that exits before the closeout is still a leak` |
| the public contracts, FailureCodes, thresholds, Provider registry, Origin/auth order, frozen denominator, relay fixtures and historical evidence | the frozen files and the manifests | the boundary table in `06-ac4-preserved-closures-proof.md` |

## The seams that remain test-only, and where they are used

| seam | what it is | where it is used | why it is acceptable |
|---|---|---|---|
| `NAVIA_B5_TEST_RUNTIME_URL` | the local Runtime double of the runner | the runner-level tests | it replaces the Runtime; the runner's own finalization, ledger, artifact and audit set run against it |
| `NAVIA_B5_TEST_NO_BROWSER` | no Chrome | the runner-level tests | the runner's own flow, ledger and finalization still run |
| `NAVIA_B5_TEST_DB_PATH` | a synthetic SQLite database | the runner-level tests | the database is created by the test with synthetic rows |
| `NAVIA_B5_TEST_MEDIA_TASK_ROOT` | the owned media task root of the double | the runner-level tests | the double writes the published derivative and the internal diagnostic into it |
| `NAVIA_B5_DIAGNOSTIC_FILE` | the internal diagnostic of the double | the runner-level tests | it is the same channel the production Runtime uses (the private diagnostic file) |
| the STUB runner | a child that writes the evidence set without a browser | the sequencer-level tests | the sequencer's own authorization, ledger, aggregate, artifact oracle, ownership audit and stop logic is the production code; the stub writes its evidence through the PRODUCTION ledger library and the shared contract-shaped writer |
| the hand-built rows of `aggregate_identity.node-test.mjs` | plain data | the pure cases | the evaluator under test IS the production `evaluateAggregate()`; the rows are built by the SHARED contract-shaped writer, so they carry REAL contract-shaped bytes |

**No case above is proven by a seam that skips the behaviour under test.**
