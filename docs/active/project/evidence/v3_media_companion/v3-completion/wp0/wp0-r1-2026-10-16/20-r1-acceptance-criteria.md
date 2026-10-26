# WP0 R1 验收标准 — Background Capture Transport（2026-10-16）

依据：`00-codex-r1-transport-gap-decision.md`（SHA-256 `ed9b42b2aef4e3374eaeb2d6a14bcab34d99d93f97e6e5e84b37bcea7cdedbf2`）

本文件只冻结 R1 门槛与复算命令。ClaudeCode 不得自行放宽；任一 FATAL/Major 立即停。

## 1. R1 验收门槛

| ID | 门槛 | 复算方式 |
|---|---|---|
| R1-G1 | Offscreen 源码中 `WebSocket`、`ws://`、`127.0.0.1`、Runtime URL、ticket、binding、sourceIdentity、acquisitionRecordId、`fetch` 全部为 0 | `node --test scripts/stage_b_b5_3/test/relay_ownership_contract.node-test.mjs` |
| R1-G2 | Offscreen 仅保留 getUserMedia / AudioContext / downsample / producer cleanup | 同上 |
| R1-G3 | Offscreen 无直连 Runtime 的 fallback | 同上 |
| R1-G4 | Background 恰好构造 1 个 Runtime capture WebSocket，恰好 1 个 `RuntimeCaptureTransport`、1 个 `OffscreenAudioPort` | 同上 |
| R1-G5 | 固定 Port `navia.mediaCapture.audio/v10`；两侧均不内联消息字面量 | 同上 |
| R1-G6 | 冻结参数不变：pcm_s16le/16kHz/mono/2B、raw ≤ 49152、encoded ≤ 65536、credit=1、in-flight=1、outstanding ≤ 32 chunks / 1572864 bytes | 同上 + vitest 冻结参数用例 |
| R1-G7 | 单 active task；start/stop/abort 幂等 | `npx vitest run src/modules/media_companion/tests/RuntimeCaptureTransport.test.ts` |
| R1-G8 | sender 五字段 + `runtime.getContexts` 正负例（13 例） | `npx vitest run src/modules/media_companion/tests/OffscreenAudioPort.test.ts` + `RuntimeCaptureRelayContracts.test.ts` |
| R1-G9 | sequence 从 0 严格递增；duplicate / out-of-order / negative / 非整数 / ACK 顺序错全部 fail closed | `RuntimeCaptureTransport.test.ts` |
| R1-G10 | 非法 Base64、声明长度不符、0 长度、超 raw 上限、奇数采样宽度全部 fail closed | 同上 |
| R1-G11 | credit 仅在 Runtime `chunkAccepted` 后返还；in-flight ≤ 1 | 同上 |
| R1-G12 | queue/bytes 超限在 **enqueue 前** abort，无静默丢块 | 同上 |
| R1-G13 | quiesce → drain → Offscreen stopped → Runtime finalize 顺序；stop 前不发 Runtime stop；quiesce 后拒绝新 chunk | 同上 |
| R1-G14 | restart marker 五阶段、TTL 1080000ms 不刷新、字段仅 6 个且无 ticket/streamId/PCM/cookie/路径 | 同上 |
| R1-G15 | FailureCode 归一化到闭集 20；未知串（含路径/密钥）折叠为固定码 | 同上 |
| R1-G16 | Runtime ownership barrier：worker 不早启、barrier 失败无 worker/无 receipt/无 staged audio、manifest canonical + receipt 绑定、cleanup owner 唯一且幂等、recovery 无 receipt 或 manifest 篡改 fail closed | `pytest tests/test_wp0_r1_relay_barrier.py` |
| R1-G17 | 冻结 schema / fixture / FailureCode registry / 验收阈值 / 公共 API / Runtime endpoint / Origin / ticket TTL / Cookie-provider / BVID 分母 / grounded comprehension / SourceAuthority / Side Panel materialize ownership 均未改 | `verify-...-v10-contract.py` 50/50 + `verify-...-v10-mutations.py` 15/15 |
| R1-G18 | extension typecheck / test / build 全绿 | `npm run typecheck` / `npm test` / `npm run build` |
| R1-G19 | capture/transcript/outline/fault/product focused pytest 全绿 | `pytest -k "capture or transcript or outline or fault or product"` |
| R1-G20 | 公开证据 secret / raw-media / private-path 0 hit；owned process/port/temp 清理为 0 | 交接报告 |

## 2. 复算命令

```bash
cd /mnt/c/workSpace/navia

# R1 静态所有权合同
node --test scripts/stage_b_b5_3/test/relay_ownership_contract.node-test.mjs

# R1 扩展单测
cd apps/chrome-extension
npx vitest run src/modules/media_companion/tests/RuntimeCaptureRelayContracts.test.ts \
                 src/modules/media_companion/tests/RuntimeCaptureTransport.test.ts \
                 src/modules/media_companion/tests/OffscreenAudioPort.test.ts
npm run typecheck && npm test && npm run build

# R1 Runtime barrier
cd ../../services/local-runtime
PYTHONPATH=. ./.venv/bin/python -m pytest tests/test_wp0_r1_relay_barrier.py -q
PYTHONPATH=. ./.venv/bin/python -m pytest tests/ -k "capture or transcript or outline or fault or product" -q

# 冻结合同复算
cd /mnt/c/workSpace/navia
python3 docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v10-contract.py
python3 docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v10-mutations.py
```

## 3. 禁止事项（与判定文档 §6 一致）

- 不回退既有 V3-2/V3-3 实现
- 不修改公共 API / Runtime endpoint / Origin / ticket TTL / Cookie-provider /
  BVID 分母 / grounded comprehension / SourceAuthority / Side Panel materialize
- 不让 Offscreen 保留第二条 WebSocket 或「失败时直连 Runtime」fallback
- 不降低 sender validation / backpressure / restart / cleanup / secret scan 门槛
- 不把 R1 单测通过扩大解释为 R5 canary、R7 immutable candidate 或 V3 完成
- 不进入 R2

## 4. 出门条件

R1-G1..G20 全绿 → 落盘 phase receipt / 测试结果 / PRD 检视 / handoff → 在 R1
checkpoint 停止，等待 Codex 验收。
