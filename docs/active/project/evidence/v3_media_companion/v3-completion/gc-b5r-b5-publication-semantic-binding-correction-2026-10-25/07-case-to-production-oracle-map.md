# The case → production-oracle map

Every case of the corrective goal, and the PRODUCTION code path that proves
it.

## SB1 — the machine identity is mandatory

| the required correction | the production oracle | the proving case |
|---|---|---|
| ONE explicit validator for the complete machine-receipt identity | `machineIdentityDefects()` in `lib/machine_identity.mjs` | the eleven pure cases of `machine_identity.node-test.mjs` and the eleven pure cases of `aggregate_identity.node-test.mjs` |
| the run id and the active registry digest are required | the same | the same |
| the frozen order and bvid are required | the same | the same |
| the task id and the task namespace are required | the same | the same |
| the integer task revision is required | the same | the same |
| the source identity is required and parsed | `parseSourceIdentity()` | the same |
| the dependency generation is required | the same | the same |
| the fresh start and finish timestamps are required | the same | the same |
| no truthy conditional comparisons | the module has none: every field is typed and compared | the null, wrong-type and mismatch cases |
| the expected row identity and run identity reach the artifact oracle | `evaluateAggregate()` → `checkArtifactIntegrity({ expected })` | `SB1: a foreign artifact with a removed machine source and revision is not positive` |
| the artifact binding task id, revision and source identity are compared EXACTLY | `checkArtifactIntegrity()` step 6 | the same |
| the source identity's portal/adapter/BVID components belong to the frozen row | step 7 of the oracle | `SB1: the artifact source identity must name the FROZEN row` |
| a missing machine field never disables a comparison | the oracle's explicit `continue` branches that FAIL | the eleven process-level cases of `sequencer.node-test.mjs` |
| pure AND real-sequencer negatives for every required identity field | both | the pure file and the sequencer file |
| a foreign artifact whose machine source/revision declaration was removed | the oracle + the identity validator | the pure case and the process-level case |
| a stable internal aggregate failure code | `AGG_MACHINE_IDENTITY_INVALID`, `AGG_ARTIFACT_IDENTITY_MISMATCH` | every case above asserts the code |

## SB2 — the artifact quality is bound to the disposition

| the required correction | the production oracle | the proving case |
|---|---|---|
| the PRODUCTION mapping is the single rule | `QUALITY_STATUS_TO_DISPOSITION` / `dispositionForQualityStatus()` in `lib/contracts.mjs`, used by the runner AND the aggregate | `SB2: the production mapping is the single rule` |
| `complete → complete`, `limited → limited` | the same | the same |
| a blocked pre-synthesis source publishes no derivative | the aggregate's complete-only artifact requirement | the pre-existing blocked cases |
| a rejected/invalid publication cannot be a positive complete row | the mapping (`rejected → failed`) and the aggregate's quality binding | `SB2: a REJECTED artifact claimed complete is not a positive candidate` |
| the parsed disposition, the machine disposition, the artifact quality and the publication presence must agree | the aggregate's complete-source block | the four SB2 pure cases and the four SB2 process-level cases |
| a complete artifact carries an empty `quality.failureCodes` | the aggregate's complete-source block | `SB2: a COMPLETE artifact with quality failure codes is not a positive candidate` |
| the hashes are recomputed so the failure proves the SEMANTIC binding | the shared stub derives every hash from the bytes | the limited case, which also asserts that NO `AGG_ARTIFACT_*` failure fired |

## SB3 — the schema keyword handling is fail-closed

| the required correction | the production oracle | the proving case |
|---|---|---|
| the schema keywords are inventoried BEFORE the schema is cached or used | `assertSchemaKeywordSupport()` called by `frozenV21Schema()` | `SB3: the real artifact validator refuses an unsupported frozen schema` |
| the keyword positions are distinguished from the names under `properties` and `$defs` | `inventorySchemaKeywords()` | `SB3: the frozen schema's keyword inventory is fully supported` |
| the annotation/meta keywords are explicitly allowed | `ALLOWED_ANNOTATION_KEYWORDS` | `SB3: the annotation keywords are allowed and asserted by nothing` |
| every unsupported assertion/applicator/validation/unevaluated keyword throws | `assertSchemaKeywordSupport()` | the five placement cases and the reproduction case |
| the negatives at the root, a `$defs` schema, an `items` schema, a property schema and an `if`/`then`/`else` schema | the same | the five placement cases |
| the equivalence proof asserts the COMPLETE keyword inventory of the actual frozen schema | the Python `_python_keyword_inventory()` and the JavaScript `inventorySchemaKeywords()` | `test_the_keyword_inventory_of_the_frozen_schema_is_compared` |
| the representative fixtures are kept, but not described as a universal proof | the test's own docstring and this evidence | the Python test's docstring |
| the canonical receipt serialization claim is constrained to the legal frozen receipt domain | `canonicalJson()` and the Python `_canonical()` | `test_the_canonical_receipt_serialization_is_byte_identical` (ten fixtures, byte comparison) |

## SB4 — the preserved closures

| the required property | the production oracle | the proving case |
|---|---|---|
| the deterministic artifact filename and the byte hashing | `V21_ARTIFACT_FILENAME` + `sha256Hex` | the AI1 cases |
| the receipt and derivative digest recomputation | `canonicalJson()` + `sha256Hex` | the AI1 hash cases |
| the exact mirror wrapper and the Provider lock | `MIRROR_REQUIRED_KEYS` + `DERIVED_TEXT_SCOPE` | the AI2 mirror cases |
| the positive request counts and the exact ledger totals | the aggregate's accounting block | the AI2 and CI2 cases |
| the latched owned-process sightings and the owned-only cleanup | `createOwnedProcessTracker()` + `auditOwnedProcesses()` | `an OWNED descendant that exits before the closeout is still a leak` |

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
