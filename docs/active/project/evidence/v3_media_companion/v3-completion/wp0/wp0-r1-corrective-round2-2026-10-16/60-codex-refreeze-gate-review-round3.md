# WP0 R1 Codex 重冻结门禁审查（第三轮）

日期：2026-10-16  
审查角色：Codex（冻结合同、架构门禁与阶段验收）  
审查方式：只读源码、冻结合同与既有测试证据核验；未运行 Chrome、Provider、六视频或声音测试。  
候选：`wp0-r1-corrective-round2-2026-10-16`

## 1. 决定

**R1 NO-GO / REFREEZE REJECTED / R2 BLOCKED**

| 严重度 | 数量 |
|---|---:|
| Fatal | 0 |
| Major | 1 |
| Minor | 1 |

第二轮已经关闭此前的 Port 建连循环、credit 初始化、relay 装配、producer
`capture_error`、marker 形状与 `TRUSTED_CONTEXTS` 等问题。但是，生产 Background
注入给 `RelayRestartReconciler` 的恢复适配器没有调用 Runtime；现有测试只验证了 fake
adapter。此时更新 v10 source scope/hash 会把不可工作的生产恢复路径固化为权威证据，构成
虚假验收风险。

因此本轮：

1. 不更新 v10 fixture 中的 source hash；
2. 不把新增 relay 文件加入冻结 source scope；
3. 不重算 boundary code inventory；
4. 不修改 FailureCode registry、公共 API、Schema 或验收阈值；
5. 不进入 R2。

## 2. 已确认关闭的第二轮问题

以下结论可保留，不要求回退：

- Offscreen entrypoint 在模块加载时主动建立 Port，listener 先于消息发送；
- `start -> ready -> chunk_credit` 两阶段绑定已实现；
- `relayPortRef.current` 已绑定真实 `OffscreenAudioPort`；
- Controller capture start/stop 使用 relay，旧的一次性消息控制面不再承担采集；
- producer START 失败会回传 `capture_error`，Background 再归一化；
- restart marker 严格六字段，禁止 Cookie、API key、ticket、PCM、sourceIdentity 等字段；
- `chrome.storage.session.setAccessLevel({accessLevel:"TRUSTED_CONTEXTS"})` 已在 reconciler
  读取前执行；
- 既有第二轮报告中的 typecheck、479/479、build、22/22、6/6、180 passed 结果可作为
  ClaudeCode 自验证证据，但不能证明下述生产适配器正确。

## 3. Major

### M-R1-C3-01：生产 restart adapter 自发扩展消息，未调用 authenticated Runtime

生产装配位于：

- `apps/chrome-extension/entrypoints/background/index.ts:161-187`

它把恢复动作实现为 Background 对自身调用 `chrome.runtime.sendMessage`：

- `command: "delete"` + `taskId`；
- `command: "status"` + `taskId`；
- `command: "recover"` + `sourceIdentity`。

但唯一 `navia.mediaCapture` 路由的事实是：

- `MediaCaptureMessageRouter.parse()` 只接受 `prepare`、`arm`、精确无额外字段的
  `status`、`stop`；`delete` 和 `recover` 均无合同；
- `status` 只允许 `{type, command}`，携带 `taskId` 会被判定
  `V3_MEDIA_CAPTURE_MESSAGE_INVALID`；
- `trustedSurface()` 只允许 `sidepanel.html` 或 `workspace.html`，Background service worker
  自发消息不是可信 UI surface。

对应源码：

- `apps/chrome-extension/src/modules/media_companion/capture/MediaCaptureMessageRouter.ts:11-25`
- `apps/chrome-extension/src/modules/media_companion/capture/MediaCaptureMessageRouter.ts:46-68`
- `apps/chrome-extension/src/modules/media_companion/capture/MediaCaptureMessageRouter.ts:79-90`

直接后果：

1. `deleteAcquisition()` 不会删除 Runtime task；
2. `Boolean(response)` 会把 `{ok:false, failureCode:...}` 当成 `true`，产生假成功；
3. `getTask()` 读不到 `state`，只返回 `null`；
4. `recover()` 既没有合法路由，也无法从严格六字段 marker 得到 `sourceIdentity`；
5. worker restart 后 marker 会被长期保留，真实旧任务不会按合同完成清理或终态观察。

仓库已经存在真实 authenticated Runtime 能力：

- `bootstrapLocalRuntimeSession()`：建立新的进程内 Bearer session；
- `cancelMediaAcquisition(taskId)`：`DELETE /v1/media/acquisitions/{taskId}`；
- `getMediaAcquisition(taskId)`：`GET /v1/media/acquisitions/{taskId}`；
- Runtime 对应 endpoint 位于 `services/local-runtime/navia_runtime/app.py:1227-1239` 和
  `:1642-1654`。

service worker 重启后旧 token 不在内存中，因此生产恢复适配器必须先建立新的短期本机
session，再调用真实 Runtime；不得持久化或从 marker 恢复 token。

### 测试缺口

`RelayRestartReconciliation.test.ts:71-89` 注入的是完全内存化的 fake
`RelayRecoveryAdapter`。现有测试没有导入或实例化 `background/index.ts:161-187` 的生产
adapter，因此 16 个 restart 用例只能证明 reconciler 状态机，不能证明生产调用链。

## 4. Minor

### m-R1-C3-01：终态闭集与真实 `MediaAcquisitionTask.state` 不一致

`RelayRestartReconciler.ts:207-210` 当前终态为：

```text
ready, degraded, cancelled, failed, published
```

真实 acquisition 合同位于 `runtimeClient.ts:786-799`，终态应至少按该资源判断：

```text
succeeded, degraded, blocked, failed, cancelled
```

当前实现缺少 `succeeded`、`blocked`，并包含 acquisition 不会返回的 `ready`、`published`。
因此即使生产 adapter 改为真实 GET，成功或 blocked task 仍不会按 grace 清 marker。

终态判断必须绑定 adapter 返回的明确资源类型，不能混用 acquisition、projection、outline
三套 state vocabulary。

## 5. 第三轮最小纠偏范围

1. 新增一个可注入、可单测的生产 `RuntimeRelayRecoveryAdapter`（名称可调整），由 Background
   装配真实 Runtime client，而不是向扩展自身发消息。
2. 每次 service worker reconcile 需要 Runtime 时，先调用
   `bootstrapLocalRuntimeSession()` 建立新的内存 session；不得持久化 token。
3. `connecting`：调用真实 `cancelMediaAcquisition(taskId)`，然后用真实
   `getMediaAcquisition(taskId)` 观察终态。
4. `runtime_started/capturing/draining/cleanup_pending`：只用真实
   `getMediaAcquisition(taskId)` 观察；不得恢复 PCM、ticket、sequence 或 credit。
5. 严格 marker 仍不增加 `sourceIdentity`。当前没有可信 sourceIdentity 时，不得声称
   `recover(sourceIdentity)` 可用；删除未使用的 adapter member，或明确保留为不可调用接口。
6. 终态闭集与所读取的 acquisition resource 一致：
   `succeeded/degraded/blocked/failed/cancelled`。
7. 401/403、Runtime offline、transport error、非终态都保留 marker，并返回固定失败码；不得把
   `{ok:false}`、`null` 或异常吞成成功。
8. 对 404 的行为必须按照冻结 R4 计划显式建模和测试；在 R1 内至少不得无限假成功或清理错误
   session。若 404 的最终策略仍属于 R4，R1 应保留 marker 并输出明确 pending/failure，而不是
   自行扩大公共合同。

## 6. 第三轮最低验收

- 生产 Background 不再出现上述 `delete/status/recover` 自发扩展消息；
- production adapter composition test 使用真实 adapter 类与注入的 Runtime client 函数；
- 新 worker + 旧 marker：
  - `connecting` 精确执行 bootstrap → DELETE → GET；
  - 其余四 phase 精确执行 bootstrap → GET；
  - `succeeded/degraded/blocked/failed/cancelled` + grace 后按 session 清 marker；
  - non-terminal、401/403、offline、transport failure 保留 marker；
  - `{ok:false}` 不得被解释为成功；
- marker 仍严格六字段且无 token/sourceIdentity/私密值；
- typecheck、media companion tests、全量 extension tests、build、ownership static、Runtime
  barrier、focused pytest 全绿；
- 测试不播放声音；不启动 Chrome、Provider 或六视频；
- 状态仍为 `R1 AWAITING CODEX REFREEZE`，由 Codex 复核后才可更新 v10 scope/hash。

## 7. 本轮事实哈希

```text
f4cca38c701a945ff880017284de284bc291aa47e5d02839aa820751b3a5cd41  apps/chrome-extension/entrypoints/background/index.ts
d7d0ed7db90d12a4c477cca05da46de6ba53d68535916d1de8f2218af1d8c6d0  apps/chrome-extension/src/modules/media_companion/capture/MediaCaptureMessageRouter.ts
979111e8e72257a11654e5a440947b4d0fd63408bd2a22689da20b8000a3aa4f  apps/chrome-extension/src/modules/media_companion/capture/RelayRestartReconciler.ts
3006921834d7ef09f988334e3346504662f6912b2d22f6c862b4f2430ddc95ff  apps/chrome-extension/src/modules/media_companion/tests/RelayRestartReconciliation.test.ts
d828386e627f51760e7c953725ac39846516df276813c63a1e002c62707bea5a  apps/chrome-extension/src/runtimeClient.ts
518c853dadaf769bdf53b4b6cbc13306f880833d46814c1e306e183f4e6a66a8  services/local-runtime/navia_runtime/app.py
```

## 8. 自动化开发停止原因

第二轮类级状态机与 entrypoint producer composition 已闭环，但生产 restart adapter 没有连接
Runtime，并且终态集合混用了其他资源的 state。现在重冻结会导致 worker restart 在实际产品中
既不清理旧 task，也无法完成 marker 收口，却被 50/50 与 15/15 宣称为通过。Codex 因此拒绝
重冻结，保持 R1 NO-GO，等待第三轮产品代码纠偏。

