# V3 P0 Background Capture Relay v8 修订候选 — 第二轮独立只读文档审查（Claude）

日期：2026-10-15。
审查者：独立 Claude 只读 reviewer（自身会话；首轮 v8 报告与 v7 报告仅作历史证据，不复用其结论）。
性质：v8 修订 immutable document candidate 外审；不构成 implementation audit，亦不构成实施授权。
依据：`docs/active/project/external-audit-package/01-audit-request.md`、`AUDIT_MANIFEST.md`、`docs/active/project/handoffs/v3-claudecode-completion-2026-10-15/22-p0-relay-v8-reaudit-closure.md`、`10-relay-preimplementation-audit.md`、`12-v8-reaudit-closure.md`。

---

## 1. 审查入口与依赖

按 `01-audit-request.md` 与 `AUDIT_MANIFEST.md`：

- 不得复用首轮 v8 的 PASS/REPLAN；首轮 v8 严格结论为 Fatal=0/Major=2/Minor=2（ASR staged root hard-crash 无 recover owner；36 项 source inventory 的 scope+hash 与 emit 不一致；删 handoff case 时 verifier 以 IndexError/exit 1 退出）。
- 必须复算 `AUDIT_MANIFEST.md` 的 18 项 payload SHA-256，并逐字节比对权威源。
- 必须独立运行 `17-internal-relay-v8-verifier.py` 并要求 47/47。
- 必须亲自执行请求列出的对抗变异（含：删除 handoff failure case、source scope 增删、中央 registry code 增删、已登记源码 emit 增删、未登记 source file 新增 capture code），确认全部稳定输出结构化 `exit 2`。
- 必须反证上轮两个 Major 是否真正关闭：A 独立 ASR staged root 是否已有 durable private owner manifest + hard-crash-after-stage-before-worker 是否由 `MediaRecoveryCleanupCoordinator` 按 acquisition → ASR stage → unpublished product 顺序清理并验证 active sink=0；任何失败是否复用既有 `V3_MEDIA_CLEANUP_INCOMPLETE` fail-closed。B source inventory 是否由声明的 9 scope + AST/string-literal selector + hash 可重算为准确 36，且未列文件新增边界码被拒绝。
- 必须独立复算 Archify JSON/HTML SHA；browser visual-check 维持 pending，不外推为视觉 PASS。
- 不得运行产品代码、Chrome、Runtime、Provider 或真实媒体；不得修改 `external-audit-package/` 任一文件，不得修改产品代码、既有证据或既有 candidate。
- 工作树 dirty 状态保留，禁止 reset/checkout/clean。
- 唯一允许写入：本报告 `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-background-capture-relay-independent-document-audit-v8-round2-claude-2026-10-15.md`。

---

## 2. 包结构与 18 项 payload 复算

包结构：平铺 19 文件（18 payload + AUDIT_MANIFEST.md），无子目录。

```bash
ls -la docs/active/project/external-audit-package/ | wc -l
# 19
```

复算命令（仓库根目录）：

```bash
cd docs/active/project/external-audit-package
sha256sum 01-audit-request.md 02-prd.md 03-architecture.md 04-development-plan.md \
          05-acceptance-plan.md 06-stage-gate.md 07-relay-architecture.md \
          08-relay-development-plan.md 09-relay-acceptance-plan.md \
          10-relay-preimplementation-audit.md 11-phase0-test-results.md \
          12-v8-reaudit-closure.md 13-current-checkpoint.md 14-relay-architecture.json \
          15-internal-relay-v8.schema.json 16-internal-relay-v8-fixtures.json \
          17-internal-relay-v8-verifier.py 18-main-implementation-prompt.md
```

| 序 | 复算 SHA-256 | Manifest 公布值 | 一致 |
|---|---|---|---|
| 01 | `5624899d04e6c42927b3e0cd182b59ccd02402b9a74f270e2f2ab150610c6d85` | `5624899d04e6c42927b3e0cd182b59ccd02402b9a74f270e2f2ab150610c6d85` | ✓ |
| 02 | `6328845d4f5682a1de100042f263d43da8012d220c15f99b7523cb8e2225ce40` | `6328845d4f5682a1de100042f263d43da8012d220c15f99b7523cb8e2225ce40` | ✓ |
| 03 | `c24e645468390271e27a487e3080745b63650708fd7f2ec82d9a81b61d9fe7c4` | `c24e645468390271e27a487e3080745b63650708fd7f2ec82d9a81b61d9fe7c4` | ✓ |
| 04 | `91c7704305fa386f9cbdd8b3e2147011098a6c0190aabc42c3669c82b3669dcb` | `91c7704305fa386f9cbdd8b3e2147011098a6c0190aabc42c3669c82b3669dcb` | ✓ |
| 05 | `7983e12751fa8f68a438a6b989698692e944a6d5385d41d750c4f485ac748918` | `7983e12751fa8f68a438a6b989698692e944a6d5385d41d750c4f485ac748918` | ✓ |
| 06 | `ff217a518909baeb20be1d8d83e35d1b7deb559ff492215194a8c8f78d7087d7` | `ff217a518909baeb20be1d8d83e35d1b7deb559ff492215194a8c8f78d7087d7` | ✓ |
| 07 | `3b68a6a4ce43c38cca74709d3e3c4f4ed9a527e9bc11059aac48e7cc4ae08eac` | `3b68a6a4ce43c38cca74709d3e3c4f4ed9a527e9bc11059aac48e7cc4ae08eac` | ✓ |
| 08 | `a88426a91f04fa46a1995f40daefbbbe004f7f4824f9e7e2e866836dccb86928` | `a88426a91f04fa46a1995f40daefbbbe004f7f4824f9e7e2e866836dccb86928` | ✓ |
| 09 | `5dfac6a3821cafdbdd0fd990a9b52bbd266d1dc4384927fcebc11ade494b18e6` | `5dfac6a3821cafdbdd0fd990a9b52bbd266d1dc4384927fcebc11ade494b18e6` | ✓ |
| 10 | `d85c9e7c022d9c8a29372927c4b0321e3a411a8a2855b10a3bc9ddef0cecfa38` | `d85c9e7c022d9c8a29372927c4b0321e3a411a8a2855b10a3bc9ddef0cecfa38` | ✓ |
| 11 | `6fbef7d0b1ce2cff42d987ed1b23a0779d042bc024e92cb9f8fbf18b50b13f88` | `6fbef7d0b1ce2cff42d987ed1b23a0779d042bc024e92cb9f8fbf18b50b13f88` | ✓ |
| 12 | `c256c1b9161d5f481485b1f80fbd20dbb571fd6754e84a6e4ace577f505713ba` | `c256c1b9161d5f481485b1f80fbd20dbb571fd6754e84a6e4ace577f505713ba` | ✓ |
| 13 | `3ed7274ec8c4df42ba58620b54d0e26c3e7d07ea6ad2f6e3bba307ea19cf5c73` | `3ed7274ec8c4df42ba58620b54d0e26c3e7d07ea6ad2f6e3bba307ea19cf5c73` | ✓ |
| 14 | `4b8b2bd9d998fd675e48186ce0c73769b03e4ef53d48d04da783814e9383b968` | `4b8b2bd9d998fd675e48186ce0c73769b03e4ef53d48d04da783814e9383b968` | ✓ |
| 15 | `a3385cef1185ee723945dbc867753a03e8606024110c4eb28a2f324da521e847` | `a3385cef1185ee723945dbc867753a03e8606024110c4eb28a2f324da521e847` | ✓ |
| 16 | `e9bd0c0cd93c67136109c268309c5ff72b213e8bd6ded5cbfdc1cb511cfc90c0` | `e9bd0c0cd93c67136109c268309c5ff72b213e8bd6ded5cbfdc1cb511cfc90c0` | ✓ |
| 17 | `a0677f83df7692e39d39514c95457c7c9c91fbf66729cd0a4301906866518aac` | `a0677f83df7692e39d39514c95457c7c9c91fbf66729cd0a4301906866518aac` | ✓ |
| 18 | `7dee59f87ab891b7dc2c03e88297e64ba284cbef58e9de38bf4295a286e6a6d2` | `7dee59f87ab891b7dc2c03e88297e64ba284cbef58e9de38bf4295a286e6a6d2` | ✓ |

**结论**：18/18 payload SHA-256 与 AUDIT_MANIFEST 公布值完全一致。

---

## 3. 权威源逐字节比对

```bash
for pair in \
  "docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-background-capture-relay-external-audit-request-v8-2026-10-15.md:01-audit-request.md" \
  "docs/active/project/01-prd.md:02-prd.md" \
  "docs/active/project/02-architecture.md:03-architecture.md" \
  "docs/active/project/03-development-plan.md:04-development-plan.md" \
  "docs/active/project/04-acceptance-plan.md:05-acceptance-plan.md" \
  "docs/active/project/stage-gates/v3-media-companion.md:06-stage-gate.md" \
  "docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-background-capture-relay-architecture-2026-10-15.md:07-relay-architecture.md" \
  "docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-background-capture-relay-development-plan-2026-10-15.md:08-relay-development-plan.md" \
  "docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-background-capture-relay-acceptance-plan-2026-10-15.md:09-relay-acceptance-plan.md" \
  "docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-background-capture-relay-preimplementation-audit-2026-10-15.md:10-relay-preimplementation-audit.md" \
  "docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-phase0-test-results-2026-10-15.md:11-phase0-test-results.md" \
  "docs/active/project/handoffs/v3-claudecode-completion-2026-10-15/22-p0-relay-v8-reaudit-closure.md:12-v8-reaudit-closure.md" \
  "docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-phase0-checkpoint-2026-10-15.md:13-current-checkpoint.md" \
  "docs/active/project/design/v3-p0-background-capture-relay-architecture.json:14-relay-architecture.json" \
  "docs/active/project/contracts/v3_media_capture_internal_relay_v8.schema.json:15-internal-relay-v8.schema.json" \
  "docs/active/project/fixtures/v3-media-capture-internal-relay-v8-fixtures.json:16-internal-relay-v8-fixtures.json" \
  "docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v8-contract.py:17-internal-relay-v8-verifier.py" \
  "docs/active/project/handoffs/v3-claudecode-completion-2026-10-15/14-claudecode-p0-relay-goal-prompt.md:18-main-implementation-prompt.md" ; do
  src="${pair%:*}" ; pkg="${pair##*:}"
  echo "[src=$src_hash] [pkg=$pkg_hash]"
done
```

| 序 | 路径 | 一致 |
|---|---|---|
| 01 | `01-audit-request.md` ↔ evidence audit request v8 | ✓ MATCH |
| 02 | `02-prd.md` ↔ `docs/active/project/01-prd.md` | ✓ MATCH |
| 03 | `03-architecture.md` ↔ `docs/active/project/02-architecture.md` | ✓ MATCH |
| 04 | `04-development-plan.md` ↔ `docs/active/project/03-development-plan.md` | ✓ MATCH |
| 05 | `05-acceptance-plan.md` ↔ `docs/active/project/04-acceptance-plan.md` | ✓ MATCH |
| 06 | `06-stage-gate.md` ↔ `docs/active/project/stage-gates/v3-media-companion.md` | ✓ MATCH |
| 07 | `07-relay-architecture.md` ↔ relay-architecture-2026-10-15 | ✓ MATCH |
| 08 | `08-relay-development-plan.md` ↔ relay-development-plan-2026-10-15 | ✓ MATCH |
| 09 | `09-relay-acceptance-plan.md` ↔ relay-acceptance-plan-2026-10-15 | ✓ MATCH |
| 10 | `10-relay-preimplementation-audit.md` ↔ relay-preimplementation-audit-2026-10-15 | ✓ MATCH |
| 11 | `11-phase0-test-results.md` ↔ phase0-test-results-2026-10-15 | ✓ MATCH |
| 12 | `12-v8-reaudit-closure.md` ↔ `22-p0-relay-v8-reaudit-closure.md` | ✓ MATCH |
| 13 | `13-current-checkpoint.md` ↔ phase0-checkpoint-2026-10-15 | ✓ MATCH |
| 14 | `14-relay-architecture.json` ↔ `design/v3-p0-background-capture-relay-architecture.json` | ✓ MATCH |
| 15 | `15-internal-relay-v8.schema.json` ↔ `contracts/v3_media_capture_internal_relay_v8.schema.json` | ✓ MATCH |
| 16 | `16-internal-relay-v8-fixtures.json` ↔ `fixtures/v3-media-capture-internal-relay-v8-fixtures.json` | ✓ MATCH |
| 17 | `17-internal-relay-v8-verifier.py` ↔ `verify-stage-b-b5-3-background-capture-relay-v8-contract.py` | ✓ MATCH |
| 18 | `18-main-implementation-prompt.md` ↔ `14-claudecode-p0-relay-goal-prompt.md` | ✓ MATCH |

**结论**：18/18 payload 与权威源逐字节一致。

---

## 4. Archify 视觉证据复算

```bash
sha256sum docs/active/project/design/v3-p0-background-capture-relay-architecture.json \
           docs/active/project/design/v3-p0-background-capture-relay-architecture.html
diff -q docs/active/project/design/v3-p0-background-capture-relay-architecture.json \
          docs/active/project/external-audit-package/14-relay-architecture.json
```

| 文件 | 复算 SHA-256 | 与包内 14/manifest |
|---|---|---|
| `v3-p0-background-capture-relay-architecture.json` | `4b8b2bd9d998fd675e48186ce0c73769b03e4ef53d48d04da783814e9383b968` | ✓ MATCH（与 manifest 14 一致） |
| `v3-p0-background-capture-relay-architecture.html` | `8e815df4b70f8d7fd6e5ec301fd896d34355c37b4499a0bfc69f42ea03346f77` | ✓ 与 `12-v8-reaudit-closure.md` 一致 |

JSON 与包内 14 字节一致。HTML 存在但本会话不启动浏览器，浏览器 visual-check 维持 pending，不外推为视觉 PASS（与 12 §3「Chrome unavailable 因此 browser visual-check 仍为 skipped、人工视觉审阅 pending」一致）。

---

## 5. 17-internal-relay-v8-verifier.py 47/47 运行

命令（仓库根目录）：

```bash
python3 docs/active/project/external-audit-package/17-internal-relay-v8-verifier.py
```

| 项 | 结果 |
|---|---|
| `passed` | `true` |
| `total` | 47 |
| `passed` 计数 | 47 |
| `failed` 计数 | 0 |
| `failedChecks` | `[]` |
| `schemaErrors` | `[]` |
| Python exit | `0` |

47 个检查全部 `true`。新增/扩展检查（与首轮 v8 不同）：

- `afterStageHardCrashCaseExact`：handoffFailureCases[3] 必含 `faultMode=hard_process_crash`、`restartAction=existing_recover_composite_cleanup`、`requiredResiduals={activeSinkCount:0, acquisitionResidualCount:0, asrResidualCount:0, productResidualCount:0}`、`requiresFreshBegin=true`。
- `hardCrashTraceRecoveryBarrierExact`：8 步 trace，消息序列精确为 `stage_barrier_owner_manifest_fsynced` → `hard_crash_after_stage_before_worker`(finallyExecuted=false) → `existing_recover_invoked` → `acquisition_sandbox_cleanup`(residual=0) → `asr_staged_root_cleanup`(residual=0) → `unpublished_product_cleanup`(residual=0) → `recover_abandoned`(activeSinkCount=0) → `fresh_begin_succeeds`(singleActiveSink=true)。
- `stagedAudioCrashOwnerFrozen`：`stagedAudioOwnerManifest="private_task_scoped_owner_json_taskId_pid_processStartToken_sourceSha256_stagedSha256_state_fsync_before_transfer"`；`hardCrashRecoveryOwner="MediaRecoveryCleanupCoordinator_called_by_existing_recover_internal_cleanup_callback"`。
- `compositeRecoveryCleanupFailClosed`：`hardCrashCleanupOrder="acquisition_sandbox_then_asr_staged_root_then_unpublished_product_evidence"`；`hardCrashCleanupReceipt="acquisitionResidualCount_asrResidualCount_productResidualCount_activeSinkCount_all_zero"`；`hardCrashCleanupFailure="any_error_or_nonzero_residual_fail_closed_V3_MEDIA_CLEANUP_INCOMPLETE"`；`freshBeginPrecondition="recover_abandoned_and_all_four_residual_counts_zero"`。
- `recoverCompositeCleanupEntityExact`：`recoveryOwnership.stagedAudioRecoveryEntity="MediaRecoveryCleanupCoordinator_internal_callback"`；`recoverCleanupBarrier="acquisition_sandbox_then_asr_staged_root_then_unpublished_product_evidence_all_residual_zero"`；`recoverFailureRule="any_cleanup_error_or_nonzero_residual_returns_V3_MEDIA_CLEANUP_INCOMPLETE"`。
- `sourceScopeExtractorsValid`：`python_ast_module`、`python_ast_symbols`、`typescript_string_literals_whole_file` 全部 extractor 合法返回。
- `sourceManifestPathsExact`：`authoritativeScopes` 与 `sourceInventoryEvidence.scopes` 的 path#extractor(:symbols) 集合相等。
- `sourceEmitSetEqualsFrozenInventory`：实际 AST/string-literal 推导 emit 集合与 `sourceInventory` 集合相等（双向误差 ±0）。
- `unlistedSourceFilesEmitNoBoundaryCodes`：两个 discovery root 下，未登记文件不发射任何 `V3_MEDIA_*` 在 source_inventory 内的 code 也不发射任何 `V3_MEDIA_CAPTURE_*` code。
- `discoveryRootsAndPolicyExact`：fixture 与 schema 的 `discoveryRoots` 一致；`unlistedEmitPolicy="reject_unlisted_file_containing_any_frozen_source_code_or_new_V3_MEDIA_CAPTURE_code"` 在 schema 和 fixture 中均为同一字符串。

附：路径无关性验证——把整套平铺文件复制到 `/tmp/shallow-v8r2/` 后，配合 `NAVIA_REPO_ROOT=/mnt/c/workSpace/navia` 仍 47/47 exit 0；不设 env 时 verifier 走 HERE.parents 自动寻根，正确识别仓库。

附：9 个源码证据文件 SHA-256 在仓库内复算，全部与 fixture `sourceInventoryEvidence.scopes` 一致：

| 文件 | 复算 | fixture |
|---|---|---|
| `services/local-runtime/navia_runtime/modules/media_companion/acquisition/capture_grants.py` | `cf0d50cd5bae093d62966bd0a5e165fec6582ab370360a6131cf61e75333c874` | ✓ |
| `services/local-runtime/navia_runtime/modules/media_companion/acquisition/capture_sink.py` | `a851708f3bc680b5cb29b65ae9edecab12ba9fb4b2fd4fa07f0186482a1f531a` | ✓ |
| `services/local-runtime/navia_runtime/modules/media_companion/acquisition/task_artifacts.py` | `425e64b2b63d9faa51bda559409a1d6cb290f0db24bbec0216e6a1a899c85841` | ✓ |
| `services/local-runtime/navia_runtime/modules/media_companion/acquisition/coordinator.py` | `de3a903564fe534e1dd1bb94850491abaeec56fd567678b609a88fec33da759b` | ✓ |
| `services/local-runtime/navia_runtime/app.py` | `40040aed9ad7b3d29d93e487e92042ac97d201bf1f837dafdac697418f7c3618` | ✓ |
| `apps/chrome-extension/src/modules/media_companion/capture/MediaCaptureController.ts` | `10c9404a7b7c0f5bc82f5773dea9f699f4ccbacf35c334855880ade9ae5aaab6` | ✓ |
| `apps/chrome-extension/src/modules/media_companion/capture/MediaCaptureMessageClient.ts` | `5a2317a96d24f257b4bbc127c19bbc636dfced9e6f162e0e289cb5605b206346` | ✓ |
| `apps/chrome-extension/src/modules/media_companion/capture/MediaCaptureMessageRouter.ts` | `d7d0ed7db90d12a4c477cca05da46de6ba53d68535916d1de8f2218af1d8c6d0` | ✓ |
| `apps/chrome-extension/entrypoints/media-capture-offscreen/main.ts` | `217967821df1a54f4a2292c6ad5cf4b124de0318f2371664af17f664736dd7e7` | ✓ |

附：源码 emit 推导（独立复算 `sourceEmitSetEqualsFrozenInventory`）：

| Scope | 推导 emit 数量 |
|---|---|
| `capture_grants.py` (python_ast_module) | 6 |
| `capture_sink.py` (python_ast_module) | 10 |
| `task_artifacts.py` (python_ast_module) | 4 |
| `coordinator.py` (python_ast_symbols × 4) | 7 |
| `app.py` (python_ast_symbols × 3) | 5 |
| `MediaCaptureController.ts` (string literals whole file) | 9 |
| `MediaCaptureMessageClient.ts` (string literals whole file) | 2 |
| `MediaCaptureMessageRouter.ts` (string literals whole file) | 3 |
| `media-capture-offscreen/main.ts` (string literals whole file) | 8 |
| **合并** | **36** |

`actual_emit_total = 36`、`frozen inventory = 36`、`emit − inventory = []`、`inventory − emit = []`——set equality 成立。

---

## 6. 对抗变异（隔离副本 `/tmp/v8r2-mut/`，每项独立 reset；`NAVIA_REPO_ROOT=/mnt/c/workSpace/navia`）

| 编号 | 变异 | Python exit | 失败检查数 | 关键 failedChecks |
|---|---|---|---|---|
| M1 | Schema 放宽 `additionalProperties` + `maxRawChunkBytes=999999` + `maxOutstandingChunks=999` + `maxOutstandingRawBytes=99999999` + `maxRetentionMs=9999999` | 2 | 5 | `schemaAuthorityAllFieldsImmutable`、`protocolInstanceSchemaValid`、`sourceEvidenceHashesCurrent`、`sourceScopeExtractorsValid`、`sourceEmitSetEqualsFrozenInventory` |
| M2 | schema+fixture `portName` 回退 `navia.mediaCapture.audio/v7` | 2 | 2 | `schemaAuthorityAllFieldsImmutable`、`protocolAuthorityAllFieldsImmutable` |
| M3 | 删除同步 stage barrier、worker start 前移、handler cleanup after transfer 允许 | 2 | 5 | `schemaAuthorityAllFieldsImmutable`、`protocolAuthorityAllFieldsImmutable`、`synchronousStageBarrierBeforeWorkerExact`、`artifactOwnershipTransferExact`、`stageBarrierIntegrityExact` |
| M4 | `completedFrameDelivery=authoritative_product_terminal`、`productDurableAuthority=process_in_memory_only_no_persistent_commit`、`sinkFinalizeIsTerminal=true`、`runtimeRestartBeforeProductPublish=existing_recover_always_published` + handoffFailureCases[4].productTerminal=true + handoffFailureCases[5].expectedDisposition=published | 2 | 7 | `schemaAuthorityAllFieldsImmutable`、`protocolAuthorityAllFieldsImmutable`、`allFixtureAuthoritiesImmutable`、`handoffIsNotProductTerminal`、`existingPersistentProductAuthorityExact`、`completedNotificationFailurePreservesHandoffNotSuccess`、`restartDispositionBoundToPersistentCommit` |
| M5 | 删除四个 current relay code、`V3_MEDIA_CROSS_TASK_REUSE` 重映射、删除 `V3_MEDIA_TEMP_FILE_MODE_INVALID` 映射、`r0Registry=optional_only`、`implementationVerification=none` | 2 | 8 | `schemaAuthorityAllFieldsImmutable`、`protocolAuthorityAllFieldsImmutable`、`sourceInventoryExact36`、`sourceClassificationClosedAndDisjoint`、`missingCurrentRelayCodesClosed`、`taskArtifactCodesMappedExact`、`r0RegistryAndAstScanRequired`、`sourceEmitSetEqualsFrozenInventory` |
| M6 | source hash 错配 + `revisionDomainCount=4` + identityShared/public_only 重叠 | 2 | 8 | `schemaAuthorityAllFieldsImmutable`、`protocolAuthorityAllFieldsImmutable`、`allFixtureAuthoritiesImmutable`、`sourceClassificationClosedAndDisjoint`、`sourceEvidenceHashesCurrent`、`sourceScopeExtractorsValid`、`sourceEmitSetEqualsFrozenInventory`、`threeRevisionDomainsExplicit` |
| M7 | handoffFailureCases pop 一次（首轮 IndexError 路径） | **2** | 4 | `schemaAuthorityAllFieldsImmutable`、`allFixtureAuthoritiesImmutable`、`handoffInjectionOwnersExact`、`restartDispositionBoundToPersistentCommit`（**无 IndexError/KeyError/exit 1**） |
| M7b | handoffFailureTrace pop 一次 | 2 | 3 | `schemaAuthorityAllFieldsImmutable`、`allFixtureAuthoritiesImmutable`、`handoffTraceProvesBarrierAndNoFalseTerminal` |
| M7c | hardCrashRecoveryTrace pop 一次 | 2 | 3 | `schemaAuthorityAllFieldsImmutable`、`allFixtureAuthoritiesImmutable`、`hardCrashTraceRecoveryBarrierExact` |
| M7d | handoffFailureCases[3] `faultMode=soft_signal`、`restartAction=in_memory_recover_only`、`requiresFreshBegin=false`、`requiredResiduals={...acquisitionResidualCount:1}` + schema `hardCrashRecoveryOwner=in_memory_only`、`hardCrashCleanupOrder=unpublished_product_evidence_only`、`hardCrashCleanupFailure=silent_retry`、`recoverFailureRule=silent_retry` | 2 | 4 | `schemaAuthorityAllFieldsImmutable`、`allFixtureAuthoritiesImmutable`、`protocolInstanceSchemaValid`、`afterStageHardCrashCaseExact` |
| M8 | source scope delete（删除 `capture_grants.py` scope） | 2 | 6 | `schemaAuthorityAllFieldsImmutable`、`protocolAuthorityAllFieldsImmutable`、`sourceEvidenceHashesCurrent`、`sourceManifestPathsExact`、`sourceEmitSetEqualsFrozenInventory`、`unlistedSourceFilesEmitNoBoundaryCodes` |
| M9 | source scope add（重复添加 `MediaCaptureController.ts` scope with bad hash） | 2 | 3 | `schemaAuthorityAllFieldsImmutable`、`allFixtureAuthoritiesImmutable`、`sourceEvidenceHashesCurrent`、`sourceScopeExtractorsValid` |
| M10 | r0Registry 字段删除 + `implementationVerification=none` | 2 | 3 | `schemaAuthorityAllFieldsImmutable`、`protocolAuthorityAllFieldsImmutable`、`r0RegistryAndAstScanRequired` |
| M11 | r0Registry 改为虚构名 `captureRelaySourceFailureCodes_v9_extra` | 2 | 3 | 同 M10 |

**14 项变异全部 `passed=false`、`failedChecks` 非空、`exit 2`，无 IndexError/KeyError/exit 1**。首轮 v8 的 M7（`handoffFailureCases` pop 一次触发 `IndexError/exit 1`）在 v8 修订版已通过 `handoff_by_point` 字典访问 + `len()` 保护修复。

---

## 7. 必审问题逐项反证

### 7.1 同步 staging 屏障

- `15-internal-relay-v8.schema.json` `artifactOwnershipPolicy.const.stageBarrier` = `TaskAudioStager_stage_copy_fsync_sha256_byte_length_wave_shape_all_match_before_return`。
- `asyncWorkerPrecondition` = `stage_barrier_receipt_published_in_memory_before_thread_start`。
- `captureHandoffBoundary.const.successPreconditions` 后 2 项 `stage_copy_fsync_hash_shape_barrier_succeeded`、`async_transcript_worker_started`——顺序屏障正确。
- `handoffAcceptedAt` = `after_sink_finalize_transcript_create_and_synchronous_stage_barrier_before_async_worker`。
- `07-relay-architecture.md §5`：「TaskAudioStager.stage()」必须完成私有复制、fsync、SHA-256、byte length 与 WAV shape 一致性验证，发布内存 ownership receipt 后才允许启动异步 worker；屏障前由 Runtime handler 独占 acquisition sandbox 清理权，屏障后由 transcript service 独占 staged audio 与 acquisition sandbox，handler 禁止再 cleanup。
- `09-relay-acceptance-plan.md A15` + §4 sink finalize 至 worker start 注入表。
- `16-internal-relay-v8-fixtures.json` `handoffFailureTrace` 6 步：sink_finalize → stage_barrier（fsyncCompleted=true, sourceSha256EqualsStagedSha256=true, shapeMatched=true）→ ownership_transferred(handlerCleanupAllowed=false) → async_transcript_worker_started(handoffAccepted=true, productTerminal=false) → completed_frame_send_failed → recover_after_runtime_restart(publishedRequiresDurableProductCommit=true)。
- 反证：M3 删除 stage barrier → 5 个失败检查包含 `synchronousStageBarrierBeforeWorkerExact`、`artifactOwnershipTransferExact`、`stageBarrierIntegrityExact` → exit 2 ✓

### 7.2 唯一 cleanup owner

- barrier 前：`beforeStageBarrierOwner = "runtime_capture_handler_owns_acquisition_sandbox"`。
- barrier 后：`afterStageBarrierOwner = "transcript_service_owns_staged_audio_and_acquisition_sandbox_until_terminal_cleanup"`。
- handler transfer 后禁止：`handlerCleanupAfterTransfer = "forbidden"`。
- transcript success 清理顺序：`transcriptSuccessCleanupOrder = "ASR_validate_then_cleanup_stage_then_acquisition_complete_then_transcript_terminal"`。
- transcript failure 清理顺序：`transcriptFailureCleanupOrder = "cleanup_stage_then_acquisition_failure_cleanup_then_transcript_failed"`。
- handoffFailureCases 注入 owner 6 项与 `handoffInjectionOwnersExact` 检查一致——3 项 runtime_capture_handler + 2 项 transcript_service + 1 项 product_reattach_recovery。
- 反证：M3 允许 `handlerCleanupAfterTransfer=allowed_after_transfer` → exit 2 ✓

### 7.3 持久产品 authority

- `captureHandoffBoundary.const.sinkFinalizeIsTerminal = false`。
- `captureHandoffBoundary.const.captureStreamDurability = "ephemeral_transport_handoff_not_authoritative_product_terminal"`。
- `captureHandoffBoundary.const.completedFrameDelivery = "best_effort_capture_handoff_notification_not_task_success"`。
- `captureHandoffBoundary.const.productDurableAuthority = "MediaTaskStore_commit_terminal_ready_or_degraded"`。
- `captureHandoffBoundary.const.runtimeRestartBeforeProductPublish = "existing_recover_returns_abandoned_cleanup_then_fresh_analysis_required"`。
- `recoveryOwnership.const.runtime_hard_crash_restart = "existing_recover_returns_published_only_if_durable_product_commit_exists_else_abandoned_after_cleanup"`。
- `recoveryOwnership.const.recoverObservableEvidence` 中新增 `abandoned_requires_acquisition_asr_stage_unpublished_product_cleanup_zero`。
- `handoffFailureCases[4]`：`expectedHandoffAccepted=true`、`productTerminal=false`、`expectedFailureCode=null`。
- `handoffFailureCases[5]`：`expectedDisposition="published_only_if_MediaTaskStore_terminal_commit_exists_else_abandoned"`、`requiresFreshBegin=true`。
- `07-relay-architecture.md §5`：「唯一 durable 产品终态是现有 SQLite `MediaTaskStore.commit_terminal(ready|degraded)`」；进程内 coordinator `succeeded` 不得扩大为跨重启持久成功。
- `18-main-implementation-prompt.md` line 39:「completed frame 只通知 handoff，不代表产品成功。唯一 durable 产品终态是现有 SQLite `MediaTaskStore.commit_terminal(ready|degraded)`」；无旧 v7 语义「task succeeded/GET recoverable」。
- 反证：M4 completed notification 改为产品 terminal + crash 强制 published → 7 个失败检查含 `handoffIsNotProductTerminal`、`existingPersistentProductAuthorityExact`、`completedNotificationFailurePreservesHandoffNotSuccess`、`restartDispositionBoundToPersistentCommit` → exit 2 ✓

### 7.4 36 source / 20 target 分类与遗漏代码 / TaskArtifactError / R0 registry / AST scan

- `boundaryFailureNormalization.const.sourceInventory` 36 项；`targetInventory` 20 项；`identityShared` 15 项、`renameMapping` 17 项、`publicOnlyNotEmittedOnRelayWire` 4 项。`schema.failureCodes` 与 `protocol.failureCodes` 数组 20 项。
- 集合闭包：`sourceInventory == identityShared ∪ renameSources ∪ public_only`，互斥（`sourceClassificationClosedAndDisjoint`）。
- 四个遗漏 relay code 均在 `identityShared` 集合（`missingCurrentRelayCodesClosed`）。
- 两个 TaskArtifactError：`V3_MEDIA_CROSS_TASK_REUSE → V3_MEDIA_CAPTURE_BINDING_MISMATCH`、`V3_MEDIA_TEMP_FILE_MODE_INVALID → V3_MEDIA_CAPTURE_AUDIO_SHAPE_INVALID`（`taskArtifactCodesMappedExact`）。
- R0 中央 registry：`sourceAuthority.r0Registry = "captureRelaySourceFailureCodes"`；`implementationVerification = "AST_scan_emit_sites_equals_registry_equals_frozen_sourceInventory"`（`r0RegistryAndAstScanRequired`）。
- 9 个 `sourceInventoryEvidence.scopes` SHA-256 在仓库内复算全部一致（见 §5）。
- 反证：M5 删除四个 relay code + 改 cross-task mapping + 删除 temp-file mapping + 改 r0Registry/implementationVerification → 8 个失败检查含 `sourceInventoryExact36`、`sourceClassificationClosedAndDisjoint`、`missingCurrentRelayCodesClosed`、`taskArtifactCodesMappedExact`、`r0RegistryAndAstScanRequired`、`sourceEmitSetEqualsFrozenInventory` → exit 2 ✓

### 7.5 R0 中央 registry/AST scan + discovery roots + unlisted 拒绝

- `sourceAuthority.discoveryRoots` 2 项：
  - `services/local-runtime/navia_runtime/modules/media_companion/acquisition/*.py`
  - `apps/chrome-extension/src/modules/media_companion/capture/*.ts`
- `unlistedEmitPolicy = "reject_unlisted_file_containing_any_frozen_source_code_or_new_V3_MEDIA_CAPTURE_code"` 在 schema 与 fixture 中同一字符串。
- 9 个 listed scope 覆盖范围与 discovery roots 不冲突：
  - 13 个 acquisition/*.py 文件，4 个 listed，9 个 unlisted（`__init__.py`、`audio_ref.py`、`contracts.py`、`fault_testing.py`、`sample_registry.py`、`subtitle_resolver.py`、`transcript_lineage.py`、`transcript_service.py`、`transcript_validator.py`）；unlisted 仅发射 `V3_MEDIA_TRANSCRIPT_*`/`V3_MEDIA_SUBTITLE_*` code——既不在 source_inventory 也非 `V3_MEDIA_CAPTURE_*`，被 `unlistedSourceFilesEmitNoBoundaryCodes` 检查忽略。
  - 6 个 capture/*.ts 文件，3 个 listed，3 个 unlisted（`contracts.ts`、`index.ts`、`resolveCaptureGrantBinding.ts`）；unlisted 文件不发射任何 `V3_MEDIA_*` code。
- 反证：M8（scope delete `capture_grants.py`）→ 6 个失败检查含 `sourceEvidenceHashesCurrent`、`sourceManifestPathsExact`、`sourceEmitSetEqualsFrozenInventory`、`unlistedSourceFilesEmitNoBoundaryCodes`（captured capture_grants.py 的 emit 进入 unlisted 列表）→ exit 2 ✓

### 7.6 revision 域 / Chrome 116 sender / 恢复 owner / 公共 API 不变 / A01-A18

- `identityAndRevisionPolicy.const`：`taskIdentity`、`consentRevision`、`transcriptRevision`、`productRevision`（outline/workspace 共享）、`crossDomainRevisionEquality = "forbidden_transcript_consent_and_product_revisions_are_distinct_domains"`、`revisionDomainCount = 3`。
- `senderPolicy.const.minimumChromeVersion = 116`；`capability = "chrome.runtime.getContexts_required_no_runtime_downgrade"`；6 项 sender 校验；WXT manifest 输出 `minimum_chrome_version: "116"`。
- `recoveryOwnership.const` 6 类 owner + `recoverObservableEvidence`（含 `abandoned_requires_acquisition_asr_stage_unpublished_product_cleanup_zero`） + `get404` + `markerExpiry`。
- `restartTermination.const.publicApiChange = "none"`；`recoveryOwnership.const.publicApiChange = "none"`、`newUserAction = "none"`。
- 8 步 `hardCrashRecoveryTrace` 全程 finallyExecuted=false → existing_recover invoked → 4 类 residual 归零 → recover_abandoned → fresh_begin_succeeds(singleActiveSink=true)。
- 6 个 `handoffFailureCases` 注入 owner 互斥；A01-A18 拒假绿（`09-relay-acceptance-plan.md §3`）：A01-A18 完整覆盖（与首轮 v8 一致；A15/A16/A17 增加了 owner manifest / composite cleanup / 9 个 scope / discovery root 措辞）。
- 反证：M1/M2/M6 等均被结构化 exit 2 拒绝；M6 `revisionDomainCount=4` → `threeRevisionDomainsExplicit` 失败 ✓

---

## 8. 上轮打回事实是否真正关闭

| v7→v8 上轮 Major/Minor | v8 修订版关闭证据 | 状态 |
|---|---|---|
| **Major 1**：ASR staged root 在 hard crash 后没有 recover owner；handler/worker staging 竞态 | 新增 `stagedAudioOwnerManifest` 字段（taskId/pid/processStartToken/source+staged SHA/state/fsync-before-transfer）；`hardCrashRecoveryOwner=MediaRecoveryCleanupCoordinator_called_by_existing_recover_internal_cleanup_callback`；`hardCrashCleanupOrder=acquisition_sandbox_then_asr_staged_root_then_unpublished_product_evidence`；`hardCrashCleanupReceipt=acquisitionResidualCount_asrResidualCount_productResidualCount_activeSinkCount_all_zero`；`hardCrashCleanupFailure=any_error_or_nonzero_residual_fail_closed_V3_MEDIA_CLEANUP_INCOMPLETE`；`freshBeginPrecondition=recover_abandoned_and_all_four_residual_counts_zero`；`recoveryOwnership.stagedAudioRecoveryEntity=MediaRecoveryCleanupCoordinator_internal_callback`；`recoverCleanupBarrier=acquisition_sandbox_then_asr_staged_root_then_unpublished_product_evidence_all_residual_zero`；`recoverFailureRule=any_cleanup_error_or_nonzero_residual_returns_V3_MEDIA_CLEANUP_INCOMPLETE`；8 步 `hardCrashRecoveryTrace` 全程 `finallyExecuted=false`、4 类 residual=0、fresh_begin singleActiveSink=true；handoffFailureCases[3] 的 faultMode/restartAction/requiredResiduals/requiresFreshBegin 全部由 `afterStageHardCrashCaseExact` 检查 | ✓ 关闭 |
| **Major 2**：source failure inventory 的 scope、hash 与实际 emit 文件不一致 | 9 个 `sourceInventoryEvidence.scopes`（4 python_ast_module + 2 python_ast_symbols + 3 typescript_string_literals_whole_file）SHA-256 全匹配；`sourceScopeExtractorsValid`、`sourceManifestPathsExact`、`sourceEmitSetEqualsFrozenInventory` 三项新检查保证；推导 emit 集合 36 == sourceInventory 36（双向误差 ±0） | ✓ 关闭 |
| **Minor**：删除 handoff case 时 verifier 以 `IndexError`/exit 1 退出 | verifier 用 `handoff_by_point` 字典访问 `handoffFailureCases`，所有 injectionPoint 引用走 `.get()` 而非索引；M7 删一项 handoffFailureCases 后输出 `passed=false`、4 个 failedChecks、exit 2，无 IndexError/KeyError | ✓ 关闭 |
| **Minor**：revision 域文字计数 | `revisionDomainCount=3` 与 `threeRevisionDomainsExplicit` 一致 | ✓ 关闭 |
| **Minor**：视觉检查 pending | Archify JSON/HTML SHA 复算；HTML 存在但 visual-check 维持 pending | ✓ 不外推 |

---

## 9. v8 修订版结构闭合性验证

| 新增/扩展维度 | 机器检查 | 文档约束 | 状态 |
|---|---|---|---|
| 独立 ASR staging root durable private owner manifest | `stagedAudioCrashOwnerFrozen`、`compositeRecoveryCleanupFailClosed` | `artifactOwnershipPolicy.const.stagedAudioOwnerManifest`、`recoveryOwnership.const.stagedAudioOwnerMetadata` | ✓ |
| hard-crash-after-stage-before-worker existing recover composite cleanup | `afterStageHardCrashCaseExact`、`hardCrashTraceRecoveryBarrierExact`、`recoverCompositeCleanupEntityExact` | `handoffFailureCases[3]`、`hardCrashRecoveryTrace` 8 步 | ✓ |
| 4 类 residual 全零 fail-closed | `hardCrashTraceRecoveryBarrierExact`（trace[3..6] 的 4 类 residual=0 + trace[-1] singleActiveSink=true）、`compositeRecoveryCleanupFailClosed`、`freshBeginPrecondition` | `recoveryOwnership.const.recoverCleanupBarrier`、`recoveryOwnership.const.recoverFailureRule` | ✓ |
| 既有 `V3_MEDIA_CLEANUP_INCOMPLETE` 复用 | `compositeRecoveryCleanupFailClosed`、`recoverCompositeCleanupEntityExact` | `artifactOwnershipPolicy.const.hardCrashCleanupFailure`、`recoveryOwnership.const.recoverFailureRule` | ✓ |
| 36 source inventory 由 9 scope + AST/string-literal selector 可重算 | `sourceScopeExtractorsValid`、`sourceManifestPathsExact`、`sourceEmitSetEqualsFrozenInventory` | `sourceInventoryEvidence.scopes[].language/extractor/symbols`、`discoveryRoots`、`unlistedEmitPolicy` | ✓ |
| 未列文件新增边界码被拒绝 | `unlistedSourceFilesEmitNoBoundaryCodes` | `unlistedEmitPolicy="reject_unlisted_file_containing_any_frozen_source_code_or_new_V3_MEDIA_CAPTURE_code"` | ✓ |
| `completed` 只为 handoff notification | `handoffIsNotProductTerminal`、`completedNotificationFailurePreservesHandoffNotSuccess` | `captureHandoffBoundary.const.completedFrameDelivery`、`07-relay-architecture.md §5`、`18-main-implementation-prompt.md` line 39 | ✓ |
| 唯一 durable product authority = SQLite `MediaTaskStore.commit_terminal(ready|degraded)` | `existingPersistentProductAuthorityExact` | `captureHandoffBoundary.const.productDurableAuthority`、`recoveryOwnership.const.runtime_hard_crash_restart`、`18-main-implementation-prompt.md` line 39 | ✓ |
| 旧 v7「task succeeded/GET recoverable」语义不复活 | `restartDispositionBoundToPersistentCommit`、`completedNotificationFailurePreservesHandoffNotSuccess`、`handoffIsNotProductTerminal`、`existingPersistentProductAuthorityExact` | `recoveryOwnership.const.runtime_hard_crash_restart`、`handoffFailureCases[5]` | ✓ |
| R0-R7/A01-A18 完整 | 47/47 PASS；A01-A18 在 09 中逐项 + R0/R4 引用 owner manifest 与 composite cleanup | `08-relay-development-plan.md §R0/R4`、`09-relay-acceptance-plan.md §3-4`、`18-main-implementation-prompt.md` line 45/53 | ✓ |
| 真实静音 Chrome (`--mute-audio`) | 仅文字约束（不在 verifier 47 项内） | `18-main-implementation-prompt.md` §四 line 67、`07-relay-architecture.md §7`、`09-relay-acceptance-plan.md §1-2` | ✓ 文档固定 |
| 真实 Uvicorn | 仅文字约束 | `18-main-implementation-prompt.md` line 53「TestClient 不能替代真实 Uvicorn」、`09-relay-acceptance-plan.md §4 R6` | ✓ 文档固定 |
| 失败 runner 非零 | 仅文字约束 | `09-relay-acceptance-plan.md §3 A14` | ✓ 文档固定 |
| cleanup/secret scan | 仅文字约束 | `09-relay-acceptance-plan.md §3 A11/A12` | ✓ 文档固定 |
| P1 阻断 | 仅文字约束 | `12-v8-reaudit-closure.md §4`、`10-relay-preimplementation-audit.md §3`、`AUDIT_MANIFEST.md §审查边界` | ✓ 文档固定 |

---

## 10. 文档内容附加观察

- `12-v8-reaudit-closure.md §2`：明确修订 6 项——ASR staged owner manifest、MediaRecoveryCleanupCoordinator composite cleanup、8 步 hard-crash trace、9 scope 推导 36 inventory、verifier 按 injectionPoint 安全索引、主实施提示删除 v7「completed send 后 task succeeded」语义。本审查每项独立验证。
- `10-relay-preimplementation-audit.md §4`：保留 3 个 Minor（M-1 CSP loopback 声称未证、M-2 最新 canary 目录临时、M-3 Archify 仅专项图）；与首轮 v8 一致，需在 R7 candidate 封存前关闭 M-1/M-2。
- `08-relay-development-plan.md §R0/R4`：明确「按 fixture 冻结的 9 个路径和 Python AST symbol/TypeScript literal selector 推导 emit set，并扫描两个 discovery root 拒绝未登记发码文件」；「为 TaskAudioStager 增加私有、fsync 的 owner manifest，并把 stager cleanup 接入 existing recover 的内部 composite callback」。
- `09-relay-acceptance-plan.md §3 A15-A17`：A15 加 `completed frame 仅通知 handoff；只有 SQLite ready/degraded 产品提交允许 recover=published`；A16 加 `hard crash/SIGTERM 用 owner manifest + existing recover composite cleanup，acquisition/ASR/product/sink 四项残留全零`；A17 加 `9 个冻结源码 scope 的 emit set、中央 registry 与 inventory 精确相等，discovery root 无未登记发码文件`。
- `18-main-implementation-prompt.md`：第 39 行删除 v7 旧语义；第 45 行明确 R0「保持 47/47」并新增 `scope/emit/registry/unlisted-file 增删` 变异；第 53 行明确 R4「after-stage hard crash 必须经 owner manifest + existing recover composite cleanup 使 acquisition/ASR/product/sink 四项残留全零后 fresh begin」。

---

## 11. Fatal / Major / Minor 结论

| 级别 | 项 | 数量 |
|---|---|---|
| **Fatal** | — | **0** |
| **Major** | — | **0** |
| **Minor** | — | **0** |

v8 修订版相对首轮 v8 的所有打回事实（Major 1 ASR owner/composite cleanup、Major 2 source inventory scope/hash/emit 一致性、Minor IndexError、Minor revision 域计数、Minor 视觉 pending）均已结构化关闭。14 项对抗变异（含首轮导致 IndexError 的 M7）全部稳定结构化 exit 2。视觉检查维持 pending，不外推为视觉 PASS。

---

## 12. 限制

- 仅复算 `external-audit-package/` 当前 v8 修订平铺 18 项 payload；未运行产品代码、Chrome、Runtime、Provider 或真实媒体。
- 未实际修改权威源（schema/fixture/verifier）以测试 mutation 的结构化 exit 2；mutation 全部在 `/tmp/v8r2-mut/` 副本中执行。
- 未启动浏览器核对 Archify HTML 视觉检查；按 audit request 视觉检查维持 pending，不外推为视觉 PASS。
- 报告路径已新增，未修改 `external-audit-package/` 任一文件、未修改产品代码、未修改既有证据、未修改既有 candidate；未执行 reset/checkout/clean。
- 工作树保留 dirty 状态。

---

## 13. 结论

`DOCUMENT PASS / IMPLEMENTATION REQUIRES EXPLICIT USER AUTHORIZATION`

依据：

- 18/18 payload SHA-256 与 AUDIT_MANIFEST 一致；18/18 payload 与权威源逐字节一致。
- `17-internal-relay-v8-verifier.py` 在原包和浅层副本（`NAVIA_REPO_ROOT` 已显式指向）均 47/47 PASS、exit 0。
- Archify JSON/HTML 复算完成；HTML 存在但 visual-check 维持 pending。
- 9 个源码证据 SHA-256 与 fixture 一致；AST/string-literal 推导 emit 集合 36 == sourceInventory 36（set equality），双向误差 ±0；未列文件无任何边界码。
- 14 项对抗变异（含首轮导致 IndexError 的 `handoffFailureCases.pop()`）均稳定结构化 exit 2。
- 必审问题 7 维度（同步 staging 屏障、唯一 cleanup owner、持久产品 authority、36/20 分类与四个 relay 漏项 + 两 TaskArtifactError + R0 registry/AST scan、三个 revision 域 + Chrome 116 sender + 恢复 owner + 公共 API 不变 + A01-A18、ASR owner manifest + composite cleanup、9 scope 推导 36 inventory + unlisted 拒绝）在 schema/fixture 文档层面被显式冻结；其反证变异均被结构化 exit 2 拒绝。
- v8 修订版对上轮 v8 严格 review 的 Major 1（ASR owner + composite cleanup + 4 residual = 0 + V3_MEDIA_CLEANUP_INCOMPLETE）、Major 2（9 scope + AST/string-literal selector + emit = inventory = 36）、Minor IndexError（verifier 字典安全访问）、Minor revision 域（3）、Minor 视觉（pending 不外推）全部结构化关闭。

**本结论仅证明 v8 修订文档候选与 47 项机器检查 + 14 项对抗变异（含 source scope/emit/registry/unlisted-file 增删）结构闭合，不构成 R0-R7 实施授权**。v8 修订版与 `12-v8-reaudit-closure.md §4` 同步要求：双重独立审查均 Fatal=0/Major=0 后，仍须用户明确 `approved P0 Background Capture Relay R0-R7 implementation` 才可实施；P1 六视频保持 BLOCKED；产品代码、Chrome、Runtime、Provider、媒体真实运行均保持阻塞。

—— end of round-2 independent document audit ——