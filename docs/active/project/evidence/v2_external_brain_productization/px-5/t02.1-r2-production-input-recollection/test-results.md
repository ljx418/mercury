# T02.1 测试与真实证据结果

日期：2026-09-12  
run：`t02-r2-raw-production-input-20260912T053500`

## 1. 全量命令

| 命令/检查 | 结果 |
|---|---|
| Extension fresh `build:e2e` | exit 0；build index 91/91 文件重算一致 |
| Extension `typecheck` | exit 0 |
| raw collector tests | 11/11 |
| frontend full tests | 22 files / 169 tests passed |
| Runtime `pytest -q` | 307 passed，55 warnings |
| T01 real Chrome regression | 36/36 |
| typed axe-core | 1 result；Side Panel + Workspace；serious 0 / critical 0 |
| typed keyboard | 5/5 |
| source corpus registration | 12/12 |
| `verify-t02.1-candidate.py` | exit 0；31/31 machine checks |
| T03 readiness 对 new run | exit 0；Fatal 0 / Major 0 |
| T03 readiness 对 old accepted run | exit 2；仍为原 4 个 Major |

本轮结束后又直接执行了一次 `pnpm --dir apps/chrome-extension test:v2-px-r2-raw-collector`，结果仍为 11/11。

## 2. 原始证据重算

```text
segments: 2
events: 1127
artifacts: 953 = 947 public + 6 private_local_only
runtime request/response/failure: 454 / 439 / 15
background request/response: 7 / 7
request orphan or multi-terminal: 0
entry origins: open_workspace 2 / open_in_workspace 2 / view_source 3
routes: 5 intents x 4 recovery modes
route recoveries: INVALID_ROUTE / WORKSPACE_NOT_FOUND
corpus: 6 web + 3 local + 3 note
screenshots: 10；产品视口 360/420/768/1280
faults: 4 non-overlapping intervals
```

raw SHA-256：`711d2f2c976658427148c5b717710d0a8ecf09b83b20aa43210e270d6523b0f2`。canonical seal：`acdc13434fe140daf5e3ea86abbe10c61ca1fb0509db9de17e10c44f3d4abcb0`。

## 3. 隔离与清理

本次成功 run 使用独立 build、browser profile、Runtime database、raw root 和 seal。cleanup manifest 的 browser/runtime/fixture server/profile 四项均为 true。之前五个失败 run 均没有 seal，未被拼接。

原 T02 run `t02-r2-raw-20260911T143100` 的 raw SHA-256 与 seal 仍分别为 `ade431410ec375b7ab48e9de7e41472c2b9e7baa72fce30373809b807a493f2e` 和 `725fb2eedb6902900744b67577f55d5434987adba91be05cb376a7b216aa40f7`。
