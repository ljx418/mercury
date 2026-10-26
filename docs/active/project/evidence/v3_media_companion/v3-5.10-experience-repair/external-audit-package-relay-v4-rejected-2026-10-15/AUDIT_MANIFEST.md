# V3 P0 Background Capture Relay v4 外部审计包 Manifest

日期：2026-10-15。载荷数：18；本 manifest 不计算自身 SHA-256。审查者必须先逐项复算下列哈希，再运行 `17-internal-relay-v4-verifier.py`。本目录在审查期间保持只读。

| SHA-256 | 文件 |
|---|---|
| `c02d66c2ef15b114eccd4371e0fc6f122e7a7baf58f8cdc7f4f67f3f809ab6d6` | `01-audit-request.md` |
| `7f870d8395970b27f2a56b2c44ffd130a69e7042d66b01e97a196337ad0b019c` | `02-prd.md` |
| `e73a0ebc1bdac64eefbd2cac0d479112b0a258d02512fa3994c14f4d371f52ab` | `03-architecture.md` |
| `cafe82ff883709d824e01f655337f17a700c33fa4a83a7bc4ae99627ea1b0b68` | `04-development-plan.md` |
| `a38a7ddea274c4f2cc68f6075dd14e9bead5275ed8ef07fc2610105d19f373e7` | `05-acceptance-plan.md` |
| `f2bb9bc3bf0ba18f40a8192955f87b8cb62ce15b2bf5ae5ed63d5a07a500da21` | `06-stage-gate.md` |
| `5f4001f6ff8dd8af21a03823db10527040550ea9c57ae747e7443c181e509a7d` | `07-relay-architecture.md` |
| `6d1ce5d5961629e25592a23f3422afaa878097af33f5c40cc569178614796ab6` | `08-relay-development-plan.md` |
| `4047607c4e3c4ea1984af465e2f49aea965e8ea3be41a38dfd4efa0ee311d9d0` | `09-relay-acceptance-plan.md` |
| `b7b8d20626745cf495c72b716c92aae1d0bdd88d1da30bdb281ec87a82c2482e` | `10-relay-preimplementation-audit.md` |
| `6fbef7d0b1ce2cff42d987ed1b23a0779d042bc024e92cb9f8fbf18b50b13f88` | `11-phase0-test-results.md` |
| `5cd6c64e51377988b4038980d2d8ca1af0a0367678037bf973eb8a9a34bb2dff` | `12-round5-architecture-audit.md` |
| `ef283885bb443229be8c73748511ee49912d4c5c7190b2f0139d8ac9b70930dc` | `13-current-checkpoint.md` |
| `90e3ae86ed4ca5ec0ef9390420fb389ca8bead306c5e763e6c98a6c839d62d42` | `14-relay-architecture.json` |
| `afe7e22ec86b8e73de25c03ccd76cbe75a0774ca6e6a4683c98d9d6637d3c06a` | `15-internal-relay-v4.schema.json` |
| `bf8e64d8605e2f1f2b2915bed72415901e53f65967bd96cb0cb7d73f31a60858` | `16-internal-relay-v4-fixtures.json` |
| `b78bd8211555272c35b2156f5b50c98bd74029508538c5cbfd45c7fbb8b014b4` | `17-internal-relay-v4-verifier.py` |
| `d1d9db8030ab3050f9c0ceca47c814a4ca4e5582c6c3275cc91ff4a2c919a7ce` | `18-main-implementation-prompt.md` |

复算命令：`sha256sum 0[1-9]-* 1[0-8]-*`。任何不一致均为 Fatal，禁止继续审查或实施。
