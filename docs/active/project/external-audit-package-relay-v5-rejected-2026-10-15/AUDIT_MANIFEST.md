# V3 P0 Background Capture Relay v5 外部审计包 Manifest

日期：2026-10-15。载荷数：18；本 manifest 不计算自身 SHA-256。审查者必须先逐项复算，再运行 `17-internal-relay-v5-verifier.py`。本目录在审查期间保持只读。

| SHA-256 | 文件 |
|---|---|
| `545816ff8fbf376d5bcef0e65ffed8f63a4e9ee8e6734082f2ae46313529af5e` | `01-audit-request.md` |
| `0e3279a9901e2b8b98a76805e66dede42094418f3c41904f43232258b203f2c6` | `02-prd.md` |
| `99b5626d64698be3ffa334d17feedd668257e8c18ebc6c3a2f804779a80a17b6` | `03-architecture.md` |
| `920a701650468f26d2a8ca995069d300e0d166a63d0ee87f2ef2d4272b98730f` | `04-development-plan.md` |
| `8656b64e5081e4eeb1c54acdaf8261d82f15d39567e25e349aca174d0920cbb8` | `05-acceptance-plan.md` |
| `375694763e846c77c43e0c14a03c2cfeff0612023cfcba20a0257b6437e69f84` | `06-stage-gate.md` |
| `f837d6c84bfa47ca5bbce6e2960e978d1a9d3f83cf347dbc16c17ae754714f7a` | `07-relay-architecture.md` |
| `5150f960ba16c8288fca075e80d6ab91d3bce8fa00747edec36e06b23ed663f2` | `08-relay-development-plan.md` |
| `d8cb34e94174567f624fbfc894cb47c280375601812c1e86409e7bdaee894cbf` | `09-relay-acceptance-plan.md` |
| `476f67bd6628e455714aea597360c9707360d3b38aa1789cba28c715f2f141b1` | `10-relay-preimplementation-audit.md` |
| `6fbef7d0b1ce2cff42d987ed1b23a0779d042bc024e92cb9f8fbf18b50b13f88` | `11-phase0-test-results.md` |
| `357ab6e92309b936b863a4ec3a7ccc743b6eaa5161add6e80a517c3b6687a963` | `12-v5-replan-closure.md` |
| `32edb65fd2e04e7e93f676df8b4e563dc634155d123c4dbbe3125ab1cb560ff8` | `13-current-checkpoint.md` |
| `ae99de3a12a917f5720a3da200394524545901cb1f71d8e65d1c156ff4c17123` | `14-relay-architecture.json` |
| `17af8e3de2aa8650e6cd15ece1b83285afb2d820d32cd67b13f1e9dc13ef192e` | `15-internal-relay-v5.schema.json` |
| `a1dc2d95de47833d2cc507586e11388d6e251cb1e4413e25ee920fd6eee124e6` | `16-internal-relay-v5-fixtures.json` |
| `ea04110c0b64e6928205794800e5c0f522fcec8eb11ce57b2a63f93ba832cd93` | `17-internal-relay-v5-verifier.py` |
| `f4dbc0beaed5b28b2f22eeaf248111b5b3cd5009d0d2a005dbae21d5f61aafff` | `18-main-implementation-prompt.md` |

复算命令：`sha256sum 0[1-9]-* 1[0-8]-*`。任何不一致均为 Fatal，禁止继续审查或实施。
