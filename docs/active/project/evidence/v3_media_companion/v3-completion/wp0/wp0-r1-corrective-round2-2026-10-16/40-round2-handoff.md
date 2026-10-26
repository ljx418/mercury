# WP0 R1 第二轮纠偏 Handoff（2026-10-16）

Candidate: `wp0-r1-corrective-round2-2026-10-16`
阶段结论：**R1 AWAITING CODEX REFREEZE**。R2–R7 未启动。
证据目录：`docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r1-corrective-round2-2026-10-16/`

## 1. changed files

### 新增

```
apps/chrome-extension/src/modules/media_companion/capture/OffscreenProducerBootstrap.ts
  b2e978942eb55a9c21fe55bd6743abafb5580bb095a8411344b7e15cabcdb464
apps/chrome-extension/src/modules/media_companion/capture/RelayRestartReconciler.ts
  979111e8e72257a11654e5a440947b4d0fd63408bd2a22689da20b8000a3aa4f
apps/chrome-extension/src/modules/media_companion/tests/OffscreenEntrypointComposition.test.ts
  7ce83b52449456d8ccf71c234fde658421e9187a77402a5d225a2b0e85115e43
apps/chrome-extension/src/modules/media_companion/tests/RelayRestartReconciliation.test.ts
  3006921834d7ef09f988334e3346504662f6912b2d22f6c862b4f2430ddc95ff
```

### 修改

```
apps/chrome-extension/src/modules/media_companion/capture/OffscreenAudioPort.ts
  31b6dd3f3ff72b0c7b20b70aeca5ea59d63e688696ee49bdaddfadbe9db9f368
apps/chrome-extension/src/modules/media_companion/capture/MediaCaptureController.ts
  b344caf3be26a2264867ce0453d6dddbffed06adb02746d58136429600d71888
apps/chrome-extension/src/modules/media_companion/capture/index.ts
  6b1d5adb4adf6bd826b29fdcb6c2d4cd34b0ca56b9a2874c00dfad69d039bc83
apps/chrome-extension/entrypoints/media-capture-offscreen/main.ts
  fff4948edddb2220bc00eef66ac0cf217b8765e755d505d1cc0170288ebebe1a
apps/chrome-extension/entrypoints/background/index.ts
  f4cca38c701a945ff880017284de284bc291aa47e5d02839aa820751b3a5cd41
apps/chrome-extension/src/modules/media_companion/tests/MediaCaptureController.test.ts
  00d4b3b4cc9a01f1b07813989300cf31dc223578a503b62f096e11e62949dc13
scripts/stage_b_b5_3/test/relay_ownership_contract.node-test.mjs
  dc568547b8fa47e8eec770aac1392a1d1f81549fa6ad1903cb89acea62d7f3eb
apps/chrome-extension/chrome-mv3-unpacked/**   （npm run build 产物）
```

### 未修改

`services/local-runtime/navia_runtime/**`、冻结 schema / fixture / contracts /
`docs/active/project/01-prd.md` 等权威文档、`stage-b-six-video-registry.json`、
第一轮与第二轮 handoff 目录（历史证据未被覆盖）。

## 2. 合同变化

- **内部合同变化**：有 —— Port 两阶段绑定（`start` → `ready` → `chunk_credit`）、
  `MediaCaptureControllerDependencies.relay` 由可选改**必需**、
  producer `capture_error` 失败边界、新增 `RelayRestartReconciler` 与
  `chrome.storage.session` `TRUSTED_CONTEXTS` 访问级别。
- **公共合同变化**：**none**。

## 3. 全部命令与退出码

| # | 命令 | 退出码 | 结果 |
|---:|---|---:|---|
| 1 | `npm run typecheck` | 0 | PASS |
| 2 | `npx vitest run src/modules/media_companion/tests/` | 0 | **146 / 146**（20 files） |
| 3 | `npx vitest run --maxWorkers=2` | 0 | **479 / 479**（64 files） |
| 4 | `npm run build` | 0 | PASS（Σ 4.65 MB） |
| 5 | `node --test scripts/stage_b_b5_3/test/relay_ownership_contract.node-test.mjs` | 0 | **22 / 22** |
| 6 | `pytest tests/test_wp0_r1_relay_barrier.py -q` | 0 | **6 / 6** |
| 7 | `pytest -k "capture or transcript or outline or fault or product" -q` | 0 | **180 passed** |
| 8 | `verify-...-v10-contract.py` | **2** | 45 / 50（待重冻结） |
| 9 | `verify-...-v10-mutations.py` | **2** | 14 / 15（待重冻结） |

## 4. composition / restart 用例数

| harness | 用例 |
|---|---:|
| `OffscreenEntrypointComposition.test.ts`（真实 entrypoint composition） | **3** |
| `RelayRestartReconciliation.test.ts`（新实例读取旧 store） | **16** |
| 合计新增 | **19** |

## 5. Chrome / Provider / 六视频 / 声音

| 项 | 次数 |
|---|---:|
| Chrome 启动 | **0** |
| Provider 请求 | **0** |
| 六视频 fresh run | **0** |
| 真实产品 run | **0** |
| 声音播放 | **0** |
| 可见 Chrome / 原生弹窗 / 焦点抢占 / UIAutomation | **0** |

## 6. secret / raw-media / private-path scan

- 本轮新增与修改的源码**不含**任何 Cookie 值、API key、凭据、原始音视频或
  绝对私有路径。
- producer `capture_error` 仅传内部诊断 code，Background
  `normalizeRelayFailureCode` 归一化后才出界；异常文本、路径、私密值不进入
  公开响应、日志或证据。
- restart marker 严格 6 字段，8 个禁止字段（ticket / grantId / streamId /
  pcm / sourceIdentity / absolutePath / cookie / apiKey）由
  `validateStoredMarker` 与测试逐项拒绝。
- 全部测试使用 `os.tmpdir()` / `tmp_path` 沙箱并清理；结束前无遗留
  vitest / uvicorn / node 进程。
- 公开证据只含固定 code 名、仓库内相对路径、测试计数与 SHA-256。

## 7. PRD / 架构覆盖

见 `30-round2-prd-review.md`：Codex 第二轮 4 项 Major + 1 项 Minor 全部关闭；
9 项所有权不变量满足；16 项冻结 v10 schema 常量逐项 pin 且一致；新增
「单一 capture control plane」「restart 不恢复旧音频/票据/序列」两项不变量
均满足。

## 8. Fatal / Major / Minor

| 级别 | 数量 | 内容 |
|---|---:|---|
| Fatal | 0 | — |
| Major | 0 | M-R1-C2-01..04 全部关闭 |
| Minor | 0 | m-R1-C2-01 关闭 |
| **待重冻结** | **1** | v10 verifier 45/50 + 14/15。8 个「缺失」code 逐项核验**全部仍存在于工作树**（每个 ≥1 个非测试文件），本轮**零真实删除**；根因是 verifier 在 2 个 R1 必须改的冻结 scope 文件哈希漂移时**跳过整文件 AST 抽取**，加新增 relay 模块未入 11-scope 触发 `unlistedSourceFilesEmitNoBoundaryCodes`；mutation 唯一失败为对照用例。属 Codex 冻结权限。 |

## 9. 本轮修正的真实实现缺陷

1. **Offscreen Port 循环依赖**（M-R1-C2-01 本体）：`ensurePort()` 只在
   `startCapture()` 内，而 `startCapture()` 只在收到 `start` 后运行。
2. **`sendStart` 顺序缺陷**（本轮新发现）：先 post `start` 再
   `this.#credit = 0`，producer 同步回 `ready` 时授予的 credit 被抹掉。
3. **`sendStart` 前置依赖缺陷**（本轮新发现）：要求 `producerReady` 才放行，
   等于「先 ready 再 start」，仍是循环。
4. **`relayPortRef.current` 从未赋值**（本轮新发现）：transport 的
   Runtime-ACK hook 在生产中永远拿不到 Port owner，`chunk_credit` 不会发出。
5. **producer 错误无回传**（M-R1-C2-04 本体）：START 失败产生未处理
   Promise，Background 只能等 timeout。

五者均由本轮新增的 entrypoint composition 与 restart reconciliation
harness 暴露。

## 10. 自动化开发停止原因

R1-C2-1..5 与 Codex 第二轮 4 Major + 1 Minor 全部实施并自验证通过
（479/479 扩展全量、146/146 media_companion、22/22 静态合同、6/6
barrier、180/180 focused、typecheck 与 build 全绿），真实 entrypoint
composition 与 restart reconciliation 已闭合。

剩余唯一未闭合项是冻结 v10 证据的 source scope / hash 尚未由 Codex
更新，导致 contract verifier 45/50、mutation verifier 14/15。逐项核验
证明剩余失败**仅来自冻结证据漂移**（8 个「缺失」code 全部仍在工作树，
零真实删除），不来自实现缺陷。修正该项需改动冻结 fixture /
FailureCode registry / 权威 source scope，属 Codex 冻结权限
（`60-codex-refreeze-gate-review.md §5`、`61-…-round2-handoff.md` 禁止事项）。
故在 R1 停止，状态标记 **R1 AWAITING CODEX REFREEZE**。

## 11. 下一门禁

1. Codex 检查本轮实现事实（含真实 composition / restart harness）；
2. Codex 更新冻结 source scope / hash / inventory；
3. 重跑 `verify-...-v10-contract.py` 达 50/50（退出码 0）；
4. 重跑 `verify-...-v10-mutations.py` 达 15/15（退出码 0）；
5. Codex 明确 `R2 may start`。

在此之前不进入 R2，不宣布 R1 PASS。
