# WP-B acceptance completion — commands and exit codes

Every command of the ONE consolidated offline regression. The seed environment
variable is the only external input; it is set for the runs that need real
media and is never searched for.

`NAVIA_WP_B_SEED_MEDIA=/tmp/wp-b-seed/compliant-seed.mp4` — an explicitly
authorized seed, produced once from the user's own download and validated with
the real ffprobe, the real local SenseVoice and the real frame digests before
use. It is deleted in the cleanup.

| # | command | exit | result |
|---|---|---|---|
| 1 | `pytest` — the local-import suites, the AC1 and AC2 suites, and the C7 production suite (schema and fixture mutations, routed HTTP, the actual visual materialization, the barrier and the restart paths) | 0 | **267 passed** |
| 2 | `python3 scripts/v3_media_local_import_wp_b_probe.py --json` | 0 | **9/9** real kill points, every `killExitCode = 137`; see `03-ac1-hard-kill-and-restart-receipt.md` |
| 3 | `pytest` — the corrected WP0 R4 oracle and the affected relay static tests | 0 | **51 passed** |
| 4 | `pytest` — the Runtime media-focused suite | 0 | **483 passed** |
| 5 | `npx vitest run src/modules/media_companion` | 0 | **61 files, 512 passed** |
| 6 | `npx tsc --noEmit -p tsconfig.json` | 0 | clean, except the **pre-existing** `vitest.config.ts` `module` overload error, which is not in this package's scope |
| 7 | `node --test e2e/lib/v3WpBLocalImportOwnedSession.node-test.mjs` | 0 | **7 passed** — the owned-session harness rules |
| 8 | `npx wxt build` | 0 | the production extension built, 4.67 MB |
| 9 | `python3 …/verify-stage-b-b5-3-background-capture-relay-v11-contract.py` | 2 | 46/50, target 20/20, source 35/40, `unlistedBoundaryEmits = {}` — the frozen source-scope drift. **No refreeze.** |
| 10 | `node e2e/v3-wp-b-local-import-owned-session.mjs` (the offline phase) | 0 | `{"phase":"offline","launched":false,"generatedAssets":0,"ownedRootRemoved":true}` |
| 11 | `python3 scripts/build_wp_b_acceptance_completion_evidence.py` | 0 | the hash record and the payload manifest were written, re-hashed and verified |

## Resource notes

* A single `pytest tests/ -q` over every Runtime test is killed by the host with
  exit 137 (memory). The suite was therefore run as deterministic sequential
  shards, and every shard's exit code and count is in the table above.
* No broad suite was re-run repeatedly after an individual edit: the shards in
  the table are the single consolidated regression.
* The whole offline phase is SILENT. No test opened an audio output device, and
  no Chrome process was started at any point.
