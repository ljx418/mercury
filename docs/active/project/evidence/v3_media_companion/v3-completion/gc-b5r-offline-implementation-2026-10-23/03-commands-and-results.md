# Commands, exits and counts

Every command below was run from the repository root (or from
`services/local-runtime` for the Runtime suites) inside this batch. No command
started Chrome, started the Runtime media work, called a Provider, downloaded
media, imported media, generated an artifact for a real BVID or produced audio.

## 1. The focused Runtime suites (O11)

| Command | Exit | Result |
|---|---:|---|
| `python3 -m pytest tests/test_v3_gc_b5r_input_authority.py -q` | 0 | **32 passed** (the new O01, O03–O09 cases) |
| `python3 -m pytest tests/test_v3_media_comprehension.py -q` | 0 | **28 passed** (the pre-existing comprehension suite, unchanged) |
| `python3 -m pytest tests/test_v3_gc_b5r_input_authority.py tests/test_v3_media_comprehension.py -q` | 0 | **60 passed** |
| `python3 -m pytest tests/test_v3_media_comprehension.py tests/test_v3_gc_b5r_input_authority.py tests/test_v3_media_local_import_contracts_store.py tests/test_v3_media_local_import_api.py tests/test_v3_media_local_import_barrier.py tests/test_v3_media_local_import_manager.py tests/test_v3_media_local_import_gates.py tests/test_v3_media_local_import_preparer.py tests/test_v3_media_local_import_restart.py tests/test_v3_media_dependency_manager.py tests/test_v3_media_dependency_task_binding.py tests/test_v3_media_acquisition_core.py tests/test_v3_media_product_materializer.py tests/test_v3_media_product_contracts.py tests/test_v3_media_outline_task_store.py tests/test_wp_b_ac2_lifecycle.py -q` | 0 | **319 passed** |

The 319 cases cover the comprehension chain, the acquisition core, the whole
local-import suite (contracts, store, API, barrier, manager, gates, preparer,
restart), the dependency manager and its task binding, the product
materializer and contracts, the outline task store and the WP-B lifecycle.

The full `services/local-runtime` suite was also started; see §6 for its
result.

## 2. The runner suites (O11)

| Command | Exit | Result |
|---|---:|---|
| `node --test scripts/stage_b_b5_3/test/gc_b5r_preflight.node-test.mjs` | 0 | **18/18 passed** (the new O02, O05, O06, O10 cases) |
| `node --test scripts/stage_b_b5_3/test/*.node-test.mjs` | 1 | **204 tests, 202 passed, 2 failed** — see §5 |
| `node --check scripts/stage_b_b5_3/run_one_bvid.mjs` | 0 | syntax OK |
| `node --check scripts/stage_b_b5_3/sequencer.mjs` | 0 | syntax OK |
| `node --check scripts/stage_b_b5_3/lib/contracts.mjs` | 0 | syntax OK |
| `node --check scripts/stage_b_b5_3/lib/preflight.mjs` | 0 | syntax OK |

## 3. The frozen relay verifiers (O12)

| Command | Exit | Result |
|---|---:|---|
| `python3 docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v11-contract.py` | 0 | **50/50**, `failedChecks: []` |
| `python3 docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v11-mutations.py` | 0 | **16/16** |

**No hash and no verifier was refrozen.** The `app.py` byte state is the one
the frozen evidence records (`d7d2c438b6bf…08e5f9d`), and the two frozen
digests below were re-verified:

| Frozen artefact | SHA-256 | Match |
|---|---|---|
| `stage-b-six-video-registry.json` | `25331486cad5d5ad251e135ae0cba59a46accbe17f37f1883a26da596ca8f439` | yes |
| `stage-b-grounded-comprehension-contract.md` | `c03491d5f55d3950448de75d20f2c89c1195234da05d17329f3a6f19254f38b8` | yes |

### The hash drift that was found and removed

The first implementation of this workpack wired the authority in
`navia_runtime/app.py`. That made the relay-v11 baseline report **46/50**
(`sourceEvidenceHashesCurrent`, `sourceScopeExtractorsValid`,
`sourceEmitSetEqualsFrozenInventory`, `discoveredCodeUniverseClosed`) and the
mutation verifier refuse to run (`canonical_baseline_not_green`, exit 2),
because `app.py`'s SHA-256 is frozen in the relay-v11 evidence and the file is
skipped on a hash mismatch.

The wiring was moved into the media_companion package, `app.py` was restored
byte-for-byte, and both verifiers are green again. The drift was **not**
papered over with a refreeze.

## 4. The preflight (O10)

| Command | Exit | Result |
|---|---:|---|
| `node scripts/stage_b_b5_3/sequencer.mjs --preflight-only=1 --run-id=gc-b5r-offline-preflight-2026-10-23 --evidence-root=…/gc-b5r-offline-implementation-2026-10-23/preflight` | 0 | the receipt in `04-preflight-receipt.md`: eleven action counters at **0**, six sources inspected, `attempted: false`, `anySourcePassed: false`, no `bvid-*` directory |

## 5. The two Node failures, honestly

| Case | Why it fails | Is it this batch's? |
|---|---|---|
| `PH0-AR-12: pregranted-fixture canary on BV1pohR6rEEh — pre-computed path-based ID + real Runtime` | `stage=cookie-prerequisite-failed` — it needs a real cookie, a real Chrome and a real Runtime, all of which this batch is forbidden to use | no — it is an integration case that cannot run in an offline batch, and it failed before this batch |
| `PH0-AR-10: SIGTERM to running sequencer → child killed + no leaked subprocesses` | timing sensitive under the full parallel suite (32 s); it **passes when it is run alone** | no — a harness flake, not an implementation failure |

Neither is a GC-B5R case, and neither is a false green: the runner suite
reports them as failures.

## 6. The full local-runtime suite

| Command | Exit | Result |
|---|---:|---|
| `python3 -m pytest tests -q` | 0 | **1163 passed, 3 skipped**, 4 warnings, 460 s |

The three skips and the four warnings are pre-existing (the warnings are the
`os.fork()` deprecation of the WP-B AC1 durability cases). The full suite ran
against the final byte state of every file this batch touched.

## 7. The scans

| Scan | Command family | Result |
|---|---|---|
| secret shapes | the runner's six frozen patterns over the changed files and the new evidence | **0 hits** |
| private absolute paths | a POSIX home directory of a user, and the Windows user profile directories in both forms | **0 hits** |
| raw media / cookie / key payloads | the marker list plus the six frozen secret shapes | **0 hits** (the only textual match is the scan list inside the test file) |
| residual processes | `run_one_bvid`, `sequencer.mjs`, owned Chrome, `navia_runtime` | **0** |
| residual ports | the owned port ranges | **0** |
| residual profiles / task roots | `/tmp/navia-b5-3-*`, the owned Chrome profile roots | **0 owned** (115 test scratch directories of the pre-existing Node suites) |
| residual media assets | `*.mp4`, `*.mkv`, `*.webm` under the owned roots | **0 owned** (62 test scratch directories of the pre-existing Python suites) |
| the user's real Runtime root | `~/.navia` | untouched — mtime `2026-10-14 20:40:12`, before this batch |

## 8. The action counts of this batch

| Action | Count |
|---|---:|
| Chrome launches | **0** |
| Visible windows | **0** |
| Runtime media starts | **0** |
| Provider calls | **0** |
| Downloads | **0** |
| Imports | **0** |
| Artifacts generated for a real BVID | **0** |
| Cookie injections | **0** |
| Audio outputs | **0** |
| tabCapture enablements | **0** |
| Real six-video runs | **0** |
| BVID substitutions | **0** |
| Generic seed reuses | **0** |
