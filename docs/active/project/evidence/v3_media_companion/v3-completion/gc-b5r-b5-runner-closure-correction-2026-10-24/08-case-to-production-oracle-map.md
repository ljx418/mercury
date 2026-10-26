# The case → production-oracle map

Every case of the corrective goal, and the PRODUCTION code path that proves
it.

## RC1 — the child grants are authoritative and one-use

| required case | the production oracle | the proving case |
|---|---|---|
| the marker exists, parses exactly, and matches the grant digest and the run id | `consumeAuthorization` / `verifyChildGrant` in `lib/authorization.mjs` | `RC1: a corrupt authorization state fails closed`, `RC1: an absent consumption marker is refused`, `RC1: a mismatched consumption marker is refused` |
| the digest supplied by the sequencer matches the grant AND the marker | the same | `RC1: a mismatched authorization digest is refused` |
| the grant id equals a recomputation from the trusted grant fields | `childGrantId` + the marker copy | `RC1: a grant under an arbitrary file name is refused` |
| the registry digest and the exact ordered six identities match | the marker and the grant identities | `RC1: a substituted, reordered, stale or cross-run grant is refused` |
| the per-source grant is consumed once, so a replay is refused | the `O_EXCL` use receipt | `RC1: a second use of a valid child grant is refused` |
| an entirely forged self-signed grant is refused | the marker's authoritative digest copy | `RC1: an entirely forged, self-signed grant is refused` |
| an arbitrary grant file name is refused | the marker's issued grant id | `RC1: a grant under an arbitrary file name is refused` |
| every refusal branch has zero Cookie reads, Chrome launches, Runtime starts and ledger external actions | the grant gate of `run_one_bvid.mjs`, which precedes the Cookie inspection and Chrome | the shared receipt of `assertNoExternalAction` in every negative case |
| the six-child composition is retained | the sequencer and the six child grants | `RC1: one sequencer authorization permits exactly the six expected children` |
| the concurrent sequencer race is retained | the `O_EXCL` marker | `RC1: two concurrent sequencers produce exactly one winner` |
| the raw authorization value stays out of the disk and the evidence | the digest-only marker, grant and use receipt | `RC1: the raw authorization value is never persisted` |
| one authorization owner | `lib/authorization.mjs`; the legacy owner in `lib/action_ledger.mjs` is REMOVED | the absence of the legacy export and of its two legacy tests |

## RC2 — the explicit field semantics of the finalizer

| required case | the production oracle | the proving case |
|---|---|---|
| the cleanup booleans converge false → true | `mergeCleanupFacts` in `lib/audit_finalizer.mjs` | `RC2: the cleanup booleans CONVERGE false -> true`, `RC2: a verified deletion is never undone by a weaker observation` |
| the cleanup failure may not be erased | the same | `RC2: the cleanup failure may NOT be erased` |
| a published receipt may replace an earlier null but is never fabricated | `mergeProviderFacts` + `isRealPublication` | `RC2: a published receipt may replace an earlier null`, `RC2: a published receipt is never FABRICATED and never erased` |
| the terminal failure code and the disposition follow an explicit precedence | `mergeTerminalPair` | `RC2: the terminal pair follows an EXPLICIT precedence` |
| the timestamps and the attempt counts reflect the final run state | `mergeMachineReceipt` + `CURRENT_RUN_FIELDS` | `RC2: the timestamps and the attempt counts follow the FINAL run state`, `RC2: the merge covers every current-run field explicitly` |
| a retry/restart never combines the evidence of a different run/source | `sameRunAndSource` | `RC2: a retry never COMBINES the evidence of a different run or source` |
| the runner drives the pre-cleanup finalization and the successful finally cleanup, and both the receipt and cleanup.json report true | the real runner's finally path | `RC2: the runner converges the cleanup to true and the aggregate accepts it` |
| the aggregate accepts the cleanup | `evaluateAggregate` (`cleanupComplete`) | the same case |
| the failure case | the real runner's failure path | `RC2: the failure path converges the cleanup to true as well` |
| the fresh-process re-entry case | the real runner in a second process | `FC3: a fresh-process re-entry never degrades a known fact` |

**The convergence case fails against the old merge**: with "never replace a
non-null primitive" the value `false` survives the later `true`.

## RC3 — the actual outbound Provider HTTP attempts

| required case | the production oracle | the proving case |
|---|---|---|
| one Runtime synthesize endpoint invocation | `ledger.record("runtimeSynthesize", …)` in `run_one_bvid.mjs` | `RC3: a successful synthesis records the ACTUAL outbound Provider attempts` |
| the actual outbound Provider HTTP attempts | the adapter's `provider_outbound_http_attempts` + the Runtime's internal diagnostic + the receipt | the same case, `RC3: a REJECTED synthesis records the ACTUAL attempts and publishes nothing` |
| the successful 1-request and N-request cases | the same | `RC3: a successful synthesis with ONE request records ONE attempt`, `RC3: a successful synthesis records the ACTUAL outbound Provider attempts` (N=3) |
| the rejected 3-request and 8-request cases | the same | `RC3: a REJECTED synthesis records the ACTUAL attempts and publishes nothing` (3), `RC3: a REJECTED synthesis at the request cap records EIGHT attempts` (8) |
| the stage total equals the actual attempts, not one per endpoint | the durable ledger | the same cases |
| the candidate and the stage totals are exact and never double counted | the ledger's candidate run id | `RC3: the candidate and the stage totals are EXACT and are not double counted` |
| the publication stays null on failure | the receipt + the merge | the two rejected cases |
| the adapter counts every attempt at the request boundary | `_complete_once` in `comprehension/synthesis.py` | `test_rc3_the_adapter_counts_every_outbound_attempt`, `test_rc3_a_regeneration_is_counted_as_an_outbound_attempt` |
| the production service publishes the count in its internal diagnostic | `_write_stage_b_diagnostic` in `comprehension/service.py` | `test_rc3_the_service_diagnostic_carries_the_outbound_attempt_count` |
| no public endpoint, no response text, no prompt, no evidence id, no path, no secret | the diagnostic's schema | the same Python case |

## RC4 — the process ownership and the fixture isolation

| required case | the production oracle | the proving case |
|---|---|---|
| only the process tree owned by the current sequencer is audited | `createOwnedProcessTracker` in `lib/process_ownership.mjs` + the sequencer's `auditOwnedProcesses` | `an OWNED leaked process exits nonzero` |
| an unrelated `run_one_bvid.mjs` is neither killed nor counted | the same | `an UNRELATED live runner is neither counted nor killed`, `PH0-AR-10: an UNRELATED live runner is neither counted nor killed` |
| the generated sequencer copies live in a unique owned temporary directory and are deleted in a finally | `createSequencerCopy` in `lib/sequencer_copy.mjs` | the source-tree inventory: `generatedArtifactsInTheSourceTree: []` |
| the persisted `sequencer_alt.mjs` and `sequencer_grant_alt.mjs` are removed | the source tree | the inventory's `removedByThisBatch` |
| the relevant Node files run CONCURRENTLY and succeed deterministically | `run_offline_suite.mjs` (no serial phase) | the suite: 307/307, exit 0 |
| the previously failing combined command | the same | 30/30, exit 0 |

## RC5 — the privacy and the inventory boundary

| required case | the production oracle | the proving case |
|---|---|---|
| POSIX paths, including the one-segment form | `detectAbsolutePaths` in `lib/privacy.mjs` | `the detector finds a POSIX absolute path`, `the detector finds a ONE-SEGMENT POSIX path` |
| Windows backslash and forward-slash drive paths | the same | `the detector finds a Windows absolute path`, `the detector finds a Windows FORWARD-SLASH drive path` |
| UNC paths | the same | `the detector finds a UNC path` |
| no false positive on a URL or on a public route | the narrow structured allowlist | `the detector ignores a URL, a relative path and a frozen route`, `the allowlist is narrow, structured and documented` |
| every changed/new source file and every evidence file is scanned | the scan of this package | `09-secret-path-raw-media-scan.json` |
| the changed-file hashes are built from the actual final source set | the inventory of this package | `01-changed-file-hashes.json` (49 files, 22 modified, 27 carried, 0 generated) |
| the manifest is generated last | the manifest of this package | `PAYLOAD_MANIFEST.sha256` |

## The seams that remain test-only, and where they are used

| seam | what it is | where it is used | why it is acceptable |
|---|---|---|---|
| `NAVIA_B5_TEST_RUNTIME_URL` | the local Runtime double of the runner | the runner-level tests | it replaces the Runtime; the runner's own classification, finalization, ledger and audit set run against it |
| `NAVIA_B5_TEST_NO_BROWSER` | no Chrome | the runner-level tests | the runner's own flow, ledger and finalization still run |
| `NAVIA_B5_TEST_DB_PATH` | a synthetic SQLite database | the runner-level tests | the database is created by the test with synthetic rows |
| `NAVIA_B5_TEST_MEDIA_TASK_ROOT` | the owned media task root of the double | the runner-level tests | the double writes the published derivative and the internal diagnostic into it |
| `NAVIA_B5_DIAGNOSTIC_FILE` | the internal diagnostic of the double | the runner-level tests | it is the same channel the production Runtime uses (the private diagnostic file) |
| `httpx.MockTransport` | the Provider transport | every Runtime-side test | the adapter's own code (the budget, the parsing, the enforcement, the attempt counter) is the production code |
| the STUB runner | a child that writes the evidence set without a browser | the sequencer-level tests | the sequencer's own authorization, ledger, aggregate, ownership audit and stop logic is the production code |

**No case above is proven by a seam that skips the behaviour under test.**
