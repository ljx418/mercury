# V3 P0 Background Capture Relay v2 External Audit Manifest

日期：2026-10-15。候选：`relay-v2-document-candidate-20261015`。平铺文件总数：19（18 项载荷 + 本 manifest）。本文件不声明自身 SHA-256；审查开始后禁止修改本目录。

| SHA-256 | 文件 |
|---|---|
| `9e03d7adcea23ea190ccd7b0386ad56d997511e03c0f1b1b5e91c8f36874aac0` | `01-audit-request.md` |
| `50db60ff6b5c075ab4c20a770ce3f44805fc2464a6613acfb38478cf5c97c11b` | `02-prd.md` |
| `fa8b9438422273a1ad79f1091eeaf5ba2122b632e0dd70af19dae4b784f27055` | `03-architecture.md` |
| `cafe82ff883709d824e01f655337f17a700c33fa4a83a7bc4ae99627ea1b0b68` | `04-development-plan.md` |
| `6f701b148002c620146253139b8d7d23545c4b9ef219881150855f7022be144e` | `05-acceptance-plan.md` |
| `f2bb9bc3bf0ba18f40a8192955f87b8cb62ce15b2bf5ae5ed63d5a07a500da21` | `06-stage-gate.md` |
| `e5406ad5902feb575b1dbb1ad23d446b0b5a2f4edd053602e8204c8d2f7fbeb8` | `07-relay-architecture.md` |
| `85f96aea6ab5ec8d17d1632e1f47a7d501d34a671e77e8e859da04becc84732d` | `08-relay-development-plan.md` |
| `fc54d7e32ff3f9a09a4068689cae7cf504b32a4a58e82f48d6e79d7a09d89a70` | `09-relay-acceptance-plan.md` |
| `d53b7cd94c7ff74e0ddac73eb3163a830291a940de76943f9e428eebc5848e83` | `10-relay-preimplementation-audit.md` |
| `605fe9b10748141128b31f7508105142478cf72bd1a080c157e2e3a17c8baab8` | `11-phase0-test-results.md` |
| `e3448be6f9109a2e5f51c738eba2600a71ce41c0ce23da952fe7cf580461e48d` | `12-round3-architecture-audit.md` |
| `87347ab007f379b5e9915c6676dcadbe9ec76cf374d2cd9d441f413fdf511b03` | `13-current-checkpoint.md` |
| `96874b81a3c8cbf7a885e777e05ee90e6bb8a5e41e1808ea62f85b04eae48dd5` | `14-relay-architecture.json` |
| `3b163d739bbac4f26a45cecc21b7b20e97da9ea815939a4782fce639817c6ae0` | `15-internal-relay-v2.schema.json` |
| `e12fdc116b89446e70118eb471dd5cbc5037aeda2397a9743fc5a9b4581a0a80` | `16-internal-relay-v2-fixtures.json` |
| `f41a596d9f7ce44464e740c96d703ecac264ddf0bb159223e21c2bd9c37d951a` | `17-internal-relay-v2-verifier.py` |
| `5ba161ca57fe7369705bd30aabc334df9e28af8015732fbf61108ebd1ed52fa0` | `18-main-implementation-prompt.md` |

复算命令：`sha256sum -c <(awk -F'\`' '/^\| \`[0-9a-f]{64}\`/ {print $2 "  " $4}' AUDIT_MANIFEST.md)`。
