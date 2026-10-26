# The case → production-oracle map

Every case of the corrective goal, and the PRODUCTION code path that proves
it.

## AI1 — the published artifact bytes

| the required correction | the production oracle | the proving case |
|---|---|---|
| a deterministic durable derivative artifact in the source evidence set | `V21_ARTIFACT_FILENAME` in `lib/v21_artifact.mjs`, written by `run_one_bvid.mjs` and resolved by `sequencer.mjs` | `the positive candidate carries the publication and the exact ledger accounting` |
| the aggregate READS the actual bytes | `checkArtifactIntegrity()` in `lib/artifact_integrity.mjs` (the row carries `{ filename, bytes }`) | the nine AI1 process-level cases and the twelve focused unit cases |
| …and PARSES them | the same module | `AI1: a malformed derivative artifact exits nonzero` |
| …and validates the frozen V2.1 contract with a production/shared EXACT validator | `validateV21Artifact()` in `lib/v21_artifact.mjs`, driven by the FROZEN contract file | `AI1: a derivative with the wrong schema exits nonzero` and the Python equivalence test (19 cases) |
| no reduced duplicate schema | the validator reads `docs/active/project/contracts/v3_media_grounded_comprehension_v2_1.schema.json` | the equivalence test compares the shared validator with the production `jsonschema` on 22 fixtures |
| SHA-256 from the exact durable bytes, compared with EVERY declared hash | `checkArtifactIntegrity()` step 1 | `AI1: a derivative hash mismatch exits nonzero`, `AI1: a derivative tampered after the receipt was created exits nonzero` |
| the receipt hash recomputed with the PRODUCTION canonical serialization | `canonicalJson()` in `lib/v21_artifact.mjs` (used by the runner for `receiptSha256`) | `AI1: a receipt hash mismatch exits nonzero` |
| the task, revision, source identity, run, receipt, Provider and endpoint identities cross-bound | `checkArtifactIntegrity()` steps 5 and 6 | `AI1: a foreign task identity exits nonzero` |
| missing or malformed evidence fails closed | `AGG_ARTIFACT_MISSING`, `AGG_ARTIFACT_MALFORMED` | the two matching process-level cases |
| ONE deterministic contracted filename, no directory search | `V21_ARTIFACT_FILENAME` resolved exactly in `sequencer.mjs` | the inventory and the code |
| the secret/private-path rules are preserved | the runner's secret scan and privacy audit over the whole evidence directory | the FC3 case and the privacy audit of the runner |
| the positive stub writes a real V2.1 artifact and derives the hashes from the bytes | `test/_fixtures/contract_shaped_stub.mjs` | `six fresh complete attempts are a positive candidate and exit 0` |
| no repeated-character placeholder hashes | the stub derives every digest from the artifact bytes | the same case |

## AI2 — the request count and the mirror

| the required correction | the production oracle | the proving case |
|---|---|---|
| a complete publication has an integer `requestCount >= 1` | the aggregate's publication block + `frozenReceiptDefects()` | `AI2: receipts and ledger that consistently claim zero requests exits nonzero` |
| any `attemptCount > 0` has an integer `requestCount >= 1` | the aggregate's per-row accounting | the same case |
| the candidate ledger totals exactly match the sums of the source facts | `evaluateAggregate({ candidateLedgerTotals })` | `CI2: missing ledger events exits nonzero`, `CI2: duplicated ledger events exits nonzero`, `AI2: … zero requests …` |
| the mirror schema version is exactly `v3-5.10-b5-3-receipt-mirror/v2` | `MIRROR_SCHEMA_VERSION` in `lib/aggregate.mjs` | `AI2: a mirror with the wrong schema version exits nonzero` |
| the mirror has the exact required wrapper key set | `MIRROR_REQUIRED_KEYS` | `AI2: a mirror that lacks a required wrapper field exits nonzero`, `AI2: a mirror that carries an extra wrapper field exits nonzero`, `AI2: every required mirror wrapper field is required` (ten cases) |
| the locked Provider id, endpoint class, provider lock and derived-text scope are REQUIRED and exact | the aggregate's mirror block + `DERIVED_TEXT_SCOPE` from `lib/contracts.mjs` | the mirror cases above |

## AI3 — the preserved boundaries

| the required property | the production oracle | the proving case |
|---|---|---|
| the accepted leak-sighting behavior is unchanged | `createOwnedProcessTracker()` + `auditOwnedProcesses()` in `sequencer.mjs` | `an OWNED descendant that exits before the closeout is still a leak` |
| the sighting remains fatal after the child exits | the LATCHED `leakSightings` | the same case |
| only the first source runs | the `break` in the source loop | the same case (`bvids.length === 1`) |
| the owned descendant is cleaned | `killOwnedLeaks()` | the same case (`killedOwnedPids.length > 0`) |
| an unrelated process remains alive | the ownership-based tracker | the same case and `an UNRELATED live runner is neither counted nor killed` |
| the public API, schema, FailureCode, threshold, message, Provider registry, Origin/auth order and the denominator are unchanged | the frozen contract files and `lib/contracts.mjs` | the boundary table in `05-ci1-regression-proof.md` |
| the historical evidence is unchanged | the manifests of the prior packages | the manifest verification in `02-commands-and-exits.md` |

## The seams that remain test-only, and where they are used

| seam | what it is | where it is used | why it is acceptable |
|---|---|---|---|
| `NAVIA_B5_TEST_RUNTIME_URL` | the local Runtime double of the runner | the runner-level tests | it replaces the Runtime; the runner's own finalization, ledger, artifact and audit set run against it |
| `NAVIA_B5_TEST_NO_BROWSER` | no Chrome | the runner-level tests | the runner's own flow, ledger and finalization still run |
| `NAVIA_B5_TEST_DB_PATH` | a synthetic SQLite database | the runner-level tests | the database is created by the test with synthetic rows |
| `NAVIA_B5_TEST_MEDIA_TASK_ROOT` | the owned media task root of the double | the runner-level tests | the double writes the published derivative and the internal diagnostic into it |
| `NAVIA_B5_DIAGNOSTIC_FILE` | the internal diagnostic of the double | the runner-level tests | it is the same channel the production Runtime uses (the private diagnostic file) |
| the STUB runner | a child that writes the evidence set without a browser | the sequencer-level tests | the sequencer's own authorization, ledger, aggregate, artifact oracle, ownership audit and stop logic is the production code; the stub writes its evidence through the PRODUCTION ledger library and the shared contract-shaped writer |

**No case above is proven by a seam that skips the behaviour under test.**
