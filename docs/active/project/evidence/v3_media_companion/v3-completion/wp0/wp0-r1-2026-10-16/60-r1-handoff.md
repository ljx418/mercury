# WP0 R1 Handoff（2026-10-16）

Candidate: `wp0-r1-2026-10-16`
阶段结论：**R1 NO-GO（1 Major）**。R2–R7 未启动。
证据目录：`docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r1-2026-10-16/`

## 1. changed files

### 新增

```
apps/chrome-extension/src/modules/media_companion/capture/relayContracts.ts
apps/chrome-extension/src/modules/media_companion/capture/audioChunk.ts
apps/chrome-extension/src/modules/media_companion/capture/RuntimeCaptureTransport.ts
apps/chrome-extension/src/modules/media_companion/capture/OffscreenAudioPort.ts
apps/chrome-extension/src/modules/media_companion/tests/RuntimeCaptureRelayContracts.test.ts
apps/chrome-extension/src/modules/media_companion/tests/RuntimeCaptureTransport.test.ts
apps/chrome-extension/src/modules/media_companion/tests/OffscreenAudioPort.test.ts
scripts/stage_b_b5_3/test/relay_ownership_contract.node-test.mjs
services/local-runtime/tests/test_wp0_r1_relay_barrier.py
docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r1-2026-10-16/10-r1-gap-analysis.md
docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r1-2026-10-16/20-r1-acceptance-criteria.md
docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r1-2026-10-16/10-r1-phase-receipt.md
docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r1-2026-10-16/40-r1-test-results.md
docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r1-2026-10-16/50-r1-prd-review.md
docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r1-2026-10-16/60-r1-handoff.md
```

### 修改

```
apps/chrome-extension/entrypoints/background/index.ts
apps/chrome-extension/entrypoints/media-capture-offscreen/main.ts
apps/chrome-extension/src/modules/media_companion/capture/MediaCaptureController.ts
apps/chrome-extension/src/modules/media_companion/capture/index.ts
apps/chrome-extension/src/modules/media_companion/tests/MediaCaptureController.test.ts
apps/chrome-extension/chrome-mv3-unpacked/**   （npm run build 产物）
```

### 未修改

`services/local-runtime/navia_runtime/**`、冻结 schema / fixture / contracts、
`docs/active/project/01-prd.md` 等权威文档、`stage-b-six-video-registry.json`、
`v3-claudecode-implementation-2026-10-15/` 交接包载荷（16 项 SHA-256 一致）。

## 2. 合同变化

**none**。

## 3. 全部命令与退出码

| # | 命令 | 退出码 | 结果 |
|---:|---|---:|---|
| 1 | `node --test scripts/stage_b_b5_3/test/relay_ownership_contract.node-test.mjs` | 0 | 12 / 12 PASS |
| 2 | `npx vitest run .../RuntimeCaptureRelayContracts.test.ts .../RuntimeCaptureTransport.test.ts .../OffscreenAudioPort.test.ts` | 0 | 47 / 47 PASS |
| 3 | `npx vitest run .../MediaCaptureController.test.ts` | 0 | 10 / 10 PASS |
| 4 | `pytest tests/test_wp0_r1_relay_barrier.py` | 0 | 6 / 6 PASS |
| 5 | `npm run typecheck` | 0 | PASS |
| 6 | `npx vitest run --maxWorkers=2` | 0 | 61 files / 452 tests PASS |
| 7 | `npm run build` | 0 | PASS（Σ 4.64 MB） |
| 8 | `pytest -k "capture or transcript or outline or fault or product"` | 0 | 180 passed |
| 9 | `verify-...-v10-contract.py` | **2** | **45 / 50 FAIL** |
| 10 | `verify-...-v10-mutations.py` | **2** | **14 / 15 FAIL** |

## 4. 真实 run / build / task / candidate ID

- 真实产品 run：**未执行**（R1 原则上不要求六视频真实 run）
- Chrome：**未启动**（无可见浏览器、无焦点抢占、无 UIAutomation）
- Runtime：pytest 进程内启动，无长驻服务
- task ID：**无**
- candidate ID：`wp0-r1-2026-10-16`（**非** immutable candidate；R7 才产出）

## 5. PRD 覆盖

见 `50-r1-prd-review.md`。R1 只覆盖 relay transport 所有权迁移；V3-2 的
trusted tabCapture ASR、SenseVoice、cleanup barrier 仍由 WP1/WP6 验收，
本轮不推进任何 PRD 范围的阶段结论。

## 6. cleanup / secret scan

- Chrome 启动次数：**0**；Provider 请求次数：**0**；六视频 fresh run：**未启动**
- 结束前无遗留 vitest / uvicorn / node 进程
- 公开证据只含固定 code 名、仓库内相对路径、测试计数与 SHA-256；
  **无** Cookie 值、API key、凭据、原始音视频或绝对私有路径
- 所有 Chrome 相关 argv 仍显式含 `--mute-audio`

## 7. 剩余风险

**Fatal 0 / Major 1 / Minor 2**

### Major：冻结 v10 证据与 R1 迁移目标结构性冲突

R1 的实施目标就是迁走 Offscreen 的 WebSocket，而冻结 fixture 恰好把
`MediaCaptureController.ts` 与 `media-capture-offscreen/main.ts` 钉进
11-scope 权威清单。verifier 在哈希漂移时跳过整文件 AST 抽取，连锁产生
45/50 与 14/15；另有 4 个新 relay 模块触发
`unlistedSourceFilesEmitNoBoundaryCodes`（`relayContracts.ts` 发出 5 个
boundary code）。

需 Codex 处置（ClaudeCode 不得自行冻结）：
1. 更新 2 个漂移文件哈希；
2. 把 `relayContracts.ts` / `audioChunk.ts` / `RuntimeCaptureTransport.ts` /
   `OffscreenAudioPort.ts` 加入 11-scope；
3. 重算 40-code inventory；
4. 裁定 `V3_MEDIA_CAPTURE_AUDIO_CONTEXT_SUSPENDED`（唯一真实删除的 code）
   的去留。

### Minor 1：`V3_MEDIA_CAPTURE_AUDIO_CONTEXT_SUSPENDED` 真实删除

R1 改写 Offscreen 音频上下文检查时改用
`RELAY_FAILURE_CODES.AUDIO_SHAPE_INVALID`；需 Codex 确认该取代可接受。

### Minor 2：既有 Controller 用例按新合同改写

`MediaCaptureController.test.ts` 原断言
`sendOffscreenMessage` 携带 `ticket` —— 正是 R1 要修的越权。已改为断言
ticket / binding / sourceIdentity / acquisitionRecordId **不得**下发，
并新增 2 个用例：Runtime `started` 必须早于 streamId 下发；Runtime 未
started 时不得下发 streamId。

## 8. 自动化开发停止原因

R1 实施与自验证完成（R1-G1..G16、R1-G18、R1-G19 全绿），但 R1-G17 要求
v10 verifier 回到 50/50 与 15/15，实测 45/50 与 14/15，且根因是 R1 的迁移
目标与冻结 fixture 结构性冲突。修复该冲突需要改动冻结 fixture / FailureCode
registry / 权威 scope，属 Codex 冻结权限
（`00-codex-r1-transport-gap-decision.md` §6、`03-master-roadmap.md §3`）。
故在 R1 停止，不进入 R2，等待 Codex 验收与冻结处置。

## 9. 下一门禁

Codex 处置冻结冲突 → verifier 回到 50/50 + 15/15 → Codex 接受 R1 checkpoint
→ Codex 明确 `R2 may start`。
