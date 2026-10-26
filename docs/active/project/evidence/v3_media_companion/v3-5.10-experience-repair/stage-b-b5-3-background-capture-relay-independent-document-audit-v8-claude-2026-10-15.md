# V3 P0 Background Capture Relay v8 — 独立只读文档审查（Claude）

日期：2026-10-15。
审查者：独立 Claude 只读 reviewer（自身会话，不可被任一既有 reviewer PASS 覆盖）。
性质：v8 immutable document candidate 外审；不构成 implementation audit，亦不构成实施授权。
依据：`docs/active/project/external-audit-package/01-audit-request.md`、`AUDIT_MANIFEST.md`、`docs/active/project/handoffs/v3-claudecode-completion-2026-10-15/14-claudecode-p0-relay-goal-prompt.md`、`docs/active/project/handoffs/v3-claudecode-completion-2026-10-15/21-p0-relay-v8-replan-closure.md`。

---

## 1. 审查入口与依赖

按 `01-audit-request.md` 与 `AUDIT_MANIFEST.md`：

- 必须复算 `AUDIT_MANIFEST.md` 的 18 项 payload SHA-256，并逐字节比对权威源。
- 必须独立运行 `17-internal-relay-v8-verifier.py` 并要求 39/39。
- 必须亲自执行请求列出的对抗变异，确认必须稳定输出结构化 `exit 2`（非 KeyError/exit 1）。
- 必须独立复算 Archify JSON/HTML SHA-256；browser visual-check skipped 不得外推为视觉 PASS。
- 必须反证上轮 v7 两个 Major 是否真正关闭：进程内 succeeded 非 durable；handler/worker staging 竞态。
- 不得运行产品代码、Chrome、Runtime、Provider 或真实媒体。
- 不得修改 `external-audit-package/` 任一文件，不得修改产品源码、既有证据或既有 candidate。
- 唯一允许写入：本报告 `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-background-capture-relay-independent-document-audit-v8-claude-2026-10-15.md`。

---

## 2. 18 项 payload 复算（按 `AUDIT_MANIFEST.md` 表格逐字节）

复算命令（仓库根目录 `/mnt/c/workSpace/navia`）：

```bash
cd docs/active/project/external-audit-package
sha256sum 01-audit-request.md 02-prd.md 03-architecture.md 04-development-plan.md \
          05-acceptance-plan.md 06-stage-gate.md 07-relay-architecture.md \
          08-relay-development-plan.md 09-relay-acceptance-plan.md \
          10-relay-preimplementation-audit.md 11-phase0-test-results.md \
          12-v8-replan-closure.md 13-current-checkpoint.md 14-relay-architecture.json \
          15-internal-relay-v8.schema.json 16-internal-relay-v8-fixtures.json \
          17-internal-relay-v8-verifier.py 18-main-implementation-prompt.md
```

| 序 | 复算 SHA-256 | Manifest 公布值 | 一致 |
|---|---|---|---|
| 01 | `d2de08016f3a6311ae71e2e44a67895c2c5d829b286b11518bbb2d80317ed02b` | `d2de08016f3a6311ae71e2e44a67895c2c5d829b286b11518bbb2d80317ed02b` | ✓ |
| 02 | `247cfa66a3e687915b62b8d3bea2bc26e2e081a8c82b3da1926570db04a163cb` | `247cfa66a3e687915b62b8d3bea2bc26e2e081a8c82b3da1926570db04a163cb` | ✓ |
| 03 | `6332f54d84d2c89154294490fe1d0290dab97cc46ae195d02fa994313f497870` | `6332f54d84d2c89154294490fe1d0290dab97cc46ae195d02fa994313f497870` | ✓ |
| 04 | `be79ca14e975712312b425e0e5ad01f93cdc7179ee3654f57167c6ba270b7b47` | `be79ca14e975712312b425e0e5ad01f93cdc7179ee3654f57167c6ba270b7b47` | ✓ |
| 05 | `1194fd7189fdc2f0b6987dfc13985e3150354107b9cd5bec3f947daa0e3792c9` | `1194fd7189fdc2f0b6987dfc13985e3150354107b9cd5bec3f947daa0e3792c9` | ✓ |
| 06 | `a876ea6b01184e81e0fa3d437372aa70363f3d331b101e52d8d7afc257494ed4` | `a876ea6b01184e81e0fa3d437372aa70363f3d331b101e52d8d7afc257494ed4` | ✓ |
| 07 | `89c41b7c329bb284defbcb932d197d156cf029f32e57d3583b9f0b06006bf4b0` | `89c41b7c329bb284defbcb932d197d156cf029f32e57d3583b9f0b06006bf4b0` | ✓ |
| 08 | `cc85b048a5362e09ee937ef426fa25f0e30379f9a94332fa96be2634fdfa5297` | `cc85b048a5362e09ee937ef426fa25f0e30379f9a94332fa96be2634fdfa5297` | ✓ |
| 09 | `e4fede4860bdd70f39707c646dbf8f4086d87ac7b5c284fbb3b256cd9ceae096` | `e4fede4860bdd70f39707c646dbf8f4086d87ac7b5c284fbb3b256cd9ceae096` | ✓ |
| 10 | `4e222ba852795e50d9bd1647a89b9842ab8ab02ae51f7884128eceb4c040b98d` | `4e222ba852795e50d9bd1647a89b9842ab8ab02ae51f7884128eceb4c040b98d` | ✓ |
| 11 | `6fbef7d0b1ce2cff42d987ed1b23a0779d042bc024e92cb9f8fbf18b50b13f88` | `6fbef7d0b1ce2cff42d987ed1b23a0779d042bc024e92cb9f8fbf18b50b13f88` | ✓ |
| 12 | `38ef1d523a7a500396b2c6972f7b0e1298a17805ca4d2c382515fa96771e4407` | `38ef1d523a7a500396b2c6972f7b0e1298a17805ca4d2c382515fa96771e4407` | ✓ |
| 13 | `3ed7274ec8c4df42ba58620b54d0e26c3e7d07ea6ad2f6e3bba307ea19cf5c73` | `3ed7274ec8c4df42ba58620b54d0e26c3e7d07ea6ad2f6e3bba307ea19cf5c73` | ✓ |
| 14 | `435befea1d473241feea3368ab3b7ad5d4e2f80827656104b8371d5155ee387d` | `435befea1d473241feea3368ab3b7ad5d4e2f80827656104b8371d5155ee387d` | ✓ |
| 15 | `96c0c324ca2875509ffa9db4d223ece56f6380cd6071c7d3d1d1ea3ac26fda8d` | `96c0c324ca2875509ffa9db4d223ece56f6380cd6071c7d3d1d1ea3ac26fda8d` | ✓ |
| 16 | `6dcc63194b9667fe1ad435bfb557e33dff286f25bd307f32d1f28ca30f922c83` | `6dcc63194b9667fe1ad435bfb557e33dff286f25bd307f32d1f28ca30f922c83` | ✓ |
| 17 | `c414eedf2b59ccaa9948df84edcc9c009af9ccb8d82744aec4ab79dbf9213e08` | `c414eedf2b59ccaa9948df84edcc9c009af9ccb8d82744aec4ab79dbf9213e08` | ✓ |
| 18 | `d415c9a8d4e2cf1eedecc085ab1de2624448be1f07fda8f3531d4648888a333a` | `d415c9a8d4e2cf1eedecc085ab1de2624448be1f07fda8f3531d4648888a333a` | ✓ |

**结论**：18/18 payload SHA-256 与 AUDIT_MANIFEST 公布值完全一致。

---

## 3. 权威源逐字节比对

复算命令（仓库根目录）：

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
  "docs/active/project/handoffs/v3-claudecode-completion-2026-10-15/21-p0-relay-v8-replan-closure.md:12-v8-replan-closure.md" \
  "docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-phase0-checkpoint-2026-10-15.md:13-current-checkpoint.md" \
  "docs/active/project/design/v3-p0-background-capture-relay-architecture.json:14-relay-architecture.json" \
  "docs/active/project/contracts/v3_media_capture_internal_relay_v8.schema.json:15-internal-relay-v8.schema.json" \
  "docs/active/project/fixtures/v3-media-capture-internal-relay-v8-fixtures.json:16-internal-relay-v8-fixtures.json" \
  "docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v8-contract.py:17-internal-relay-v8-verifier.py" \
  "docs/active/project/handoffs/v3-claudecode-completion-2026-10-15/14-claudecode-p0-relay-goal-prompt.md:18-main-implementation-prompt.md" ; do
  src="${pair%:*}" ; pkg="${pair##*:}"
  echo "src=$src_hash pkg=$pkg_hash"
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
| 12 | `12-v8-replan-closure.md` ↔ `21-p0-relay-v8-replan-closure.md` | ✓ MATCH |
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
sha256sum docs/active/project/design/v3-p0-background-capture-relay-architecture.json
sha256sum docs/active/project/design/v3-p0-background-capture-relay-architecture.html
```

| 文件 | 复算 SHA-256 | 一致（包内 14 是 JSON 副本） |
|---|---|---|
| `v3-p0-background-capture-relay-architecture.json` | `435befea1d473241feea3368ab3b7ad5d4e2f80827656104b8371d5155ee387d` | ✓ 与 14 同 |
| `v3-p0-background-capture-relay-architecture.html` | `9e4a19c9fff7692503f62d6d9b318c235d68d7c2c81fda8d9177998edbc6ab7d` | ✓ 存在 |

JSON 内含 10 个 components、13 条 connections、3 个 boundaries、3 个 cards、3 个 views，6 个 source 引用 `sidepanel/main.tsx`、`MediaCaptureController.ts`、`media-capture-offscreen/main.ts`、`app.py`、`task_store.py`；quality_profile = `showcase`，diagram_type = `architecture`。HTML 存在但当前会话不启动浏览器，浏览器 visual-check 维持 pending，不外推为视觉 PASS。

---

## 5. 17-internal-relay-v8-verifier.py 39/39 运行

命令（仓库根目录）：

```bash
python3 docs/active/project/external-audit-package/17-internal-relay-v8-verifier.py
```

| 项 | 结果 |
|---|---|
| `passed` | `true` |
| `total` | 39 |
| `passed` 计数 | 39 |
| `failed` 计数 | 0 |
| `failedChecks` | `[]` |
| `schemaErrors` | `[]` |
| Python exit | `0` |

`checks` 逐项：`schemaMetaValid`、`schemaAuthorityAllFieldsImmutable`、`protocolAuthorityAllFieldsImmutable`、`allFixtureAuthoritiesImmutable`、`protocolInstanceSchemaValid`、`nineUniqueMessageVariantsExact`、`unknownFailureCodeRejected`、`duplicateTenthMessageRejected`、`positiveChunksCanonicalAndLengthExact`、`malformedChunksRejected`、`traceCountsExact`、`negativeIdsAndMappingExact`、`positiveTraceCleanupExact`、`traceOrderingAndAckExact`、`markerFivePhasesSameIdentity`、`markerExpiryArithmeticNoRefresh`、`handoffIsNotProductTerminal`、`existingPersistentProductAuthorityExact`、`synchronousStageBarrierBeforeWorkerExact`、`artifactOwnershipTransferExact`、`stageBarrierIntegrityExact`、`handoffTraceProvesBarrierAndNoFalseTerminal`、`handoffInjectionOwnersExact`、`completedNotificationFailurePreservesHandoffNotSuccess`、`restartDispositionBoundToPersistentCommit`、`sourceInventoryExact36`、`targetInventoryExact20`、`sourceClassificationClosedAndDisjoint`、`renameTargetsDeclared`、`missingCurrentRelayCodesClosed`、`taskArtifactCodesMappedExact`、`r0RegistryAndAstScanRequired`、`sourceEvidenceHashesCurrent`、`requiredObservedCodesExistInCurrentSources`、`sourceEvidenceListsAllSixKnownOmissions`、`threeRevisionDomainsExplicit`、`noPublicApiExpansion`、`restartRecoveryNoInMemorySuccessClaim`、`limitsRemainBounded` 全部 `true`。

附：路径无关性验证——把整套平铺文件复制到 `/tmp/shallow-audit/` 后运行，仍然 39/39 exit 0。

附：6 个源码证据文件 SHA-256 在仓库内复算，全部与 fixture `sourceInventoryEvidence.files` 一致：

| 文件 | 复算 | fixture |
|---|---|---|
| `services/local-runtime/navia_runtime/modules/media_companion/acquisition/capture_sink.py` | `a851708f3bc680b5cb29b65ae9edecab12ba9fb4b2fd4fa07f0186482a1f531a` | ✓ |
| `services/local-runtime/navia_runtime/modules/media_companion/acquisition/task_artifacts.py` | `425e64b2b63d9faa51bda559409a1d6cb290f0db24bbec0216e6a1a899c85841` | ✓ |
| `services/local-runtime/navia_runtime/modules/media_companion/acquisition/coordinator.py` | `de3a903564fe534e1dd1bb94850491abaeec56fd567678b609a88fec33da759b` | ✓ |
| `services/local-runtime/navia_runtime/app.py` | `40040aed9ad7b3d29d93e487e92042ac97d201bf1f837dafdac697418f7c3618` | ✓ |
| `apps/chrome-extension/src/modules/media_companion/capture/MediaCaptureController.ts` | `10c9404a7b7c0f5bc82f5773dea9f699f4ccbacf35c334855880ade9ae5aaab6` | ✓ |
| `apps/chrome-extension/entrypoints/media-capture-offscreen/main.ts` | `217967821df1a54f4a2292c6ad5cf4b124de0318f2371664af17f664736dd7e7` | ✓ |

---

## 6. 对抗变异（隔离副本 `/tmp/v8-audit-mut/`，每项独立 reset）

| 编号 | 变异 | Python exit | 失败检查数 | 关键 failedChecks |
|---|---|---|---|---|
| M1 | Schema 放宽 `additionalProperties`+`maxRawChunkBytes=999999`+`maxOutstandingChunks=999`+`maxOutstandingRawBytes=99999999`+`maxRetentionMs=9999999` | 2 | 2 | `schemaAuthorityAllFieldsImmutable`、`protocolInstanceSchemaValid` |
| M2 | schema+fixture `portName` 回退 `navia.mediaCapture.audio/v7` | 2 | 2 | `schemaAuthorityAllFieldsImmutable`、`protocolAuthorityAllFieldsImmutable` |
| M3 | 删除同步 stage barrier、worker start 前移、handler cleanup after transfer 允许 | 2 | 5 | `schemaAuthorityAllFieldsImmutable`、`protocolAuthorityAllFieldsImmutable`、`synchronousStageBarrierBeforeWorkerExact`、`artifactOwnershipTransferExact`、`stageBarrierIntegrityExact` |
| M4 | `completedFrameDelivery=authoritative_product_terminal`、`productDurableAuthority=process_in_memory_only_no_persistent_commit`、`sinkFinalizeIsTerminal=true`、`runtimeRestartBeforeProductPublish=existing_recover_always_published` + handoffFailureCases[4].productTerminal=true + handoffFailureCases[5].expectedDisposition=published | 2 | 7 | `schemaAuthorityAllFieldsImmutable`、`protocolAuthorityAllFieldsImmutable`、`allFixtureAuthoritiesImmutable`、`handoffIsNotProductTerminal`、`existingPersistentProductAuthorityExact`、`completedNotificationFailurePreservesHandoffNotSuccess`、`restartDispositionBoundToPersistentCommit` |
| M5 | 删除四个 current relay code、`V3_MEDIA_CROSS_TASK_REUSE` 重映射、删除 `V3_MEDIA_TEMP_FILE_MODE_INVALID` 映射、`r0Registry=optional_only`、`implementationVerification=none` | 2 | 7 | `schemaAuthorityAllFieldsImmutable`、`protocolAuthorityAllFieldsImmutable`、`sourceInventoryExact36`、`sourceClassificationClosedAndDisjoint`、`missingCurrentRelayCodesClosed`、`taskArtifactCodesMappedExact`、`r0RegistryAndAstScanRequired` |
| M6 | source hash 错配 + `revisionDomainCount=4` + identityShared/public_only 重叠 | 2 | 5 | `schemaAuthorityAllFieldsImmutable`、`protocolAuthorityAllFieldsImmutable`、`allFixtureAuthoritiesImmutable`、`sourceClassificationClosedAndDisjoint`、`threeRevisionDomainsExplicit` |
| M7a | 第十 message 追加 | 2 | 3 | `schemaAuthorityAllFieldsImmutable`、`protocolAuthorityAllFieldsImmutable`、`nineUniqueMessageVariantsExact` |
| M7b | chunk `rawByteLength=999` (decoded length mismatch) | 2 | 3 | `schemaAuthorityAllFieldsImmutable`、`protocolAuthorityAllFieldsImmutable`、`positiveChunksCanonicalAndLengthExact` |
| M7c | chunk `pcmBase64='AAA'` 坏 padding | 2 | 3 | 同 M7b |
| M7d | sender `minimumChromeVersion` 删除 | 2 | 2 | `schemaAuthorityAllFieldsImmutable`、`protocolInstanceSchemaValid` |
| M7e | positiveTrace pop 一次 | 2 | 2 | `schemaAuthorityAllFieldsImmutable`、`traceCountsExact` |
| M7f | restartRecoveryTrace pop 一次 | 2 | 2 | 同 M7e |
| M7g | phaseRecoveryCases pop 一次 | 2 | 2 | 同 M7e |
| M7h | handoffFailureCases pop 一次（剩 5 项） | **1** | N/A | **IndexError: list index out of range** at line 196（handoff_cases[5]） |
| M7i | RLY8-N01 expectedFailureCode 改为 `V3_MEDIA_CAPTURE_PROTOCOL_INVALID` | 2 | 2 | `schemaAuthorityAllFieldsImmutable`、`negativeIdsAndMappingExact` |
| M7j | RLY8-N01 caseId 改为 `RLY8-N99` | 2 | 2 | 同 M7i |
| M7k | negativeCases pop 一次 | 2 | 3 | `schemaAuthorityAllFieldsImmutable`、`protocolAuthorityAllFieldsImmutable`、`negativeIdsAndMappingExact` |

**子项观察**：M7h（删减 `handoffFailureCases` 至 5 项）触发 `raise SystemExit(1)` 而非 `SystemExit(2)`，因为 verifier line 196 直接访问 `handoff_cases[5]` 与 `handoff_cases[4]`、line 191 访问 `ownership.get("afterStageBarrierOwner")`、`handoff_trace[3]`、`handoff_trace[-1]`，并直接断言 `handoff_cases[1].get(injectionPoint)`、`handoff_cases[2].get(injectionPoint)` 等；其处理目标是一改一报，**没有对 fixture 长度作任何范围校验**。这是 v8 相对 v7「所有字段使用安全读取、变异必须结构化 exit 2」的 Minor 回归：M7h 仍稳定失败，但失败形态不是结构化 JSON（`passed=false` + `failedChecks`），而是 Python 栈追踪。

### 6.1 v7 已修复的稳定失败

v7 文档内提到的 KeyError/exit 1 异常退出路径在以下类别已稳定修复：

- schema `additionalProperties` 放宽 → M1 exit 2 ✓
- v7 portName 回退 → M2 exit 2 ✓
- barrier 删除 → M3 exit 2 ✓
- completed 通知冒充产品终态 → M4 exit 2 ✓
- 强制 published → M4 exit 2 ✓
- inventory 漏项 → M5 exit 2 ✓
- TaskArtifact mapping 漏项 → M5 exit 2 ✓
- 中央 registry/AST scan 删除 → M5 exit 2 ✓
- source hash 错配 → M6 exit 2 ✓
- `revisionDomainCount=4` → M6 exit 2 ✓
- 三类集合重叠 → M6 exit 2 ✓
- 第十消息、decoded length、sender context、24+8+6 trace、RLY8-N01 字段 → M7a–M7g, M7i–M7k exit 2 ✓

### 6.2 v7→v8 新引入或未关闭的稳定失败路径

- `handoffFailureCases` 长度 < 6 仍直接崩溃（IndexError/exit 1）。其他 fixture 数组被显式断言长度时也有同样风险（例如若将 `handoffFailureTrace` 减为 3 项，`handoff_trace[3]`、`handoff_trace[-1]` 与 `handoff_trace[1]` 同样会触发 IndexError）。
- `protocolInstanceSchemaValid` 失败时 schema-内 `minItems`/`maxItems`/`enum` 错误以 dict 形式呈现，已结构化；不计入本条。

---

## 7. 必审问题逐项反证

### 7.1 同步 staging 屏障

- `15-internal-relay-v8.schema.json` `artifactOwnershipPolicy.const.stageBarrier` 字段字符串明确：`TaskAudioStager_stage_copy_fsync_sha256_byte_length_wave_shape_all_match_before_return`。
- `asyncWorkerPrecondition`：`stage_barrier_receipt_published_in_memory_before_thread_start`。
- `captureHandoffBoundary.const.successPreconditions` 列表前 2 项 `sink_finalize_succeeded`、`transcript_create_succeeded`；后 2 项 `stage_copy_fsync_hash_shape_barrier_succeeded`、`async_transcript_worker_started`——顺序屏障正确。
- `handoffAcceptedAt`：`after_sink_finalize_transcript_create_and_synchronous_stage_barrier_before_async_worker`。
- `07-relay-architecture.md §5`：capture handoff 顺序固定为 sink finalize → transcript create → **同步** `TaskAudioStager.stage()`；屏障必须完成私有复制、fsync、SHA-256、byte length 与 WAV shape 一致性验证，发布内存 ownership receipt 后才允许启动异步 worker。屏障前由 Runtime handler 独占 acquisition sandbox 清理权；屏障后由 transcript service 独占 staged audio 与 acquisition sandbox，handler 禁止再 cleanup。
- `09-relay-acceptance-plan.md A15` + §4 sink finalize 至 worker start 注入表：同完整屏障定义。
- `16-internal-relay-v8-fixtures.json` `handoffFailureTrace` 6 步：step1 sink_finalize_succeeded（handoffAccepted=false, productTerminal=false）、step2 stage_barrier_succeeded（fsyncCompleted=true, sourceSha256EqualsStagedSha256=true, shapeMatched=true）、step3 ownership_transferred_to_transcript_service（handlerCleanupAllowed=false）、step4 async_transcript_worker_started（handoffAccepted=true, productTerminal=false）、step5 completed_frame_send_failed（handoffAccepted=true, productTerminal=false）、step6 product recover_after_runtime_restart（publishedRequiresDurableProductCommit=true）。
- `handoffFailureCases[0..5]` 注入 owner：`after_sink_finalize→runtime_capture_handler`、`transcript_create→runtime_capture_handler`、`before_stage→runtime_capture_handler`、`after_stage_before_worker→transcript_service`、`handoff_completed_frame_send→transcript_service`、`commit_then_runtime_restart_before_background_observe→product_reattach_recovery`。
- 反证：M3 删除 stage barrier → 5 个失败检查包含 `synchronousStageBarrierBeforeWorkerExact`、`artifactOwnershipTransferExact`、`stageBarrierIntegrityExact` → 结构化 exit 2 ✓

### 7.2 唯一 cleanup owner

- barrier 前：`artifactOwnershipPolicy.const.beforeStageBarrierOwner = "runtime_capture_handler_owns_acquisition_sandbox"`。
- barrier 后：`afterStageBarrierOwner = "transcript_service_owns_staged_audio_and_acquisition_sandbox_until_terminal_cleanup"`。
- handler transfer 后禁止：`handlerCleanupAfterTransfer = "forbidden"`。
- transcript success 清理顺序：`transcriptSuccessCleanupOrder = "ASR_validate_then_cleanup_stage_then_acquisition_complete_then_transcript_terminal"`。
- transcript failure 清理顺序：`transcriptFailureCleanupOrder = "cleanup_stage_then_acquisition_failure_cleanup_then_transcript_failed"`。
- handoffFailureCases 注入 owner 6 项与 `handoffInjectionOwnersExact` 检查一致——3 项 runtime_capture_handler（前 3 注入点）+ 2 项 transcript_service（中间 2 注入点）+ 1 项 product_reattach_recovery（最后 1 注入点）。
- after-stage-before-worker、completed-frame-send、commit_then_runtime_restart_before_background_observe 三个无双重 cleanup / 无原件提前删除的注入点 owner 互斥已被冻结。
- 反证：M3 允许 `handlerCleanupAfterTransfer=allowed_after_transfer` → 5 个失败检查含 `artifactOwnershipTransferExact` → exit 2 ✓

### 7.3 持久产品 authority

- `captureHandoffBoundary.const.sinkFinalizeIsTerminal = false`。
- `captureHandoffBoundary.const.captureStreamDurability = "ephemeral_transport_handoff_not_authoritative_product_terminal"`。
- `captureHandoffBoundary.const.completedFrameDelivery = "best_effort_capture_handoff_notification_not_task_success"`。
- `captureHandoffBoundary.const.productDurableAuthority = "MediaTaskStore_commit_terminal_ready_or_degraded"`。
- `captureHandoffBoundary.const.runtimeRestartBeforeProductPublish = "existing_recover_returns_abandoned_cleanup_then_fresh_analysis_required"`。
- `handoffFailureCases[4]`：`expectedHandoffAccepted=true`、`productTerminal=false`、`expectedFailureCode=null`。
- `handoffFailureCases[5]`：`expectedDisposition="published_only_if_MediaTaskStore_terminal_commit_exists_else_abandoned"`、`requiresFreshBegin=true`。
- `handoffFailureTrace[3]`：`handoffAccepted=true, productTerminal=false`。
- `handoffFailureTrace[5]`：`publishedRequiresDurableProductCommit=true`。
- `07-relay-architecture.md §5`：唯一 durable 产品终态是现有 SQLite `MediaTaskStore.commit_terminal(ready|degraded)`；Runtime 在该提交前重启，现有 recover 必须返回 `abandoned`、清理私有原件并要求 fresh analysis；提交后才允许返回 `published`。不得新增第二套 acquisition 数据库，也不得把进程内 coordinator `succeeded` 扩大为跨重启持久成功。
- `recoveryOwnership.const.runtime_hard_crash_restart = "existing_recover_returns_published_only_if_durable_product_commit_exists_else_abandoned_after_cleanup"`。
- `recoveryOwnership.const.recoverObservableEvidence` 6 项：recover_http_success、disposition_published_or_abandoned、authoritativeTaskId_matches_marker、`published_requires_MediaTaskStore_ready_or_degraded_projection`、`abandoned_requires_unpublished_cleanup`、fresh_begin_succeeds_single_sink。
- 反证：M4 completed notification 改为产品 terminal + crash 强制 published → 7 个失败检查含 `handoffIsNotProductTerminal`、`existingPersistentProductAuthorityExact`、`completedNotificationFailurePreservesHandoffNotSuccess`、`restartDispositionBoundToPersistentCommit` → exit 2 ✓

### 7.4 36 source / 20 target 分类与遗漏代码 / TaskArtifactError / R0 registry / AST scan

- `boundaryFailureNormalization.const.sourceInventory` 36 项；`targetInventory` 20 项；`identityShared` 15 项、`renameMapping` 17 项、`publicOnlyNotEmittedOnRelayWire` 4 项。`schema.failureCodes` 与 `protocol.failureCodes` 数组 20 项。
- 集合闭包：`sourceInventory == identityShared ∪ renameSources ∪ public_only`，互斥。
- 四个遗漏 relay code：`V3_MEDIA_CAPTURE_CHUNK_INVALID`、`V3_MEDIA_CAPTURE_CHUNK_SEQUENCE_INVALID`、`V3_MEDIA_CAPTURE_CLEANUP_INCOMPLETE`、`V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED` 均在 `identityShared` 集合（`missingCurrentRelayCodesClosed` 验证）。
- 两个 TaskArtifactError：`V3_MEDIA_CROSS_TASK_REUSE → V3_MEDIA_CAPTURE_BINDING_MISMATCH`、`V3_MEDIA_TEMP_FILE_MODE_INVALID → V3_MEDIA_CAPTURE_AUDIO_SHAPE_INVALID`（`taskArtifactCodesMappedExact` 验证）。
- R0 中央 registry：`sourceAuthority.r0Registry = "captureRelaySourceFailureCodes"`；`implementationVerification = "AST_scan_emit_sites_equals_registry_equals_frozen_sourceInventory"`；`authoritativeScopes` 7 项：`capture_grants.py`、`capture_sink.py`、`task_artifacts.py`、`coordinator.capture_lifecycle`、`app.capture_stream`、`MediaCaptureController.ts`、`media-capture-offscreen/main.ts`。
- 6 个 `sourceInventoryEvidence.files` SHA-256 在仓库内复算全部一致（见 §5）；`requiredObservedCodes` 6 项在 6 文件文本中均存在（`requiredObservedCodesExistInCurrentSources` true）。
- 反证：M5 删除四个 relay code + 改 cross-task mapping + 删除 temp-file mapping + 改 r0Registry/implementationVerification → 7 个失败检查含 `sourceInventoryExact36`、`sourceClassificationClosedAndDisjoint`、`missingCurrentRelayCodesClosed`、`taskArtifactCodesMappedExact`、`r0RegistryAndAstScanRequired` → exit 2 ✓

### 7.5 revision 域 / Chrome 116 sender / 恢复 owner / 公共 API 不变 / A01-A18

- `identityAndRevisionPolicy.const`：`taskIdentity`（同 taskId/sourceIdentity）、`consentRevision`（同 consentPolicyId+consentPolicyRevision）、`transcriptRevision`（独立单调 transcript projection revision）、`productRevision`（outline/workspace 共享 media_task revision + expected-revision fence）、`crossDomainRevisionEquality = "forbidden_transcript_consent_and_product_revisions_are_distinct_domains"`、`revisionDomainCount = 3`。
- `senderPolicy.const.minimumChromeVersion = 116`；`capability = "chrome.runtime.getContexts_required_no_runtime_downgrade"`；`extensionId`、`url`、`tab`、`frameId`、`documentId`、`incognito` 6 项 sender 校验；WXT manifest 输出 `minimum_chrome_version: "116"`。
- `recoveryOwnership.const` 6 类：connecting_before_valid_start、valid_start_runtime_alive、runtime_graceful_sigterm、runtime_hard_crash_restart、recoverObservableEvidence、get404、markerExpiry；均为 fail-closed。
- `restartTermination.const.publicApiChange = "none"`；`recoveryOwnership.const.publicApiChange = "none"`、`newUserAction = "none"`。
- `phaseRecoveryCases` 7 项 fixture：connecting、runtime_started、capturing、draining、cleanup_pending、any/hard_crash_or_restarted、any/GET_404——`traceCountsExact = 24/8/7/30/6/6` 全匹配。
- `handoffFailureCases` 6 项 fixture：六注入点 + 六 owner 互斥。
- A01-A18 拒假绿（`09-relay-acceptance-plan.md §3`）：A01 内部 sender 严格五字段 + Chrome 116+ capability probe；A02 30s/一次性；A03 Offscreen 网络 0；A04 协议顺序；A05 sequence 严格递增；A06 49152/65536/32/1572864；A07 taskId/sourceIdentity + consent/transcript/product 三域；A08 真实非空 PCM；A09 materialize only after succeeded；A10 10s busy；A11 secret 0；A12 cleanup 全归零；A13 mute-audio；A14 runner 直调 0；A15 handoff/terminal；A16 recovery owners；A17 36/20 分类与 central registry/AST emit scan；A18 合同 immutable。
- 反证：M1/M2/M6/M7d 等均被结构化 exit 2 拒绝；M6 `revisionDomainCount=4` → `threeRevisionDomainsExplicit` 失败 ✓

---

## 8. v7 上轮打回事实是否真正关闭

| v7 Major/Minor | v8 关闭证据 | 状态 |
|---|---|---|
| M1 进程内 `MediaAcquisitionCoordinator.succeeded` 非 durable + SenseVoice daemon worker staging 竞态 | `captureHandoffBoundary.const` 全 4 项关键字段；`artifactOwnershipPolicy.const.stageBarrier`、`asyncWorkerPrecondition`、`handlerCleanupAfterTransfer=forbidden`；handoffFailureTrace 6 步证据；`recoveryOwnership.runtime_hard_crash_restart` | ✓ 关闭 |
| M2 source failure inventory 漏四个 relay code + 两个 TaskArtifactError code | `sourceInventory` 36 项；identityShared 含四个遗漏 code；renameMapping 含两个 TaskArtifactError 显式映射；R0 registry + AST scan | ✓ 关闭 |
| Minor 变异异常 exit 1 | 大多数（M1-M7k 除 M7h）已结构化 exit 2 | △ M7h 仍 IndexError/exit 1 |
| Minor revision 域计数文字错误 | `revisionDomainCount = 3` 与 `threeRevisionDomainsExplicit` 检查一致 | ✓ 关闭 |
| Minor 视觉 pending | Archify JSON/HTML 复算；HTML 存在但 visual-check pending，不外推 | ✓ 不外推 |

---

## 9. 文档内容附加观察（非致命）

- `10-relay-preimplementation-audit.md §4.1` 声称「对抗变异 12/12 均稳定输出结构化 `passed=false`、`failedChecks` 非空并 exit 2」，但实际 v8 verifier 在 `handoffFailureCases` 长度被减至 5 时会 `IndexError` exit 1。M7h 应归入下一轮（v9）修复，作为本轮 Minor 标注。
- `10-relay-preimplementation-audit.md §4` 三个 Minor（M-1 CSP loopback 声称未证、M-2 最新 canary 目录临时、M-3 Archify 仅专项图）保留，与本审查无关，但需在 R7 candidate 封存前关闭 M-1/M-2。
- `12-v8-replan-closure.md` 明确当前仅允许双重独立文档审查；两份审查均 Fatal=0/Major=0 后仍须用户明确授权才能实施 R0-R7；P1 六视频保持 BLOCKED。本审查文档 PASS 不等于放行实施。

---

## 10. Fatal / Major / Minor 结论

| 级别 | 项 | 数量 |
|---|---|---|
| **Fatal** | — | **0** |
| **Major** | — | **0** |
| **Minor** | M-Index：v8 verifier line 196/191 等位置对 `handoffFailureCases`/`handoffFailureTrace` 等 fixture 数组长度作直接索引，未做范围校验；`handoffFailureCases` 减为 <6 项触发 `IndexError/exit 1` 而非结构化 exit 2；同样风险存在于 `handoffFailureTrace` 减为 <4 项 | **1** |

---

## 11. 限制

- 仅复算 `external-audit-package/` 当前 v8 平铺 18 项 payload；未运行产品代码、Chrome、Runtime、Provider 或真实媒体。
- 未实际运行 `verify-stage-b-b5-3-background-capture-relay-v8-contract.py`（`external-audit-package/` 内 17 与权威源同 SHA，按权威源执行等价）；但 audit request 要求跑的是 17，故以 17 为准。
- 未启动浏览器核对 Archify HTML 视觉检查；按 audit request 视觉检查维持 pending，不外推为视觉 PASS。
- 报告路径已新增，未修改 `external-audit-package/` 任一文件、未修改产品代码、未修改既有证据、未修改既有 candidate。

---

## 12. 结论

`DOCUMENT PASS / IMPLEMENTATION REQUIRES EXPLICIT USER AUTHORIZATION`

依据：

- 18/18 payload SHA-256 与 AUDIT_MANIFEST 一致；18/18 payload 与权威源逐字节一致。
- `17-internal-relay-v8-verifier.py` 在原包和浅层副本均 39/39 PASS、exit 0；Archify JSON/HTML 复算完成；6 个源码证据 SHA-256 与 fixture 一致。
- 12 类对抗变异（M1/M2/M3/M4/M5/M6/M7a-g/M7i-k）均稳定结构化 exit 2，覆盖 schema 放宽、portName 回退、stage barrier 删除、worker 前移、handler cleanup transfer、completed 冒充产品终态、强制 published、inventory 漏项、TaskArtifact mapping 漏项、中央 registry/AST scan 删除、source hash 漂移、`revisionDomainCount=4`、三类集合重叠、第十消息、decoded length、padding、sender context、24+8+6 trace、RLY8 字段。
- 必审问题 5 维度（同步 staging 屏障、唯一 cleanup owner、持久产品 authority、36/20 分类 + 四个 relay 漏项 + 两 TaskArtifactError + R0 registry/AST scan、三个 revision 域 + Chrome 116 sender + 恢复 owner + 公共 API 不变 + A01-A18）在 schema/fixture 文档层面被显式冻结；其反证变异（M3/M4/M5/M6/M7d 等）均被结构化 exit 2 拒绝。
- v7 两 Major 在 v8 文档内已结构化关闭（`captureHandoffBoundary`/`artifactOwnershipPolicy` 全字段、handoffFailureTrace/Cases 证据、`recoveryOwnership.runtime_hard_crash_restart`、identityShared 15 项含四个遗漏 code、renameMapping 含两个 TaskArtifactError）。
- 唯一 Minor：v8 verifier 在 fixture 数组长度被减时仍会 IndexError/exit 1（M7h），不符合 v7 修复承诺「变异必须结构化 exit 2」。该 Minor 不破坏 39/39 基线与大多数对抗变异的稳定拒绝，可在 v9 verifier 修订中补 `len()` 范围校验。
- Fatal=0/Major=0；文档候选结构闭合。

**本结论仅证明 v8 文档候选与 39 项机器检查 + 12 项对抗变异结构闭合，不构成 R0-R7 实施授权**。v8 文档自身与 `12-v8-replan-closure.md` 同步要求双重独立审查均 Fatal=0/Major=0 后，仍须用户明确 `approved P0 Background Capture Relay R0-R7 implementation` 才可实施；P1 六视频保持 BLOCKED。

—— end of independent document audit ——