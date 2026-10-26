# WP0 R1 第二轮纠偏 Phase Receipt（2026-10-16）

Candidate: `wp0-r1-corrective-round2-2026-10-16`
状态：**R1 AWAITING CODEX REFREEZE**
依据：`wp0-r1-corrective-2026-10-16/60-codex-refreeze-gate-review.md`
（SHA-256 `081ddc08040a3ba1a2c0e25fd35ebe87cc070af730f341de986cd718fac54edc`）、
`61-codex-r1-correction-round2-handoff.md`
（SHA-256 `a0a5ad17c09bc6bb3f6ad985adb5d70b82b64d816a39435141cdab4211d1db8f`）
R2 未启动。

## 1. M-R1-C2-01 关闭：真实 Port bootstrap

**原缺陷**：Offscreen 只在 `startCapture()` 内 `ensurePort()`，而
`startCapture()` 只在收到 Port `start` 后运行 —— 需要 Port 才能收到
start，Port 只在收到 start 后创建。首次采集必然在 `sendStart` 前失败。

**修复**：

- 抽出可注入、chrome-free 的 `capture/OffscreenProducerBootstrap.ts`
  （`bootstrapOffscreenProducerPort`）。listener 在函数内**同步注册**，
  早于任何 post。
- `entrypoints/media-capture-offscreen/main.ts` 在**模块加载时**调用
  `ensurePort()`，消除循环。
- 两阶段 session 绑定只使用冻结 9 消息，无第十种协议消息：
  `Port connect`（transport ready，无需消息）→ Background `start`
  （带 captureSessionId + 一次性 streamId）→ Offscreen `ready`
  （回显已绑定 captureSessionId）→ Background 首个 `chunk_credit`。
- 所有 Port 消息使用同一 captureSessionId。

**本轮再修正两个真实顺序缺陷**：

1. `sendStart` 原本先 post `start` 再 `this.#credit = 0`；producer 的
   `ready` 同步回包时先授予 credit，随后被这个 `= 0` 抹掉。现改为**先清
   credit 再 post `start`**。
2. `sendStart` 原本要求 `producerReady` 才放行，等于要求「先 ready 再
   start」，仍是循环。改为**只要求 Port 已连接**；首个 credit 改由
   `ready` 触发授予。

## 2. M-R1-C2-02 关闭：删除旧控制面

- `MediaCaptureControllerDependencies.relay` 由 `relay?:` 改为
  **`relay: RelayTransportPort`（必需）**。
- 删除 `startArmed()` 与 `stop()` 中的 `sendOffscreenMessage({command:
  "start"|"stop"})` fallback 分支。
- `stop()` 强制 `relay.beginStop(reason)` → `relay.sendQuiesce()` →
  `relay.stop(reason)`，终态只来自 transport。
- `sendOffscreenMessage` 仅保留给 Background 的 offscreen 预热 ping，
  与 capture start/stop 完全隔离。
- 测试：删除依赖旧 fallback 的 stop 用例，改为 relay 驱动；新增
  「无 legacy onMessage capture control plane」用例，断言
  `sendOffscreenMessage` 在 start 与 stop 期间**零调用**。

## 3. M-R1-C2-03 关闭：worker restart reconciliation

新增 `capture/RelayRestartReconciler.ts`：

- `RelaySessionStore` 显式调用
  `chrome.storage.session.setAccessLevel({accessLevel:"TRUSTED_CONTEXTS"})`
  （`RESTART_MARKER_ACCESS_LEVEL`），且在任何读取之前。
- `reconcile()` 读 marker、`validateStoredMarker` 按冻结 6 字段精确校验
  （任何多余字段即 fail closed）。
- 五阶段 phase dispatch，严格使用**既有** authenticated 端点：
  - `connecting` → `deleteAcquisition(taskId)` + `getTask(taskId)` 观察
  - `runtime_started` / `capturing` / `draining` / `cleanup_pending` →
    仅 `getTask(taskId)` 观察（Runtime 存活时由其 finally 收口）
- **永不恢复旧 PCM / ticket / sequence**：模块内不存在
  `restorePcm` / `resumeTicket` / `resumeSequence` / `restoreTicket`，
  静态合同测试逐项断言其缺席。
- 过期 marker → fail-closed 清理（`action:"expired"`），不 dispatch。
- 非法 marker → fail-closed 清理 + `V3_MEDIA_CAPTURE_WORKER_RESTARTED`。
- Runtime 暂不可用 → 保留 marker 供下一个 worker，`RUNTIME_DISCONNECTED`。
- terminal（`ready|degraded|cancelled|failed|published`）**且** cleanup
  grace 已过 → 按 session 清理；清他 session 的 marker 会被拒绝。
- 重复 worker 启动幂等：marker 已清则 `action:"none"`。
- Background `entrypoints/background/index.ts` 在装配时构造 reconciler
  并 `void relayRestartReconciler.reconcile()`。

**本轮修正一个真实装配缺陷**：`relayPortRef.current = offscreenAudioPort`
此前**从未被赋值**，导致 transport 的 Runtime-ACK hook 在生产中永远拿不到
Port owner，`chunk_credit` 不会发出。已补齐赋值。

## 4. M-R1-C2-04 关闭：producer error 边界

- `handleBackgroundMessage` 的 `START` 分支统一 `try/catch`：捕获
  getUserMedia / AudioContext / shape / already-active 全部失败。
- 失败后先 `await teardown()`（释放 tracks / context / nodes）并重置
  `started` / `credit`，再发**恰好一个**带当前 captureSessionId 的
  `capture_error`，随后 `closePort()`。
- Background `OffscreenAudioPort` 的 `CAPTURE_ERROR` 分支：用
  `normalizeRelayFailureCode` 归一化到固定 20-code，向 producer 发
  `abort`，并上报类型化失败。
- 异常文本、路径、私密值**不进入**公开响应、日志或证据：仅传内部诊断
  code，归一化后仅公开码出界。

## 5. m-R1-C2-01 关闭：真实 entrypoint composition 测试

新增两个 harness（不再只有类级 mock）：

**`OffscreenEntrypointComposition.test.ts`（3 例）**
调用**真实 entrypoint bootstrap** `bootstrapOffscreenProducerPort` +
**真实** `OffscreenAudioPort.accept` + **真实** `RuntimeCaptureTransport`：

1. 文档加载即连接冻结 Port，无循环依赖（`connectCalls === 1`）。
2. 完整首采集：accept → Runtime start → `start` → `ready` → 首个
   `chunk_credit`（bound 同 captureSessionId）→ credited chunk 抵达 Runtime。
3. producer START 失败 → 恰好一个 `capture_error` → Background 归一化为
   `V3_MEDIA_CAPTURE_AUDIO_SHAPE_INVALID`；内部码
   `AUDIO_CONTEXT_SUSPENDED` 不越界。

**`RelayRestartReconciliation.test.ts`（16 例）**
创建**新 reconciler 实例读取旧 store**（不是旧 transport 写 marker）：

- 访问级别在读取前设为 `TRUSTED_CONTEXTS`
- marker 校验（canonical / 8 个禁止字段 / schemaVersion / sessionId /
  taskId / phase / 非对象）
- 五个 phase 各自 dispatch 到既有 DELETE / GET；断言从不调用 `recover`
  去恢复旧状态
- 过期 marker fail-closed 清理且零 dispatch
- 非法 marker fail-closed 清理 + `WORKER_RESTARTED`
- Runtime 不可用保留 marker + `RUNTIME_DISCONNECTED`
- terminal + grace 前不清、grace 后清
- 不清他 session marker
- 重复 worker 启动幂等
- 无 marker 时 `action:"none"`
- dispatch 可观测性

## 6. 合同变化

- **内部合同变化**：有 — Port 两阶段绑定（start → ready → credit）、
  `relay` 由可选改必需、producer `capture_error` 边界、新增 restart
  reconciler 与 access level。
- **公共合同变化**：**none**。未修改冻结 schema、fixture、FailureCode
  registry（20 码）、验收阈值、公共 API、Runtime endpoint、Origin、
  ticket TTL、Cookie/provider 合同、BVID 分母、grounded comprehension、
  SourceAuthority、Side Panel materialize ownership。

## 7. 严重度

| 级别 | 数量 | 内容 |
|---|---:|---|
| Fatal | 0 | — |
| Major | 0 | M-R1-C2-01..04 全部关闭 |
| Minor | 0 | m-R1-C2-01 关闭 |
| 待重冻结 | 1 | v10 verifier 45/50 + 14/15，见 §8 |

## 8. v10 verifier 现状（预期失败，等待 Codex 重冻结）

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

**逐项核验：8 个「缺失」code 全部仍存在于工作树**（每个 ≥1 个非测试文件），
本轮**零真实删除**：

| code | 存在于非测试文件数 |
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
抽取**的假象。漂移文件（均为 R1 必须改的）：

| 文件 | 原因 |
|---|---|
| `capture/MediaCaptureController.ts` | `relay` 改必需 + 删除 legacy fallback + `beginStop` |
| `entrypoints/media-capture-offscreen/main.ts` | 加载即 bootstrap Port + `capture_error` 边界 |

`unlisted emit`：新增 relay 模块不在冻结 11-scope 内，`relayContracts.ts`
发出 5 个 boundary code。mutation 唯一失败是对照用例（基线本身失败）。

以上属 Codex 冻结权限。ClaudeCode 未修改任何冻结证据。

## 9. 下一门禁

Codex 检查本轮实现事实（含真实 entrypoint composition 与 restart
reconciliation）→ 更新冻结 source scope / hash / inventory → 重跑
contract verifier 50/50 与 mutation verifier 15/15。在此之前不进入 R2。
