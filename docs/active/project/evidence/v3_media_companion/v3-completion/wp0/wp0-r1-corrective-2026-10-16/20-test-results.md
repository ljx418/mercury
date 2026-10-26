# WP0 R1 纠偏测试结果（2026-10-16）

Candidate: `wp0-r1-corrective-2026-10-16`
状态：**R1 AWAITING CODEX REFREEZE**

## 1. 命令与退出码

| # | 命令 | 退出码 | 结果 |
|---:|---|---:|---|
| 1 | `node --check`（`npm run typecheck`） | 0 | PASS |
| 2 | `node --test scripts/stage_b_b5_3/test/relay_ownership_contract.node-test.mjs` | 0 | **17 / 17 PASS** |
| 3 | `npx vitest run src/modules/media_companion/tests/` | 0 | **128 / 128 PASS**（18 files） |
| 4 | `npx vitest run --maxWorkers=2`（全量） | 0 | **461 / 461 PASS**（62 files） |
| 5 | `npm run build` | 0 | PASS（Σ 4.65 MB） |
| 6 | `pytest tests/test_wp0_r1_relay_barrier.py -q` | 0 | **6 / 6 PASS** |
| 7 | `pytest -k "capture or transcript or outline or fault or product" -q` | 0 | **180 passed** / 537 deselected |
| 8 | `verify-...-v10-contract.py` | **2** | **45 / 50**（待 Codex 重冻结） |
| 9 | `verify-...-v10-mutations.py` | **2** | **14 / 15**（待 Codex 重冻结） |

> 全量首跑曾出现 1 error（宿主内存压力：available 2.4 GB / swap 耗尽）。
> 复跑 `62 files / 461 tests / 0 errors`，确认非实现缺陷。

## 2. R1 相关 Vitest 细分

| 文件 | 退出码 | 用例 | 覆盖 |
|---|---:|---:|---|
| `RuntimeCaptureRelayContracts.test.ts` | 0 | 20 | 9 个冻结消息、方向、capture_error 取代 failed、chunk_credit、13 项 limits/audioConfig、session id 格式、归一化（含内部码→公开码、未知串折叠）、marker schema/字段/相变/禁止字段、sender 精确 URL + frameId absent-or-0 + getContexts/incognito |
| `RuntimeCaptureTransport.test.ts` | 0 | 30 | started 门控、session 绑定与 BINDING_MISMATCH、第二 start 拒绝、sequence 全类拒绝、raw 长度上下界、奇数采样宽度、Base64/长度不符、in-flight≤1、ACK 返 credit、ACK 序列错、chunk/byte 上限 enqueue 前 abort、**ACK timeout**、原子 stop + 首个 reason 冻结、producer 不得自发 finalize、drain 门、quiesce 后拒收、finalize 失败/无 transcript、**正常 disconnect 不 abort / 异常 disconnect fail closed / close reason 保留码**、marker 五阶段/TTL 不刷新/6 字段/clear |
| `RelayTwoEndHarness.test.ts` | 0 | 5 | **双端真实协议 harness**（真实 `OffscreenAudioPort` + 真实 `RuntimeCaptureTransport` 接入 fake Port/Socket）：`ready→start→credit→chunk→ACK→credit→quiesce→quiesced→stopped→finalize` 全序列；replacement Port 拒绝；无 credit 拒发；AudioContext 内部码归一化；正常 disconnect |
| `RelayRestartHarness.test.ts` | 0 | 8 | **restart harness**：五阶段落盘、模拟重启后读回、TTL 不刷新（+1,080,000）、五相变、禁止字段污染、过期 marker 判定、clear 规则、**他 session marker 存活** |
| `MediaCaptureController.test.ts` | 0 | 10 | Offscreen 只收 streamId（ticket/binding/sourceIdentity/acquisitionRecordId 均 undefined）、Runtime `started` 早于 streamId、Runtime 未 started 时不下发 |

## 3. R1 静态所有权合同（17 例）

| 分组 | 覆盖 |
|---|---|
| Offscreen 无所有权 | 不构造 WebSocket；无 `127.0.0.1`/`ws://`/`wss://`/`capture-stream`/`RUNTIME_*`；不处理 ticket/binding/sourceIdentity/acquisitionRecordId；无 `fetch`/`XMLHttpRequest`/`sendBeacon` |
| Offscreen 控制面 | 保留 getUserMedia/AudioContext/downsample/teardown；**受 credit 约束**；**无 onMessage start/stop**，仅 stateless ping；getUserMedia 仅由 Port `START` 驱动 |
| Background 唯一 owner | 恰好 1 个 `new WebSocket` 且指向冻结 endpoint；恰好 1 transport + 1 port；以冻结 Port 常量为连接门 |
| 冻结参数 | 13 项 limits + 3 项 audioConfig 全部 pin |
| marker 身份 | `v3-media-capture-restart-marker/v10`；`cap_` + 32 base64url；`TRUSTED_CONTEXTS`；`chrome.storage.session` |
| marker 持久化 | Background 存在 `storage.session.set` / `.remove` |
| 诊断归一化 | 内部码存在于 source inventory 且映射到公开码；Offscreen 确实发出内部码 |

## 4. Runtime barrier（6 例，不变量）

| 用例 | 证明 |
|---|---|
| `test_worker_cannot_start_before_the_ownership_receipt_is_committed` | `create()` 返回时 receipt 已落库、ASR 未运行 |
| `test_barrier_failure_leaves_no_worker_no_receipt_and_no_staged_audio` | barrier 失败 → 无 worker/无 receipt/无 staged audio |
| `test_ownership_manifest_is_canonical_and_bound_to_the_durable_receipt` | manifest canonical 字节 + receipt digest 绑定 + 无残留临时文件 |
| `test_cleanup_owner_hands_over_exactly_once_after_the_barrier` | cleanup 幂等，receipt 恰好释放一次 |
| `test_recovery_cleanup_requires_the_authoritative_receipt` | 缺 receipt → `V3_MEDIA_TRANSCRIPT_CLEANUP_INCOMPLETE` |
| `test_recovery_cleanup_rejects_a_tampered_manifest` | manifest 篡改 → 同上 fail closed |

## 5. v10 verifier（预期失败）

```
verify-...-v10-contract.py  exit 2  45/50
  failed: sourceEvidenceHashesCurrent, sourceScopeExtractorsValid,
          sourceEmitSetEqualsFrozenInventory,
          unlistedSourceFilesEmitNoBoundaryCodes,
          discoveredCodeUniverseClosed
  sourceInventoryDiff: actual 32 vs frozen 40（missing 8 / extra 0）
verify-...-v10-mutations.py exit 2  14/15
```

**8 个「缺失」code 逐项核验：全部仍存在于工作树**（每个 ≥1 个非测试文件）
→ 本轮**零真实删除**。「缺失」完全是 verifier 在 2 个冻结 scope 文件哈希
漂移时**跳过整文件 AST 抽取**的假象。

漂移文件（2 个，均为 R1 必然要改）：`capture/MediaCaptureController.ts`
（原子 stop 边界）、`entrypoints/media-capture-offscreen/main.ts`（收敛为纯
producer）。

unlisted emit：4 个新 relay 模块不在冻结 11-scope，`relayContracts.ts`
发出 5 个 boundary code。

## 6. cleanup / secret scan

- Chrome 启动 **0** 次；Provider 请求 **0** 次；六视频 fresh run **未启动**
- 全部 vitest / node:test / pytest 使用 `os.tmpdir()` / `tmp_path` 沙箱并在
  结束时清理
- 结束前无遗留 vitest / uvicorn / node 进程
- 公开证据只含固定 code 名、仓库内相对路径、测试计数与 SHA-256；
  **无** Cookie、API key、凭据、原始音视频或绝对私有路径
- 本轮未播放任何声音，未启动任何浏览器实例（故无 `--mute-audio` 实际执行；
  所有 Chrome 相关 argv 仍显式含 `--mute-audio`）
