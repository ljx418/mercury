# V3 P0 Background Capture Relay v7 — 独立只读文档审查（Claude）

日期：2026-10-15。
审查者：独立 Claude 只读 reviewer（自身会话）。
reviewer：自身会话，不可被任一既有 reviewer PASS 覆盖。
性质：v7 immutable document candidate 外审；不构成 implementation audit，亦不构成实施授权。
依据：`docs/active/project/external-audit-package/01-audit-request.md`、`AUDIT_MANIFEST.md`、`docs/active/project/handoffs/v3-claudecode-completion-2026-10-15/15-claudecode-p0-relay-review-prompt.md`、`docs/active/project/handoffs/v3-claudecode-completion-2026-10-15/20-p0-relay-v7-replan-closure.md`。

---

## 1. 审查入口与依赖

按 `01-audit-request.md` 与 `15-claudecode-p0-relay-review-prompt.md`：

- 必须复算 `AUDIT_MANIFEST.md` 的 18 项 payload SHA-256，且逐字节比对权威源。
- 必须独立运行 `17-internal-relay-v7-verifier.py` 并要求 36/36。
- 必须亲自执行要求的对抗变异，确认必须失败。
- 必须独立复算 Archify JSON/HTML SHA-256、showcase 9/9 与 composition 0/0。
- 必须反证 v6 五项 Major 是否真正关闭；不得只引用 36/36。
- 不得运行产品代码、Chrome、Runtime、Provider 或真实媒体。
- 不得修改 `external-audit-package/` 任一文件，不得修改产品源码、既有证据或既有 candidate。
- 唯一允许写入：`docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-background-capture-relay-independent-document-audit-v7-claude-2026-10-15.md`（本报告）。

---

## 2. 18 项 payload 复算（按 `AUDIT_MANIFEST.md` 表格逐字节）

复算命令（仓库根目录）：

```bash
cd docs/active/project/external-audit-package
sha256sum 01-audit-request.md 02-prd.md 03-architecture.md 04-development-plan.md \
          05-acceptance-plan.md 06-stage-gate.md 07-relay-architecture.md \
          08-relay-development-plan.md 09-relay-acceptance-plan.md \
          10-relay-preimplementation-audit.md 11-phase0-test-results.md \
          12-v7-replan-closure.md 13-current-checkpoint.md 14-relay-architecture.json \
          15-internal-relay-v7.schema.json 16-internal-relay-v7-fixtures.json \
          17-internal-relay-v7-verifier.py 18-main-implementation-prompt.md
```

| 序 | 复算 SHA-256 | Manifest 公布值 | 一致 |
|---|---|---|---|
| 01 | `42adbbc393c66a181503d35d61f1ebb201d50695dce5b02640d9cc42d4f8d1eb` | `42adbbc393c66a181503d35d61f1ebb201d50695dce5b02640d9cc42d4f8d1eb` | ✓ |
| 02 | `38a2471d969873405f6a0e332e786ef5a4b292fb95e74e77aa956e627ca73cec` | `38a2471d969873405f6a0e332e786ef5a4b292fb95e74e77aa956e627ca73cec` | ✓ |
| 03 | `514bc366f8223884969486ead924975746e5bbc83f94a682dd1fcd70dd85e46c` | `514bc366f8223884969486ead924975746e5bbc83f94a682dd1fcd70dd85e46c` | ✓ |
| 04 | `db72a15470a72a737be224793ba6c0f36e36af3e09d5e2559c6c080e2837ed7b` | `db72a15470a72a737be224793ba6c0f36e36af3e09d5e2559c6c080e2837ed7b` | ✓ |
| 05 | `d8d97b973944252c365aa14214b5f65a7666103b54e3d67560bad2126fb77b63` | `d8d97b973944252c365aa14214b5f65a7666103b54e3d67560bad2126fb77b63` | ✓ |
| 06 | `12cc84ef70f1bdb019ff58c824d4865b40fa8cf8290a5960160f03776fbe6442` | `12cc84ef70f1bdb019ff58c824d4865b40fa8cf8290a5960160f03776fbe6442` | ✓ |
| 07 | `5d3498e515aac39f5a90aa17691d688b425dcb85a626da13c4d0466a1e440613` | `5d3498e515aac39f5a90aa17691d688b425dcb85a626da13c4d0466a1e440613` | ✓ |
| 08 | `5dbaa73eb4df60e186817758de8c33f44638b5788e72bd842332f6373d9f2579` | `5dbaa73eb4df60e186817758de8c33f44638b5788e72bd842332f6373d9f2579` | ✓ |
| 09 | `60fc84ad167fd9381c4268d6398e4f0b27aa97ee4005a5ef4b5eb1f9dbf07d95` | `60fc84ad167fd9381c4268d6398e4f0b27aa97ee4005a5ef4b5eb1f9dbf07d95` | ✓ |
| 10 | `87b783e37f974bb7e4786f1f97a6c26d8fbfdc5b6742539e73c9e415040dfd4d` | `87b783e37f974bb7e4786f1f97a6c26d8fbfdc5b6742539e73c9e415040dfd4d` | ✓ |
| 11 | `6fbef7d0b1ce2cff42d987ed1b23a0779d042bc024e92cb9f8fbf18b50b13f88` | `6fbef7d0b1ce2cff42d987ed1b23a0779d042bc024e92cb9f8fbf18b50b13f88` | ✓ |
| 12 | `ae102caecb7a029b530c9b6ce9af99c3c1f36cd86991dcdcdb0738fef81860dc` | `ae102caecb7a029b530c9b6ce9af99c3c1f36cd86991dcdcdb0738fef81860dc` | ✓ |
| 13 | `3ed7274ec8c4df42ba58620b54d0e26c3e7d07ea6ad2f6e3bba307ea19cf5c73` | `3ed7274ec8c4df42ba58620b54d0e26c3e7d07ea6ad2f6e3bba307ea19cf5c73` | ✓ |
| 14 | `f62f3767683708e099dea4b63b9883698827795fbd3f578690dc2fcee35d508b` | `f62f3767683708e099dea4b63b9883698827795fbd3f578690dc2fcee35d508b` | ✓ |
| 15 | `e7b8d1e2dc5bfe76db6210cf037499b60344afe937d6ce4a5cc33383a20c8913` | `e7b8d1e2dc5bfe76db6210cf037499b60344afe937d6ce4a5cc33383a20c8913` | ✓ |
| 16 | `c6301cdf24688c1cb9fa57200f758ef12f78d950be1cd5f7fc6136f43b39b319` | `c6301cdf24688c1cb9fa57200f758ef12f78d950be1cd5f7fc6136f43b39b319` | ✓ |
| 17 | `9b27f284ad6e685723e8a977ca2cac55876c9271de8e57627f3ba4dd7b2bcd1f` | `9b27f284ad6e685723e8a977ca2cac55876c9271de8e57627f3ba4dd7b2bcd1f` | ✓ |
| 18 | `761929913359844b95ae731a281c0acab4c82ab6bb8a0633b5c15c6ac7116fe3` | `761929913359844b95ae731a281c0acab4c82ab6bb8a0633b5c15c6ac7116fe3` | ✓ |

18/18 完全一致。命令 `exit=0`。

---

## 3. payload ↔ 权威源逐字节比对

```bash
cd /mnt/c/workspace/navia
diff -q docs/active/project/external-audit-package/<P> <authoritative-path>
```

| Payload | 权威源 | diff | 备注 |
|---|---|---|---|
| 02-prd.md | `docs/active/project/01-prd.md` | 0 字节差异 | ✓ |
| 03-architecture.md | `docs/active/project/02-architecture.md` | 0 | ✓ |
| 04-development-plan.md | `docs/active/project/03-development-plan.md` | 0 | ✓ |
| 05-acceptance-plan.md | `docs/active/project/04-acceptance-plan.md` | 0 | ✓ |
| 06-stage-gate.md | `docs/active/project/stage-gates/v3-media-companion.md` | 0 | ✓ |
| 01-audit-request.md | `…/stage-b-b5-3-background-capture-relay-external-audit-request-v7-2026-10-15.md` | 0 | ✓ |
| 07-relay-architecture.md | `…/stage-b-b5-3-background-capture-relay-architecture-2026-10-15.md` | 0 | ✓ |
| 08-relay-development-plan.md | `…/stage-b-b5-3-background-capture-relay-development-plan-2026-10-15.md` | 0 | ✓ |
| 09-relay-acceptance-plan.md | `…/stage-b-b5-3-background-capture-relay-acceptance-plan-2026-10-15.md` | 0 | ✓ |
| 10-relay-preimplementation-audit.md | `…/stage-b-b5-3-background-capture-relay-preimplementation-audit-2026-10-15.md` | 0 | ✓ |
| 11-phase0-test-results.md | `…/stage-b-b5-3-phase0-test-results-2026-10-15.md` | 0 | ✓ |
| 12-v7-replan-closure.md | `…/20-p0-relay-v7-replan-closure.md` | 0 | ✓ |
| 13-current-checkpoint.md | `…/stage-b-b5-3-phase0-checkpoint-2026-10-15.md` | 0 | ✓ |
| 14-relay-architecture.json | `docs/active/project/design/v3-p0-background-capture-relay-architecture.json` | 0 | ✓ |
| 15-internal-relay-v7.schema.json | `docs/active/project/contracts/v3_media_capture_internal_relay_v7.schema.json` | 0 | ✓ |
| 16-internal-relay-v7-fixtures.json | `docs/active/project/fixtures/v3-media-capture-internal-relay-v7-fixtures.json` | 0 | ✓ |
| 17-internal-relay-v7-verifier.py | `…/verify-stage-b-b5-3-background-capture-relay-v7-contract.py` | 0 | ✓ |
| 18-main-implementation-prompt.md | `…/14-claudecode-p0-relay-goal-prompt.md` | 0 | ✓ |

17/17 直接映射逐字节相同（含 18 SHA-256 一致 ⇒ 18/18 平铺副本与权威源等价）。命令 `exit=0`。

---

## 4. v7 verifier 独立运行

```bash
cd docs/active/project/external-audit-package
python3 17-internal-relay-v7-verifier.py
```

输出关键节（与权威 verifier 完全等价）：

```text
schemaVersion       : v3-media-capture-internal-relay-v7-verification/v1
passed              : true
schemaErrors        : []
summary             : { total: 36, passed: 36, failed: 0 }
checks              : 36/36 true
```

`exit=0`。分母 36：schemaMetaValid、schemaAuthorityAllFieldsImmutable、protocolAuthorityAllFieldsImmutable、protocolAllInstancesSchemaValid、nineUniqueMessageVariantsExact、unknownFailureCodeRejected、duplicateTenthMessageRejected、allPositiveChunksCanonicalAndLengthExact、mismatchedDecodedLengthRejected、nonCanonicalPaddingRejected、positiveTraceAllFieldsImmutable、restartRecoveryAllFieldsImmutable、terminalFailureTraceAllFieldsImmutable、phaseRecoveryAllFieldsImmutable、terminalFailureCasesAllFieldsImmutable、negativeSuiteAllFieldsImmutable、negativeIdsAndMappingAllThirtyExact、traceMarkerPhasesExact、traceForwardAckSequencesExact、traceCreditsExact、traceQuiescedStoppedAndStopBoundaryExact、traceCleanupThreeZerosExact、markerFivePhasesSameIdentity、markerExpiryArithmeticAndNoRefresh、senderSourceAndIncognitoResolutionExact、terminalBoundaryExact、restartTerminationOwnerAndNoPublicApiExact、phaseRecoveryOwnersExact、boundaryFailureNormalizationClosed、recoverEvidenceUsesExistingObservableContract、identityAndRevisionDomainsExact、restartTraceCleanupAndFreshStartExact、singleSinkInvariantExact、ownershipCapacityQuiesceExact、capacityValuesExact、runtimeLimitsNotExpanded。

`EXPECTED_*` 常量（来源 `17-internal-relay-v7-verifier.py:31-38`）即等于本次独立 digest 复算值；任何字节漂移都会破坏 `schemaAuthorityAllFieldsImmutable` / `protocolAuthorityAllFieldsImmutable` / `positiveTraceAllFieldsImmutable` / `restartRecoveryAllFieldsImmutable` / `terminalFailureTraceAllFieldsImmutable` / `phaseRecoveryAllFieldsImmutable` / `terminalFailureCasesAllFieldsImmutable` / `negativeSuiteAllFieldsImmutable` 八条 digest 检查并使 RC=2。

路径独立性：在 `/tmp/audit-mutations/` 与 `/tmp/shallow-audit/` 浅层目录（无 `docs/active/project`）各放一份 schema+fixture+verifier，verifier 仍走 fallback 分支定位 schema/fixtures 并产出 36/36。`exit=0`，确认 verifier 不依赖审计包目录深度。

---

## 5. 对抗变异（24 项内存/副本变异，全部必须 RC=2）

按 `01-audit-request.md` “对抗动作”段落所列类别（Schema 放宽、portName 回退、未知 FailureCode、第十消息、decoded length、padding、sender context、trace/case/RLY7-N01..N30、cleanup rename 删除、code inventory 重叠/缺失、terminal/recover/owner/revision 域、marker expiry）。本审查在 `/tmp/audit-mutations/` 创建 schema+fixtures+verifier 副本，每次变异后从权威源恢复再运行。

| # | 变异 | 期望 | 实际 RC | 实际失败检查 | 判定 |
|---|---|---|---|---|---|
| M1 | schema `additionalProperties` → true | REJECT | 2 | schemaAuthorityAllFieldsImmutable | OK |
| M2 | `limits.maxRawChunkBytes` 49152→524288 | REJECT | 2 | protocolAuthorityAllFieldsImmutable、protocolAllInstancesSchemaValid、capacityValuesExact | OK |
| M3 | `limits.creditWindowChunks` 1→3、`runtimeMaxInFlightChunks` 1→3 | REJECT | 2 | protocolAuthorityAllFieldsImmutable、protocolAllInstancesSchemaValid、capacityValuesExact | OK |
| M4 | schema `required` 去掉 `restartMarker` | REJECT | 2 | schemaAuthorityAllFieldsImmutable | OK |
| M5 | schema `portName.const` 回退到 `navia.mediaCapture.audio/v6` | REJECT | 2 | schemaAuthorityAllFieldsImmutable、protocolAllInstancesSchemaValid | OK |
| M6 | 新增未声明 FailureCode `V3_MEDIA_CAPTURE_FAKE_CODE` | REJECT | 2 | protocolAuthorityAllFieldsImmutable、protocolAllInstancesSchemaValid、boundaryFailureNormalizationClosed | OK |
| M7 | `renameMapping` 删 `V3_MEDIA_CLEANUP_INCOMPLETE` | REJECT | 2 | protocolAuthorityAllFieldsImmutable、protocolAllInstancesSchemaValid、boundaryFailureNormalizationClosed | OK |
| M8 | identityShared 与 renameMapping 重叠（同义密钥） | REJECT | 2 | protocolAuthorityAllFieldsImmutable、protocolAllInstancesSchemaValid、boundaryFailureNormalizationClosed | OK |
| M9 | sourceInventory 删尾部一项（30→29） | REJECT | 2 | protocolAuthorityAllFieldsImmutable、protocolAllInstancesSchemaValid、boundaryFailureNormalizationClosed | OK |
| M10 | `positiveTrace[1].message` 改为 `tampered_message` | REJECT | 2 | positiveTraceAllFieldsImmutable | OK |
| M11 | `negativeCases[0].caseId` 改为 `RLY7-N99` | REJECT | 2 | negativeSuiteAllFieldsImmutable、negativeIdsAndMappingAllThirtyExact | OK |
| M12 | targetInventory 删尾部一项（20→19） | REJECT | 2 | protocolAuthorityAllFieldsImmutable、protocolAllInstancesSchemaValid、boundaryFailureNormalizationClosed | OK |
| M13 | `terminalBoundary.sinkFinalizeIsTerminal=true`（v5/v6 错误） | REJECT | 2 | protocolAuthorityAllFieldsImmutable、protocolAllInstancesSchemaValid、terminalBoundaryExact | OK |
| M14 | `failureInjectionPoints` 删 `completed_frame_send` | REJECT | 2 | protocolAuthorityAllFieldsImmutable、protocolAllInstancesSchemaValid、terminalBoundaryExact | OK |
| M15 | 标记 `expiresAt = startedAt`（无 expiry） | REJECT | 2 | protocolAuthorityAllFieldsImmutable、markerExpiryArithmeticAndNoRefresh | OK |
| M16 | `recoverObservableEvidence` 追加 `cleanup_receipt_fabricated`（v6 错误） | REJECT | 2 | protocolAuthorityAllFieldsImmutable、protocolAllInstancesSchemaValid、recoverEvidenceUsesExistingObservableContract | OK |
| M17 | `crossDomainRevisionEquality = "enforced"`（v6 错误） | REJECT | 2 | protocolAuthorityAllFieldsImmutable、protocolAllInstancesSchemaValid、identityAndRevisionDomainsExact | OK |
| M18 | `authoritativeTerminalCommit` 改为 `after_sink_finalize_only` | REJECT | 2 | protocolAuthorityAllFieldsImmutable、protocolAllInstancesSchemaValid、terminalBoundaryExact | OK |
| M19 | restartRecoveryTrace 末步改为 `task_resumed`（非 fresh） | REJECT | 2 | restartRecoveryAllFieldsImmutable、restartTraceCleanupAndFreshStartExact | OK |
| M20 | `senderPolicy.minimumChromeVersion` 116→110 | REJECT | 2 | protocolAuthorityAllFieldsImmutable、protocolAllInstancesSchemaValid、senderSourceAndIncognitoResolutionExact | OK |
| M21 | schema `required` 去掉 `streamIdPolicy` | REJECT | 2 | schemaAuthorityAllFieldsImmutable | OK |
| M22 | `limits.maxOutstandingChunks` 32→256 | REJECT | 2 | protocolAuthorityAllFieldsImmutable、protocolAllInstancesSchemaValid、capacityValuesExact | OK |
| M23 | terminalFailureTrace 删末步（6→5） | REJECT | 2 | terminalFailureTraceAllFieldsImmutable | OK |
| M24 | failureCodes 删 `V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED` | REJECT | 2 | protocolAuthorityAllFieldsImmutable、protocolAllInstancesSchemaValid、boundaryFailureNormalizationClosed | OK |

24/24 全部 RC=2。verifier 同时因 `protocolAuthorityAllFieldsImmutable` / `schemaAuthorityAllFieldsImmutable` digest 漂移与各语义检查（terminalBoundaryExact / boundaryFailureNormalizationClosed / recoverEvidenceUsesExistingObservableContract / identityAndRevisionDomainsExact / capacityValuesExact / markerExpiryArithmeticAndNoRefresh / senderSourceAndIncognitoResolutionExact / negativeIdsAndMappingAllThirtyExact / restartTraceCleanupAndFreshStartExact / positiveTraceAllFieldsImmutable / restartRecoveryAllFieldsImmutable / terminalFailureTraceAllFieldsImmutable）返回失败。

任意 verifier 不通过即视为本次外审失败。**当前 24/24 全部 REJECT**，可拒绝 §3 中所有“v6 错误”或“放宽”路径。

---

## 6. 反证 v6 五项 Major

`12-v7-replan-closure.md` §v7 逐项闭环表格 vs `stage-b-b5-3-background-capture-relay-independent-document-audit-v6-subagent-2026-10-15.md` Findings：

### M1. durable success 与 completed frame failure 互相矛盾

v7 文档（`15-internal-relay-v7.schema.json:20`、`12-v7-replan-closure.md:19`）：

```text
authoritativeTerminalCommit: "after_sink_finalize_transcript_create_transcript_start_and_acquisition_complete_returns_succeeded"
sinkFinalizeIsTerminal: false
failureInjectionPoints: ["after_sink_finalize","transcript_create","transcript_start","acquisition_complete","completed_frame_send"]
completedFrameSendFailure: "preserve_succeeded_task_cleanup_zero_background_GET_observes_same_terminal"
restartTermination.taskFailureMapping.completed_frame_send_after_authoritative_success: "preserve_succeeded_task_background_GET_terminal"
restartTermination.idempotency: "terminal_returns_same_task_without_rewrite_nonterminal_transitions_once_cleanup_failure_wins"
finallyRule: "valid_start_always_aborts_sink_idempotently_then_fails_only_nonterminal_task_and_preserves_terminal_task"
```

并由 fixtures：

```text
terminalCases[-1].expectedTaskState == "succeeded"
terminalCases[-1].expectedFailureCode == null
restartRecoveryTrace[-1] == { step:8, actor:"runtime", message:"fresh_started", freshCapture:true }
restartRecoveryTrace[1].(activeCaptureCount,residualRawAudioCount,privateTempAudioCount) == (0,0,0)
```

verifier 给出 `terminalBoundaryExact=true`、`restartTraceCleanupAndFreshStartExact=true`，且 M13/M14/M18/M19 全部 RC=2。

→ M1 真正关闭：durable succeeded 是唯一权威，completed frame 失败保持 succeeded 不回滚，前四个注入点由 finally 幂等 abort 仅终结非终态 task 并 cleanup=0。

### M2. recover 收据虚构、`interrupted` 误作持久状态

v7 文档（`15-internal-relay-v7.schema.json:21`、`12-v7-replan-closure.md:20`）：

```text
runtime_hard_crash_restart: "existing_recover_returns_disposition_and_matching_authoritativeTaskId_cleanup_zero_is_guaranteed_by_recover_success_else_public_cleanup_error"
runtime_graceful_sigterm: "persisted_owner_pid_and_start_token_derive_interrupted_then_existing_recover_on_product_reattach"
recoverObservableEvidence: ["recover_http_success","disposition_published_or_abandoned","authoritativeTaskId_matches_marker","source_authority_terminal_or_published","fresh_begin_succeeds_single_sink"]
publicApiChange: "none"
newUserAction: "none"
get404: "stop_polling_emit_recovery_pending_wait_product_reattach_recover_result_or_marker_expiry"
markerExpiry: "clear_nonsecret_marker_only_does_not_mark_task_success_or_delete_persistent_authority"
```

recoverObservableEvidence 仅含 5 项既有可观察字段，**无 cleanup_receipt**；`cleaned_count`/`activeCaptureCount`/`residualRawAudioCount`/`privateTempAudioCount` 仅为 Runtime sink 内部 observerChecks（schema `runtimeSinkInvariant.observerChecks`），不暴露到 `/v1/media/acquisitions/recover` 响应。verifier 给出 `recoverEvidenceUsesExistingObservableContract=true`，M16 注入虚构字段后 RC=2。

→ M2 真正关闭：recover 接受面只是既有 `/v1/media/acquisitions/recover` 的 HTTP 成功、`disposition`、`authoritativeTaskId` 与 authority 终态 + fresh begin；`interrupted` 由持久 owner PID/start token 推导；清理非零时公开 `V3_MEDIA_CAPTURE_CLEANUP_INCOMPLETE`。

### M3. 公共 source / relay target inventory 不闭合、缺唯一 cleanup rename

v7 文档（`15-internal-relay-v7.schema.json:22`、`12-v7-replan-closure.md:21`、`07-relay-architecture.md:104`）：

```text
sourceInventory: 30 项
targetInventory: 20 项（== failureCodes const，与 targetInventory 完全等同）
identityShared: 11 项
renameMapping: 15 项（含 V3_MEDIA_CLEANUP_INCOMPLETE -> V3_MEDIA_CAPTURE_CLEANUP_INCOMPLETE）
publicOnlyNotEmittedOnRelayWire: 4 项
```

独立数值复算：

| 指标 | 值 |
|---|---|
| `len(sourceInventory)` | 30 |
| `len(targetInventory)` | 20 |
| `len(identityShared)` | 11 |
| `len(renameMapping)` | 15 |
| `len(publicOnlyNotEmittedOnRelayWire)` | 4 |
| `11 + 15 + 4` | 30 |
| `sourceInventory == identityShared ∪ renameMapping.keys() ∪ publicOnlyNotEmittedOnRelayWire` | True |
| `identityShared ∩ renameMapping` | ∅ |
| `identityShared ∩ publicOnlyNotEmittedOnRelayWire` | ∅ |
| `renameMapping ∩ publicOnlyNotEmittedOnRelayWire` | ∅ |
| `set(renameMapping.values()) ⊆ targetInventory` | True |
| `renameMapping["V3_MEDIA_CLEANUP_INCOMPLETE"]` | `"V3_MEDIA_CAPTURE_CLEANUP_INCOMPLETE"` |
| `set(failureCodes.const) == set(targetInventory)` | True |

verifier 给出 `boundaryFailureNormalizationClosed=true`。M6/M7/M8/M9/M12/M24 全部 RC=2。

→ M3 真正关闭：30/20 inventory 精确并、互斥，target 集闭合，cleanup rename 唯一；公共 Runtime/UI 合同不变（`restartTermination.publicApiChange == "none"`，`recoveryOwnership.publicApiChange == "none"`、`newUserAction == "none"`）。

### M4. 专项架构仍引用 v5

v7 文档（`07-relay-architecture.md:54,68,133`、`12-v7-replan-closure.md:22`、`18-main-implementation-prompt.md:31-32,45`、`14-relay-architecture.json:54`）：

```text
07 §4.1: "名称固定为 navia.mediaCapture.audio/v7；v1-v6 不得实现"
07 §4.2: "v1 transferable 被拒绝；v2/v3/v4/v5/v6 因各自缺陷被拒绝"
07 §9:  "机器源: v3-p0-background-capture-relay-architecture.{json,html}；内部机器合同: v3_media_capture_internal_relay_v7.schema.json + 24 步正例…fixtures…v7-contract.py"
14:      "v7 verifier 36/36 且变异全部失败"
18:      "Port 名 navia.mediaCapture.audio/v7" + "v1-v6 不得实现" + "RLY7-N01..N30"
15:      schemaVersion const = "v3-media-capture-internal-relay/v7"，portName const = "navia.mediaCapture.audio/v7"
12:      "专项架构、计划、验收、审计与交接只把 v7 schema/fixture/verifier 作为当前机器权威"
```

`AUDIT_MANIFEST.md` 第 14/15/16/17 行指向的权威源分别为 `docs/active/project/design/v3-p0-background-capture-relay-architecture.json`、`…/contracts/v3_media_capture_internal_relay_v7.schema.json`、`…/fixtures/v3-media-capture-internal-relay-v7-fixtures.json`、`…/verify-stage-b-b5-3-background-capture-relay-v7-contract.py`。verifier M5 (portName v6 回退) RC=2。

→ M4 真正关闭：专项架构、主 PRD/架构/计划/验收、handoff、schema、fixture、verifier、Port、marker、RLY7、24+8+6 trace 全部指向 v7；v1-v6 显式禁止实现。

### M5. 跨域 same revision 不可判定

v7 文档（`15-internal-relay-v7.schema.json:23`、`12-v7-replan-closure.md:23`、`08-relay-development-plan.md` A07）：

```text
identityAndRevisionPolicy:
  taskIdentity:           "resolve_sourceAuthority_acquisition_transcript_outline_workspace_share_taskId_and_sourceIdentity_where_field_exists"
  consentRevision:        "resolve_authority_and_acquisition_request_share_consentPolicyId_and_consentPolicyRevision"
  transcriptRevision:     "independent_monotonic_transcript_projection_revision"
  productRevision:        "outline_and_workspace_share_media_task_revision_with_expected_revision_fence"
  crossDomainRevisionEquality: "forbidden_transcript_consent_and_product_revisions_are_distinct_domains"
```

即：仅存在字段的层（taskId/sourceIdentity）共享；consent / transcript / product revision 各自独立单调（consensent 持 consentPolicyId+Revision、transcript 持独立 projection revision、outline+workspace 共享同一 product revision 并经 expected-revision fence）；跨域等式“forbidden”。

verifier 给出 `identityAndRevisionDomainsExact=true`，M17 (enforced) RC=2。

→ M5 真正关闭：A07 拆为可观察断言；跨域 revision 相等不再作为验收条件。

---

## 7. Archify JSON / HTML 与 showcase / composition 复算

```bash
sha256sum docs/active/project/design/v3-p0-background-capture-relay-architecture.{json,html}
```

| 文件 | 复算 SHA-256 | freeze / manifest 一致 |
|---|---|---|
| `v3-p0-background-capture-relay-architecture.json` | `f62f3767683708e099dea4b63b9883698827795fbd3f578690dc2fcee35d508b` | ✓（manifest 第 14 行 + `13-p0-background-capture-relay-document-freeze.md` 公布值） |
| `v3-p0-background-capture-relay-architecture.html` | `41bd7f7c0f5b6c13d25c9ffedd43f5bcfd825fe6f91489586525af4b278d4dd9` | ✓（`13-p0-background-capture-relay-document-freeze.md` §2 公布值，817 096 bytes） |

`/tmp/navia-relay-archify-validation.json`（外部 Archify 校验回执）独立确认：

```text
ok            : true
command       : validate
type          : architecture
input         : /mnt/c/workspace/navia/docs/active/project/design/v3-p0-background-capture-relay-architecture.json
checks (9/9)  : single_svg, finite_svg, orthogonal_arrows, label_route_clearance,
                relationship_crossings, relationship_corridors, container_border_runs,
                route_rhythm, legend_clearance — all ok=true
composition   : { profile: "showcase", status: "pass",
                 summary: { errors: 0, warnings: 0 },
                 metrics: { properCrossings: 0, ambiguousCorridors: 0,
                            containerBorderRuns: 0, labelRouteClearanceIssues: 0,
                            minLabelRouteClearance: 9.2 } }
```

→ showcase 9/9 ✓、composition 0 error / 0 warning ✓（properCrossings=0 仅是 metric，非 0/0 计数）。

视觉审阅仍 skipped`（`v3-p0-background-capture-relay-architecture.visual-check.json` → `status: "skipped"`, `chrome.status: "unavailable"`, `error: "Chrome or Chromium is unavailable. Set ARCHIFY_CHROME to its executable path."`）。本审计与 freeze doc 立场一致：**禁止把 deterministic deliver 外推为浏览器视觉 PASS**。

---

## 8. R0-R7 / A01-A18 / 假绿拒绝 静态可读评估

未执行人类体验或 implementation exit，仅文本可读追踪：

- A01-A18 静态门槛已在 `09-relay-acceptance-plan.md` 与 `08-relay-development-plan.md` 列出：真实静音 canary / 真实 Uvicorn / 故障矩阵 / runner purity / secret/raw-media/path/cleanup 0 / mock/空 PCM/跨 run/无限 queue/泄密 拒绝条款齐备。
- R0 必改项中部分源码尚未落地：
  - `apps/chrome-extension/wxt.config.ts` 当前未声明 `minimum_chrome_version: "116"`（schema `senderPolicy.minimumChromeVersion == 116` 与架构 §4.1 强制要求）—— 与 v6 审查 M-V6-D-01 同样的待办，未在 v7 主干上闭环；属 R0 待办，**不属于 v7 文档缺陷**。
  - WXT `manifest.content_security_policy.extension_pages.connect-src` 当前已含 `http://127.0.0.1:17861 ws://127.0.0.1:17861`，与架构 §6 兼容；尚待 R0 build 静态断言。
- 公共 API 增减：`recoveryOwnership.publicApiChange == "none"`、`recoveryOwnership.newUserAction == "none"`、`restartTermination.publicApiChange == "none"` —— v7 doc 不引入新公共 API。
- 真实静音 canary 收据：现存 `external-audit-package-relay-pre-r0-contract-2026-10-15/11-phase0-test-results.md` 与 `13-p0-background-capture-relay-document-freeze.md` §1 “最新事实” 仍以 `V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED` 非零结束，证明当前不可作为 P0 PASS 证据；与“未授权时主干只能修订文档和 fixture 设计”一致。
- 真实 Uvicorn、真实非空 PCM、故障矩阵：本审计不可启动产品代码；静态门禁由 R0-R7 后续独立检查闭环。

---

## 9. 命令与退出码一览

| 命令 | 退出码 |
|---|---|
| `cd external-audit-package && sha256sum 01..18` | 0 |
| `diff -q external-audit-package/<P> <权威源>` × 17 | 0 / 0 |
| `cd external-audit-package && python3 17-internal-relay-v7-verifier.py` | 0 (36/36) |
| `cd /tmp/audit-mutations && python3 verifier.py`（baseline） | 0 (36/36) |
| `cd /tmp/shallow-audit && python3 17-internal-relay-v7-verifier.py`（路径独立性） | 0 (36/36) |
| 24 项内存/副本变异 → verifier | RC=2（24/24） |
| `sha256sum v3-p0-background-capture-relay-architecture.{json,html}` | 0 |
| `cat /tmp/navia-relay-archify-validation.json` 解析 | 0（9/9 checks ok、composition 0/0） |

---

## 10. Findings

### Fatal

无。

### Major

无。

v6 五项 Major（M1 终态提交矛盾 / M2 recover 收据虚构 / M3 inventory 不闭合 / M4 引用陈旧 / M5 跨域 revision 不可判定）在 v7 文档与机器合同中均真正闭环，详见 §6；verifier 同步以 digest + 语义检查双层捕获所有放宽/回退/虚构变异（§5 24/24 全部 RC=2）。

### Minor

| ID | 描述 | 触发条件 | 关闭建议 |
|---|---|---|---|
| m-V7-D-01 | `apps/chrome-extension/wxt.config.ts` 当前未声明 `minimum_chrome_version: "116"`。v7 文档（`07-relay-architecture.md:59`、`18-main-implementation-prompt.md:31`）将“在 WXT manifest 输出 `minimum_chrome_version: "116"` 且不允许旧浏览器弱校验降级”列为 R0 必改项；与 v6 审查 M-V6-D-01 同样的待办，当前主干未闭环 | 仅 R0 实施门禁要求；未授权实施前主干只能修订文档和 fixture 设计 | R0 实施 owner 在 build 静态断言中纳入该字段的最小版本常量，并提供 unit test 拒绝回退 |
| m-V7-D-02 | `apps/chrome-extension/wxt.config.ts` 当前 `connect-src` 已含 loopback HTTP/WS，但 v6 M-V6-D-02 提醒需保留以防回退；本审查确认当前值未回退 | 当前已满足；保留 Minor 仅作回退预警 | R0 build 静态断言把 `connect-src` 严格仅留 `http://127.0.0.1:17861 ws://127.0.0.1:17861` |
| m-V7-D-03 | Archify HTML `visual-check` 因 WSL 无 Chrome executable 而 skipped；本审计与 freeze doc §2 一致，明确禁止把 deterministic deliver 外推为浏览器视觉 PASS | WSL 宿主限制（`chrome.status: unavailable`） | 待真实 Chrome 视觉流水线就位后独立视觉复审 |
| m-V7-D-04 | fixture 30 项 RLY7-N01..N30 中 `ALREADY_ACTIVE` / `AUDIO_SHAPE_INVALID` / `BINDING_MISMATCH` / `BYTE_LIMIT` / `DURATION_LIMIT` / `EMPTY` / `FINALIZE_FAILED` / `TICKET_INVALID|EXPIRED|REPLAYED` 共 10 项 FailureCode 由跨层注入（Runtime-side ticket-binding、acquisition 容量超限等）覆盖，未在 wire mutation 中显式出现。`mapping == EXPECTED_FAILURES` 与 `len == 30` 仍严格闭合 | 当前 acceptance §4 矩阵把它们分发到对应注入点和 ticket-binding 路径；不在 wire mutation 显式出现 | R0 出门补充跨层 fixture，保证 20 项内部 FailureCode 在不同层都被实际路径触发 |

四项 Minor 不影响 v7 文档作为合同候选的可信度；它们属于 R0/R1/R4 实施闭环要补的细节，由后续 R 阶段 owner 关闭。

---

## 11. 限制

- 按审计约束未运行产品代码、Runtime、Chrome、Provider、真实媒体或音频；未把未来 R0-R7 计划当作当前实现。
- 工作树在审查开始前已存在若干未提交改动（git status）；本报告评估的是 2026-10-15 文件系统中 `external-audit-package/` 平铺 manifest 封存载荷及当前相关源码，不代表任一 Git commit。
- `17-internal-relay-v7-verifier.py` 的 24 项对抗变异均在 `/tmp/audit-mutations/` 副本上运行（候选目录未创建任何副本来执行变异），哈希表不变；浅目录 `/tmp/shallow-audit/` 路径独立性已实测。
- 未执行人类体验或 P0 implementation exit；即使文档 PASS，实施仍需独立 Fatal=0/Major=0 + 用户明确授权 R0-R7。

---

## 12. 结论

**`DOCUMENT PASS / IMPLEMENTATION REQUIRES EXPLICIT USER AUTHORIZATION`**

依据：

- 18/18 SHA-256 一致，无 Fatal。
- 17/17 payload ↔ 权威源逐字节相同；剩余 18（manifest）按规约保留。
- v7 verifier baseline 36/36 PASS；浅目录与 `/tmp` 副本路径独立。
- 24/24 对抗变异（schema/port/credit/marker/code inventory/trace/RLY7/terminal/recover/revision）全部 RC=2。
- v6 五项 Major（M1 终态矛盾 / M2 recover 收据 / M3 inventory / M4 路径陈旧 / M5 跨域 revision）在 v7 文档与机器合同中由 digest + 语义检查双层真正闭环，并非仅复述自报。
- 30 公共 source / 20 relay target / 11 identityShared / 15 renameMapping / 4 publicOnlyNotEmittedOnRelayWire 严格并、互斥；renameMapping 全部值 ⊆ targetInventory；`V3_MEDIA_CLEANUP_INCOMPLETE -> V3_MEDIA_CAPTURE_CLEANUP_INCOMPLETE` 唯一；failureCodes const 与 targetInventory 等同。
- recoverObservableEvidence 仅含既有 5 项可观察字段，无虚构 cleanup receipt；`interrupted` 由持久 owner PID/start token 推导，不声称持久状态。
- durable task 在 sink finalize → transcript create → transcript start → acquisition complete 返回 succeeded 后唯一提交；`completed` frame 是最佳努力通知，发送失败不破坏 succeeded。
- Archify JSON `f62f3767683708e099dea4b63b9883698827795fbd3f578690dc2fcee35d508b` 与 HTML `41bd7f7c0f5b6c13d25c9ffedd43f5bcfd825fe6f91489586525af4b278d4dd9` 一致；外部 Archify 校验回执 showcase 9/9、composition 0 error / 0 warning；visual-check skipped 不可外推为浏览器视觉 PASS。
- 公共 Runtime/UI 合同不变：`publicApiChange == "none"`、`newUserAction == "none"`；无新增公共 API / schema / 用户动作。
- v1-v6 在专项架构、主 PRD/架构/计划/验收、handoff、schema、fixture、verifier、Port、marker、RLY7、24+8+6 trace 中均被显式禁止实现；机器权威唯一。
- 仅四项 Minor 与 R0/R1/R4 实施闭环相关，文档层未触线。

**实施仍 NO-GO**：必须等待用户在 v7 双外审 Fatal=0/Major=0 之后再明确批准 R0-R7，主干才可改产品代码。P1 六视频继续 BLOCKED。本审计未授权任何实施动作。