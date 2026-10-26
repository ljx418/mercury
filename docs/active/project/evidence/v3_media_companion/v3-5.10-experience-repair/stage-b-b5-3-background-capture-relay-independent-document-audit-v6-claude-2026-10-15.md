# Stage B B-5.3 P0 Background Capture Relay v6 — 独立只读文档审查（Claude）

日期：2026-10-15。
审查者：独立 Claude session（只读）。
对象：`docs/active/project/external-audit-package/` 已冻结 v6 平铺包（18 文件）。
性质：v6 immutable document candidate 外审（不是 implementation audit）。
约束：未运行 Chrome / Runtime / Provider；未播放声音；除本报告外未修改任何文件。

---

## 1. 审查入口与依赖文档

依据本仓库 `AGENTS.md` 与 `external-audit-package/01-audit-request.md` 的指令，本轮审查：

- `external-audit-package/AUDIT_MANIFEST.md`（SHA-256 manifest）
- `02-prd.md` §18.11（V3 P0 可信捕获内部中继纠偏）
- `03-architecture.md` §22.15（P0 Background Capture Relay 增量架构）
- `05-acceptance-plan.md` §28（P0 Background Capture Relay 专项门槛）
- `06-stage-gate.md`（V3 Media Companion Stage Gate + 2026-10-15 P0 门禁补丁）
- `07-relay-architecture.md` / `08-relay-development-plan.md` / `09-relay-acceptance-plan.md` / `10-relay-preimplementation-audit.md`（v6 专项四件套）
- `11-phase0-test-results.md`（Phase 0 测试结果，证明 `BV1pohR6rEEh` 单视频仍 `NO-GO`）
- `12-v6-replan-closure.md`（v6 重规划闭环；v5 → v6 关闭五项 Major 的依据）
- `13-current-checkpoint.md`（v6 文档冻结检查点）
- `14-relay-architecture.json`（Archify v6 spec；与 handoff 13 公布的 spec SHA-256 比对）
- `15-internal-relay-v6.schema.json` / `16-internal-relay-v6-fixtures.json` / `17-internal-relay-v6-verifier.py`（机器权威 + 反假绿 verifier）
- `18-main-implementation-prompt.md`（ClaudeCode CLI 完整 goal；P0 R0-R7 + P1-P9）

审查期间严格遵守：

- 不修改 `external-audit-package/` 任一文件（已 `sha256sum` 比对一致）
- 不重启 Chrome / Runtime / Provider
- 不播放声音
- 不发任何伪造实施授权；本审查仅产生 `DOCUMENT PASS / DOCUMENT REPLAN`

---

## 2. 输入复算（18 项 SHA-256）

复算命令（在本仓库根目录）：

```bash
cd /mnt/c/workspace/navia/docs/active/project/external-audit-package
sha256sum 0[1-9]-* 1[0-8]-*
```

实际输出 SHA-256（manifest 表格列出原始值；命令 `exit=0`）：

| 序 | 文件 | 复算 SHA-256 | 一致 |
|---|---|---|---|
| 01 | `01-audit-request.md` | `cdc983c3ea9f04c95c8e67ad500140c2b04db0372be83aea7143306dc3f06dbd` | ✓ |
| 02 | `02-prd.md` | `562178ae8a5c38e6057d975f9912bc7662eca0c31ae28774ab5144bd84cf907a` | ✓ |
| 03 | `03-architecture.md` | `304a1de633ceac5857bcbd38cba160ff146aa23318de4311f02d97198bc2666c` | ✓ |
| 04 | `04-development-plan.md` | `d3cdff5b7bff188262d6aaa97152a3c60ff527a2a933c3f6308432c8e2d6dbbd` | ✓ |
| 05 | `05-acceptance-plan.md` | `99348115a5c17b805130ccae8723364afd54b55362fc6bd944bf081d80288c85` | ✓ |
| 06 | `06-stage-gate.md` | `0ab8b9a37a1da8b764a7ac002bc771ddf30f81421a8197cf73d07059bcab4864` | ✓ |
| 07 | `07-relay-architecture.md` | `11e5e2c326f584a0184e76fb16e914cac47c6d0e95bf2959a79281b517137a30` | ✓ |
| 08 | `08-relay-development-plan.md` | `9133284ed375318177a6bf66c8f1018b6d407acfd204621f7127c6627b2ab9f4` | ✓ |
| 09 | `09-relay-acceptance-plan.md` | `fea8101f564f1be5342eaec1dc5bb2a1960224d12039fa3013437cfc72c42f3f` | ✓ |
| 10 | `10-relay-preimplementation-audit.md` | `62227e0917c422aad86b2d98012a395a24f2544491a885ea06b7ad1325240e19` | ✓ |
| 11 | `11-phase0-test-results.md` | `6fbef7d0b1ce2cff42d987ed1b23a0779d042bc024e92cb9f8fbf18b50b13f88` | ✓ |
| 12 | `12-v6-replan-closure.md` | `701d506bc5f0d34ad410273e69e575af88995dcd94c1795f6ea030a98d59370c` | ✓ |
| 13 | `13-current-checkpoint.md` | `f4728904a77257207244dfb43eb50c11aa4ab8145f046980e384b28cb941c933` | ✓ |
| 14 | `14-relay-architecture.json` | `f1bb393e05bc75c67e8e64ba55d08203937d44f74d3d9ab550cee0d339eb0789` | ✓ |
| 15 | `15-internal-relay-v6.schema.json` | `584ff420c6c179429576fc0cb33916852de663c711b5366ca1279a74dcf3064f` | ✓ |
| 16 | `16-internal-relay-v6-fixtures.json` | `11c63cfb806348a2ceaa507cd621bcbfb9b8d3d236e05312afa0c723c502523b` | ✓ |
| 17 | `17-internal-relay-v6-verifier.py` | `9d0cd344ffc6ecb19b78ee6e493d210f4097be21d97d90776a51933eb8fcf63f` | ✓ |
| 18 | `18-main-implementation-prompt.md` | `16ec469f7d6b6a10bd3689bfa4208f9977837524f4aa1384a9dc46501d9038b2` | ✓ |

`handoffs/v3-claudecode-completion-2026-10-15/19-p0-relay-v6-replan-closure.md`、`…/13-p0-background-capture-relay-document-freeze.md`、`…/16-claudecode-v3-completion-goal-v2.md` 三个权威源 SHA-256 与 manifest 公布值一致（`701d506b…` / `f4728904…` / `16ec469f…`）。

权威源 `docs/active/project/contracts/v3_media_capture_internal_relay_v6.schema.json` 与 `docs/active/project/fixtures/v3-media-capture-internal-relay-v6-fixtures.json` 与平铺包 `15-/16-` 同名文件 SHA-256 一致。

任何不一致即视为致命，本次复算 18/18 一致。

---

## 3. v6 verifier 基线与 digest 复算

### 3.1 基线 PASS（34/34）

```bash
cp -r docs/active/project/external-audit-package /tmp/v6-audit/external-audit-package
cd /tmp/v6-audit/external-audit-package
python3 17-internal-relay-v6-verifier.py
exit=0
summary: {'total': 34, 'passed': 34, 'failed': 0}
FAILED: none
```

### 3.2 独立 digest 复算（八项硬编码常数）

verifier 硬编码八个 `EXPECTED_*_SHA256`；本审查独立用同一 `json.dumps(..., sort_keys=True, separators=(",", ":"))` + `hashlib.sha256` 复算：

| 常量名（verifier 名称） | verifier 内置值 | 独立复算值 | 一致 |
|---|---|---|---|
| `EXPECTED_SCHEMA_SHA256` | `46e627a1b0473c00f6dcc85993c4b72ea6cbd0bc7f3308bc939483dd904f9ef2` | `46e627a1b0473c00f6dcc85993c4b72ea6cbd0bc7f3308bc939483dd904f9ef2` | ✓ |
| `EXPECTED_PROTOCOL_SHA256` | `dbd5bc8588e6df3f1194e990fea53bba4aaf24cf71e2e39c4a67d40c0a20d39b` | `dbd5bc8588e6df3f1194e990fea53bba4aaf24cf71e2e39c4a67d40c0a20d39b` | ✓ |
| `EXPECTED_TRACE_SHA256` | `411446f92c3e6a831dc2359a6317891e450443d29a80b90113edbc9fb689573a` | `411446f92c3e6a831dc2359a6317891e450443d29a80b90113edbc9fb689573a` | ✓ |
| `EXPECTED_RESTART_TRACE_SHA256` | `050b12914c1f5509f7f23348b89feb601fcee6d0386a46946d47a8de5bcb8771` | `050b12914c1f5509f7f23348b89feb601fcee6d0386a46946d47a8de5bcb8771` | ✓ |
| `EXPECTED_TERMINAL_TRACE_SHA256` | `648118bf663a72b48cdd5d7273514fc5e3fce0741713a3fc7ce163a6765405a1` | `648118bf663a72b48cdd5d7273514fc5e3fce0741713a3fc7ce163a6765405a1` | ✓ |
| `EXPECTED_PHASE_RECOVERY_SHA256` | `d4bba0e9b2a5b8744ea57a5568c3a6cd74d40a085bb6ffd5fc26b8bbec50365f` | `d4bba0e9b2a5b8744ea57a5568c3a6cd74d40a085bb6ffd5fc26b8bbec50365f` | ✓ |
| `EXPECTED_TERMINAL_CASES_SHA256` | `0b955cf72258217246e1ab7690a62312187eabdbe3b91a84ef2dcc45ab4cdd58` | `0b955cf72258217246e1ab7690a62312187eabdbe3b91a84ef2dcc45ab4cdd58` | ✓ |
| `EXPECTED_NEGATIVE_SHA256` | `73ba8bd0cc9c194fdeb0774a74d35907b99be95474f505603818d6fc0ff42b1e` | `73ba8bd0cc9c194fdeb0774a74d35907b99be95474f505603818d6fc0ff42b1e` | ✓ |

八项 digest 全数对账一致；verifier 内置 digest 不是空集或回绕值。

### 3.3 Archify spec / HTML

```bash
sha256sum docs/active/project/design/v3-p0-background-capture-relay-architecture.json \
          docs/active/project/design/v3-p0-background-capture-relay-architecture.html
```

- `14-relay-architecture.json` → `f1bb393e05bc75c67e8e64ba55d08203937d44f74d3d9ab550cee0d339eb0789`（与 manifest / handoff 13 一致）
- HTML → `c8d707477a143a802272db1a81d3d90ba80b2b43e1bb9adf03608bcb38e18972`（与 handoff 13 一致；自动浏览器 visual-check 因 WSL 未发现 Chrome executable 而 skipped，视觉审阅 pending，文档原样声明）

`14-relay-architecture.json` 自身结构：`schema_version=1`、`diagram_type=architecture`、`quality_profile=showcase`、10 个 components、12 条 connections、2 个 boundaries、3 个 card、viewBox `[1390, 850]`、revision `a303551…`。所有 component `sources[*].path` 引用的源文件均存在（`sidepanel/main.tsx`、`app.py`、`MediaCaptureController.ts`、`media-capture-offscreen/main.ts`、`task_store.py`）。

---

## 4. 必审问题清单（v5 五项 Major 关闭验证）

### 4.1 sender 校验可实现性 + Chrome 116 边界

v6 architecture §4.1、acceptance §4 (A01)、PRD §18.11 三处明确：

- sender 仅读 5 个 `MessageSender` 字段：`id === runtime.id`、`url === runtime.getURL(offscreen)`、`tab` 缺、`frameId` 缺/0、`documentId` 必填且非空
- Background 以该 `documentId` 调 `chrome.runtime.getContexts`，要求**恰好一个** `contextType=OFFSCREEN_DOCUMENT` 且 `ExtensionContext.incognito === chrome.extension.inIncognitoContext`
- WXT `wxt.config.ts` 当前**尚未**声明 `minimum_chrome_version: "116"`；R0 / A01 必须新增。文档未把此条变成“现成 manifest”，且 acceptance §3 A01 提前将 `getContexts` capability probe 列为能力门槛
- Chrome 官方文档 `chrome.runtime.MessageSender` 不含 `incognito` 字段，与 v5 的“读取不存在字段”缺陷彻底切断
- `streamIdPolicy` 限定为一次性 `background_to_offscreen_start_exactly_once`；forbiddenLocations 显式排除 `chunk/credit/log/restartMarker/storage/publicEvidence`

结论：v6 显式冻结 sender 校验策略且不允许弱化降级；任何回退到 `URL only` 或 `payload self-report` 都被作为 R0 必改项列出。

### 4.2 sink finalize 是否被错误认作 protocol terminal

v6 architecture §5（第三段）、§4.4、PRD §18.11、acceptance §4（A15）四份文档同步声明：

- `protocolTerminalCommitted` 仅在权威 task 已完成状态迁移、transcript `create/start` 成功、`completed` frame 发送成功后置 true
- 五个失败注入点 `after_sink_finalize / transcript_create / transcript_start / before_completed_send / completed_send` 统一走 `finally`，并以 `V3_MEDIA_CAPTURE_FINALIZE_FAILED` 幂等终结
- schema `terminalBoundary.failureInjectionPoints` 与 fixtures `terminalFailureCases` 五项一致
- v5 的"sink finalize 误作 terminal"显式列出 reject 原因并归档

### 4.3 restart 是否按 phase 可达且不扩大公共 API

schema `recoveryOwnership.const` 一字一句列出五个 phase 调度：

| phase / state | owner | action |
|---|---|---|
| `connecting` + `alive_before_valid_start` | `background_new_worker` | `existing_authenticated_DELETE_acquisition` |
| `runtime_started` / `capturing` / `draining` + `alive_after_valid_start` | `runtime_websocket_handler_finally` | `abort_and_internal_fail_then_GET` |
| `cleanup_pending` + `alive_after_valid_start` | `runtime_websocket_handler_finally` | `idempotent_internal_fail_then_GET` |
| any + `hard_crash_or_restarted` | `product_reattach_recovery` | `existing_recover_by_current_sourceIdentity_match_authoritativeTaskId` |
| any + `GET_404` | `background_new_worker` | `stop_polling_emit_recovery_pending` |

该表与 schema `recoveryOwnership` 与 fixtures `phaseRecoveryCases` 七项一一对应；schema `recoveryOwnership.publicApiChange == "none"`、`newUserAction == "none"`，fixtures 表中只有 `existing_authenticated_DELETE_acquisition`、`existing_get_observed_terminal`、`existing_recover_by_current_sourceIdentity_match_authoritativeTaskId` 三类动作对应既有 Runtime/UI 合同。

`restartTermination.publicApiChange == "none"`；`newWorkerRole == "dispatch_by_marker_phase_using_existing_authenticated_DELETE_or_GET_or_existing_recover_never_resume_old_pcm_ticket_or_sequence"`。

### 4.4 v6 唯一实施权威 + Schema/protocol digest

四份专项文档 + 两份 handoff（12、13） + main goal（18）一致声明：

- v1-v5 拒绝；v6 机器权威只为 `v3_media_capture_internal_relay_v6.schema.json` / `v3-media-capture-internal-relay-v6-fixtures.json` / `verify-stage-b-b5-3-background-capture-relay-v6-contract.py`
- 30 负例必须严格连续 `RLY6-N01..RLY6-N30`（fixtures 即给出，且与 verifier `EXPECTED_FAILURES` 字典一一对账）
- 24 + 8 + 6 trace、五终端注入点、七类 phase recovery owner、20 项内部 relay FailureCode、15 项 boundary mapping 均为 `const` 或 immutable
- 任何 Schema 放宽、port 回退 v5、`V3` fixture 漂移都使 verifier exit ≠ 0（见第 5 节对抗动作）

### 4.5 20 项内部 relay FailureCode 只属于 v6 内部 wire + 公开合同不变

schema `failureCodes` 含 20 项 `const`，与 fixtures `failureCodes` 一致；架构 §5、PRD §18.11 明确 20 项只属于内部 relay wire。`boundaryFailureNormalization.const` 把 14 个**旧** public/UI FailureCode 显式映射到 14 个**新**内部 relay code；映射总数（连同 `scope` 键）= 15，与 verifier 的 `len(...) == 15` 一致。`scope == "internal_relay_only_public_runtime_and_ui_codes_remain_unchanged"`；acceptance §4 矩阵同样声明 **公共 Runtime/UI 错误归一化矩阵**保持原合同。

### 4.6 R0-R7、A01-A18、真实 canary 与假绿拒绝

- 9 类消息类型：abort / capture_error / chunk / chunk_credit / quiesce / quiesced / ready / start / stopped（zsh 系唯一存在 9 个 unique type，与 verifier `nineUniqueMessageVariantsExact` 对账）
- 正例 24 步：trace 中 `restart_marker_phase_*` 仅四个（runtime_started / capturing / draining / cleanup_pending；`connecting` 通过 `restart_marker_write` 触发，与 schema `restartMarker.phaseValues` 五值完全闭合）
- 8 步 restart trace 严格匹配：`step[1]` `restart_marker_read`、`step[2]` `websocket_finally_abort` 三零、`step[3]` `internal_fail_capture_stream` `idempotent=True publicApiCall=False`、`step[4]` `existing_get_observed_terminal state=failed`、`step[-1]` `fresh_started freshCapture=True`；verifier `restartTraceCleanupAndFreshStartExact` 一并锁定
- 6 步 terminal failure trace：每步最终落到 `V3_MEDIA_CAPTURE_FINALIZE_FAILED` + task/authority terminal，幂等，且 protocolTerminalCommitted 仍为 false 直到 `step[5]`/`step[6]`
- 30 负例 ID 与 verifier `EXPECTED_FAILURES` 字典严格对账：`[caseId for case in negative] == ["RLY6-N%02d" for i in range(1,31)]` 且 `mapping == EXPECTED_FAILURES`
- A01-A18 十八行条目与 schema / fixtures / architecture / PRD 四个位置都可达
- 真实 canary 与故障矩阵由 `09-relay-acceptance-plan.md` §4 详细列出；R5/R6 出门必须固定 `BV1pohR6rEEh` fresh visible muted Chrome、`--mute-audio`、runner 不直调 controller/materialize/database

### 4.7 完整 goal 是否仍要求文档外审 + 用户授权后才编码

`18-main-implementation-prompt.md` 第三、四节明确：

- "每次只实现一个已冻结、Fatal=0/Major=0 且用户明确批准的子阶段"
- "若缺独立文档审查 Fatal=0/Major=0 或明确实施授权，只能修文档/fixture，禁止改产品代码"
- P1 六视频被 P0 immutable candidate 外审阻塞

`13-current-checkpoint.md` §3 与 `12-v6-replan-closure.md` 反复重申 `P1 BLOCKED`；v6 verifier 34/34 只证明静态合同一致，不等于 R0-R7、P0、P1 或 V3 PASS。

---

## 5. 对抗动作（v6 verifier 反假绿变体）

审查者独立编写 `/tmp/v6-audit/mutations/run_mutations.py`，对 schema 或 fixtures 应用一项变异并要求 verifier `exit != 0`。

执行摘要（22/22 全部捕获）：

| # | 变异类别 | 关键失败检查 | exit |
|---|---|---|---|
| 1 | `chunk.additionalProperties=true` | `schemaAuthorityAllFieldsImmutable` | 2 |
| 2 | `limits.maxRawChunkBytes=50000`（上限放宽） | `schemaAuthorityAllFieldsImmutable` + `protocolAllInstancesSchemaValid` | 2 |
| 3 | `portName = "navia.mediaCapture.audio/v5"` 回退 | digest 与 `portName` 不一致 | 2 |
| 4 | `terminalBoundary.sinkFinalizeIsTerminal=true` | `terminalBoundaryExact` 锁定 | 2 |
| 5 | `streamIdPolicy.allowedMessage="anywhere"`（放宽 streamId 位置） | digest | 2 |
| 6 | `failureCodes` 删除一项（删 `V3_MEDIA_CAPTURE_PROTOCOL_INVALID`） | digest | 2 |
| 7 | `boundaryFailureNormalization` 删除一项映射（`V3_MEDIA_CAPTURE_NOT_ELIGIBLE`） | `boundaryFailureNormalizationClosed` 拒绝 14 项 | 2 |
| 8 | `recoveryOwnership.publicApiChange="new_endpoint_required"`（试图扩公共 API） | digest | 2 |
| 9 | `restartMarker.phaseValues` 删 `cleanup_pending` | digest | 2 |
| 10 | `senderPolicy.minimumChromeVersion=110`（降低 Chrome 版本要求） | `senderSourceAndIncognitoResolutionExact` 拒绝 | 2 |
| 11 | `runtimeSinkInvariant.scope="multi_active_sink_allowed_per_request"`（单 sink 弱化） | `singleSinkInvariantExact` 拒绝 | 2 |
| 12 | `ordering.overflowBehavior="drop_chunks_and_continue"`（违反 overflow 语义） | digest | 2 |
| 13 | `positiveTrace` 插一步（24 → 25） | `positiveTraceAllFieldsImmutable` 拒绝 | 1 |
| 14 | `restartMarkerInstances[*].expiresAt` 全延后 60 分钟（试图刷新 expiry） | `markerExpiryArithmeticAndNoRefresh` 拒绝 | 2 |
| 15 | `phaseRecoveryCases` connecting owner 改为 `background_new_worker_with_new_api` | `phaseRecoveryOwnersExact` 拒绝 | 2 |
| 16 | `terminalFailureCases` 删除 `completed_send` 注入点（仅剩四项） | `terminalFailureCasesAllFieldsImmutable` 拒绝 | 2 |
| 17 | `negativeCases[*].caseId` 全部改名为 `RLY6-X*`（断开源连续性） | `negativeIdsAndMappingAllThirtyExact` 拒绝 | 2 |
| 18 | `restartTrace` step 8 `freshCapture=false`（试图否认 fresh start） | `restartTraceCleanupAndFreshStartExact` 拒绝 | 2 |
| 19 | `messageExamples.chunk.pcmBase64="AAB"`（非 canonical padding） | `allPositiveChunksCanonicalAndLengthExact` + JSON schema `pattern` 拒绝 | 2 |
| 20 | `messageExamples` 追加第 10 条（断 nineUniqueMessageVariants） | `nineUniqueMessageVariantsExact` 拒绝 | 2 |
| 21 | `messageExamples.chunk.rawByteLength=4` 与 `pcmBase64="AAA="` 解码长度不一致 | `allPositiveChunksCanonicalAndLengthExact` | 2 |
| 22 | `protocol.portName="navia.mediaCapture.audio/v4"`（更深旧版回退） | digest | 2 |

verifier 内置的 `unknownFailureCodeRejected`、`duplicateTenthMessageRejected`、`mismatchedDecodedLengthRejected`、`nonCanonicalPaddingRejected`、`canonical_chunk` 五项离线探针在 baseline 34/34 中已得到 PASS，确认 schema/fixtures 在原状下拒绝已知恶意输入；本审查的 22 项独立 probe 增加"形变也被拒"的角度。

**判定**：22/22 变异均使 verifier exit ≠ 0，v6 schema/fixtures/verifier 对常见降级、回退和放宽动作具备失败闭合，未发现"放宽也能 PASS"的隐藏假绿路径。

---

## 6. 文档内部一致性

- 9 个唯一 message type、4 个 phase（runtime_started / capturing / draining / cleanup_pending）+ `restart_marker_write` 触发 `connecting`、5 个 marker 实例同 session/task；5 个 phase 内部全部走同一 `expiresAt`，与 schema `phaseValues` 闭合
- schema `senderPolicy.incognito` 文案 `runtime.getContexts_by_documentId_returns_exactly_one_OFFSCREEN_DOCUMENT_and_context.incognito_equals_chrome.extension.inIncognitoContext` 与 architecture §4.1、PRD §18.11、acceptance §28 第二条、acceptance §3 A01 五处文本一致
- 限制值（`maxRawChunkBytes=49152` / `maxEncodedChunkChars=65536` / `creditWindowChunks=1` / `runtimeMaxInFlightChunks=1` / `maxOutstandingChunks=32` / `maxOutstandingRawBytes=1572864` = `49152*32` / capture timeouts 5s/10s/10s/10s/120s / total 900s / 512 MiB）在 schema §`limits`、verifier `capacityValuesExact`、`runtimeLimitsNotExpanded`、PRD §18.11、architecture §22.15 五处同步声明
- `boundaryFailureNormalization` 14 项旧 public/UI → 14 项新内部 code 映射；`scope` 一项；总 15，与 verifier `boundaryFailureNormalizationClosed` 完全对应
- `terminalBoundary`：`sinkFinalizeIsTerminal=false`、`failureInjectionPoints` 五项与 fixtures `terminalFailureCases` 五项同序；`protocolTerminalCommit` 只在 terminal frame 发送成功后提交
- `restartTermination.taskFailureMapping` 四键 (`unexpected_disconnect`/`finalize_transcript_or_terminal_send_failure`/`cleanup_failure`/`validated_capture_failure`) 与架构 §5 第四段一致
- Archify HTML spec SHA-256 `f1bb393e…` 与 handoff 13 spec SHA-256 一致；visual-check skipped 仅作 visual pending 声明，不当作 PASS

---

## 7. 源码可实现性追踪（非 implementation audit，仅追踪实现候选是否尚未落地）

依据本审查约束"若存在 immutable implementation candidate 另行复算"，本轮检查仓库内是否存在实现候选：

- `apps/chrome-extension/wxt.config.ts` **未**声明 `minimum_chrome_version: "116"` —— 这意味着即使 R0 出门，候选仍需在此 WXT 配置新增 `manifest.minimum_chrome_version`，并由 build manifest 静态断言；acceptance A01 把 capability probe 显式列出门槛
- `apps/chrome-extension/src/` 全树无 `navia.mediaCapture.audio/v6` 引用；无 `RuntimeCaptureTransport`；无 `chrome.runtime.getContexts` 调用
- `services/local-runtime/navia_runtime/` 也无 `RuntimeCaptureSink` 单 active sink 不变量的 v6 落地代码

判定：本 v6 candidate 仍是 **document-only**；不存在 immutable implementation candidate；故本审查只用于判定 v6 文档是否足以请求实施授权，而不作实施出门的"自身证据复算"。

提示（Minor）：R0 出门时除 verifier 34/34 外，必须在 diff 中可找到新 `manifest.minimum_chrome_version` 字段、能力 probe（真实 Chrome 启动后 `typeof chrome.runtime.getContexts === "function"`）以及严格 sender 校验函数的 unit test，否则视为 R0 出门不可信。

---

## 8. 限制与未在本审查范围内

- 本审查只读取 `docs/active/project/external-audit-package/` 18 文件及其权威源；不读取已归档 v1-v4 / v5 平铺包（按 manifest "有意省略"处理）
- 未启动 Chrome、Runtime、Provider；未运行 `pnpm build`、`pnpm typecheck`、`scripts/stage_b_b5_3/test/*`；未跑真实 canary、真实 Uvicorn、故障矩阵
- 不评估 `scripts/stage_b_b5_3/run_one_bvid.mjs` 或 `scripts/stage_b_b5_3/sequencer.mjs` 等 P0 既有测试是否需要为 R0-R7 重构（属 R0 范畴）
- 不评判 14 项归档 old v1-v5 测试是否删除（属归档纪律）
- Archify HTML 仅有 SHA-256 与 checklist 信息；visual-check 因当前宿主 WSL 无 Chrome executable 而 skipped，文档原样声明视觉审阅 pending —— 本审查不可视为 visual PASS

---

## 9. 审查发现分级

### 9.1 Fatal

无。

### 9.2 Major

无。

逐项复核 v5 五项 Major，确认全部关闭：

| v5 Major | v6 关闭证据 |
|---|---|
| Schema authority 可漂移假绿 | digest `EXPECTED_SCHEMA_SHA256`/`EXPECTED_PROTOCOL_SHA256` + 22/22 变异被 verifier exit≠0 捕获 |
| Terminal 过早 | `terminalBoundary.sinkFinalizeIsTerminal=false`、5 项注入点全部以 `FINALIZE_FAILED` 幂等终结、`protocolTerminalCommit` 文案 + 6 步 trace + 5 终端 case 三处一致 |
| Connecting 无 owner | `recoveryOwnership.connecting_before_valid_start` + `phaseRecoveryCases[0]` owner=`background_new_worker`, action=`existing_authenticated_DELETE_acquisition`；并以 `restartTermination.newWorkerRole` 文案整体闭合 |
| Runtime hard crash 无恢复链 | `recoveryOwnership.runtime_hard_crash_restart` + `phaseRecoveryCases[5]` owner=`product_reattach_recovery`, action=`existing_recover_by_current_sourceIdentity_match_authoritativeTaskId`；`runtime_graceful_sigterm` 同 owner；`GET_404` stop polling |
| 内部/公共 FailureCode 边界未闭合 | `boundaryFailureNormalization` 14 项映射 + `scope` + `restartTermination.publicApiChange="none"` + `recoveryOwnership.publicApiChange="none"`、`newUserAction="none"` |

### 9.3 Minor

| ID | 描述 | 触发条件 | 关闭建议 |
|---|---|---|---|
| M-V6-D-01 | 当前 WXT manifest 未声明 `minimum_chrome_version: "116"`；A01 capability probe 列为门槛，但 R0 必须由 build 静态断言避免 R1 才补 | 由 `apps/chrome-extension/wxt.config.ts` diff 闭环 | R0 必须新增该字段，并提供 unit test 拒绝回退 |
| M-V6-D-02 | `wxt.config.ts` 当前 `connect-src` 未列显式 localhost-only CSP；架构 §6 / acceptance A11 把 loopback CSP 列硬门槛 | 同上 | R0 应在 `manifest.content_security_policy.extension_pages.connect-src` 严格仅留 `http://127.0.0.1:17861 ws://127.0.0.1:17861`（当前已含 ws，本项保留以防回退） |
| M-V6-D-03 | Archify HTML visual-check skipped（WSL 无 Chrome executable）—— 文档原样声明视觉审阅 pending，不可作 visual PASS | 已知宿主限制 | 后续有真实 Chrome 视觉流水线时再独立复审 |
| M-V6-D-04 | 30 负例中 10 项 FailureCode（`ALREADY_ACTIVE` / `AUDIO_SHAPE_INVALID` / `BINDING_MISMATCH` / `BYTE_LIMIT` / `DURATION_LIMIT` / `EMPTY` / `FINALIZE_FAILED` / `TICKET_*` 三项）未通过 30 负例直接覆盖；分别由 `second_start_message → STREAM_INVALID` / `transcript_* 注入 → FINALIZE_FAILED` / ticket 来自 Runtime 边界归一 / 超限由 Runtime 端保证。当前 acceptance §4 矩阵把它们分发到对应注入点和 ticket-binding 路径，未在 wire mutation 中显式出现 | 当前 schema 与 architecture 边界已声明 | R0 出门补充跨层 fixture（Runtime-side ticket 拒绝、acquisition 容量超限）以保证 20 项 FailureCode 在不同层都被实际路径触发 |

四项 Minor 都不影响 v6 文档作为合同候选的可信度；它们属于 R0/R1/R4 实施闭环要补的细节，由后续 R 阶段 owner 关闭。

---

## 10. 结论

**`DOCUMENT PASS / IMPLEMENTATION REQUIRES EXPLICIT USER AUTHORIZATION`**

依据：
- 18/18 SHA-256 一致，无 Fatal
- 8/8 verifier 内置 digest 独立复算一致
- verifier baseline 34/34 PASS
- 22/22 对抗变异均被 verifier exit≠0 捕获
- v5 五项 Major 全部由 v6 文档闭环
- sender 单 Offscreen ExtensionContext 验证 + Chrome 116 capability probe 已写入 R0 / A01 必改项
- sink finalize 严格非 terminal；五注入点统一幂等 FAILURE
- restart 5-phase 全有 owner，且 publicApiChange == "none" / "newUserAction" == "none"
- 30 负例 ID 与 mapping 严格闭合
- 20 项内部 FailureCode 与 14 项 boundary normalization 闭合
- 完整 goal 仍要求双外审 Fatal=0/Major=0 + 用户明确批准后才可进入 R0 编码

本 v6 candidate 满足文档 PASS；**实施仍 NO-GO**，须由用户在 v5 双外审 Fatal=0/Major=0 之后再明确批准 R0-R7，主干才可启动 P0 实施。P1 六视频继续 BLOCKED。

约束：本审查为外审包内只读审查；不替签 R0-R7 出门；不对 P0/P1 PASS 出具有效意见。
