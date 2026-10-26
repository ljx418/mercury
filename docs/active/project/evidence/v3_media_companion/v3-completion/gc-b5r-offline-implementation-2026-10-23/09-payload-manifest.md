# GC-B5R payload manifest

Generated at `2026-10-23T15:22:15.423446Z`, **after** every payload file stabilized.
The manifest files themselves are not listed (a file cannot contain its own digest).

## Changed implementation files

| SHA-256 | Bytes | Path |
|---|---:|---|
| `4780bb9e3e606201f7818930c86e742eae5d705ce2a6856f7f034e0d812b5fce` | 5146 | `services/local-runtime/navia_runtime/modules/media_companion/local_import/binding.py` |
| `620714618dec3c327deeee184fe46ac465e512a9d1a238f11c676412608b5145` | 30842 | `services/local-runtime/navia_runtime/modules/media_companion/local_import/store.py` |
| `42c37a4869ff373bbc92b8d5b503ad7b262a05ed3ae40eb087d8f1ccaee24dd7` | 7598 | `services/local-runtime/navia_runtime/modules/media_companion/input_authority.py` |
| `18492a8ab1a05d6f9f0e239935f3d7f5275dfa0a0e3984fd8256bef50a91edb7` | 39432 | `services/local-runtime/navia_runtime/modules/media_companion/comprehension/service.py` |
| `524f171b191e5192fa59090a3c42ea8d0355d75ef8aa316ba4603155285fc2a2` | 31788 | `services/local-runtime/navia_runtime/modules/media_companion/dependencies/manager.py` |
| `7c2d1acc503ed52907528683796002ce65eefaca479037ccab49e086b1a3054c` | 36276 | `services/local-runtime/tests/test_v3_gc_b5r_input_authority.py` |
| `39817dcc6160b4131f3e8cb2a695119a6aff8d0db66d7ddb5acf502623bad8e6` | 7649 | `scripts/stage_b_b5_3/lib/preflight.mjs` |
| `0b1b8de2931bce24894cdd952e7c817ddb9df2429b180bcc2acb50727df52d38` | 5329 | `scripts/stage_b_b5_3/lib/contracts.mjs` |
| `58b9497a79826e14a0f5de1afa2e20e70990fa379a4044cbff5125b6028571e1` | 14161 | `scripts/stage_b_b5_3/sequencer.mjs` |
| `8a42fea8a6b65c5091ac26664e03783cf0a619dc6155f3dc4441f5d6eaeae4e6` | 31886 | `scripts/stage_b_b5_3/run_one_bvid.mjs` |
| `1a9a0a00ed2f6d15da4f1e87739ec1eceeb242b2a2b62a48d132b00bcd9e6aed` | 12085 | `scripts/stage_b_b5_3/test/gc_b5r_preflight.node-test.mjs` |
| `f4611079931435882399c3b93fd41cc36d3eaf16f7a5765ca0abdfbf319dec3b` | 18726 | `scripts/stage_b_b5_3/test/sequencer.node-test.mjs` |
| `e28c2d218228ba8625afeb5b6a5704ba3e84ec6c693feb56cef9df341a35d790` | 13592 | `scripts/stage_b_b5_3/test/real_branches.node-test.mjs` |

## Files that were deliberately left unchanged

| SHA-256 | Bytes | Path |
|---|---:|---|
| `d7d2c438b6bf3fb71e9a541fd66a22d90718ffbc2f4ebaf8219e7d3ac08e5f9d` | 173540 | `services/local-runtime/navia_runtime/app.py` |
| `25331486cad5d5ad251e135ae0cba59a46accbe17f37f1883a26da596ca8f439` | 1015 | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-six-video-registry.json` |
| `c03491d5f55d3950448de75d20f2c89c1195234da05d17329f3a6f19254f38b8` | 5735 | `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-grounded-comprehension-contract.md` |

## Evidence files

| SHA-256 | Bytes | Path |
|---|---:|---|
| `dcd45cf55f92eaeffb39f3ec8aed7c59591d755a3a109e6a5658c8fdb14ac2a4` | 11107 | `00-implementation-report.md` |
| `259019dc89cabfbadb44e17d9d742ad70c046a89114793b4e1b59ce873d2b8d8` | 4124 | `01-changed-file-hashes.md` |
| `fb11620ca9dc095752530ebcddadb14448f0a64fbaef34b29060a4c6905ccfe0` | 9919 | `02-o01-o12-case-to-production-oracle.md` |
| `46a2d82c2045e7165050caa422df18a83fc59374b9238247d4b29a3985e9c69a` | 7216 | `03-commands-and-results.md` |
| `de89a12fa28b06c77f6036c9d5019c9ced32096477f460b59a80dc1a13a50187` | 2785 | `04-preflight-receipt.md` |
| `5d75098ab5fbc353a462499780e4c484580397fe0f5cc0f320e4da04309fcfab` | 8934 | `05-prd-coverage-and-contracts.md` |
| `4e55352dcd955ce10f7cf96bb7a1c59dd7132a043bd93dd645b03948d327b77c` | 4878 | `06-secret-path-raw-media-and-cleanup.md` |
| `d0409df7c3945b80292c240ebef5fefec84fa3d94f415311fc537dda33e6511d` | 6667 | `07-risks-and-handoff.md` |
| `6f846e8362e406ee10057a2d036776c56597d3909ca52f35edddc6099553a571` | 9965 | `08-module-handoff.md` |
| `a555677d4bcadeb42ef0e8b7b02b04877d8477f5907c4b54778acfb0ef17322f` | 3097 | `preflight/preflight-receipt.json` |
| `3ba92764ec4663f455454307bdf92a0eb58f5d152401ebd86e29295031375440` | 433 | `preflight/sequencer-summary.json` |
| `488ed9b529fdf777972f72950073ebdabf1fc3f48095dcfce4cd21f3946f3c2a` | 639 | `relay/relay-v11-baseline-summary.json` |
| `648f3c62545f2d6be339a64094866213e9fa6ba251c59a3cbc90cd6c18f46145` | 2469 | `relay/relay-v11-mutations-summary.json` |

## Counts

* changed implementation files: **13**
* deliberately unchanged frozen files: **3**
* evidence files: **13**
* Chrome launches: **0** · visible windows: **0** · Runtime media starts: **0** · Provider calls: **0** · downloads: **0** · imports: **0** · artifacts for a real BVID: **0** · cookie injections: **0** · audio outputs: **0** · real six-video runs: **0**
