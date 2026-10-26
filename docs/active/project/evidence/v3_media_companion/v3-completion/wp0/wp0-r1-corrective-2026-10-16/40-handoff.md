# WP0 R1 纠偏 Handoff（2026-10-16）

Candidate: `wp0-r1-corrective-2026-10-16`
阶段结论：**R1 AWAITING CODEX REFREEZE**。R2–R7 未启动。
证据目录：`docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r1-corrective-2026-10-16/`

## 1. changed files（完整，含首轮遗留）

### 新增

```
apps/chrome-extension/src/modules/media_companion/capture/relayContracts.ts
  d09c43c46778ed4a70e96e397c2e25deb7052c8955688dc0fdd081cded2a693b
apps/chrome-extension/src/modules/media_companion/capture/audioChunk.ts
  dbfbf39f77ca34de9bce0ed95e29a8af030071a3c2bb8f0cc4b542f9c2f0e74b
apps/chrome-extension/src/modules/media_companion/capture/RuntimeCaptureTransport.ts
  d48352733e106d8109b24eccc43ea060933847699f7a1be4a0a01143887fbb99
apps/chrome-extension/src/modules/media_companion/capture/OffscreenAudioPort.ts
  ffa7968c17106636af5d7a7e46c092d0de195edc7c90449403439a47dc34a45b
apps/chrome-extension/src/modules/media_companion/capture/resolveCaptureGrantBinding.ts
  ba47be52448ccaeaaf737d18af1c9617caf6e31e8f8ade339bf23385125bab19
apps/chrome-extension/src/modules/media_companion/tests/RuntimeCaptureRelayContracts.test.ts
  703067cc8cf198bdca57a9894a06583ba1113b716284eb27089e199bb0f931d9
apps/chrome-extension/src/modules/media_companion/tests/RuntimeCaptureTransport.test.ts
  b045381852dcae51d34d7fe64d150c11dfd9d9a727733121c1ab118935a97ff9
apps/chrome-extension/src/modules/media_companion/tests/RelayTwoEndHarness.test.ts
  9a9cd32a32af368a8fb6ea16ca188de05f6c4978330eadd5a0c04023b58e933e
apps/chrome-extension/src/modules/media_companion/tests/RelayRestartHarness.test.ts
  ea04682596d57bd7b0a0388b277dc8422051e631dbe42bdfe8fe7e86c336cf1f
scripts/stage_b_b5_3/test/relay_ownership_contract.node-test.mjs
  5cbbe926180a76b57ddfa5fe19f1225a87904ceeb2b554270527fa1e67a9e9d4
services/local-runtime/tests/test_wp0_r1_relay_barrier.py
  e1d21d2f5f05162867621de779957cd18ad039bb475526d1585cb211417104d2
```

### 修改

```
apps/chrome-extension/entrypoints/background/index.ts
  5efebf4d8c3ca2a55edfb218746101d85a74a486d2a737594a8618539b640fd7
apps/chrome-extension/entrypoints/media-capture-offscreen/main.ts
  74acc17551b8d175654e4bfa7b2a93de44ae2cf14fa4b9a0dac3ced79149e5db
apps/chrome-extension/src/modules/media_companion/capture/MediaCaptureController.ts
  6d902419d0b23ef93117c55ebb1170669c4f0e7c74d61924894d7a5135630631
apps/chrome-extension/src/modules/media_companion/capture/index.ts
  72729490895ce7fbeb5bae719f5f240a682a872ec103fcfdd089172d6f11bfba
apps/chrome-extension/src/modules/media_companion/capture/contracts.ts
  18d0b5361cb84a2c83f7c2c2d9234cae301930acd2aff897d470770e8ad12a68
apps/chrome-extension/src/modules/media_companion/capture/MediaCaptureMessageClient.ts
  5a2317a96d24f257b4bbc127c19bbc636dfced9e6f162e0e289cb5605b206346
apps/chrome-extension/src/modules/media_companion/capture/MediaCaptureMessageRouter.ts
  d7d0ed7db90d12a4c477cca05da46de6ba53d68535916d1de8f2218af1d8c6d0
apps/chrome-extension/src/modules/media_companion/tests/MediaCaptureController.test.ts
  75166b3911107e957bce435b929f64e40b656df8a9f85a68a75208dc2afe7037
apps/chrome-extension/chrome-mv3-unpacked/**   （npm run build 产物）
```

### 未修改

`services/local-runtime/navia_runtime/**`、冻结 schema / fixture / contracts /
`docs/active/project/01-prd.md` 等权威文档、`stage-b-six-video-registry.json`、
`v3-claudecode-implementation-2026-10-15/` 交接包载荷。

## 2. 合同变化

- **内部合同变化**：有 —— Port 消息集合（补 `chunk_credit`、`failed`→
  `capture_error`）、restart marker 身份（schemaVersion / captureSessionId 格式）、
  sender 校验规则（精确 URL / frameId absent-or-0 / documentId 首绑）、
  stop 顺序（原子 `beginStop`）、credit 语义（仅 Runtime ACK 返还）。
- **公共合同变化**：**none**。

## 3. 全部命令与退出码

| # | 命令 | 退出码 | 结果 |
|---:|---|---:|---|
| 1 | `npm run typecheck` | 0 | PASS |
| 2 | `node --test scripts/stage_b_b5_3/test/relay_ownership_contract.node-test.mjs` | 0 | 17 / 17 |
| 3 | `npx vitest run src/modules/media_companion/tests/` | 0 | 128 / 128（18 files） |
| 4 | `npx vitest run --maxWorkers=2` | 0 | **461 / 461（62 files）** |
| 5 | `npm run build` | 0 | PASS（Σ 4.65 MB） |
| 6 | `pytest tests/test_wp0_r1_relay_barrier.py -q` | 0 | 6 / 6 |
| 7 | `pytest -k "capture or transcript or outline or fault or product" -q` | 0 | 180 passed |
| 8 | `verify-...-v10-contract.py` | **2** | 45 / 50（待重冻结） |
| 9 | `verify-...-v10-mutations.py` | **2** | 14 / 15（待重冻结） |

## 4. 真实 run / build / task / candidate ID

- 真实产品 run：**未执行**
- Chrome：**未启动**（0 次；无可见浏览器、无焦点抢占、无 UIAutomation）
- Provider 请求：**0**
- task ID：**无**
- build：`npm run build` 已执行
- candidate ID：`wp0-r1-corrective-2026-10-16`（**非** immutable candidate）

## 5. 测试数量汇总

| 套件 | 用例 |
|---|---:|
| 静态所有权合同（node:test） | 17 |
| 冻结 relay 合同（vitest） | 20 |
| Runtime transport（vitest） | 30 |
| 双端协议 harness（vitest） | 5 |
| restart harness（vitest） | 8 |
| MediaCaptureController（vitest） | 10 |
| media_companion 子树合计（vitest） | 128 |
| 扩展全量（vitest） | **461** |
| Runtime barrier（pytest） | 6 |
| Runtime focused（pytest） | 180 |

## 6. PRD / 架构不变量覆盖

见 `30-prd-review.md`：Codex 5 项 Major + 2 项 Minor 全部关闭；9 项架构
所有权不变量满足；16 项冻结 schema 常量逐项 pin 且一致。

## 7. cleanup / secret scan

- Chrome 0 次、Provider 0 次、六视频 0 次
- 全部测试使用 `os.tmpdir()` / `tmp_path` 沙箱并在结束时清理
- 结束前无遗留 vitest / uvicorn / node 进程
- 公开证据只含固定 code 名、仓库内相对路径、测试计数、SHA-256；
  无 Cookie / API key / 凭据 / 原始音视频 / 绝对私有路径
- 本轮未播放任何声音；所有 Chrome 相关 argv 仍显式含 `--mute-audio`

## 8. 剩余 Fatal / Major / Minor

| 级别 | 数量 | 内容 |
|---|---:|---|
| Fatal | 0 | — |
| Major | 0 | Codex 5 项 Major 全部关闭 |
| Minor | 0 | Codex 2 项 Minor 全部关闭 |
| **待重冻结** | **1** | v10 verifier 45 / 50 + 14 / 15。8 个「缺失」code 逐项核验**全部仍存在于工作树**（每个 ≥1 个非测试文件），本轮**零真实删除**；根因是 verifier 在 2 个 R1 必然要改的冻结 scope 文件（`MediaCaptureController.ts`、`media-capture-offscreen/main.ts`）哈希漂移时**跳过整文件 AST 抽取**，并因 4 个新 relay 模块未入 11-scope 触发 `unlistedSourceFilesEmitNoBoundaryCodes`。属 Codex 冻结权限。 |

## 9. 本轮修正的三个真实实现缺陷

1. **首帧 credit 被自我取消** —— `sendStart` 先置 `credit=1` 再调用
   `grantCredit`，而 `grantCredit` 在 `credit >= 1` 时直接返回，导致
   `chunk_credit` 永不发出、producer 永久无 credit。改为先置 0 再授予。
2. **最后一个 ACK 后不复检 finalize 门** —— `#onRuntimeAck` 只调用
   `#pump()`，当最后一个 in-flight chunk 被 ACK、backlog 清空时，
   `#maybeFinalize()` 不再被触发，Runtime `stop` 永不发出。已在 ACK 后
   复检 finalize 门。
3. **终态把 marker phase 改写成 `connecting`** —— `#setState` 对
   `finalized`/`aborted`/`failed` 仍落盘，而 `currentMarker()` 对非五阶段
   state 回退为 `connecting`，等于在收口瞬间污染 marker 再清除。已改为
   只有五个冻结阶段才落盘。

三者均由本轮新增的双端 / restart harness 暴露。

## 10. 自动化开发停止原因

R1-F1..F6 与 Codex 2 项 Minor 全部实施并自验证通过（461/461 扩展、6/6
barrier、180/180 focused、17/17 静态合同、typecheck 与 build 全绿）。
剩余唯一未闭合项是冻结 v10 证据的 scope/hash 尚未由 Codex 更新，导致
contract verifier 45/50、mutation verifier 14/15。修正该项需要改动冻结
fixture / FailureCode registry / 权威 source scope，属 Codex 冻结权限
（`81-codex-r1-corrective-handoff.md` 禁止事项）。故在 R1 停止，状态标记
**R1 AWAITING CODEX REFREEZE**，等待 Codex 检查实现事实、更新冻结
scope/hash 并重跑 50/50 与 15/15。

## 11. 下一门禁

1. Codex 检查本轮实现事实（R1-F1..F6 + 2 项 Minor）；
2. Codex 更新冻结 source scope / hash / inventory；
3. 重跑 `verify-...-v10-contract.py` 达 50/50（退出码 0）；
4. 重跑 `verify-...-v10-mutations.py` 达 15/15（退出码 0）；
5. Codex 明确 `R2 may start`。

在此之前不进入 R2，不宣布 R1 PASS。
