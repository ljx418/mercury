# WP0 R2 测试结果（2026-10-17）

Candidate: `wp0-r2-2026-10-17`
状态：**R2 AWAITING CODEX CHECKPOINT**

## 1. 全部命令与退出码

| # | 命令 | 退出码 | 结果 |
|---:|---|---:|---|
| 1 | `npm run typecheck` | 0 | PASS |
| 2 | `npx vitest run src/modules/media_companion/tests/ --maxWorkers=2` | 0 | **194 / 194**（22 files） |
| 3 | `npx vitest run --maxWorkers=2` | 0 | **527 / 527**（66 files） |
| 4 | `npm run build` | 0 | PASS（Σ 4.66 MB） |
| 5 | `node --test scripts/stage_b_b5_3/test/relay_ownership_contract.node-test.mjs` | 0 | **28 / 28** |
| 6 | `pytest tests/test_wp0_r1_relay_barrier.py -q` | 0 | **6 / 6** |
| 7 | `pytest -k "capture or transcript or outline or fault or product" -q` | 0 | **180 passed** / 537 deselected |
| 8 | `verify-...-v10-contract.py` | **0** | **50 / 50**（sourceInventoryDiff 40/40，unlisted `{}`） |
| 9 | `verify-...-v10-mutations.py` | **0** | **15 / 15** |

> 与 R1 不同，本轮两个 v10 verifier 均为 **exit 0**：Codex 已完成受限重冻结，
> 且 R2 只修改 target（relay 实现）文件，未触及冻结 source scope。

## 2. R2 新增与扩展测试

| 文件 | 状态 | 用例 | 覆盖 |
|---|---|---:|---|
| `tests/RelayR2Invariants.test.ts` | **新增** | **28** | R2-1 sender 矩阵 5 组 / R2-2 PCM-Base64 4 组 / R2-3 credit-sequence 3 组 / R2-4 bounded queue 4 组 / R2-5 disconnect-timeout-stop 7 组 / R2-8 无状态继承 2 组 |
| `scripts/.../relay_ownership_contract.node-test.mjs` | 扩展 | 25 → **28** | 新增 R2-5（owner 时长/字节上限 + 检查位置早于入队）、R2-1（精确 URL、frameId absent-or-0）、R2-3/R2-4（ACK 驱动 credit、admitChunk 早于 push） |
| `capture/RuntimeCaptureTransport.ts` | **最小修改** | — | 新增 `#totalRawBytes` 计数 + 两个 owner 侧上限检查（见 receipt §2） |

## 3. R1 回归（全部保持通过）

| 套件 | 用例 |
|---|---:|
| `RuntimeCaptureRelayContracts.test.ts` | 20 |
| `RuntimeCaptureTransport.test.ts` | 30 |
| `RelayTwoEndHarness.test.ts` | 5 |
| `RelayRestartHarness.test.ts` | 8 |
| `RelayRestartReconciliation.test.ts` | 22 |
| `RuntimeRelayRecoveryAdapter.test.ts` | 12 |
| `OffscreenEntrypointComposition.test.ts` | 3 |
| `MediaCaptureController.test.ts` | 11 |

## 4. 计数汇总

| 类别 | 计数 |
|---|---:|
| R2 新增不变量测试 | **28** |
| 静态所有权合同 | **28** |
| media_companion 子树 | **194**（22 files） |
| 扩展全量 | **527**（66 files） |
| Runtime barrier | 6 |
| Runtime focused | 180 |
| v10 baseline / mutation | **50 / 50** · **15 / 15** |

## 5. R2 修复的直接验证

R2 唯一真实缺口：`maxCaptureMs` / `maxCaptureBytes` 在冻结合同中存在但
从未被 owner 强制执行，且 R1-C2-1 已移除 Offscreen 本地计时器。

直接验证：

| 用例 | 结果 |
|---|---|
| `enforces the frozen capture duration bound at the owner`（clock 推进过 `maxCaptureMs` 后下一 chunk） | `DURATION_LIMIT` |
| 静态：`RELAY_V10.maxCaptureBytes` / `maxCaptureMs` 均在 `#queue.push` 之前 | 通过 |
| 静态：使用冻结 `BYTE_LIMIT` / `DURATION_LIMIT` 码 | 通过 |
| 冻结常量值 `maxCaptureBytes === 536_870_912` | 通过 |

## 6. Chrome / Provider / 六视频 / 声音

| 项 | 次数 |
|---|---:|
| Chrome 启动 | **0** |
| Provider 请求 | **0** |
| 六视频 fresh run | **0** |
| 真实产品 run | **0** |
| 声音播放 | **0** |
| 可见 Chrome / 原生弹窗 / 焦点抢占 / UIAutomation | **0** |

R2 未需要任何浏览器，因此未触发「先通知用户」的前置条件。

## 7. secret / raw-media / private-path scan

- 无 Cookie / API key / 凭据 / 原始音视频 / 绝对私有路径进入源码或证据。
- 新增测试断言 Offscreen 消息序列化结果**不含** ticket
  （`"t".repeat(43)`）、`portal:bilibili`（sourceIdentity）、`mar_`
  （acquisitionRecordId）。
- 未新增任何 token 持久化；R1 的静态门禁继续通过。
- 全部测试使用 `os.tmpdir()` / `tmp_path` 沙箱并清理。
