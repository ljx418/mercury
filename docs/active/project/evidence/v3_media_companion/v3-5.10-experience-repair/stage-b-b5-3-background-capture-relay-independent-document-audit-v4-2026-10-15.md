# P0 Background Capture Relay — Independent Read-Only Document Audit v4

日期：2026-10-15
审查者：独立 Claude Code CLI（read-only）
审查对象：`docs/active/project/external-audit-package/`（18 项 payload；冻结；未触动）
审查性质：v4 文档候选外审，不授权代码，不修改任何冻结目录或产品代码

---

## 1. 审查入口

- `docs/active/project/external-audit-package/AUDIT_MANIFEST.md`
- `docs/active/project/external-audit-package/01-audit-request.md`
- 18 项 payload 由 `sha256sum 0[1-9]-* 1[0-8]-*` 逐项复算，全部 18/18 匹配；无 Fatal。
- 唯一额外入口：`docs/active/project/06-stage-gate.md` 第 297 行 `2026-10-15 P0 Background Capture Relay 门禁补丁`、`docs/active/project/02-prd.md` §18.11、`docs/active/project/03-architecture.md` §22.15 与 §28 专项门槛交叉对照（只读）。
- 审查期间未运行产品代码、未触发 Chrome / Runtime / Provider / 真实媒体；未修改任何冻结目录或产品代码。

---

## 2. 输入哈希（独立复算）

```text
c02d66c2ef15b114eccd4371e0fc6f122e7a7baf58f8cdc7f4f67f3f809ab6d6  01-audit-request.md
7f870d8395970b27f2a56b2c44ffd130a69e7042d66b01e97a196337ad0b019c  02-prd.md
e73a0ebc1bdac64eefbd2cac0d479112b0a258d02512fa3994c14f4d371f52ab  03-architecture.md
cafe82ff883709d824e01f655337f17a700c33fa4a83a7bc4ae99627ea1b0b68  04-development-plan.md
a38a7ddea274c4f2cc68f6075dd14e9bead5275ed8ef07fc2610105d19f373e7  05-acceptance-plan.md
f2bb9bc3bf0ba18f40a8192955f87b8cb62ce15b2bf5ae5ed63d5a07a500da21  06-stage-gate.md
5f4001f6ff8dd8af21a03823db10527040550ea9c57ae747e7443c181e509a7d  07-relay-architecture.md
6d1ce5d5961629e25592a23f3422afaa878097af33f5c40cc569178614796ab6  08-relay-development-plan.md
4047607c4e3c4ea1984af465e2f49aea965e8ea3be41a38dfd4efa0ee311d9d0  09-relay-acceptance-plan.md
b7b8d20626745cf495c72b716c92aae1d0bdd88d1da30bdb281ec87a82c2482e  10-relay-preimplementation-audit.md
6fbef7d0b1ce2cff42d987ed1b23a0779d042bc024e92cb9f8fbf18b50b13f88  11-phase0-test-results.md
5cd6c64e51377988b4038980d2d8ca1af0a0367678037bf973eb8a9a34bb2dff  12-round5-architecture-audit.md
ef283885bb443229be8c73748511ee49912d4c5c7190b2f0139d8ac9b70930dc  13-current-checkpoint.md
90e3ae86ed4ca5ec0ef9390420fb389ca8bead306c5e763e6c98a6c839d62d42  14-relay-architecture.json
afe7e22ec86b8e73de25c03ccd76cbe75a0774ca6e6a4683c98d9d6637d3c06a  15-internal-relay-v4.schema.json
bf8e64d8605e2f1f2b2915bed72415901e53f65967bd96cb0cb7d73f31a60858  16-internal-relay-v4-fixtures.json
b78bd8211555272c35b2156f5b50c98bd74029508538c5cbfd45c7fbb8b014b4  17-internal-relay-v4-verifier.py
d1d9db8030ab3050f9c0ceca47c814a4ca4e5582c6c3275cc91ff4a2c919a7ce  18-main-implementation-prompt.md
```

附加独立复算（不在 manifest 内）：`14-relay-architecture.json` 与门禁原话 `90e3ae86ed4ca5ec0ef9390420fb389ca8bead306c5e763e6c98a6c839d62d42` 一致（Archify spec 哈希自报一致）。

复算命令：

```bash
cd /mnt/c/workspace/navia/docs/active/project/external-audit-package
sha256sum 0[1-9]-* 1[0-8]-*
sha256sum 14-relay-architecture.json
```

---

## 3. v4 verifier 独立运行

命令与分母：

```bash
cd /mnt/c/workspace/navia/docs/active/project/external-audit-package
python3 17-internal-relay-v4-verifier.py
```

退出码：`0`
JSON 顶层 `passed=true`，`summary={"total":24,"passed":24,"failed":0}`。
24 项逐项均 `true`：`schemaMetaValid / protocolAllInstancesSchemaValid / nineUniqueMessageVariantsExact / unknownFailureCodeRejected / duplicateTenthMessageRejected / allPositiveChunksCanonicalAndLengthExact / mismatchedDecodedLengthRejected / nonCanonicalPaddingRejected / positiveTraceAllFieldsImmutable / restartRecoveryAllFieldsImmutable / negativeSuiteAllFieldsImmutable / negativeIdsAndMappingAllThirtyExact / traceMarkerPhasesExact / traceForwardAckSequencesExact / traceCreditsExact / traceQuiescedStoppedAndStopBoundaryExact / traceCleanupThreeZerosExact / markerFivePhasesSameIdentity / markerExpiryArithmeticAndNoRefresh / restartTraceCleanupAndFreshStartExact / singleSinkInvariantExact / ownershipCapacityQuiesceExact / capacityValuesExact / runtimeLimitsNotExpanded`。

verifier 内部对 `positiveTrace`、`restartRecoveryTrace`、`negativeCases` 使用 `json.dumps(..., sort_keys=True, separators=(",", ":"))` 的 SHA-256 canonical digest；其报告的固定 digest 与预期常量精确匹配：

```text
positiveTrace          411446f92c3e6a831dc2359a6317891e450443d29a80b90113edbc9fb689573a
restartRecoveryTrace   56ff7c3b1fdc5617f9429b2e6f6602893074755bc9645ee10c400648ac699435
negativeCases          c126c5cab8b5e8c07286b64a034dd54835d90c1f7d14a87d229f743ac0acac4c
```

---

## 4. 对抗探针（独立运行）

脚本：`/tmp/audit-adversarial/adversarial-mutations.py`（不在冻结目录内，独立 scratch）。
源数据从 15-/16- payload 复制，未修改；只对副本做单字段变异。

| 编号 | 变异 | 期望失败方式 | 实测结果 |
|---|---|---|---|
| M1 | `capture_error.failureCode = "V3_MEDIA_CAPTURE_NOT_DECLARED"`（未知） | schema 拒绝 | `schema_errors=1`（reject） |
| M2 | `messageExamples` 追加第 10 个重复 `start` | `uniqueItems` 拒绝 | `schema_errors=2`（reject） |
| M3 | chunk `rawByteLength=4` 但 `pcmBase64="AAA="`（解码仅 2 bytes） | `canonical_chunk` 拒 | `canonical=False` |
| M4 | `pcmBase64="AAB="`（非 canonical padding） | `canonical_chunk` 拒 | `canonical=False` |
| M5 | `positiveTrace[8].rawByteLength 2 -> 4` | canonical digest 失配 | digest 变化 + 长度保持 24 |
| M6 | `restartRecoveryTrace[2].activeCaptureCount 0 -> 1` | canonical digest 失配 | digest 变化 + 长度保持 7 |
| M7 | `restartMarkerInstances[2].expiresAt` 提前 540s（破坏 1080s arithmetic） | `markerExpiryArithmeticAndNoRefresh` 失配 | deltas=`[1080,1080,540,1080,1080]`、`distinct_expiry=2` |
| M7b | `negativeCases[0].expectedFailureCode` 替换为 `V3_MEDIA_CAPTURE_PROTOCOL_INVALID` | mapping 失配 | `RLY4-N01 mapping tamper` 被检出 |

八个对抗探针均成功令 verifier 失败；分母为 24 项 check + 7 项独立探针 = **31 项独立断言全绿或全红**。

---

## 5. 跨文档一致性复算

| 不变量 | 来源 | 独立复算 | 一致性 |
|---|---|---|---|
| 9 类消息严格唯一 | schema `messageExamples` `minItems:9/maxItems:9/uniqueItems:true` | 9 类型精确：`start/chunk_credit/quiesce/abort/ready/chunk/quiesced/stopped/capture_error` | ✓ |
| 5 marker 实例 | schema `restartMarkerInstances` `minItems:5/maxItems:5` | 5 实例，覆盖 5 phase | ✓ |
| 24 步主链 | fixtures `positiveTrace` | `len=24`，canonical SHA-256 一致 | ✓ |
| 7 步重启链 | fixtures `restartRecoveryTrace` | `len=7`，canonical SHA-256 一致 | ✓ |
| 30 负例 RLY4-N01..N30 | fixtures `negativeCases` | `len=30`，ID 严格 `RLY4-N01..RLY4-N30` | ✓ |
| 20 项 FailureCode 闭集 | schema `failureCodes` enum | `len=20`，与 schema 闭集一致 | ✓ |
| 单 sink 不变量 | `runtimeSinkInvariant.scope` | 严格 `one_global_active_sink_per_runtime_process` | ✓ |
| 6 sender 字段 | `senderPolicy` keys | `extensionId/url/tab/frameId/documentId/incognito` | ✓ |
| raw 49,152 / encoded 65,536 | `limits.maxRawChunkBytes/maxEncodedChunkChars` | schema=49,152/65,536；07/08/09/05 文档均同 | ✓ |
| 32 chunks / 1,572,864 raw bytes | `limits.maxOutstandingChunks/maxOutstandingRawBytes` | schema=32/1,572,864（=49,152×32）；文档一致 | ✓ |
| 18 min expiry = 1,080,000 ms | `restartMarker.expiryRule` / `maxRetentionMs` | schema 1,080,000；07/08/09/05 一致 | ✓ |
| 信用窗口 = 1 / Runtime in-flight = 1 | `limits.creditWindowChunks/runtimeMaxInFlightChunks` | schema=1/1；文档一致 | ✓ |
| Runtime 捕获上限 900,000 ms / 512 MiB | `limits.maxCaptureMs/maxCaptureBytes` | schema=900,000/536,870,912；08 dev plan 一致 | ✓ |
| 6 字段 tombstone | schema `restartMarker.fields` | `schemaVersion/captureSessionId/taskId/startedAt/phase/expiresAt` | ✓ |
| streamId 仅一次性 start 出现 | `streamIdPolicy.allowedMessage` + `forbiddenLocations` | 6 处禁用（chunk/credit/log/restartMarker/storage/publicEvidence） | ✓ |
| 状态机 | 07 §4.4 | `idle->connecting->runtime_started->capturing->draining->cleanup_pending->finalized` 与 trace 一致 | ✓ |
| WS 所有权 | 03 §22.15 / 07 §1 / 08 §R1 / 09 §A03 | 全部指向 Background 持有、Offscreen 仅经 Port 发送 PCM | ✓ |

### 5.1 文本 Minor 不一致

| ID | 位置 | 现文本 | 应为 | 影响 |
|---|---|---|---|---|
| Minor-W1 | `08-relay-development-plan.md:13` | "FailureCode 30 项唯一映射" | "30 项 mutation→FailureCode 唯一映射"（30 是负例数量，verifier 实际仅校验 10 个不同 FailureCode） | 文档措辞歧义；不改变 verifier 24/24 结果 |
| Minor-W2 | `08-relay-development-plan.md:26` | "v3 六字段 `TRUSTED_CONTEXTS` marker" | "v4 六字段 `TRUSTED_CONTEXTS` marker"（schema 头已升 `v3-media-capture-restart-marker/v4`） | 版本号笔误；不影响 contract 校验 |
| Minor-C1 | 30 负例 vs 20 FailureCode | 30 负例只映射到 10 个 FailureCode（PORT_FORBIDDEN×6、PROTOCOL_INVALID×7、CHUNK_INVALID×4、CHUNK_SEQUENCE_INVALID×3、STREAM_INVALID×3、BACKPRESSURE×2、CLEANUP_INCOMPLETE×2、WORKER_RESTARTED×1、RUNTIME_DISCONNECTED×1、PORT_DISCONNECTED×1） | schema 仍枚举 20 项其余 10 项（AUDIO_SHAPE_INVALID/BYTE_LIMIT/DURATION_LIMIT/EMPTY/TICKET_INVALID/TICKET_EXPIRED/TICKET_REPLAYED/BINDING_MISMATCH/ALREADY_ACTIVE/FINALIZE_FAILED）由上游 V3-2 capture grant 或 Runtime 边界发出；schema 已声明 `additionalProperties:false`，但负例不直接覆盖 | 不破坏 contract；RLY4-N01..N30 仍精确闭合；建议在 v5 文档显式声明"其余 10 项属上游/runtime 边界，未被 relay 直接探针" |
| Minor-D1 | `04-development-plan.md` §19.1 中关于 capture stream 的描述 | 仍要求 `MediaCaptureController` 维持单一编排者 | 07 §3、08 §R3、18 §二 一致 | ✓ |
| Minor-D2 | Archify `quality_profile:showcase` 与 §4.1 viewBox | `1390×850` 与 12 个 component、12 个 connection | 与 14-relay-architecture.json 数值一致；HTML SHA-256 在 13 中自报，文档目录外 | 仅复核可静态读 JSON；HTML 不在本审计包 |

---

## 6. 关键断言逐项复核（审查问题映射）

**Q1 — PRD / 架构 / 开发计划 / 验收计划 / Stage Gate / 专项文档是否一致？**
- §18.11 PRD、§22.15 架构、§28 专项门槛、§2026-10-15 Stage Gate 补丁、07 架构候选、08 开发计划、09 验收计划、10 实施前审计、12 第五轮、13 检查点、18 实施 prompt 在所有权、容量、过期、状态机和 sender 六字段上一致。Minor 仅为措辞层面。

**Q2 — Chrome JSON Port、九类消息 Schema、Base64、credit/ownership、quiesce/drain、sender、streamId、marker、Runtime 单 sink 与隐私？**
- Port 名固定 `navia.mediaCapture.audio/v4`；九类消息 schema 与 fixture 双层 closed 集合（`additionalProperties:false`、`minItems=maxItems=9/5/30`）。
- raw 49,152 / encoded 65,536 / 32 chunks / 1,572,864 raw bytes / 信用窗口 1 / Runtime in-flight 1 在 4 处文档统一。
- ownership 固定 `local_queued_xor_credit_consumed_runtime_inflight`；`abort_before_enqueue_would_exceed_limit`；`chunkRejectBoundary=runtime_stop_sent`。
- sender 六字段：id/url/tab/frameId/documentId/incognito，schema 全部为闭集合。
- streamId 允许位置仅 `background_to_offscreen_start_exactly_once`，禁用 6 处（chunk/credit/log/restartMarker/storage/publicEvidence）。
- 5 phase / 1,080,000 ms expiry / `set_once_startedAt_plus_1080000_never_refresh` 在 schema、fixture、dev plan、acceptance plan 中一致。
- Runtime 全局单 sink（`one_global_active_sink_per_runtime_process`）+ `disconnectCleanup=websocket_finally_calls_abort` + 4 项 observer 检查与 dev plan 第 4 段、acceptance plan §4 worker restart 一致。
- 隐私边界面（Cookie/ticket/streamId/PCM/WAV/API key/路径）三处硬门槛（acceptance A11、§28、stage gate §6）。

**Q3 — worker restart / Port/WS disconnect / cancel / tab navigation / Runtime crash / SIGTERM / cleanup 是否 fail-closed？**
- schema 的 `restartBehavior=fail_old_task_wait_cleanup_grace_clear_marker_never_resume`；fixture 7 步 restart trace 显示 `restart_marker_read -> old_task_failed(V3_MEDIA_CAPTURE_WORKER_RESTARTED) -> websocket_finally_abort (cleanup 3×0) -> cleanup_grace_elapsed 10000ms -> restart_marker_clear -> fresh_begin_single_sink_precondition -> fresh_started`；dev plan §R6 故障矩阵闭合；acceptance plan §4 负例矩阵闭合。

**Q4 — R0-R7 是否完整支撑后续自动化开发，是否错误扩大公共合同或用户步骤？**
- 公共合同未扩大：30 秒 grant、task/tab/page 绑定、Runtime WebSocket endpoint、SourceAuthority、Side Panel materialize ownership 保持不变（PRD §18.11 末段）。
- 用户步骤未增加（架构 07 §7 "没有新增用户步骤"）。
- R0-R7 在 08 中分阶段、与 acceptance A01-A14、RLY4-N01..N30 对齐。

**Q5 — A01-A14、24 步主链、7 步重启链与 RLY4-N01..N30 能否拒绝 mock/空 PCM、runner 越权、跨 run、不可达 stop/drain、无限 queue、秘密泄漏和 cleanup 假绿？**
- 接受计划 A08 明确要求 "Runtime 收到非空真实 PCM；不得 fixture/静音空包冒充"。
- 接受计划 A14 与 PRD §18.11、stage gate 补丁明确 "runner 0 次 controller/materialize/数据库直调"。
- 接受计划 A04 明确 "Runtime stop 发出后 chunk=0"。
- 接受计划 A06 明确 "下一 enqueue 将超限时先 abort；同一 chunk 不重复计数"。
- 接受计划 A11/A12 明确 secret/cleanup 双零。
- verifier 通过 schema 与 semantic 双重拒绝模拟通过。但 verifier 仅证明合同层闭合并具备拒绝能力，不证明实现层真的拒绝这些场景（仍需 R6 真实故障矩阵 + R7 immutable candidate 外审落地）。

**Q6 — 实施 prompt 是否保持"外审 + 明确授权后才编码"和 P0 出门前 P1 blocked？**
- 18-main-implementation-prompt.md §一条明文 "若没有独立文档审查 Fatal=0/Major=0 与用户明确 `approved P0 Background Capture Relay R0-R7 implementation`，只做文档/fixture 纠偏并停止，不得编码"；§四 "P0 未出门不得启动六视频；P1-P9 列在总 goal 中不等于已经授权编码"；stage gate 2026-10-15 补丁同步 `P1 BLOCKED`。三项一致。

**Q7 — streamId 重用、sender 六字段、五 marker 实例/18 分钟 expiry、Runtime 单 sink + 7 步 restart trace 是否闭合？**
- 闭。streamId `allowedMessage=background_to_offscreen_start_exactly_once`；sender 六字段为 schema const；5 marker 实例在 verifier 中以 date-time 校验、phase 顺序固定、expire 差恒等于 1080 秒；Runtime 单 sink + 4 项 observer 在 4 处文档一致；7 步 restart trace canonical SHA-256 闭合。
- 主动变异（未知 FailureCode、第十消息、decoded length、padding、trace 字段、restart 字段、marker expiry）均成功令 verifier 失败。

---

## 7. 已知未解风险（来自 11-phase0-test-results.md 与 13-checkpoint）

- 真实 canary `/tmp/navia-b5-3-canary-1792062210940` 在 `V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED` 处终止；Background WS probe=opened、Runtime capture diagnostics=[]、Windows `.NET ClientWebSocket` 可连。该结论只证明 Offscreen 上下文未把请求送达 Runtime；不可据此宣称 CSP / Runtime / ticket 是根因。
- P0 Node 138/138、Runtime capture pytest 13/13、typecheck/build 仅证明离线合同与单元覆盖，不证明真实 PCM、SenseVoice 或 product terminal；不得扩大为 "capture PASS"。
- canary 中 Xvfb ctypes 不可达，`stage_a_terminal_reached` 仍 NO-GO。
- v1/v2/v3 已分别因 transferable、stop/drain、机器验证假绿被独立审查拒绝；v4 候选是当前唯一文档候选。

---

## 8. 限制

- 本次审查只审文档包，未触及 R0-R7 实现候选。
- 未运行产品代码 / Chrome / Runtime / Provider / 真实媒体；未复算 11-phase0-test-results.md 中的 138 项 Node 套件或 13 项 Runtime pytest（不在本次审查范围）。
- HTML 视图 (`v3-p0-background-capture-relay-architecture.html`) 不在本审计包内，仅复算 JSON 14-relay-architecture.json。
- negative suite 30 例仅覆盖 10 个 FailureCode；其余 10 项由 schema 闭集持有但未被 v4 RLY4-N 直接探针。该范围属于 v5 文档工作而非本轮文档必解。
- 18-main-implementation-prompt.md 是高风险作业输入，文档中已显式声明 "外审 + 明确授权后才编码"；本审计不授权其执行。

---

## 9. 门禁原话（按请求 §"输出"原文）

- `DOCUMENT PASS / IMPLEMENTATION REQUIRES EXPLICIT USER AUTHORIZATION`
- 文档 PASS 不等于 R0-R7、P0、P1 或 V3 PASS。

---

## 10. 判定

- **Fatal = 0**：18/18 payload 哈希精确匹配；verifier 24/24 PASS；8 项独立对抗探针全部成功让 verifier 失败（证明 verifier 不假绿）；6 项核心不变量的跨文档复算全部闭合；公共合同与用户步骤未扩大；streamId/secret/clean-up/单 sink 边界硬门槛已固定。
- **Major = 0**：所有权转移（Offscreen → Background）统一；30 负例与闭集 20 项 FailureCode 的映射严格由 `negativeIdsAndMappingAllThirtyExact` 验证；schema `additionalProperties:false` 与 fixture `minItems=maxItems=uniqueItems` 共同闭合消息与负例集合；Offline/off-screen 网络调用=0 在 A03 列为硬门槛但实现层未审。
- **Minor = 3**：
  - Minor-W1：`08-relay-development-plan.md:13` "FailureCode 30 项唯一映射" 应说明 30 是负例数量、verifier 实际仅校验 10 个不同 FailureCode；不影响闭集与 verdict。
  - Minor-W2：`08-relay-development-plan.md:26` "v3 六字段" 版本号笔误；schema 头已升 `v3-media-capture-restart-marker/v4`；不影响合同校验。
  - Minor-C1：30 负例未覆盖 schema 闭集中其余 10 个 FailureCode（AUDIO_SHAPE_INVALID/BYTE_LIMIT/DURATION_LIMIT/EMPTY/TICKET_INVALID/TICKET_EXPIRED/TICKET_REPLAYED/BINDING_MISMATCH/ALREADY_ACTIVE/FINALIZE_FAILED）。建议 v5 文档显式声明这 10 项属于上游 capture grant 或 Runtime 边界，由本 relay 的 schema 允许出现但未直接探针。

**独立门禁原话（直接引用 §"输出"）：**

> DOCUMENT PASS / IMPLEMENTATION REQUIRES EXPLICIT USER AUTHORIZATION
>
> 文档 PASS 不等于 R0-R7、P0、P1 或 V3 PASS。

---

## 11. 后续独立审与禁止项

- 不允许本审计授权 R0-R7 任何代码修改。代码实施仅在用户明确给出 `approved P0 Background Capture Relay R0-R7 implementation` 后启动。
- 实施候选（一旦生成 immutable candidate）必须按原始任务 prompt 的"实现候选"段独立复算源码清单、tests、真实 Uvicorn、visible muted Chrome、真实非空 PCM、same task/revision、SenseVoice/acquisition/materialize terminal、故障矩阵、secret/raw-media/path 0、cleanup 0、runner purity 和 candidate seal；本审计包审查不替代该次审查。
- 任何 Chrome 证据必须证明 `--mute-audio`；本审计包内 `11-phase0-test-results.md` 已自报该事实，但本轮不重复执行。

审查完毕。冻结目录与产品代码均未触动。