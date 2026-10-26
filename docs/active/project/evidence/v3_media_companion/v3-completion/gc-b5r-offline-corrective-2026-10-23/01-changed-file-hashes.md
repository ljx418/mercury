# Changed files and SHA-256 (corrective)

Only the files this corrective batch touched are listed. The dirty worktree
that the earlier phases left behind is untouched: nothing was committed,
pushed, reset, cleaned, checked out, reverted or discarded, and no unrelated
file was modified.

| SHA-256 | Path | What this batch changed |
|---|---|---|
| `afbf76a0d3a7e11186b5a9257fb1108254972148bd37bb179754a2750bde23c1` | `services/local-runtime/navia_runtime/app.py` | the authorized production composition: the `MediaInputAuthority` import, the manager-owned generation resolver and the authority handed to the comprehension service |
| `8e2d31ef108034e0274c3a6d4e892caf3f106f27197eb85a444e3cdc93baf95e` | `services/local-runtime/navia_runtime/modules/media_companion/input_authority.py` | the global-mirror reader is gone; the generation is an injected manager seam; the coordinator's live task is checked on both routes; an unverifiable generation is a refusal |
| `89b184cbdbb61fc585dffda3b6f265b4a17a3e0d65d85851d4c3b3e6b378a3dd` | `services/local-runtime/navia_runtime/modules/media_companion/local_import/binding.py` | `verify_binding()` now REQUIRES a current generation and refuses with `V3_MEDIA_DEPENDENCY_NOT_READY` instead of skipping the comparison |
| `c647e90c32ce47af00c0aa8cb70a315acf15154b9e9195f5a2422963f8a5020b` | `services/local-runtime/navia_runtime/modules/media_companion/comprehension/service.py` | the refusal-code map gained `V3_MEDIA_DEPENDENCY_NOT_READY`; the default authority documents that it carries no generation resolver |
| `2ab14da4ff62af42cc3b0d320a07880a9af9cb2c6df842cc3bbec5f5ad60bb5b` | `services/local-runtime/navia_runtime/modules/media_companion/dependencies/manager.py` | the process-global lease mirror is no longer written; the map stays empty and carries no authority |
| `48bee9a0a861875fcbc5acf3d6be05d4f32178f4753d8e6874b9a8ebfabdacac` | `services/local-runtime/tests/test_v3_gc_b5r_input_authority.py` | the default-composition cases now assert the fail-closed behaviour, and the generation case uses the injected resolver instead of the global mirror |
| `3d87d990062c27bf49e9ea4548c764fae18a3792fc6099178d19678997a64d8c` | `services/local-runtime/tests/test_v3_gc_b5r_corrective_authority.py` | **new** — the eleven corrective cases (the manager, the restart, the coordinator, the app composition) |
| `f883ce51c722468ca0a2f5e8690892d945eb0af6736d14d6952c697c981726a6` | `scripts/stage_b_b5_3/lib/preflight.mjs` | the exact declared-identity and path matching, the stable ineligible reasons, the manifest findings |
| `eb9d7f6b2038b76201806df296e38d260e04f526c40c12c753002a4edd3b941a` | `scripts/stage_b_b5_3/lib/contracts.mjs` | `SELECTED_PROVIDER_ID` and the exact `providerLockOffenders` (no substring acceptance) |
| `e6aa40fd51a164c0e084219c1e75d49b2c24cbecb4a4e92cd332b501a4e56ede` | `scripts/stage_b_b5_3/sequencer.mjs` | the preflight-only output reports the manifest findings and the per-source ineligible reason |
| `463f0d35a611414114cc5e1af9be52fca2c7c4f49d0b170e8f8d879abf3064bc` | `scripts/stage_b_b5_3/run_one_bvid.mjs` | the exact Provider lock, the selected Provider id and the observed values in the evidence |
| `94519ceffa5e21d1cb283c13fa4bd51b0fce8dee9264cb7c710abad67d546cdd` | `scripts/stage_b_b5_3/test/gc_b5r_preflight.node-test.mjs` | the exact preflight matching and the exact Provider lock, with the full negative matrix and deterministic cleanup |
| `397e1a4d07e0fb3052e9714fcb116e08e8e62522d90003daf34bd0e87d78e638` | `scripts/stage_b_b5_3/test/real_branches.node-test.mjs` | the PH0-AR-10 readiness fix: the signal waits for the stub runner's own marker instead of a fixed sleep |
| `e8afd80f14ffdf56d590ed4ad2017dad8d5ffa45ccef4f951c427edc54b551f9` | `scripts/stage_b_b5_3/test/run_offline_suite.mjs` | **new** — the ONE offline runner command: serial phases, the external canary classified as `external_not_run` |

## The frozen artefacts that were read and NOT modified

| SHA-256 | Path |
|---|---|
| `25331486cad5d5ad251e135ae0cba59a46accbe17f37f1883a26da596ca8f439` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-six-video-registry.json` |
| `c03491d5f55d3950448de75d20f2c89c1195234da05d17329f3a6f19254f38b8` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-grounded-comprehension-contract.md` |

Both digests were re-verified in this batch and they match the values pinned in
`post-wp-b-rebaseline-2026-10-23/01-development-plan.md`.

The relay v11 fixtures, inventories, schemas, registry and verifier code were
**not** modified and **nothing was refrozen**: the only drift is the
authorized `app.py` source scope, reported in
`05-relay-source-drift-report.md`.
