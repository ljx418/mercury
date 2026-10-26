# WP0 R1 第三轮纠偏 Phase Receipt（2026-10-16）

Candidate: `wp0-r1-corrective-round3-2026-10-16`
状态：**R1 AWAITING CODEX REFREEZE**
依据：`wp0-r1-corrective-round2-2026-10-16/60-codex-refreeze-gate-review-round3.md`、
`61-codex-r1-correction-round3-handoff.md`
R2 未启动。

## 1. M-R1-C3-01 关闭：生产 restart adapter 改为真实 authenticated Runtime client

**原缺陷**：`entrypoints/background/index.ts` 的 `relayRecoveryAdapter` 通过
`chrome.runtime.sendMessage` 向**自身**发送 `command:"delete"` /
`command:"status" + taskId` / `command:"recover"`。这三条都不是 Runtime 调用：

- `MediaCaptureMessageRouter.parse()` 只接受 `prepare` / `arm` /
  字段精确的 `status` / `stop`；`delete`、`recover` 无合同；
- `status` 带 `taskId` 直接 `V3_MEDIA_CAPTURE_MESSAGE_INVALID`；
- `trustedSurface()` 只允许 `sidepanel.html` / `workspace.html`，service
  worker 不是可信 surface；
- `Boolean(response)` 把 `{ok:false, failureCode}` 读成 `true`，产生假成功。

**修复**：新增 `capture/RuntimeRelayRecoveryAdapter.ts`（可注入、可单测），
Background 装配真实 Runtime client：

| 原实现 | 新实现 |
|---|---|
| `sendMessage({command:"status", taskId})` | `getMediaAcquisition(taskId)` — 真实 `GET /v1/media/acquisitions/{id}` |
| `sendMessage({command:"delete", taskId})` | `cancelMediaAcquisition(taskId)` — 真实 `DELETE /v1/media/acquisitions/{id}` |
| `sendMessage({command:"recover", sourceIdentity})` | **成员已删除**（见 §3） |
| 无 session 建立 | `bootstrapLocalRuntimeSession()` — 每次 reconcile 建立**新**进程内 session |

`RelayRuntimeClient` 是唯一允许的 Runtime 表面，Background 注入
`{ bootstrapSession, cancelAcquisition, getAcquisition }` 三个真实函数。

## 2. service worker 重启后建立新进程内 session

- `RuntimeRelayRecoveryAdapter.ensureSession()` **单飞**（single-flight）：
  一次 reconcile 内最多 1 次 bootstrap，并发调用共享同一 in-flight promise。
- 新 worker（新 adapter 实例）**必然**重新 bootstrap —— 旧 bearer token 不在
  内存中，且**从不持久化**：静态合同测试断言 relay 装配块内不存在
  `sessionToken` / `persistToken` / `bearerToken` / `storage.local.set`，
  且写入 `storage.session` 的内容不含 `token`。
- marker 仍严格 6 字段，不含 token。

## 3. phase dispatch 顺序固定

| phase | 顺序 | 断言 |
|---|---|---|
| `connecting` | bootstrap → DELETE → GET | `calls === [bootstrap, cancel, get]`，且 `cancel.taskId === get.taskId === marker.taskId` |
| `runtime_started` / `capturing` / `draining` / `cleanup_pending` | bootstrap → GET | `calls === [bootstrap, get]`，**无** cancel |

`recover(sourceIdentity)` 已从 adapter 与 reconciler **同时删除**：严格 6 字段
marker 没有 `sourceIdentity`，宣称该成员可调用即是虚假合同。静态测试在
剥离注释后断言两个文件均不含 `sourceIdentity`。

## 4. acquisition 终态闭集修正（m-R1-C3-01）

`RelayRestartReconciler.ts` 新增导出常量 `ACQUISITION_TERMINAL_STATES`，
严格等于 `MediaAcquisitionTask.state`（`runtimeClient.ts:794`）的终态子集：

```
succeeded / degraded / blocked / failed / cancelled
```

删除了属于 projection / outline 资源、acquisition 永不返回的
`ready` 与 `published`。

- 5 个终态 + grace → 按 session 清 marker（各 1 例）；
- 5 个非终态（`created` / `acquiring` / `capturing` / `transcribing` /
  `cleaning`）→ 保留 marker（各 1 例）。

## 5. 失败传播：401/403、offline、transport、API error 一律 fail closed

- adapter 的 `classifyRuntimeError` 只保留 `kind`
  （`authentication` / `transport` / `api`）与 `httpStatus`，**不携带原始
  message**；测试断言 `classified.message` 不含 `/home/user`。
- `readAcquisitionState` 对以下情况全部返回 `ok:false`：
  非对象、`{ok:false,error}` 信封、缺 `task`、缺 `state`。
- reconciler 收到 `ok:false` → 返回 `runtime-unavailable` +
  固定 `V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED`，**保留 marker**。
- DELETE 失败 → 不再继续 GET（`calls === [bootstrap, cancel]`）。

### 404 的处理

本轮按 handoff §5.8 显式建模：404 属于 Runtime 返回的 `{ok:false}` 或被
Runtime client 抛为 `api` kind，两条路径都保留 marker 并报固定码，**不**
自行扩大公共合同把 404 当作终态。R1 内的行为是「保留 marker + 明确
pending/failure」，最终 404 策略仍属 R4。

## 6. 新增测试

**`RuntimeRelayRecoveryAdapter.test.ts`（12 例，R1-C3-01 production adapter
composition）** —— 使用**真实 adapter 类**，只注入 Runtime client 函数：

1. 绝不调用扩展自消息，只出现 bootstrap/cancel/get
2. `connecting` 顺序与参数精确
3. Runtime-owned phase 只 bootstrap → get，无 cancel
4. 一次 reconcile 内 bootstrap 至多 1 次
5. 新 worker（新 adapter）必然重新建立 session
6. 401/403、offline、transport、API error 全部传播为失败
7. `{ok:false}` 永不被读成成功
8. 缺 task / 缺 state 永不被读成成功
9. acquisition state 读取 10 个真实取值
10. 非对象 / 错误信封 / 无 task 一律拒绝
11. Runtime error kind 分类
12. 保留 httpStatus 但不含原始 message

**`RelayRestartReconciliation.test.ts`（22 例）** —— 全部改用**生产 adapter
类**，新 worker 实例读取旧 store；新增：

- `connecting` 精确 bootstrap → DELETE → GET
- 四个 Runtime-owned phase 精确 bootstrap → GET
- 5 个终态 + grace 清 marker
- 5 个非终态保留 marker
- 401/403、offline、transport、api 保留 marker + 固定码
- DELETE 失败不再继续 GET
- `{ok:false}` / 缺 state 不得变成功
- 一次 reconcile bootstrap 至多一次
- 新 worker 必然重新 bootstrap
- marker 六字段与禁止字段回归（保持）

**`relay_ownership_contract.node-test.mjs`（25 例）** —— 新增 3 组静态门禁：

- 生产 adapter 不再出现 `delete` / `recover` / 带 `taskId` 的 `status`
  自发扩展消息；必须装配 `RuntimeRelayRecoveryAdapter` 与三个真实
  Runtime client 函数；relay 装配块内不得持久化 bearer token
- adapter / reconciler 不含 `recover(sourceIdentity)`，也不含
  `sourceIdentity`（剥离注释后断言）
- 终态闭集含 5 个 acquisition 终态，且不含 `ready` / `published`

## 7. 本轮修正的真实实现缺陷

1. **生产 restart adapter 完全无效**（M-R1-C3-01 本体）：向自身发送
   router 不接受的命令，且 `Boolean(response)` 制造假成功。
2. **`recover(sourceIdentity)` 是不可调用成员**：严格 6 字段 marker 没有
   sourceIdentity。
3. **终态闭集混用资源词汇**：含 acquisition 永不返回的 `ready` /
   `published`，缺 `succeeded` / `blocked`，导致成功与 blocked task 在 grace
   后不会清 marker。

## 8. 合同变化

- **内部合同变化**：有 —— 生产 recovery adapter 改为真实 Runtime client；
  `RelayRecoveryAdapter` 成员由 `deleteAcquisition` / `getTask` / `recover`
  改为 `cancelThenObserve` / `observe`；新增
  `ACQUISITION_TERMINAL_STATES`。
- **公共合同变化**：**none**。未修改冻结 schema、fixture、FailureCode
  registry（20 码）、验收阈值、公共 API、Runtime endpoint、Origin、
  ticket TTL、Cookie/provider 合同、BVID 分母、grounded comprehension、
  SourceAuthority、Side Panel materialize ownership。

## 9. 严重度

| 级别 | 数量 | 内容 |
|---|---:|---|
| Fatal | 0 | — |
| Major | 0 | M-R1-C3-01 关闭 |
| Minor | 0 | m-R1-C3-01 关闭 |
| 待重冻结 | 1 | v10 verifier 45/50 + 14/15，见 §10 |

## 10. v10 verifier 现状（预期失败）

```
verify-...-v10-contract.py  → exit 2, 45/50
  failed: sourceEvidenceHashesCurrent, sourceScopeExtractorsValid,
          sourceEmitSetEqualsFrozenInventory,
          unlistedSourceFilesEmitNoBoundaryCodes,
          discoveredCodeUniverseClosed
  sourceInventoryDiff: actual 32 vs frozen 40（missing 8 / extra 0）
verify-...-v10-mutations.py → exit 2, 14/15
  唯一失败：non_boundary_lexical_string_control（expected 0 / actual 2）
```

**逐项核验：8 个「缺失」code 全部仍存在于工作树**
（每个 ≥1 个非测试文件，最多 3 个），**本轮零真实删除**：

| code | 非测试文件数 |
|---|---:|
| `V3_MEDIA_CAPTURE_AUDIO_CONTEXT_SUSPENDED` | 1 |
| `V3_MEDIA_CAPTURE_CLEANUP_INCOMPLETE` | 1 |
| `V3_MEDIA_CAPTURE_PERMISSION_REQUIRED` | 1 |
| `V3_MEDIA_CAPTURE_PREPARE_FAILED` | 2 |
| `V3_MEDIA_CAPTURE_PREPARE_REQUIRED` | 1 |
| `V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED` | 1 |
| `V3_MEDIA_CAPTURE_START_FAILED` | 3 |
| `V3_MEDIA_CAPTURE_TAB_INVALID` | 3 |

「缺失」完全是 verifier 在 2 个冻结 scope 文件哈希漂移时**跳过整文件 AST
抽取**的假象。漂移文件仍为 R1 必须改的两个：

| 文件 | 原因 |
|---|---|
| `capture/MediaCaptureController.ts` | `relay` 改必需 + 删 legacy fallback + `beginStop` |
| `entrypoints/media-capture-offscreen/main.ts` | 加载即 bootstrap Port + `capture_error` 边界 |

`unlisted emit`：新增 relay 模块不在冻结 11-scope 内。mutation 唯一失败为
对照用例（基线本身失败）。**全部属冻结证据漂移，非实现缺陷。**

ClaudeCode 未修改任何冻结证据。

## 11. 下一门禁

Codex 检查本轮生产 adapter 事实 → 更新冻结 source scope / hash / inventory
→ 重跑 contract verifier 50/50 与 mutation verifier 15/15。在此之前不进入 R2。
