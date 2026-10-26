# WP0 R1 第三轮纠偏 Handoff（2026-10-16）

Candidate: `wp0-r1-corrective-round3-2026-10-16`
阶段结论：**R1 AWAITING CODEX REFREEZE**。R2–R7 未启动。
证据目录：`docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r1-corrective-round3-2026-10-16/`

## 1. changed files

### 新增

```
apps/chrome-extension/src/modules/media_companion/capture/RuntimeRelayRecoveryAdapter.ts
  edc40367f562c918150e2bc5820d7ab65a626f8a68e09b90910a224c1c667c4f
apps/chrome-extension/src/modules/media_companion/tests/RuntimeRelayRecoveryAdapter.test.ts
  91f56bd1ebd81811ce6987d8d7dcad3c669388e4697680018c09f5013843a57e
```

### 修改

```
apps/chrome-extension/src/modules/media_companion/capture/RelayRestartReconciler.ts
  a58944d7836b955d7fa08d8803e16cffa7e314fda9093eb7f667f967a197c6fc
apps/chrome-extension/src/modules/media_companion/capture/index.ts
  3e1fa9ab73c07b3ca961e1f9d17fac336e5e4d0414df190e4921e9c6b3040703
apps/chrome-extension/entrypoints/background/index.ts
  b47e87f6170866d34713eb15998f181b005720fb3ea4b9eec57cca34380bbe2c
apps/chrome-extension/src/modules/media_companion/tests/RelayRestartReconciliation.test.ts
  6b8032da7a9d8d4afdf1fee9d6b55c23eaac86a3510da9ec770d945c5c355e31
scripts/stage_b_b5_3/test/relay_ownership_contract.node-test.mjs
  c8cc8e92320b578f9476e141ac1a57bfd5a4fdb70a85906c34a3672b6c61e199
apps/chrome-extension/chrome-mv3-unpacked/**   （npm run build 产物）
```

### 明确未修改

`apps/chrome-extension/src/runtimeClient.ts`（**未改**：直接复用既有
`bootstrapLocalRuntimeSession` / `cancelMediaAcquisition` /
`getMediaAcquisition` 三个导出，无需任何导出或工厂调整）、
`services/local-runtime/navia_runtime/**`、冻结 schema / fixture /
contracts / 权威文档 / `stage-b-six-video-registry.json`、
第一至第三轮 handoff 目录（历史证据未被覆盖）。

## 2. 合同变化

- **内部合同变化**：有 —— 生产 recovery adapter 换为真实 Runtime client；
  `RelayRecoveryAdapter` 成员由 `deleteAcquisition` / `getTask` / `recover`
  改为 `cancelThenObserve` / `observe`；新增
  `ACQUISITION_TERMINAL_STATES`（5 项 acquisition 终态）。
- **公共合同变化**：**none**。

## 3. 全部命令与退出码

| # | 命令 | 退出码 | 结果 |
|---:|---|---:|---|
| 1 | `npm run typecheck` | 0 | PASS |
| 2 | `npx vitest run`（8 个 R1 套件） | 0 | **115 / 115** |
| 3 | `npx vitest run src/modules/media_companion/tests/` | 0 | **163 / 163** |
| 4 | `npx vitest run --maxWorkers=2` | 0 | **499 / 499**（65 files） |
| 5 | `npm run build` | 0 | PASS（Σ 4.66 MB） |
| 6 | `node --test .../relay_ownership_contract.node-test.mjs` | 0 | **25 / 25** |
| 7 | `pytest tests/test_wp0_r1_relay_barrier.py -q` | 0 | **6 / 6** |
| 8 | `pytest -k "capture or transcript or outline or fault or product" -q` | 0 | **180 passed** |
| 9 | `verify-...-v10-contract.py` | **2** | 45 / 50（待重冻结） |
| 10 | `verify-...-v10-mutations.py` | **2** | 14 / 15（待重冻结） |

> 环境说明见 `20-round3-test-results.md` §1：pool-runner teardown 超时为宿主
> 内存压力，非测试失败；R1 套件与全量均以退出码 0 完成。

## 4. 测试计数

| 类别 | 计数 |
|---|---:|
| production adapter composition（新增） | **12** |
| restart reconciliation（改写，使用生产 adapter） | **22** |
| 其余 R1 套件 | 81 |
| **R1 套件合计** | **115** |
| media_companion 子树 | 163 |
| **扩展全量** | **499**（65 files） |
| 静态所有权合同 | 25 |
| Runtime barrier | 6 |
| Runtime focused | 180 |

## 5. Chrome / Provider / 六视频 / 声音

| 项 | 次数 |
|---|---:|
| Chrome 启动 | **0** |
| Provider 请求 | **0** |
| 六视频 fresh run | **0** |
| 真实产品 run | **0** |
| 声音播放 | **0** |
| 可见 Chrome / 原生弹窗 / 焦点抢占 / UIAutomation | **0** |

## 6. secret scan

- 无 Cookie / API key / 凭据 / 原始音视频 / 绝对私有路径进入源码或证据。
- Runtime bearer token 仅存在于 in-flight promise，**从不持久化**；静态
  合同测试断言 relay 装配块无 token 写入。
- `classifyRuntimeError` 只保留 `kind` 与 `httpStatus`，不携带原始 message。
- restart marker 仍严格 6 字段；adapter / reconciler 均不含
  `sourceIdentity`。
- 全部测试使用 `os.tmpdir()` / `tmp_path` 沙箱并清理；结束前无遗留
  vitest / uvicorn / node 进程。

## 7. PRD / 架构覆盖

见 `30-round3-prd-review.md`：Codex 第三轮 1 Major + 1 Minor 全部关闭；
handoff §4 的 10 条实施要求逐条落实；11 项所有权不变量满足，其中本轮新增
「restart 必须通过真实 authenticated Runtime」；404 策略显式建模为
「保留 marker + 固定码」，最终语义留 R4。

## 8. Fatal / Major / Minor

| 级别 | 数量 | 内容 |
|---|---:|---|
| Fatal | 0 | — |
| Major | 0 | M-R1-C3-01 关闭 |
| Minor | 0 | m-R1-C3-01 关闭 |
| **待重冻结** | **1** | v10 verifier 45/50 + 14/15。8 个「缺失」code 逐项核验**全部仍存在于工作树**（每个 ≥1 个非测试文件），**本轮零真实删除**；根因是 verifier 在 2 个 R1 必须改的冻结 scope 文件哈希漂移时**跳过整文件 AST 抽取**，加新增 relay 模块未入 11-scope 触发 `unlistedSourceFilesEmitNoBoundaryCodes`；mutation 唯一失败为对照用例。属 Codex 冻结权限。 |

## 9. 本轮修正的真实实现缺陷

1. **生产 restart adapter 完全无效**：向 service worker 自身发送
   router 不接受的 `delete` / `recover` 与字段非法的 `status`，且
   `Boolean(response)` 把 `{ok:false}` 读成成功 —— 真实旧任务既不会被
   取消，也不会被观察，marker 会长期滞留。
2. **`recover(sourceIdentity)` 是不可调用成员**：严格 6 字段 marker 没有
   `sourceIdentity`，宣称该成员可调用即虚假合同。
3. **终态闭集混用资源词汇**：含 acquisition 永不返回的 `ready` /
   `published`，缺 `succeeded` / `blocked`，导致成功与 blocked task 在
   cleanup grace 后不会清 marker。

三者均由本轮 production adapter composition 测试暴露。

## 10. 自动化开发停止原因

R1-C3-01 与 m-R1-C3-01 已实施并自验证通过：生产 Background 不再自消息，
而是驱动真实 authenticated Runtime client（`bootstrapLocalRuntimeSession` →
`cancelMediaAcquisition` / `getMediaAcquisition`）；每次 reconcile 建立新的
进程内 session 且 token 绝不持久化；`connecting` 与其余四 phase 的调用顺序
由测试精确锁定；acquisition 终态闭集与 `MediaAcquisitionTask.state` 一致；
401/403、offline、transport、API error 一律保留 marker 并报固定码。
自验证结果：499/499 扩展全量、163/163 media_companion、115/115 R1 套件、
25/25 静态合同、6/6 barrier、180/180 focused、typecheck 与 build 全绿。

剩余唯一未闭合项是冻结 v10 证据的 source scope / hash 尚未由 Codex
更新。逐项核验证明剩余失败**仅来自冻结证据漂移**（8 个「缺失」code 全部
仍在工作树，零真实删除），不来自实现缺陷。修正该项需改动冻结 fixture /
FailureCode registry / 权威 source scope，属 Codex 冻结权限
（`60-codex-refreeze-gate-review-round3.md §1`、
`61-…-round3-handoff.md §3`）。故在 R1 停止。

## 11. 下一门禁

1. Codex 检查本轮生产 adapter 事实（含 composition 测试）；
2. Codex 更新冻结 source scope / hash / inventory；
3. 重跑 `verify-...-v10-contract.py` 达 50/50（退出码 0）；
4. 重跑 `verify-...-v10-mutations.py` 达 15/15（退出码 0）；
5. Codex 明确 `R2 may start`。

在此之前不进入 R2，不宣布 R1 PASS。
