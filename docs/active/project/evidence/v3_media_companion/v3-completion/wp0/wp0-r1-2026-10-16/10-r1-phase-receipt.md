# WP0 R1 Phase Receipt — Background Capture Transport（2026-10-16）

Candidate: `wp0-r1-2026-10-16`
状态：**R1 NO-GO（1 Major：冻结 v10 证据与 R1 必然迁移冲突）**。R2 未启动。
依据：`00-codex-r1-transport-gap-decision.md`（SHA-256 `ed9b42b2aef4e3374eaeb2d6a14bcab34d99d93f97e6e5e84b37bcea7cdedbf2`）

## 1. R1 实施完成内容

### 1.1 Background 成为 Runtime capture WebSocket 唯一 owner

| 文件 | 职责 |
|---|---|
| `src/modules/media_companion/capture/relayContracts.ts`（新增） | 冻结参数、20 个 relay failure code 闭集、restart marker 五阶段、Port 消息类型常量、sender 五字段 + `getContexts` 校验 |
| `src/modules/media_companion/capture/audioChunk.ts`（新增） | Base64 编解码、chunk envelope 校验、**enqueue 前** backpressure 准入、Runtime start payload |
| `src/modules/media_companion/capture/RuntimeCaptureTransport.ts`（新增） | WS 唯一 owner：start/`started`/chunk/ACK/stop/final/close/timeout；sequence；单信用窗口；队列与字节上限；quiesce/drain；restart marker；FailureCode 归一化 |
| `src/modules/media_companion/capture/OffscreenAudioPort.ts`（新增） | 固定 Port 唯一 owner；sender 校验；单 producer；credit 转发；disconnect 立即 abort |
| `entrypoints/background/index.ts`（修改） | 装配 transport + port；单一 `onConnect` 监听；`relayFacade` 注入 Controller |
| `src/modules/media_companion/capture/MediaCaptureController.ts`（修改） | 先取得 Runtime `started`，再一次性下发 streamId；stop 走 quiesce/drain |
| `entrypoints/media-capture-offscreen/main.ts`（重写） | 收敛为纯 PCM producer：getUserMedia / AudioContext / downsample / PCM16 / producer cleanup |

### 1.2 Offscreen 越权已清除

原 `main.ts` 的 `RUNTIME_WS_URL`、`new WebSocket(...)`、ticket/binding/sourceIdentity/
acquisitionRecordId 直发、终态等待、本地 MAX_CAPTURE_MS 传输超时全部删除。
streamId 只在 Background→Offscreen 的一次性 `start` 消息中出现，并在
`getUserMedia` settle 后释放。**无直连 Runtime 的 fallback**（无 `fetch` /
`XMLHttpRequest` / `sendBeacon` / 第二条 WebSocket）。

## 2. 验证结果

| 门槛 | 命令 | 退出码 | 结果 |
|---|---|---:|---|
| R1-G1..G6 静态所有权 | `node --test scripts/stage_b_b5_3/test/relay_ownership_contract.node-test.mjs` | 0 | **12 / 12 PASS** |
| R1-G7..G15 扩展单测 | `npx vitest run .../RuntimeCaptureTransport.test.ts .../RuntimeCaptureRelayContracts.test.ts .../OffscreenAudioPort.test.ts` | 0 | **47 / 47 PASS** |
| Controller 顺序 | `npx vitest run .../MediaCaptureController.test.ts` | 0 | **10 / 10 PASS** |
| R1-G16 Runtime barrier | `pytest tests/test_wp0_r1_relay_barrier.py` | 0 | **6 / 6 PASS** |
| extension typecheck | `npm run typecheck` | 0 | PASS |
| extension test | `npx vitest run --maxWorkers=2` | 0 | **61 files / 452 tests PASS** |
| extension build | `npm run build` | 0 | PASS（Σ 4.64 MB） |
| R1-G19 focused pytest | `pytest -k "capture or transcript or outline or fault or product"` | 0 | **180 passed** |
| **R1-G17 v10 baseline** | `verify-...-v10-contract.py` | **2** | **45 / 50 FAIL** |
| **R1-G17 v10 mutations** | `verify-...-v10-mutations.py` | **2** | **14 / 15 FAIL** |

## 3. 阻塞项：冻结 v10 证据与 R1 必然迁移冲突（Major）

### 3.1 现象

R1 的实施目标就是「把 Runtime capture WebSocket 从 Offscreen 迁到 Background」。
而冻结的 v10 fixture 恰好把**这两个被迁移的文件**钉进了 11-scope 权威清单：

| 冻结源文件 | 后果 |
|---|---|
| `src/modules/media_companion/capture/MediaCaptureController.ts` | SHA-256 漂移 |
| `entrypoints/media-capture-offscreen/main.ts` | SHA-256 漂移 |

verifier 行为（`verify-...-v10-contract.py:269-272`）：哈希漂移即**跳过该文件
的 AST 抽取**，因此：

- `sourceEvidenceHashesCurrent` = false
- `sourceScopeExtractorsValid` = false
- `sourceEmitSetEqualsFrozenInventory` = false（actual 32 vs frozen 40）
- `discoveredCodeUniverseClosed` = false
- 连锁：`unlistedSourceFilesEmitNoBoundaryCodes` = false

### 3.2 冻结 inventory 报 8 个 code 缺失的真实构成

逐项核验后：

| code | 真实状态 |
|---|---|
| `V3_MEDIA_CAPTURE_AUDIO_CONTEXT_SUSPENDED` | **真实删除**（原仅在 Offscreen `main.ts`，R1 改由 `RELAY_FAILURE_CODES.AUDIO_SHAPE_INVALID` 覆盖同一边界） |
| `V3_MEDIA_CAPTURE_CLEANUP_INCOMPLETE` | 仍存在（2 个非测试文件） |
| `V3_MEDIA_CAPTURE_PERMISSION_REQUIRED` | 仍存在 |
| `V3_MEDIA_CAPTURE_PREPARE_FAILED` | 仍存在 |
| `V3_MEDIA_CAPTURE_PREPARE_REQUIRED` | 仍存在 |
| `V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED` | 仍存在（`relayContracts.ts`） |
| `V3_MEDIA_CAPTURE_START_FAILED` | 仍存在（2 个非测试文件） |
| `V3_MEDIA_CAPTURE_TAB_INVALID` | 仍存在 |

即：7 个「缺失」是 skip 机制的假象，**只有 1 个 code 被真实删除**。

### 3.3 新增文件触发的 unlisted emit

`relayContracts.ts` 发出 5 个 boundary code，但不在冻结 11-scope 内：

```
V3_MEDIA_CAPTURE_BACKPRESSURE
V3_MEDIA_CAPTURE_PORT_DISCONNECTED
V3_MEDIA_CAPTURE_PORT_FORBIDDEN
V3_MEDIA_CAPTURE_PROTOCOL_INVALID
V3_MEDIA_CAPTURE_WORKER_RESTARTED
```

discoveryRoots 已覆盖
`apps/chrome-extension/src/modules/media_companion/capture/**/*.ts`，
因此新增 relay 模块必然进入扫描范围。

### 3.4 为什么 ClaudeCode 不能自行修复

Codex 判定文档 §6 明确禁止「修改冻结 schema、fixture、FailureCode registry」。
`03-master-roadmap.md §3` 同样规定「ClaudeCode不能代替这些冻结动作」。

可行的两条路径都属于 Codex 的冻结权限：

| 选项 | 内容 |
|---|---|
| (a) 重新冻结 | 更新 2 个漂移文件哈希、把 4 个新 relay 模块加入 11-scope、重算 40-code inventory、决定 `V3_MEDIA_CAPTURE_AUDIO_CONTEXT_SUSPENDED` 的去留 |
| (b) 还原实现 | 放弃 R1 迁移，回到 Offscreen 直连（与 `02-target-architecture-and-boundaries.md §3` 冻结不变量冲突，不可接受） |

ClaudeCode 不代选。

## 4. 严重度

| 级别 | 数量 | 内容 |
|---|---:|---|
| Fatal | 0 | — |
| **Major** | **1** | 冻结 v10 证据与 R1 迁移目标结构性冲突：45/50 + 14/15，需 Codex 重新冻结 |
| Minor | 2 | ① `V3_MEDIA_CAPTURE_AUDIO_CONTEXT_SUSPENDED` 被真实删除，需确认是否可由 `AUDIO_SHAPE_INVALID` 取代；② 1 个既有 `MediaCaptureController` 用例原断言 Offscreen 收到 ticket（正是 R1 要修的越权），已按新合同改写为「ticket 不得下发」+ 新增 2 个顺序用例 |

## 5. 合同变化

**none**。未修改公共 API、Runtime endpoint、Origin、ticket TTL、Cookie/provider、
BVID 分母、grounded comprehension、SourceAuthority、Side Panel materialize ownership、
冻结 schema / fixture / FailureCode registry / 验收阈值。

## 6. cleanup / secret scan

- 本轮未启动 Chrome、Runtime 长驻进程、Provider 请求或六视频 run
- 未播放任何声音；未使用任何浏览器实例（因此本轮无 `--mute-audio` 实际执行，
  但所有 Chrome 相关代码路径的 argv 仍含 `--mute-audio`，见
  `run_one_bvid.mjs` 与 canary 启动参数）
- 公开证据只含固定 code 名、仓库内相对路径与测试计数；无 Cookie、API key、
  凭据、原始音视频或绝对私有路径
- 结束前无遗留 vitest / uvicorn / node 进程

## 7. 下一阶段 prerequisite（R1 收口）

- [ ] Codex 处置 §3 的冻结冲突（重新冻结或裁定）
- [ ] `verify-...-v10-contract.py` 回到 50/50（退出码 0）
- [ ] `verify-...-v10-mutations.py` 回到 15/15（退出码 0）
- [ ] Codex 接受本 R1 checkpoint
- [ ] Codex 明确 `R2 may start`（本轮不进入 R2）

## 8. 本轮未做的事

- 未修改冻结 schema / fixture / FailureCode registry / 验收阈值
- 未回退或删除既有 V3-2/V3-3 实现
- 未启动 R2–R7、WP1、六视频 fresh run、Provider 请求
- 未执行可见 Chrome、原生权限弹窗、焦点抢占或 UIAutomation
- 未宣布 PASS，未承担独立外审，未 commit / push
