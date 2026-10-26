# Changed files and SHA-256

Only the files this batch touched are listed. The dirty worktree that the
earlier phases left behind is untouched: nothing was committed, pushed,
reset, cleaned, checked out, reverted or discarded, and no unrelated file was
modified.

| SHA-256 | Path | State in this batch |
|---|---|---|
| `4780bb9e3e606201f7818930c86e742eae5d705ce2a6856f7f034e0d812b5fce` | `services/local-runtime/navia_runtime/modules/media_companion/local_import/binding.py` | new file (the durable local-import binding) |
| `620714618dec3c327deeee184fe46ac465e512a9d1a238f11c676412608b5145` | `services/local-runtime/navia_runtime/modules/media_companion/local_import/store.py` | modified — one read-only method `list_for_task` added; no table, column, state or transition changed |
| `42c37a4869ff373bbc92b8d5b503ad7b262a05ed3ae40eb087d8f1ccaee24dd7` | `services/local-runtime/navia_runtime/modules/media_companion/input_authority.py` | new file (the ONE input-authority composition) |
| `18492a8ab1a05d6f9f0e239935f3d7f5275dfa0a0e3984fd8256bef50a91edb7` | `services/local-runtime/navia_runtime/modules/media_companion/comprehension/service.py` | modified — the input refusal before the Provider and before the publication, the closed refusal-code map, and the default authority |
| `524f171b191e5192fa59090a3c42ea8d0355d75ef8aa316ba4603155285fc2a2` | `services/local-runtime/navia_runtime/modules/media_companion/dependencies/manager.py` | modified — the task lease is mirrored into the existing `DEPENDENCY_LEASES` map and released with it |
| `7c2d1acc503ed52907528683796002ce65eefaca479037ccab49e086b1a3054c` | `services/local-runtime/tests/test_v3_gc_b5r_input_authority.py` | new file (the O01, O03–O09 production-driven cases) |
| `39817dcc6160b4131f3e8cb2a695119a6aff8d0db66d7ddb5acf502623bad8e6` | `scripts/stage_b_b5_3/lib/preflight.mjs` | new file (the preflight-only inspection) |
| `0b1b8de2931bce24894cdd952e7c817ddb9df2429b180bcc2acb50727df52d38` | `scripts/stage_b_b5_3/lib/contracts.mjs` | modified — `providerLockOffenders` added (the testable task Provider lock) |
| `58b9497a79826e14a0f5de1afa2e20e70990fa379a4044cbff5125b6028571e1` | `scripts/stage_b_b5_3/sequencer.mjs` | modified — the frozen six now come from the frozen registry file, and `--preflight-only=1` was added |
| `8a42fea8a6b65c5091ac26664e03783cf0a619dc6155f3dc4441f5d6eaeae4e6` | `scripts/stage_b_b5_3/run_one_bvid.mjs` | modified — the frozen-identity refusal before anything starts, and the Provider lock |
| `1a9a0a00ed2f6d15da4f1e87739ec1eceeb242b2a2b62a48d132b00bcd9e6aed` | `scripts/stage_b_b5_3/test/gc_b5r_preflight.node-test.mjs` | new file (the O02, O05, O06, O10 cases) |
| `f4611079931435882399c3b93fd41cc36d3eaf16f7a5765ca0abdfbf319dec3b` | `scripts/stage_b_b5_3/test/sequencer.node-test.mjs` | modified — the alt-sequencer copy now points its relative import and its repo root back at the real tree |
| `e28c2d218228ba8625afeb5b6a5704ba3e84ec6c693feb56cef9df341a35d790` | `scripts/stage_b_b5_3/test/real_branches.node-test.mjs` | modified — the same alt-sequencer fix-up |

## The file that was deliberately left untouched

| SHA-256 | Path | State |
|---|---|---|
| `d7d2c438b6bf3fb71e9a541fd66a22d90718ffbc2f4ebaf8219e7d3ac08e5f9d` | `services/local-runtime/navia_runtime/app.py` | **unchanged by this batch** — restored to the frozen byte-for-byte state (see the report §2.7). The value is the one recorded in the relay-v11 frozen evidence, so the relay gate stays green and no hash was refrozen. |

## Frozen artefacts that were read and NOT modified

| SHA-256 | Path |
|---|---|
| `25331486cad5d5ad251e135ae0cba59a46accbe17f37f1883a26da596ca8f439` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-six-video-registry.json` |
| `c03491d5f55d3950448de75d20f2c89c1195234da05d17329f3a6f19254f38b8` | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-grounded-comprehension-contract.md` |

Both digests were re-verified in this batch and they match the values pinned in
`post-wp-b-rebaseline-2026-10-23/01-development-plan.md`.
