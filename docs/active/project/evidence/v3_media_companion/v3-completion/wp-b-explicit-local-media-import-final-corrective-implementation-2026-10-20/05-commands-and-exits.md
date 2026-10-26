# WP-B final corrective — commands and exit codes

Every command that was run for this package, with its exit code and result.
Commands are listed in the order they were used. `services/local-runtime` is
the working directory unless stated otherwise.

## Targeted runs, during the edits

| # | command | exit | result |
|---|---|---|---|
| 1 | `pytest tests/test_wp_b_fc1_client_headers.py -q` | 0 | 6 passed |
| 2 | `npx vitest run src/modules/media_companion/tests/LocalMediaImportClient.test.tsx` | 0 | 28 passed, then 31 passed after B27 |
| 3 | `npx vitest run src/modules/media_companion/tests/MediaCredentialWorkspacePageComposition.test.tsx` | 0 | 3 passed |
| 4 | `pytest tests/test_wp_b_fc4_fixed_cases.py -q` | 0 | 19 passed, then 21 passed after the B14 dimension cases |
| 5 | `pytest tests/test_wp_b_c5_startup_recovery.py -q` | 0 | 4 passed, then 6 passed after the FC3 startup split |
| 6 | `pytest tests/test_wp0_r4_restart_and_security.py::test_no_secret_or_private_path_leaks_into_the_observable_surface -q` | 0 | 1 passed (the corrected oracle) |
| 7 | `pytest tests/test_v3_media_local_import_preparer.py -q` | 0 | 9 passed (after the PNG encoder fix) |
| 8 | `pytest tests/test_v3_media_local_import_barrier.py tests/test_v3_media_local_import_restart.py -q` | 0 | 49 passed |
| 9 | `pytest tests/test_v3_media_product_materializer.py -q` | 0 | 10 passed |

## Real production runs

| # | command | exit | result |
|---|---|---|---|
| 10 | `pytest tests/test_wp_b_c7_production.py -q` (no seed) | 0 | 3 passed / 2 skipped → later 3 passed **with** the seed |
| 11 | `NAVIA_WP_B_SEED_MEDIA=… pytest tests/test_wp_b_c7_production.py -q -s` | 0 | **3 passed**, with the real B21 and B22 receipts printed |
| 12 | `python3 scripts/v3_media_local_import_wp_b_probe.py --json` | 0 | **9/9 kill points**, every `killExitCode = 137` |
| 13 | `python3 …/verify-stage-b-b5-3-background-capture-relay-v11-contract.py` | 2 | 46/50, `unlistedBoundaryEmits = {}`, target 20/20, source 35/40 — the frozen source-scope drift, **no refreeze** |

## The consolidated checkpoint regression

| # | command | exit | result |
|---|---|---|---|
| 14 | `pytest <the 15 local-import files> -q` | 0 | **175 passed** |
| 15 | `pytest <every case-bearing node id for B01-B28> -q` | 0 | **113 passed** (0 skipped, with the seed supplied) |
| 16 | `pytest <the Runtime media-focused files> -q` | 0 | **483 passed** |
| 17 | `npx vitest run src/modules/media_companion` | 0 | **61 files, 512 passed** |
| 18 | `npx vitest run <the two FC1 Extension suites>` | 0 | **34 passed** |
| 19 | `npx tsc --noEmit -p tsconfig.json` | 0 | clean, except the **pre-existing** `vitest.config.ts` `module` overload error, which is not in this package's scope |
| 20 | `pytest <the 30 files of shard 1> -q` | 0 | **263 passed** |
| 21 | `pytest <the 32 files of shard 2> -q` | 0 | **498 passed** |
| 22 | `pytest <the 30 files of shard 3> -q` | 0 | **250 passed**, 0 skipped with the seed supplied |
| 23 | `pytest <the WP0 R4 and relay static files> -q` | 0 | **51 passed**, including the corrected R4 oracle |

### The Extension media-companion subtree

The whole subtree was run with the repository's default pool and passed:
**61 test files, 512 tests**. The raw log is
`11-extension-media-companion-subtree.log`.

A first attempt with `--pool=forks --fileParallelism=false` was abandoned: it
serialises ~30 jsdom environments and exceeded 40 minutes on a loaded host. It
was replaced by the default pool, which is the configuration the repository
uses, and the result is the one above.

## Resource notes

* A single `pytest tests/ -q` over all 1005 Runtime tests is killed by the
  host with **exit 137** (memory). The suite is therefore run as **deterministic
  sequential shards** — the three 30-file shards, the 15 local-import files, the
  case-bearing node ids and the media-focused files — and every shard's exit
  code and count is reported above. No broad suite was re-run repeatedly after
  an individual edit.
* No visible Chrome was launched; no audio was played; no test opened an audio
  output device.
