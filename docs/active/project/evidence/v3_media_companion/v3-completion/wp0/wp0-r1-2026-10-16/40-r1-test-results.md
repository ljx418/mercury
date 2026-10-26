# WP0 R1 测试结果（2026-10-16）

Candidate: `wp0-r1-2026-10-16`

## 1. 扩展单测（vitest）

| 文件 | 退出码 | 结果 |
|---|---:|---|
| `npx vitest run .../RuntimeCaptureRelayContracts.test.ts` | 0 | 19 / 19 PASS |
| `npx vitest run .../RuntimeCaptureTransport.test.ts` | 0 | 28 / 28 PASS |
| `npx vitest run .../OffscreenAudioPort.test.ts` | 0 | 11 / 11 PASS |
| `npx vitest run .../MediaCaptureController.test.ts` | 0 | 10 / 10 PASS |
| `npx vitest run --maxWorkers=2`（全量） | 0 | **61 files / 452 tests PASS** |

> 全量首次运行出现 5 项 ENOMEM/timeout 失败（`e2e/validate-v2-external-brain-productization-report.test.mjs`
> 与 `src/modules/knowledge_workspace/PermissionRootManager.test.ts`，均非本轮改动文件）。
> 两文件单独重跑均 PASS，确认是宿主内存压力（available 2.2 GB / swap 耗尽），
> 以 `--maxWorkers=2` 限并发后全量 452/452 PASS。

## 2. R1 静态所有权合同（node:test）

`node --test scripts/stage_b_b5_3/test/relay_ownership_contract.node-test.mjs` → 退出码 0，**12 / 12 PASS**

| # | 用例 |
|---|---|
| 1 | Offscreen 不构造 WebSocket（`new WebSocket` / `WebSocket.` / `readyState` 均 0） |
| 2 | Offscreen 不含 `127.0.0.1` / `ws://` / `wss://` / `capture-stream` / `RUNTIME_WS` / `RUNTIME_URL` |
| 3 | Offscreen 不处理 ticket / binding / sourceIdentity / acquisitionRecordId |
| 4 | Offscreen 保留 getUserMedia / AudioContext / downsampleToPcm16 / stopProducer |
| 5 | Offscreen 无 `fetch` / `XMLHttpRequest` / `sendBeacon`（无直连 fallback） |
| 6 | Offscreen 使用冻结 Port 常量且不内联消息字面量 |
| 7 | Background 恰好构造 1 个 WebSocket 且指向 `ws://127.0.0.1:17861/v1/media/capture-stream` |
| 8 | Background 恰好 1 个 `RuntimeCaptureTransport` + 1 个 `OffscreenAudioPort` |
| 9 | Background 以冻结 Port 常量作为连接门 |
| 10 | Runtime WS URL 只出现在 Background，capture 模块内不硬编码 |
| 11 | 冻结参数（16kHz / mono / 2B / 49152 / 65536 / credit 1 / 32 / 1572864 / Port / 1080000）全部 pin |
| 12 | 冻结 20 个 relay target code 全部为 `V3_MEDIA_CAPTURE_*` |

## 3. R1 传输行为（vitest，RuntimeCaptureTransport）

| 分组 | 用例 | 结果 |
|---|---|---|
| 单 active task | 第二�� start → `ALREADY_ACTIVE`；start payload 冻结字段 | PASS |
| started 门控 | `started` 前 chunk → `PROTOCOL_INVALID`；Runtime `failed` → 归一化；未知串 → `RUNTIME_DISCONNECTED` | PASS |
| sequence | 严格递增 / duplicate / out-of-order / 负数 / 非整数全部 fail closed | PASS |
| Base64 + 长度 | 非法 Base64 / 声明长度不符 / 0 长度 / 超 raw 上限 / 奇数采样宽度 | PASS |
| 单信用窗口 | in-flight ≤ 1；仅 Runtime `chunkAccepted` 返还 credit；无 in-flight 时 ACK 拒绝 | PASS |
| backpressure | outstanding chunk 数超限 → enqueue 前 abort；字节数超限 → enqueue 前 abort | PASS |
| quiesce/drain | stop 前不发 Runtime stop；ACK 前不发；drain 后才发；quiesce 后拒绝新 chunk | PASS |
| finalize | Runtime `failed` → 固定码；`completed` 无 transcript → `FINALIZE_FAILED` | PASS |
| abort / Runtime 丢失 | abort 返回固定码；close → `RUNTIME_DISCONNECTED`；close reason 保留 relay 码 | PASS |
| restart marker | 五阶段齐备；TTL 1080000ms 不刷新；字段仅 6 个且无 ticket / streamId / PCM / cookie / 路径 | PASS |

## 4. R1 sender 校验（vitest）

`RuntimeCaptureRelayContracts.test.ts` 覆盖 sender 五字段 + `getContexts` 共 13 例：
规范 sender 通过；错误 extensionId / 缺 extensionId / 带 tab / URL 越界 /
缺 frameId / frameId 不符 / 缺 documentId / 0 个 OFFSCREEN_DOCUMENT /
2 个 OFFSCREEN_DOCUMENT / context documentId 不符 / incognito 不符 /
contextType 非 OFFSCREEN_DOCUMENT 全部 `PORT_FORBIDDEN`。

`OffscreenAudioPort.test.ts` 覆盖 Port 身份与 producer 生命周期 11 例：
错误 Port 名、并发第二 producer、无 sender facts、context 解析不到、
ready 前拒绝下发 streamId、Runtime started 前拒绝下发、
disconnect 立即 abort、Offscreen 伪造 start 被拒、quiesced/stopped 转发、
非法 chunk 转发为失败。

## 5. Controller 顺序（vitest）

| 用例 | 结果 |
|---|---|
| tab 复验 + Offscreen 只收 streamId（ticket/binding/sourceIdentity/acquisitionRecordId 均 undefined） | PASS |
| Runtime `started` 早于 streamId 解析（顺序断言 `["relay.start","streamId","relay.sendStart"]`） | PASS |
| Runtime 未 started 时不下发 streamId，返回固定码 | PASS |
| 错误 tab 绑定 / 后台发起 / 缺权限 fail closed | PASS |

## 6. Runtime ownership barrier（pytest）

`pytest tests/test_wp0_r1_relay_barrier.py` → 退出码 0，**6 / 6 PASS**

| 用例 | 证明的不变量 |
|---|---|
| `test_worker_cannot_start_before_the_ownership_receipt_is_committed` | `create()` 返回时 `ownership_committed` receipt 已落库；ASR 尚未运行；随后 `start()` 才起 worker |
| `test_barrier_failure_leaves_no_worker_no_receipt_and_no_staged_audio` | barrier 失败 → 无 receipt、无 worker、无 staged audio |
| `test_ownership_manifest_is_canonical_and_bound_to_the_durable_receipt` | manifest 字节为 canonical 序列化；receipt digest 等于 canonical SHA-256；无残留临时 manifest |
| `test_cleanup_owner_hands_over_exactly_once_after_the_barrier` | owner manifest 绑定 pid / processStartToken / state=staged；cleanup 幂等且 receipt 恰好释放一次 |
| `test_recovery_cleanup_requires_the_authoritative_receipt` | 缺 receipt → `V3_MEDIA_TRANSCRIPT_CLEANUP_INCOMPLETE` |
| `test_recovery_cleanup_rejects_a_tampered_manifest` | manifest 被改 → `V3_MEDIA_TRANSCRIPT_CLEANUP_INCOMPLETE` |

## 7. Runtime focused pytest

`pytest -k "capture or transcript or outline or fault or product"` → 退出码 0，**180 passed / 537 deselected**

## 8. 冻结 v10 verifier（**未通过**）

| 命令 | 退出码 | 结果 |
|---|---:|---|
| `verify-...-v10-contract.py` | 2 | **45 / 50 FAIL** |
| `verify-...-v10-mutations.py` | 2 | **14 / 15 FAIL** |

失败检查：

```
sourceEvidenceHashesCurrent            false
sourceScopeExtractorsValid             false
sourceEmitSetEqualsFrozenInventory     false   (actual 32 vs frozen 40)
unlistedSourceFilesEmitNoBoundaryCodes false
discoveredCodeUniverseClosed           false
```

根因与真实删除项的逐项核验见 `10-r1-phase-receipt.md` §3。
需 Codex 重新冻结，ClaudeCode 不得自行处置。

## 9. cleanup / secret scan

- Chrome 0 次、Provider 0 次、六视频 0 次
- pytest 全部使用 `tmp_path` 沙箱并在结束时清理
- 结束前无遗留 vitest / uvicorn / node 进程
- 公开证据只含固定 code 名、仓库内相对路径、测试计数；无 Cookie / 凭据 /
  原始媒体 / 绝对私有路径
