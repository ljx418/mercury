# Commands, exits and counts (corrective)

Every command below ran inside this batch. No command started Chrome, started
the Runtime media work, called a Provider, downloaded media, imported media,
generated an artifact for a real BVID or produced audio.

## 1. The corrected authority / restart / app-composition tests

| Command | Exit | Result |
|---|---:|---|
| `python3 -m pytest tests/test_v3_gc_b5r_corrective_authority.py -q` | 0 | **11 passed** |

The cases drive the real dependency manager, the real acquisition coordinator,
the real task store, the real local-import store, the real service, the real
validator and the real publisher. Only the dependency probes and the synthesis
Provider are replaced.

## 2. The existing GC-B5R cases and the affected WP-A / WP-B lifecycle tests

| Command | Exit | Result |
|---|---:|---|
| `python3 -m pytest tests/test_v3_gc_b5r_input_authority.py -q` | 0 | **32 passed** |
| `python3 -m pytest tests/test_v3_media_comprehension.py -q` | 0 | **28 passed** (unchanged) |
| `python3 -m pytest tests/test_v3_media_comprehension.py tests/test_v3_gc_b5r_input_authority.py tests/test_v3_gc_b5r_corrective_authority.py tests/test_v3_media_local_import_contracts_store.py tests/test_v3_media_local_import_api.py tests/test_v3_media_local_import_barrier.py tests/test_v3_media_local_import_manager.py tests/test_v3_media_local_import_gates.py tests/test_v3_media_local_import_preparer.py tests/test_v3_media_local_import_restart.py tests/test_v3_media_dependency_manager.py tests/test_v3_media_dependency_task_binding.py tests/test_v3_media_acquisition_core.py tests/test_v3_media_product_materializer.py tests/test_v3_media_product_contracts.py tests/test_v3_media_outline_task_store.py tests/test_wp_b_ac2_lifecycle.py -q` | 0 | **330 passed** |

## 3. The deterministic offline Stage B runner suite

| Command | Exit | Result |
|---|---:|---|
| `node scripts/stage_b_b5_3/test/run_offline_suite.mjs` | **0** | the serial phase **7/7** and the concurrent phase **209/209**; `OFFLINE SUITE PASSED` |

The command prints the classification of the external canary:

```
offline files: 11
external_not_run: canary_bvid1.node-test.mjs (real Chrome + real cookie + real Runtime; not a pass, not an offline failure)
```

`canary_bvid1.node-test.mjs` (PH0-AR-12) is **not** part of the offline
command and is **not** counted as a pass.

## 4. The focused Runtime media suite

The §2 command IS the focused Runtime media suite (comprehension, acquisition,
local import, dependency, product, outline, WP-B lifecycle): **330 passed**.

## 5. The full Runtime suite (once)

| Command | Exit | Result |
|---|---:|---|
| `python3 -m pytest tests -q` | 0 | **1175 passed, 3 skipped**, 4 warnings, 464 s |

The three skips and the four warnings are pre-existing (the warnings are the
`os.fork()` deprecation of the WP-B AC1 durability cases).

## 6. TypeScript typecheck / extension build

**Not applicable.** This batch changed no TypeScript and no shared extension
contract: the touched files are the Runtime Python modules, the Stage B runner
scripts and the evidence package. The acceptance plan conditions this class on
TypeScript or shared extension contracts having changed.

## 7. The relay v11 baseline (once, after the candidate stabilized)

| Command | Exit | Result |
|---|---:|---|
| `python3 docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v11-contract.py` | **2** | **46/50**; the failed checks are `sourceEvidenceHashesCurrent`, `sourceScopeExtractorsValid`, `sourceEmitSetEqualsFrozenInventory`, `discoveredCodeUniverseClosed`; the target inventory is 20/20; `unlistedBoundaryEmits` is `{}`; `schemaErrors` is `[]` |
| `python3 docs/active/project/evidence/v3_media_companion/v3-completion/gc-b5r-offline-corrective-2026-10-23/analyze-relay-v11-semantic-inventory.py` | **0** | the semantic inventories from the CURRENT sources: source **40/40**, target **20/20**, code universe **59/59**, `unlistedBoundaryEmits` `{}`, the only drifted scope `app.py` |
| `python3 docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v11-mutations.py` | — | **not run: canonical baseline pending Codex refreeze** |

## 8. The preflight receipts

| Command | Exit | Result |
|---|---:|---|
| `node scripts/stage_b_b5_3/sequencer.mjs --preflight-only=1 --run-id=gc-b5r-offline-corrective-preflight-2026-10-23 --evidence-root=…/preflight` | 0 | eleven action counters at **0**, six sources `not_declared`, `attempted: false`, `anySourcePassed: false` |
| the same command with an **exactly matching** declared manifest (`--local-asset-manifest`) | 0 | source 1: `localAssetAvailable = true`, reason `null`; all counters 0 |
| the same command with a **foreign** declared identity | 0 | source 1: `localAssetAvailable = false`, reason `identity_foreign_bvid`; all counters 0 |

## 9. The scans

| Scan | Result |
|---|---|
| secret shapes (the runner's six frozen patterns) over the changed files and the new evidence | **0 real hits** (one pre-existing model-name match in `app.py`, one marker list in a test) |
| private absolute paths | **0 hits** |
| raw media / cookie / API-key payload markers | **0 real hits** |
| residual owned processes | **0** |
| residual owned ports | **0** |
| residual owned profiles / task roots / temporary media assets | **0** |
| the user's real Runtime root | untouched — mtime `2026-10-14 20:40:12`, before this batch |

## 10. The action counts of this batch

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
| Relay v11 refreezes performed by this batch | **0** |
