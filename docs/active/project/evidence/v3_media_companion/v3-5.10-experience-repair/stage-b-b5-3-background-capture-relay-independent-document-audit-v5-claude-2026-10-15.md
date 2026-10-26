# Stage B B-5.3 P0 Background Capture Relay v5 — 独立只读文档审查（Claude）

日期：2026-10-15。
审查者：独立 Claude session（只读）。
对象：`docs/active/project/external-audit-package/` 已冻结 v5 平铺包（18 文件）。
性质：v5 immutable document candidate 外审（不是 implementation audit）。
约束：未运行 Chrome / Runtime / Provider；未播放声音；未修改除本报告之外的任何文件。

---

## 1. 审查入口与依赖文档

依据本仓库 `AGENTS.md` 与 `01-audit-request.md` 的指令，本轮审查：

- `external-audit-package/AUDIT_MANIFEST.md`（SHA-256 manifest）
- `02-prd.md` §18.11（V3 P0 可信捕获内部中继纠偏）
- `03-architecture.md` §22.15（P0 Background Capture Relay 增量架构）
- `04-development-plan.md` §19.1（P0 Background Capture Relay 恢复切片）
- `05-acceptance-plan.md` §28（P0 Background Capture Relay 专项门槛）
- `06-stage-gate.md`（V3 Media Companion Stage Gate + 2026-10-15 P0 门禁补丁）
- `07-relay-architecture.md` / `08-relay-development-plan.md` / `09-relay-acceptance-plan.md` / `10-relay-preimplementation-audit.md`（v5 专项四件套）
- `11-phase0-test-results.md`（Phase 0 测试结果，证明 `BV1pohR6rEEh` 单视频仍 `NO-GO`）
- `12-v5-replan-closure.md`（v5 重规划闭环；本轮 v4 -> v5 关闭三项 Major 的设计依据）
- `13-current-checkpoint.md`（v5 文档冻结检查点）
- `14-relay-architecture.json`（Archify v5 spec，与 handoff 13 公布的 spec SHA-256 比对）
- `15-internal-relay-v5.schema.json` / `16-internal-relay-v5-fixtures.json` / `17-internal-relay-v5-verifier.py`（机器权威 + verifier）
- `18-main-implementation-prompt.md`（ClaudeCode CLI 完整 goal）
- `handoffs/v3-claudecode-completion-2026-10-15/13-p0-background-capture-relay-document-freeze.md`（handoff 13；spec SHA-256 公布值）

## 2. 输入复算（18 项 SHA-256）

复算命令（在本仓库根目录）：

```bash
cd /mnt/c/workspace/navia/docs/active/project/external-audit-package
sha256sum 0[1-9]-* 1[0-8]-*
```

实际输出（仅 SHA-256 字段）：

| 文件 | 实际 | Manifest 公布 | 一致 |
|---|---|---|---|
| 01-audit-request.md | `545816ff8fbf376d5bcef0e65ffed8f63a4e9ee8e6734082f2ae46313529af5e` | `545816ff8fbf376d5bcef0e65ffed8f63a4e9ee8e6734082f2ae46313529af5e` | ✓ |
| 02-prd.md | `0e3279a9901e2b8b98a76805e66dede42094418f3c41904f43232258b203f2c6` | 同 | ✓ |
| 03-architecture.md | `99b5626d64698be3ffa334d17feedd668257e8c18ebc6c3a2f804779a80a17b6` | 同 | ✓ |
| 04-development-plan.md | `920a701650468f26d2a8ca995069d300e0d166a63d0ee87f2ef2d4272b98730f` | 同 | ✓ |
| 05-acceptance-plan.md | `8656b64e5081e4eeb1c54acdaf8261d82f15d39567e25e349aca174d0920cbb8` | 同 | ✓ |
| 06-stage-gate.md | `375694763e846c77c43e0c14a03c2cfeff0612023cfcba20a0257b6437e69f84` | 同 | ✓ |
| 07-relay-architecture.md | `f837d6c84bfa47ca5bbce6e2960e978d1a9d3f83cf347dbc16c17ae754714f7a` | 同 | ✓ |
| 08-relay-development-plan.md | `5150f960ba16c8288fca075e80d6ab91d3bce8fa00747edec36e06b23ed663f2` | 同 | ✓ |
| 09-relay-acceptance-plan.md | `d8cb34e94174567f624fbfc894cb47c280375601812c1e86409e7bdaee894cbf` | 同 | ✓ |
| 10-relay-preimplementation-audit.md | `476f67bd6628e455714aea597360c9707360d3b38aa1789cba28c715f2f141b1` | 同 | ✓ |
| 11-phase0-test-results.md | `6fbef7d0b1ce2cff42d987ed1b23a0779d042bc024e92cb9f8fbf18b50b13f88` | 同 | ✓ |
| 12-v5-replan-closure.md | `357ab6e92309b936b863a4ec3a7ccc743b6eaa5161add6e80a517c3b6687a963` | 同 | ✓ |
| 13-current-checkpoint.md | `32edb65fd2e04e7e93f676df8b4e563dc634155d123c4dbbe3125ab1cb560ff8` | 同 | ✓ |
| 14-relay-architecture.json | `ae99de3a12a917f5720a3da200394524545901cb1f71d8e65d1c156ff4c17123` | 同 | ✓ |
| 15-internal-relay-v5.schema.json | `17af8e3de2aa8650e6cd15ece1b83285afb2d820d32cd67b13f1e9dc13ef192e` | 同 | ✓ |
| 16-internal-relay-v5-fixtures.json | `a1dc2d95de47833d2cc507586e11388d6e251cb1e4413e25ee920fd6eee124e6` | 同 | ✓ |
| 17-internal-relay-v5-verifier.py | `ea04110c0b64e6928205794800e5c0f522fcec8eb11ce57b2a63f93ba832cd93` | 同 | ✓ |
| 18-main-implementation-prompt.md | `f4dbc0beaed5b28b2f22eeaf248111b5b3cd5009d0d2a005dbae21d5f61aafff` | 同 | ✓ |

**18 / 18 全匹配**。平铺包未在审查期间发生任何字节级篡改。

Archify v5 spec（`14-relay-architecture.json`）SHA-256 与 `13-current-checkpoint.md`/`handoff 13` 公布的 `ae99de3a12a917f5720a3da200394524545901cb1f71d8e65d1c156ff4c17123` 一致。HTML SHA-256 不在本审计包内，需独立路径校验，本轮仅确认 spec 字段层面无改动。

## 3. verifier 在浅层 `/tmp` 重跑

`17-internal-relay-v5-verifier.py` 启动逻辑：先按 `HERE / "15-internal-relay-v5.schema.json"` 与 `HERE / "16-internal-relay-v5-fixtures.json"` 加载；不存在则向上 `parents[N]` 探测仓库根。本审查将三个平铺文件复制到 `/tmp/audit-v5-shallow/`，再执行 verifier，确保浅层临时目录（无 `docs/active/project` 父路径）也能跑通：

```bash
mkdir -p /tmp/audit-v5-shallow
cp /mnt/c/workspace/navia/docs/active/project/external-audit-package/{15-internal-relay-v5.schema.json,16-internal-relay-v5-fixtures.json,17-internal-relay-v5-verifier.py} /tmp/audit-v5-shallow/
cd /tmp/audit-v5-shallow && python3 17-internal-relay-v5-verifier.py
echo $?
```

实际输出（缩略）：

```json
{
  "schemaVersion": "v3-media-capture-internal-relay-v5-verification/v1",
  "passed": true,
  "checks": {
    "schemaMetaValid": true,
    "protocolAllInstancesSchemaValid": true,
    "nineUniqueMessageVariantsExact": true,
    "unknownFailureCodeRejected": true,
    "duplicateTenthMessageRejected": true,
    "allPositiveChunksCanonicalAndLengthExact": true,
    "mismatchedDecodedLengthRejected": true,
    "nonCanonicalPaddingRejected": true,
    "positiveTraceAllFieldsImmutable": true,
    "restartRecoveryAllFieldsImmutable": true,
    "negativeSuiteAllFieldsImmutable": true,
    "negativeIdsAndMappingAllThirtyExact": true,
    "traceMarkerPhasesExact": true,
    "traceForwardAckSequencesExact": true,
    "traceCreditsExact": true,
    "traceQuiescedStoppedAndStopBoundaryExact": true,
    "traceCleanupThreeZerosExact": true,
    "markerFivePhasesSameIdentity": true,
    "markerExpiryArithmeticAndNoRefresh": true,
    "senderSourceAndIncognitoResolutionExact": true,
    "restartTerminationOwnerAndNoPublicApiExact": true,
    "restartTraceCleanupAndFreshStartExact": true,
    "singleSinkInvariantExact": true,
    "ownershipCapacityQuiesceExact": true,
    "capacityValuesExact": true,
    "runtimeLimitsNotExpanded": true
  },
  "schemaErrors": [],
  "summary": {"total": 26, "passed": 26, "failed": 0}
}
```

退出码 `0`。**分母 = 26，已达成 26 / 26 PASS**。verifier 不会因 `parents[N]` 浅层临时目录崩溃；`12-v5-replan-closure.md` 提到的 v5 Minor “复制到浅层 `/tmp` 仍可运行” 已在本审查复算关闭。

## 4. 对抗变异（亲自执行）

按 `01-audit-request.md` §“对抗动作”要求，本人执行了下列对抗，全部命中 verifier/schema 的预期拒绝位：

```text
mutation:senderPolicy_trust_payload_only          REJECTED (additionalProperties:false)
mutation:minimumChromeVersion_110                  REJECTED (const 116)
mutation:duplicate_tenth_start                     REJECTED (uniqueItems on messageExamples)
mutation:chunk_noncanonical_padding_AAB=           REJECTED (canonical_chunk, validate=True)
mutation:chunk_decoded_length_mismatch_4_vs_2      REJECTED (canonical_chunk length check)
mutation:capture_error_unknown_failure_code         REJECTED (failureCode enum)
mutation:chunk_contains_streamId                   REJECTED (additionalProperties:false)
mutation:marker_contains_streamId                  REJECTED (additionalProperties:false)
mutation:marker_contains_pcm                       REJECTED (additionalProperties:false)
mutation:marker_captureSessionId_wrong_format      REJECTED (sessionId pattern)
mutation:marker_expiry_60s_instead_of_1080000ms    ACCEPTED-BY-SCHEMA (no schema format on gap; verifier enforces)
mutation:marker_contains_ticket                    REJECTED-BY-SCHEMA (additionalProperties:false)
mutation:marker_contains_apiKey                    REJECTED-BY-SCHEMA
mutation:marker_contains_cookie                    REJECTED-BY-SCHEMA
mutation:restartTermination.publicApiChange_yes    REJECTED (const "none")
mutation:restartTermination.owner_background_new_worker  REJECTED (const owner)
mutation:restart_trace_activeCaptureCount=1        DETECTED (cleanup three zeros invariant broken)
mutation:restart_trace_new_worker_writes_task      DETECTED (digest != EXPECTED_RESTART_TRACE_SHA256)
```

逐字段 24 步主链（`positiveTrace`）、8 步重启链（`restartRecoveryTrace`）与 30 项负例（`RLY5-N01..N30`）的 SHA-256 immutable digest 与 `EXPECTED_*_SHA256` 全匹配；正向序列 `[(-1,1),(0,1),(1,1)]`、正向 chunk 长度 `[(0,2),(0,2),(0,2),(1,2),(1,2),(1,2)]`、cleanup 三零 `[0,0,0]` 均经复算确认。

## 5. Chrome 116 / `runtime.getContexts` 边界

- `15-internal-relay-v5.schema.json` 的 `senderPolicy.minimumChromeVersion` 强制 `const: 116`；`capability` 明确 `chrome.runtime.getContexts_required_no_runtime_downgrade`。
- `06-stage-gate.md` §“2026-10-15 P0 Background Capture Relay 门禁补丁” 与 `05-acceptance-plan.md` §28 都把 `minimum_chrome_version: "116"` 列为 R0 必改项，并禁止“旧浏览器弱 sender 校验降级”。
- `07-relay-architecture.md` §4.1 与 `03-architecture.md` §22.15 都把 incognito 解析固定为 `runtime.getContexts(documentId)` 唯一 `OFFSCREEN_DOCUMENT` 的 `ExtensionContext.incognito` 对比，不依赖 MessageSender。
- 文档没有为 Chrome < 116 留下回退；任何后续 attempt 若弱化 sender 校验、降低 Chrome 最低版本或读取 `MessageSender.incognito`，都会被本审查判定为阻断。

Chrome 116 boundary：**完整闭合**。

## 6. sender / restart / sink 关键归属（按 v4 失败点）

v4 因三项 Major 被独立 reviewer 打回：

1. `MessageSender.incognito` 不存在 → v5 已仅从 MessageSender 读取 `id/url/tab/frameId/documentId`；`incognito` 由 `runtime.getContexts(documentId)` 的 `OFFSCREEN_DOCUMENT` ExtensionContext 提供。
2. 旧任务终结 owner 缺失 → v5 把终结固定到 Runtime WS handler `finally`：`RuntimeCaptureSink.abort()` → `MediaAcquisitionCoordinator.fail_capture_stream`（内部调用，幂等，`publicApiChange: "none"`）。
3. v3/v4 权威混用 → v5 schema/fixture/verifier、Port、marker、负例、提示词统一为 `navia.mediaCapture.audio/v5` + `v3-media-capture-internal-relay/v5` + `RLY5-N01..N30`；v1-v4 在 `10-relay-preimplementation-audit.md` §3.1 与 `12-v5-replan-closure.md` 中明确被禁止实现。

`restartTermination` 的核心字段逐一对照（亲自读取 fixtures）：

| Field | 期望 | 实际 | 一致 |
|---|---|---|---|
| `owner` | `runtime_websocket_handler_finally` | `runtime_websocket_handler_finally` | ✓ |
| `trigger` | `unexpected_websocket_disconnect_after_valid_start_before_terminal` | 同 | ✓ |
| `cleanup` | `RuntimeCaptureSink.abort_then_require_three_zero_receipt` | 同 | ✓ |
| `operation` | `MediaAcquisitionCoordinator.fail_capture_stream_internal_call` | 同 | ✓ |
| `taskIdSource` | `validated_start.taskId` | 同 | ✓ |
| `taskFailureCode` | `V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED` | 同 | ✓ |
| `newWorkerRole` | `poll_existing_GET_acquisition_until_terminal_wait_cleanup_grace_clear_marker_never_write_task` | 同 | ✓ |
| `publicApiChange` | `none` | `none` | ✓ |

`senderPolicy` 七项（亲自读取）：

```text
extensionId   = messageSender.id_equals_runtime.id
url           = messageSender.url_equals_runtime.getURL_offscreen
tab           = messageSender.tab_absent
frameId       = messageSender.frameId_absent_or_zero
documentId    = messageSender.documentId_required_nonempty_bind_first_reject_replacement
incognito     = runtime.getContexts_by_documentId_returns_exactly_one_OFFSCREEN_DOCUMENT_and_context.incognito_equals_chrome.extension.inIncognitoContext
capability    = chrome.runtime.getContexts_required_no_runtime_downgrade
minimumChromeVersion = 116
```

## 7. RLY5-N01..N30 闭集

亲自读取 `16-internal-relay-v5-fixtures.json` 的 `negativeCases`：

- 总数 = 30；
- caseId 严格 `RLY5-N01` ... `RLY5-N30`；
- 30 个映射覆盖 10 个唯一 FailureCode（relay 直接探针），其余 10 个 FailureCode 在 grant/Runtime owner 边界验证（`12-v5-replan-closure.md` 已声明）。代码覆盖分布：

```text
V3_MEDIA_CAPTURE_BACKPRESSURE                       2
V3_MEDIA_CAPTURE_CHUNK_INVALID                      4
V3_MEDIA_CAPTURE_CHUNK_SEQUENCE_INVALID             3
V3_MEDIA_CAPTURE_CLEANUP_INCOMPLETE                 2
V3_MEDIA_CAPTURE_PORT_DISCONNECTED                  1
V3_MEDIA_CAPTURE_PORT_FORBIDDEN                     6
V3_MEDIA_CAPTURE_PROTOCOL_INVALID                   7
V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED               1
V3_MEDIA_CAPTURE_STREAM_INVALID                     3
V3_MEDIA_CAPTURE_WORKER_RESTARTED                   1
```

20 项 FailureCode 闭集已固化在 `failureCodes` 常量字段；verifier 的 `EXPECTED_FAILURES` 与 `negativeCases` 的 `expectedFailureCode` 逐项对齐，未发现“30 个不同 code”的误解。

## 8. 状态机 / 单 sink / 隐私 / 单视频 canary

- 状态机 `idle -> connecting -> runtime_started -> capturing -> draining -> cleanup_pending -> finalized`，`aborted` / `failed` 两条旁路，与 `04-development-plan.md` §R0 阶段状态机匹配。
- `runtimeSinkInvariant` 强制 `one_global_active_sink_per_runtime_process` + `begin_succeeded_with_no_prior_active_sink`；observer 列表含 old task terminal、activeCaptureCount=0、residualRawAudioCount=0、private_temp_audio_count=0、fresh `started`。`verifier` 已逐项校验。
- 隐私：A11 公开命中 0（Cookie/ticket/streamId/PCM/WAV/API key/私有路径），与 A14 false-green 一起要求在 R5 fresh muted Chrome canary 中真实落盘。`11-phase0-test-results.md` §11/§12 仍记录 `BV1pohR6rEEh` 真实 canary `NO-GO`（`capture-command-not-observed` 等）；本轮文档不主张 P0 已 PASS。
- 单视频 canary：`13-current-checkpoint.md` 与 `11-phase0-test-results.md` §12 显示最新一次真实静音 Chrome run 为 `/tmp/navia-b5-3-canary-1792062210940`，以 `V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED` 非零结束，cleanup failure=0、secret leak hit=0，且全部 Chrome 命令含 `--mute-audio`。文档未伪造“单视频 PASS”。

## 9. 发现清单

### 9.1 Fatal

无。

### 9.2 Major

无。

依据：

- 18 / 18 payload SHA-256 匹配；
- 26 / 26 verifier PASS 在浅层 `/tmp`；
- 亲自执行 18 组对抗变异全部命中预期拒绝位；
- 24 步主链 / 8 步重启链 / 30 项 RLY5-N01..N30 / 5 阶段 marker immutable digest 与 `EXPECTED_*_SHA256` 全一致；
- Chrome 116 boundary 闭合（`minimum_chrome_version: "116"` + `no_runtime_downgrade`）；
- `senderPolicy`、`restartTermination`、`runtimeSinkInvariant` 与 v5 重规划三项 Major 关闭设计逐字段对齐；
- 单视频 fresh muted Chrome canary 仍按文档记录为 `NO-GO`，未伪造 PASS；
- 秘密 / 原始媒体 / 私有路径 / Cookie / ticket / streamId 在公开证据中命中 0（本次审查未触发任何破坏）；审查者未启动 Chrome、Runtime、Provider，未播放声音。

### 9.3 Minor（不阻塞 document 出门；需在 R0-R7 实施期或下一轮 candidate 关闭）

- **M-1 标记器 schema 探测 = 文档承诺，实物能力待真实验证**。`senderPolicy.capability` 与 `runtime.getContexts_required_no_runtime_downgrade` 是契约性描述；`runtime.getContexts` 在 Chrome 116+ 是否真正出现，必须在 R0 实施期用真实 Chrome capability probe 给出可观测字节（`06-stage-gate.md` 已把 capability probe 列为门禁）；如该能力缺席，文档仍拒绝降级，candidate 必失败而非伪装绿色。
- **M-2 30 项负例到 10 项 code 的边界归属**。verifier 把 `EXPECTED_FAILURES` 与 30 项逐项对齐，但“relay 直接探针 10 项 code、剩余 10 项在 grant/Runtime owner 边界验证”是叙述性陈述；R0 实施期应给 grant/Runtime owner 边界的负例独立 fixture，避免与 relay fixture 混淆或被错误合并测试。
- **M-3 marker expiry 由 verifier 而非 schema 强制**。schema 允许任意日期时间字符串；`(expiresAt - startedAt) == 1080 秒` 仅由 verifier 算术验证。如果未来在主链/重启链 fixture 中修改 `expiresAt`，verifier 会立即拒绝，但 schema 不会。这是 v5 故意取舍（schema 2020-12 draft 不支持跨字段约束），但应写入 R0 测试守则。

## 10. 限制

- 本轮仅文档审计，未触碰任何产品代码、测试、既有证据或 candidate；
- 未启动 Chrome、Runtime、Provider；未播放声音；
- `handoff 13` 中提及的 HTML SHA-256（`352d0e4bd24057fab80c2d7f33b4b5b0bf4db9e8c68618cc92407e04e18e419e`）不在本平铺包内，未在本轮复算；
- Archify v5 spec 的展示/组合报告（showcase 9/9、composition 0 error/0 warning）按 `13-current-checkpoint.md` 的引用承认，但 `external-audit-package/` 不含 Archify 输出物；自动 browser visual-check 仍 pending，本轮仅承诺 spec JSON 字节级一致；
- 单视频 fresh canary 由 `11-phase0-test-results.md` 与 `13-current-checkpoint.md` 标注为 `NO-GO`，符合“文档不主张 P0 已 PASS”；
- 本审计只对 `external-audit-package/` 目录与四份评审档案 + handoff 13 + 04/05/06 章节负责；不重新审查 V3 整体或 V3-1/V3-2 历史候选。

## 11. 输出门禁原话

按 `01-audit-request.md` §“输出门禁”二选一结论如下：

> **DOCUMENT PASS / IMPLEMENTATION REQUIRES EXPLICIT USER AUTHORIZATION**

文档 PASS **不等于** R0-R7、P0、P1 或 V3 PASS；亦不等于代码授权。P0 实施仍需用户明确批准 `approved P0 Background Capture Relay R0-R7 implementation`，随后按 `18-main-implementation-prompt.md` 的 R0-R7 顺序与门禁执行：先单视频真实静音 canary、真实故障矩阵、immutable candidate 外审（实施级）、secret/cleanup 0，再启动 P1 六视频。

---

附：本审查唯一落盘文件：

- `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-background-capture-relay-independent-document-audit-v5-claude-2026-10-15.md`

未对任何其他文件做修改；未启动 Chrome / Runtime / Provider；未播放声音；未跨过 `parents[N]` 浅层限制；未伪造能力事实。