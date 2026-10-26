# WP0 R1 第三轮纠偏测试结果（2026-10-16）

Candidate: `wp0-r1-corrective-round3-2026-10-16`
状态：**R1 AWAITING CODEX REFREEZE**

## 1. 全部命令与退出码

| # | 命令 | 退出码 | 结果 |
|---:|---|---:|---|
| 1 | `npm run typecheck` | 0 | PASS |
| 2 | `npx vitest run`（8 个 R1 套件合并） | 0 | **115 / 115**（8 files） |
| 3 | `npx vitest run src/modules/media_companion/tests/` | 0 | **163 / 163**（20 files） |
| 4 | `npx vitest run --maxWorkers=2` | 0 | **499 / 499**（65 files） |
| 5 | `npm run build` | 0 | PASS（Σ 4.66 MB） |
| 6 | `node --test scripts/stage_b_b5_3/test/relay_ownership_contract.node-test.mjs` | 0 | **25 / 25** |
| 7 | `pytest tests/test_wp0_r1_relay_barrier.py -q` | 0 | **6 / 6** |
| 8 | `pytest -k "capture or transcript or outline or fault or product" -q` | 0 | **180 passed** / 537 deselected |
| 9 | `verify-...-v10-contract.py` | **2** | **45 / 50**（待 Codex 重冻结） |
| 10 | `verify-...-v10-mutations.py` | **2** | **14 / 15**（待 Codex 重冻结） |

> 环境说明：`npx vitest run src/modules/media_companion/tests/` 与
> `npx vitest run` 在本机多次出现 `[vitest-pool-runner]: Timeout waiting
> for worker to respond`，且所有 test file / test 均为 passed。该错误出现在
> worker 池 teardown 阶段，宿主内存压力所致（available 约 1.0–2.4 GB，swap
> 耗尽）。为规避，R1 套件以显式文件列表一次运行（#2，退出码 0），全量以
> `--maxWorkers=2` 运行（#4，退出码 0，0 error）。

## 2. R1 相关 Vitest 细分

| 文件 | 用例 | 覆盖 |
|---|---:|---|
| **`RuntimeRelayRecoveryAdapter.test.ts`（本轮新增）** | **12** | 生产 adapter composition：只用 bootstrap/cancel/get；`connecting` 顺序与参数；Runtime-owned phase 只 bootstrap→get；一次 reconcile bootstrap ≤1；新 worker 必重新 session；401/403/offline/transport/API 传播；`{ok:false}`、缺 task、缺 state 不为成功；10 个真实 acquisition state 读取；error 分类不携文本 |
| **`RelayRestartReconciliation.test.ts`（本轮改写）** | **22** | 新实例读旧 store + **生产 adapter 类**：`connecting` bootstrap→DELETE→GET 精确顺序与 taskId；四 phase bootstrap→GET；5 终态清 marker；5 非终态保留；4 类错误保留+固定码；DELETE 失败不继续 GET；`{ok:false}`/缺 state 不成功；单次 bootstrap；新 worker 重 bootstrap；六字段与禁止字段回归 |
| `RuntimeCaptureTransport.test.ts` | 30 | 状态机 / sequence / credit / 背压 / ACK timeout / 原子 stop / disconnect 分类 / marker 生命周期 |
| `RuntimeCaptureRelayContracts.test.ts` | 20 | 9 消息、方向、limits、session 格式、归一化、marker 身份、sender 规则 |
| `RelayTwoEndHarness.test.ts` | 5 | 双端真实协议全序列 |
| `RelayRestartHarness.test.ts` | 8 | 旧 transport 写 marker 的生命周期 |
| `OffscreenEntrypointComposition.test.ts` | 3 | 真实 entrypoint bootstrap 首采集可达 |
| `MediaCaptureController.test.ts` | 11 | relay 必需 + 无 legacy onMessage 控制面 |
| 其余既有 media_companion 测试 | 54 | — |

**R1 套件合计 115 例，全量 499 例。**

## 3. 静态所有权合同（25 例）

新增本轮 3 组：

| 组 | 断言 |
|---|---|
| 生产 adapter 不自消息 | 无 `command:"delete"` / `command:"recover"` / 带 `taskId` 的 `command:"status"`；必须装配 `RuntimeRelayRecoveryAdapter` + `bootstrapLocalRuntimeSession` / `cancelMediaAcquisition` / `getMediaAcquisition`；relay 装配块内无 `sessionToken`/`persistToken`/`bearerToken`/`storage.local.set`；写入 `storage.session` 的内容不含 `token` |
| 无不可调用成员 | 剥离注释后，adapter 与 reconciler 均不含 `recover(sourceIdentity)`，也不含 `sourceIdentity` |
| 终态闭集 | 含 `succeeded`/`degraded`/`blocked`/`failed`/`cancelled`；终态块内不含 `ready` / `published` |

其余 22 例为第一、二轮既有门禁（Offscreen 无所有权、无 onMessage 控制面、
两阶段绑定、relay 必需、TRUSTED_CONTEXTS、冻结参数、marker 身份、
冻结九消息零内联等），全部保持通过。

## 4. Runtime 侧

| 套件 | 结果 |
|---|---|
| `tests/test_wp0_r1_relay_barrier.py` | 6 / 6（不变） |
| `pytest -k "capture or transcript or outline or fault or product"` | 180 passed（不变） |

## 5. v10 verifier（预期失败）

```
verify-...-v10-contract.py  exit 2  45/50
  failed: sourceEvidenceHashesCurrent, sourceScopeExtractorsValid,
          sourceEmitSetEqualsFrozenInventory,
          unlistedSourceFilesEmitNoBoundaryCodes,
          discoveredCodeUniverseClosed
  sourceInventoryDiff: actual 32 vs frozen 40（missing 8 / extra 0）
verify-...-v10-mutations.py exit 2  14/15
  唯一失败：non_boundary_lexical_string_control（expected 0 / actual 2）
```

**8 个「缺失」code 逐项核验：全部仍存在于工作树**（每个 ≥1 个非测试文件），
**本轮零真实删除**。根因是 verifier 在 2 个 R1 必须改的冻结 scope 文件
哈希漂移时**跳过整文件 AST 抽取**，加新增 relay 模块未入 11-scope 触发
`unlistedSourceFilesEmitNoBoundaryCodes`；mutation 唯一失败为对照用例。
**全部属冻结证据漂移，非实现缺陷。**

## 6. secret / raw-media / private-path scan

- Chrome 启动 **0** 次；Provider 请求 **0** 次；六视频 fresh run **未启动**；
  真实产品 run **0** 次
- 未播放任何声音；未启动任何浏览器实例
- 本轮新增/修改源码**不含** Cookie 值、API key、凭据、原始音视频或
  绝对私有路径
- Runtime bearer token 仅存在于 `RuntimeRelayRecoveryAdapter` 的 in-flight
  promise，**从不持久化**；静态测试断言 relay 装配块无 token 写入
- `classifyRuntimeError` 只保留 `kind` 与 `httpStatus`，**不携带原始
  message**；测试断言不含 `/home/user`
- restart marker 仍严格 6 字段；adapter / reconciler 均不含
  `sourceIdentity`
- 全部测试使用 `os.tmpdir()` / `tmp_path` 沙箱并清理；结束前无遗留
  vitest / uvicorn / node 进程
