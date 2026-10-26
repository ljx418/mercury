# WP0 R1 第二轮纠偏测试结果（2026-10-16）

Candidate: `wp0-r1-corrective-round2-2026-10-16`
状态：**R1 AWAITING CODEX REFREEZE**

## 1. 全部命令与退出码

| # | 命令 | 退出码 | 结果 |
|---:|---|---:|---|
| 1 | `npm run typecheck` | 0 | PASS |
| 2 | `npx vitest run src/modules/media_companion/tests/` | 0 | **146 / 146**（20 files） |
| 3 | `npx vitest run --maxWorkers=2` | 0 | **479 / 479**（64 files） |
| 4 | `npm run build` | 0 | PASS（Σ 4.65 MB） |
| 5 | `node --test scripts/stage_b_b5_3/test/relay_ownership_contract.node-test.mjs` | 0 | **22 / 22** |
| 6 | `pytest tests/test_wp0_r1_relay_barrier.py -q` | 0 | **6 / 6** |
| 7 | `pytest -k "capture or transcript or outline or fault or product" -q` | 0 | **180 passed** / 537 deselected |
| 8 | `verify-...-v10-contract.py` | **2** | **45 / 50**（待 Codex 重冻结） |
| 9 | `verify-...-v10-mutations.py` | **2** | **14 / 15**（待 Codex 重冻结） |

> 全量 64 files / 479 tests 一次性通过，0 error。

## 2. 新增 harness 用例计数

| harness | 用例 | 覆盖 |
|---|---:|---|
| **`OffscreenEntrypointComposition.test.ts`** | **3** | 真实 entrypoint composition：① 文档加载即连冻结 Port（`connectCalls===1`）、listener 早于 post，无循环；② 完整首采集 accept → Runtime start → `start` → `ready` → 首个 `chunk_credit`（同 captureSessionId）→ credited chunk 抵达 Runtime；③ producer START 失败 → 恰好一个 `capture_error` → Background 归一化为 `V3_MEDIA_CAPTURE_AUDIO_SHAPE_INVALID`，内部码不越界 |
| **`RelayRestartReconciliation.test.ts`** | **16** | 新实例读取旧 store：access level 先设为 `TRUSTED_CONTEXTS`；marker 校验（canonical + 8 禁止字段 + schemaVersion/sessionId/taskId/phase/非对象）；五 phase dispatch（connecting→delete+get，其余→get）；过期 marker fail-closed 零 dispatch；非法 marker fail-closed + `WORKER_RESTARTED`；Runtime 不可用保留 marker + `RUNTIME_DISCONNECTED`；terminal+grace 前不清/后清；不清他 session；重复启动幂等；无 marker→none；dispatch 可观测 |

**合计新增 19 例。**

## 3. R1 静态所有权合同（22 例）

| 分组 | 覆盖 |
|---|---|
| Offscreen 无所有权 | 不构造 WebSocket；无 `127.0.0.1`/`ws://`/`wss://`/`capture-stream`/`RUNTIME_*`；不处理 ticket/binding/sourceIdentity/acquisitionRecordId；无 `fetch`/`XMLHttpRequest`/`sendBeacon` |
| Offscreen 控制面 | 保留 getUserMedia/AudioContext/downsample/teardown；受 credit 约束；**无 onMessage start/stop**，仅 ping；getUserMedia 仅由 Port `START` 驱动 |
| **R1-C2-1** | 加载时 `ensurePort()`（模块级）；使用共享 bootstrap；bootstrap 内 listener 早于 return |
| **R1-C2-2** | `relay:` 必需（非 `relay?:`）；无 `command:"start"`/`command:"stop"`；`beginStop` 早于 `sendQuiesce` |
| **R1-C2-3** | Background 构造 reconciler + `setAccessLevel` + `void reconcile()`；reconciler 用 `TRUSTED_CONTEXTS`；**无** `restorePcm`/`resumeTicket`/`resumeSequence`/`restoreTicket` |
| **R1-C2-4** | START 分支 catch → teardown → 发 `capture_error` |
| **冻结九消息** | 9 个消息全部声明；capture 模块**零**内联 `navia.mediaCapture.audio/v10:` 字面量 |
| Background 唯一 owner | 恰好 1 WebSocket + 1 transport + 1 port；冻结 Port 常量 |
| 冻结参数 | 13 项 limits + 3 项 audioConfig |
| marker 身份 | schemaVersion / `cap_`+32 / `TRUSTED_CONTEXTS` / `chrome.storage.session` |
| 诊断归一化 | 内部码存在且映射到公开码 |

## 4. R1 相关 Vitest 细分（media_companion 子树 146 例）

| 文件 | 用例 |
|---|---:|
| `RuntimeCaptureRelayContracts.test.ts` | 20 |
| `RuntimeCaptureTransport.test.ts` | 30 |
| `RelayTwoEndHarness.test.ts` | 5 |
| `RelayRestartHarness.test.ts` | 8 |
| `OffscreenEntrypointComposition.test.ts` | **3（新增）** |
| `RelayRestartReconciliation.test.ts` | **16（新增）** |
| `MediaCaptureController.test.ts` | 11 |
| 其余既有 media_companion 测试 | 53 |

## 5. Runtime barrier（6 例）与 focused（180 例）

不变：worker 不早启、barrier 失败无 worker/receipt/staged audio、manifest
canonical + receipt 绑定、cleanup owner 唯一且幂等、recovery 缺 receipt 或
manifest 篡改 fail closed。

## 6. v10 verifier（预期失败）

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

**8 个「缺失」code 逐项核验：全部仍存在于工作树**（每个 ≥1 个非测试文件，
最多 3 个）→ 本轮**零真实删除**。根因是 verifier 在 2 个 R1 必须改的冻结
scope 文件哈希漂移时**跳过整文件 AST 抽取**，加新增 relay 模块未入 11-scope
触发 `unlistedSourceFilesEmitNoBoundaryCodes`。mutation 唯一失败是对照用例
（基线本身失败）。**全部属冻结证据漂移，非实现缺陷。**

## 7. secret / raw-media / private-path scan

- Chrome 启动 **0** 次；Provider 请求 **0** 次；六视频 fresh run **未启动**
- 未播放任何声音；未启动任何浏览器实例
- 全部 vitest / node:test / pytest 使用 `os.tmpdir()` / `tmp_path` 沙箱并清理
- 结束前无遗留 vitest / uvicorn / node 进程
- 本轮新增/修改源码**不含**任何 Cookie 值、API key、凭据、原始音视频或
  绝对私有路径；producer `capture_error` 只传内部诊断 code，Background
  归一化后才出界，异常文本不出边界
- 公开证据只含固定 code 名、仓库内相对路径、测试计数与 SHA-256
