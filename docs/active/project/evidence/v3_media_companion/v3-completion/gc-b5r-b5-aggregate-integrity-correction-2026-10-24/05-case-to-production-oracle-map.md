# The case → production-oracle map

Every case of the corrective goal, and the PRODUCTION code path that proves
it.

## CI1 — the owned-process leak sightings

| the required correction | the production oracle | the proving case |
|---|---|---|
| the processAuditBefore / processAuditAfter are bound to the SOURCE ROW | `collectSourceRows()` in `sequencer.mjs` → `row.processAuditBefore`, `row.processAuditAfter`, `row.ownedLeakSightings` | the row mapping is asserted by the aggregate: `audits.ownedProcessLeakCount` is the count of the sightings of THAT source (`AGG_AUDIT_FAILED … leaked an owned process`) |
| a descendant observed alive after its source runner exits is a leak | `createOwnedProcessTracker()` in `lib/process_ownership.mjs` + `auditOwnedProcesses()` in `sequencer.mjs` | `an OWNED leaked process exits nonzero` |
| the sighting is preserved for the whole candidate, even when the process exits later | the LATCHED `leakSightings` array + `leakSightingsByPid` map | `an OWNED descendant that exits before the closeout is still a leak` (`stillAliveAtCloseout === 0` and `leakedAfter > 0`) |
| the aggregate and the process exit are non-zero | `evaluateAggregate()` (`AGG_AUDIT_FAILED`) and the sequencer's exit code | the same case (`summary.verdict.positive === false`, `proc.status !== 0`) |
| the batch stops after the FIRST owned leak | the `break` in the sequencer's source loop | the same case (`summary.bvids.length === 1`) |
| only the OWNED descendants are cleaned | `killOwnedLeaks()` in `lib/process_ownership.mjs` | the same case (`killedOwnedPids.length > 0`) and the unrelated-process assertion |
| an unrelated process is never counted, signalled or terminated | the ownership-based tracker (the Linux process tree of THIS sequencer's child) | `an UNRELATED live runner is neither counted nor killed` (sequencer and real_branches) |
| the process-level negative case: the descendant survives the source boundary and exits before the closeout | the stub runner's `owned-leak-late` mode + the real sequencer | `an OWNED descendant that exits before the closeout is still a leak` |

## CI2 — the publication and the exact action accounting

| the required correction | the production oracle | the proving case |
|---|---|---|
| `receipt.json` is PARSED; the presence alone is not evidence | `collectSourceRows()` parses the mirror into `row.mirror` | `CI2: a malformed receipt mirror exits nonzero` (`AGG_MIRROR_INVALID`) |
| a complete source requires a nested `provider.published` | `evaluateAggregate()` → `AGG_PUBLICATION_MISSING` | `CI2: a complete source without a publication exits nonzero` |
| …with the COMPLETE frozen V2.1 receipt identity | `frozenReceiptDefects()` over the 17 frozen fields | `CI2: a malformed receipt mirror exits nonzero` (the mirror receipt is invalid) |
| …and the FULL internal publication shape | `isRealPublication()` in `lib/audit_finalizer.mjs` | `CI2: a partial publication exits nonzero` (`AGG_PUBLICATION_INVALID`) and the RC2 case `RC2: a published receipt is never FABRICATED and never erased` |
| cross-bind to the MIRROR | the identity-field and upload-counter comparison in the aggregate | `CI2: a mismatched receipt mirror exits nonzero` (`AGG_MIRROR_INVALID`) |
| cross-bind to the TASK | `mirror.taskId === receipt.taskId`, `mirror.taskIdNamespace === receipt.taskNamespace` | the same case |
| cross-bind to the RUN and the SOURCE | the aggregate's existing `receipt.runId` / `receipt.bvid` / `receipt.order` checks | `a cross-run artifact exits nonzero`, `a wrong source identity exits nonzero` |
| cross-bind to the ARTIFACT hashes | `mirror.derivativeSha256` (a 64-hex digest) equals `receipt.derivativeSha256`; the machine receipt's three digests are well formed | `CI2: a mismatched receipt mirror exits nonzero` |
| the locked Provider and endpoint | the aggregate's `LOCKED_PROVIDER_ID` / `LOCKED_ENDPOINT_CLASS` checks | the foreign-provider case in the stub module and the existing provider-lock checks |
| the hard-zero upload counters | the aggregate's `UPLOAD_COUNTER_KEYS` checks (mirror and publication) | `an upload-policy violation exits nonzero` |
| the candidate ledger totals equal the sum of the per-source attempted facts | `evaluateAggregate({ candidateLedgerTotals })` | `CI2: missing ledger events exits nonzero`, `CI2: a zero ledger event exits nonzero`, `CI2: duplicated ledger events exits nonzero` |
| the permitted pre-synthesis blocked case is explicit | the aggregate's `attemptCount === 0` branch | `exactly one blocked source is still a positive candidate` |
| an attempted synthesis with an UNKNOWN Provider HTTP count is not a positive candidate | the aggregate's `attemptCount > 0 && requestCount === null` branch | `CI2: an unknown Provider HTTP count exits nonzero` |
| every positive stub carries real contract-shaped publication facts | `test/_fixtures/contract_shaped_stub.mjs` (the shared writer) + the production `appendLedgerEvent` | `six fresh complete attempts are a positive candidate and exit 0` and `the positive candidate carries the publication and the exact ledger accounting` |
| the runner writes the FULL publication shape | `run_one_bvid.mjs` → `provider.published` | `RC3: a successful synthesis records the ACTUAL outbound Provider attempts` (`isRealPublication(receipt.provider.published) === true`) |
| the defensive typo in `mergeMachineReceipt()` | `lib/audit_finalizer.mjs` | the RC2 merge cases |
| `isRealPublication()` is the full internal shape | `lib/audit_finalizer.mjs` | `RC2: a published receipt is never FABRICATED and never erased` |

## The seams that remain test-only, and where they are used

| seam | what it is | where it is used | why it is acceptable |
|---|---|---|---|
| `NAVIA_B5_TEST_RUNTIME_URL` | the local Runtime double of the runner | the runner-level tests | it replaces the Runtime; the runner's own classification, finalization, ledger and audit set run against it |
| `NAVIA_B5_TEST_NO_BROWSER` | no Chrome | the runner-level tests | the runner's own flow, ledger and finalization still run |
| `NAVIA_B5_TEST_DB_PATH` | a synthetic SQLite database | the runner-level tests | the database is created by the test with synthetic rows |
| `NAVIA_B5_TEST_MEDIA_TASK_ROOT` | the owned media task root of the double | the runner-level tests | the double writes the published derivative and the internal diagnostic into it |
| `NAVIA_B5_DIAGNOSTIC_FILE` | the internal diagnostic of the double | the runner-level tests | it is the same channel the production Runtime uses (the private diagnostic file) |
| the STUB runner | a child that writes the evidence set without a browser | the sequencer-level tests | the sequencer's own authorization, ledger, aggregate, ownership audit and stop logic is the production code; the stub writes its evidence through the PRODUCTION ledger library |

**No case above is proven by a seam that skips the behaviour under test.**
The stubs were made STRICTER, not weaker: the oracle was not relaxed to keep
the old stubs green.
