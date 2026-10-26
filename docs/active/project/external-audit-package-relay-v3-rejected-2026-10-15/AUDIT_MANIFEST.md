# V3 P0 Background Capture Relay v3 External Audit Manifest

日期：2026-10-15。候选：`relay-v3-document-candidate-20261015`。平铺文件总数：19（18 项载荷 + 本 manifest）。本文件不声明自身 SHA-256；审查开始后禁止修改本目录。

| SHA-256 | 文件 |
|---|---|
| `7dfc5aa0a53cf8a72f86dd6d9f0afd4e25d702592bf14e6cf7195a5543a9779c` | `01-audit-request.md` |
| `7f870d8395970b27f2a56b2c44ffd130a69e7042d66b01e97a196337ad0b019c` | `02-prd.md` |
| `e73a0ebc1bdac64eefbd2cac0d479112b0a258d02512fa3994c14f4d371f52ab` | `03-architecture.md` |
| `cafe82ff883709d824e01f655337f17a700c33fa4a83a7bc4ae99627ea1b0b68` | `04-development-plan.md` |
| `a38a7ddea274c4f2cc68f6075dd14e9bead5275ed8ef07fc2610105d19f373e7` | `05-acceptance-plan.md` |
| `f2bb9bc3bf0ba18f40a8192955f87b8cb62ce15b2bf5ae5ed63d5a07a500da21` | `06-stage-gate.md` |
| `a4c238c10f988be1c4b656a3224f15b9a19f764e88124d4c3e9cfe1d645c36a3` | `07-relay-architecture.md` |
| `5686ec1110a407c8f19b2b7a06310d8f9ba77f9e496a70870dff1a39a154474b` | `08-relay-development-plan.md` |
| `3791851d091e299a89d031dcf3bcb71662bb4fe2a474fe75ededfb1994bba378` | `09-relay-acceptance-plan.md` |
| `61e0cb0c66a6fb81ba44f20b32b8f206f84fef81cca1744ad47c4d1b5beb062a` | `10-relay-preimplementation-audit.md` |
| `605fe9b10748141128b31f7508105142478cf72bd1a080c157e2e3a17c8baab8` | `11-phase0-test-results.md` |
| `affc795e118388b83072a6188347fb8dc0bc1d2251f2e8845f451e8da13b311e` | `12-round4-architecture-audit.md` |
| `8b099409cf0741b69436482b1334f7afac9b588cd53a3a7162334ecd972d64b8` | `13-current-checkpoint.md` |
| `90e3ae86ed4ca5ec0ef9390420fb389ca8bead306c5e763e6c98a6c839d62d42` | `14-relay-architecture.json` |
| `b7ecf94c8af1a896de1349a3c7ca879d3288fe527b8ef9a1fcd5bccaa3dc5db3` | `15-internal-relay-v3.schema.json` |
| `ab595b0d09a9fb708da8271f05db09a461a18a4729da57019e8276a92f0fb3aa` | `16-internal-relay-v3-fixtures.json` |
| `0a4cf4c9cd47da1c789980f37b05da88d107970a572e15fef52f6d7c7a6ce706` | `17-internal-relay-v3-verifier.py` |
| `0de6036be43afb79a599a88077b7ac667aa0ca5b24f9274550faa1228fa68e9a` | `18-main-implementation-prompt.md` |

复算命令：`sha256sum -c <(awk -F'\`' '/^\| \`[0-9a-f]{64}\`/ {print $2 "  " $4}' AUDIT_MANIFEST.md)`。
