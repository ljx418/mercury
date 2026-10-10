# V3-1 路线 A 开放门户架构外部独立文档审查（第二轮）

日期：2026-09-17
审查性质：第二轮独立只读文档审查；轮-1 Minor M1 闭环后 hash-bound 重建候选复算。
审查范围：`docs/active/project/external-audit-package/` 第二轮平铺包 19 项载荷 + manifest，共 20 文件。
审查方法：与轮-1 完全独立的方法链——逐字节 SHA-256 重算 + 权威源对账；Schema Draft 2020-12 meta-validation；positive instance 0 errors；25 项 requirement/case 双向 ID/key/enforcementLayer/failureCode 映射；25 个变异应用（5 Schema + 20 semantic）；portal registry 原始字节对账 + fixture binding 校验；Draw.io XML 解析；跨权威文档权限 / UX / 通用接口 / 平台泄漏比对。
不修改：产品代码、权威文档、审计包、轮-1 历史 evidence。

---

## 1. 总评

| 维度 | 结果 |
|---|---|
| 19 项载荷 SHA-256 + 字节数 | 19/19 与权威源逐字节匹配；MANIFEST 自身未列入载荷但独立 hash 一致 |
| Schema Draft 2020-12 元校验 | PASS |
| Positive instance | PASS，0 errors |
| Schema-layer 变异（5） | 5/5 被 Draft 2020-12 拒绝 |
| Semantic-layer 变异（20） | 20/20 在 Schema 层保持合法（必须由 semantic validator 拒） |
| Requirement registry ↔ negative case 映射 | 25/25 ID/key/enforcementLayer/failureCode 精确一致 |
| Portal registry 原始字节 SHA-256 | `4c3a21037d1c6199e9bd968ed51b9741884d655f96ce1aa3a4bc6b1b5f60bce6`（与权威源一致） |
| Positive fixture `portalRegistryArtifact.sha256` | 与原始字节完全一致；`adapterIds=["bilibili"]` 与 registry 一致 |
| M1 状态字段修订 | `enabled_v3_primary` → `v3_primary_target_unimplemented`（仅此字段变化） |
| 其他 adapter 字段保持不变 | adapterId/revision/platform/matches/capabilities/identityMapping/sessionProfile 全部维持轮-1 语义 |
| Draw.io 结构 | 恰好 8 页、全部中文、0 重复 ID、0 断裂 edge reference、0 越界 |
| 路线 A 权限一致性 | PRD/架构/ADR/组件/Stage gate/V3-1 开发与验收计划逐句一致 |
| 普通网页 UX 变更一致性 | 交互 PRD 显式取消常驻 launcher；接受为有声明的 UX 变更 |
| 开放门户接口可扩展性 | 通用 `MediaPageContext` / `PortalCredentialLease` 无 B站专有字段泄漏 |
| 未来门户承诺 | YouTube / 小红书在 registry 与全部权威文档均显式 NOT_IMPLEMENTED |

候选声明「Route A round-1 external audit: Fatal=0 / Major=0 / Minor=1; Minor M1 CLOSED in this hash-bound candidate」经本轮独立复算得到一致复现，未发现种子文件被篡改、未发现 M1 修订引入新的 hash/合同不一致、未发现权限/UX/接口语义漂移。

---

## 2. 19 项载荷 SHA-256 复算（轮-2 独立）

逐字节重算所有 19 项载荷 + manifest，并对照权威源；权威源已逐项比对一致。**所有轮-1 列出的 19 项载荷与本轮完全一致——除 13 / 14 号因 M1 修订而产生新的、公开声明的 hash 之外，其余 17 项全部复用轮-1 结论**。本节给出轮-2 实测值。

| # | 平铺文件 | 复算 SHA-256 | 字节数 | 权威源 | 权威源复算 |
|---:|---|---|---:|---|---|
| 1 | `01-audit-request.md` | `59f8f92ec6823cb9bc03a3d768e26519574d03b42bd8c4463d60f0588aa49776` | 4690 | `evidence/.../route-a-external-document-audit-request.md` | OK |
| 2 | `02-prd.md` | `167d3d0d08b6c6c2c753e55a24b9bf2ec393ab823a65fcb4db8607454c52b5dc` | 134243 | `01-prd.md` | OK |
| 3 | `03-architecture.md` | `56f8f287824664f43722c5051d34925b009ceb60f36511630892da9c34804419` | 153309 | `02-architecture.md` | OK |
| 4 | `04-interaction-prd.md` | `2d42ec269c7233a13a20f59b7411c43d60a62ae18726de641b5a9ac6fb50dc54` | 15309 | `interaction-prd/窗口交互_PRD.md` | OK |
| 5 | `05-development-plan.md` | `d2dcb085d84493df14dfb59be5f3b9104354e391ae65d18e6e4cab037889aafa` | 123207 | `03-development-plan.md` | OK |
| 6 | `06-acceptance-plan.md` | `885b72ee8ff971a1f8ce84e8ea1257a8964341df8c760d61ebc35dc4705efa34` | 132603 | `04-acceptance-plan.md` | OK |
| 7 | `07-v3-stage-gate.md` | `d8e3c00a4d2ed83e4a18e1ff64a0d524d08da2377928d2756114d114ab3817d0` | 5466 | `stage-gates/v3-media-companion.md` | OK |
| 8 | `08-v3-detailed-plan.md` | `832e9e2dd97459eafef2c5614c73054c58d93772b6ab045a81eaec894bea2302` | 14577 | `design/v3-media-companion-development-acceptance-plan.md` | OK |
| 9 | `09-component-route.md` | `b761ec826a1c98da06b6c33c11dba547444ac5026f72d404e5379a283bf8b59b` | 9086 | `design/v3-media-companion-component-route-design.md` | OK |
| 10 | `10-risk-adr.md` | `4d44046399bcaceb51c3eb1f3da92dcb66395173cd6519188e64cbe80115820b` | 9002 | `design/v3-media-companion-risk-adr.md` | OK |
| 11 | `11-gap.drawio` | `4efed988b1c18cf1262f1753db5dc5f1706ceee328f0e5238ad9bf279696f5cf` | 52275 | `design/v3-media-companion-gap.drawio` | OK |
| 12 | `12-contract.schema.json` | `02b363327501da22f4293f6bfd7f1bee946bfda84ac56d8721d3c21c8b7bee73` | 14988 | `contracts/v3_media_companion_contracts.schema.json` | OK |
| 13 | `13-contract-fixtures.json` | `e05c72f0339084c4b9db5a36c45edc1032a8be5b4a40d5a96a19e2622cfc36ad` | 19666 | `fixtures/v3-media-companion-contract-fixtures.json` | OK |
| 14 | `14-portal-registry.json` | `4c3a21037d1c6199e9bd968ed51b9741884d655f96ce1aa3a4bc6b1b5f60bce6` | 2009 | `contracts/v3-media-portal-registry.json` | OK |
| 15 | `15-v3-1-development-plan.md` | `67c9808679aec7e47782722b47a02a868b3cd5bbff948232066aac2d3c4ffd34` | 6040 | `evidence/.../v3-1-development-plan.md` | OK |
| 16 | `16-v3-1-acceptance-plan.md` | `c8dc057b46a9ddef462dd2f6a40486f0f4f334707845e7c27d4ce96f542f0751` | 4389 | `evidence/.../v3-1-acceptance-plan.md` | OK |
| 17 | `17-preimplementation-audit.md` | `ced0cd8fb06ec39ac956738ab56ea76c1381ec006cfa5013ffcf76ff981ac341` | 2410 | `evidence/.../v3-1-preimplementation-audit.md` | OK |
| 18 | `18-minor-m1-closure.md` | `f89cc4caedadf8050e985f1b36eae329c3617056ed152d3335f01ad6ad5a7ccd` | 1471 | `evidence/.../route-a-minor-m1-closure.md` | OK |
| 19 | `19-route-a-false-green-audit.md` | `57c33d7fea8fa773e3394fb5911e8c40ede5370767c47563ab773b03e38704a3` | 3103 | `evidence/.../route-a-internal-contract-false-green-audit.md` | OK |
| — | `AUDIT_MANIFEST.md` | `f4da21bc8de11e572c38379f25be952e6f6b2eeafbeadac9854e767cd0a8a23a` | 5670 | （清单自身；与轮-1 不同，因 §3 / § 当前候选声明段已改写为轮-2 文案） | — |

19/19 与权威源逐字节一致；`AUDIT_MANIFEST.md` 自身随轮-2 候选包文案变化属预期。

### 2.1 与轮-1 哈希差异归因

| 文件 | 轮-1 hash | 轮-2 hash | 差异原因 |
|---|---|---|---|
| `01-audit-request.md` | `55bd4a6705…` | `59f8f92ec6…` | 轮-2 重新草拟，强调 M1 复核、portal registry hash 复算、25 项 case 与 hash 绑定 |
| `13-contract-fixtures.json` | `4fbba071…` | `e05c72f0…` | M1 修订：positive instance `validation.portalRegistryArtifact.sha256` 同步到新 portal registry 字节 hash（`4c3a…bce6`）；同时 positive instance 文本按 §M1 修订微调 |
| `14-portal-registry.json` | `1d4b40d9…` | `4c3a2103…` | M1 修订：`bilibili.status` 由 `enabled_v3_primary` → `v3_primary_target_unimplemented`；其余字段全部保留（详见 §4.2） |
| `18-minor-m1-closure.md` | `00104f19…`（旧名 `route-a-architecture-audit.md`） | `f89cc4ca…` | 文件改名 + 内容重写为 M1 闭环记录 |
| `19-route-a-false-green-audit.md` | `6fd8133f…` | `57c33d7f…` | 内审第二轮在 M1 修订后重跑，更新至新 hash |

所有差异均已被本轮 manifest § 当前候选声明 显式承认；其余 14 项 hash 与轮-1 完全一致，未发生无声明的字节变化。

---

## 3. Schema v3 机器复算

工具：`jsonschema==4.26.0` Python 实现 + `referencing` Draft 2020-12 模块。
源：`12-contract.schema.json`（`$schema=https://json-schema.org/draft/2020-12/schema`）。

| 检查 | 结果 |
|---|---|
| 声称 Draft | `https://json-schema.org/draft/2020-12/schema` |
| Draft 2020-12 meta-compile | OK；`Draft202012Validator.check_schema(schema_doc)` 无错误 |
| positive instance validate | true，0 errors |
| 25 项 case ID/key/enforcementLayer/failureCode 与 `requirementRegistry` 映射 | 25/25 一致 |

### 3.1 5 个 Schema 变异（必须被 Schema 拒绝）

| Case | Target | Mutation | Schema reject | 失败码 | 层级 |
|---|---|---|:---:|---|---|
| V3-N-001 | `acquisition.credentialLease.storage` | `persistent_plaintext` | ✓ | `V3_CREDENTIAL_STORAGE_INVALID` | schema |
| V3-N-002 | `consentPolicy.scopes` | 移除 `selected_frame_cloud_vision` | ✓ | `V3_CLOUD_VISION_SCOPE_REQUIRED` | schema |
| V3-N-003 | `askResult.evidenceIds` | `[]` | ✓ | `V3_ANSWER_EVIDENCE_REQUIRED` | schema |
| V3-N-004 | `exportManifest.knowledgeImportStatus` | `imported` | ✓ | `V3_KNOWLEDGE_IMPORT_BOUNDARY` | schema |
| V3-N-005 | `mediaPageContext.canonicalUrl` | `http://www.bilibili.com/...` | ✓ | `V3_PORTAL_URL_INVALID` | schema |

5/5 Schema 拒绝通过。

### 3.2 20 个 Semantic 变异（必须保持 Schema-valid，必须由 semantic validator 拒）

| Case | Target | Mutation | Schema-valid | 失败码 | 层级 |
|---|---|---|:---:|---|---|
| V3-N-006 | `task.cleanup.credentialFileDeleted` | `false` | ✓ | `V3_CREDENTIAL_FILE_NOT_DELETED` | semantic |
| V3-N-007 | `mindmap.outlineId` | 指向其它 outline | ✓ | `V3_PROJECTION_SOURCE_MISMATCH` | semantic |
| V3-N-008 | outline evidence ID | `evidence_missing_001` | ✓ | `V3_EVIDENCE_NOT_FOUND` | semantic |
| V3-N-009 | `outline.segments[1].startSeconds` | 与前段重叠 | ✓ | `V3_TIMELINE_INVALID` | semantic |
| V3-N-010 | `providerEvidence.executionMode` | `mock` | ✓ | `V3_VISION_PROVIDER_NOT_REAL` | semantic |
| V3-N-011 | `unauthorizedCredentialAccessEvents` | `1` | ✓ | `V3_UNAUTHORIZED_CREDENTIAL_ACCESS` | semantic |
| V3-N-012 | `seekObservations[0].observedCurrentTimeSeconds` | 与 requested 偏差 > 2s | ✓ | `V3_SEEK_NOT_OBSERVED` | semantic |
| V3-N-013 | `credentialLease.taskId` | 跨 task | ✓ | `V3_CREDENTIAL_TASK_MISMATCH` | semantic |
| V3-N-014 | `outline.taskId` | 跨 task | ✓ | `V3_OUTLINE_TASK_MISMATCH` | semantic |
| V3-N-015 | `askResult.taskId` | 跨 task | ✓ | `V3_ASK_TASK_MISMATCH` | semantic |
| V3-N-016 | `task.evidence[0].endSeconds` | 超过 media duration | ✓ | `V3_EVIDENCE_TIME_INVALID` | semantic |
| V3-N-017 | `consentPolicy.status` | `revoked` 但 acquisition 已 ready | ✓ | `V3_POLICY_STATE_INVALID` | semantic |
| V3-N-018 | `task.failureCode` | `V3_SYNTHESIS_FAILED` 但 state=completed | ✓ | `V3_COMPLETED_FAILURE_INVALID` | semantic |
| V3-N-019 | `cookieValuePersistenceEvents` | `1` | ✓ | `V3_COOKIE_VALUE_PERSISTED` | semantic |
| V3-N-020 | `cookieValueEvidenceEvents` | `1` | ✓ | `V3_COOKIE_VALUE_EVIDENCE_LEAK` | semantic |
| V3-N-021 | `temporaryMediaResidualCount` | `1` | ✓ | `V3_TEMPORARY_MEDIA_RESIDUAL` | semantic |
| V3-N-022 | `acquisition.credentialLease` | `null` 但 route=credentialed_media | ✓ | `V3_CREDENTIAL_LEASE_REQUIRED` | semantic |
| V3-N-023 | `acquisition.route` | `tab_capture` 但无 captureGrant | ✓ | `V3_TRUSTED_GESTURE_REQUIRED` | semantic |
| V3-N-024 | `mediaPageContext.adapterId` | `youtube` | ✓ | `V3_PORTAL_ADAPTER_BINDING_INVALID` | semantic |
| V3-N-025 | `task.sourceIdentity` | 指向另一 video | ✓ | `V3_SOURCE_IDENTITY_MISMATCH` | semantic |

20/20 在 Schema 层保持合法，确认 semantic validator 不能被 Schema 偶然命中取代。

### 3.3 Schema 平台字段泄漏检查

`MediaPageContext.required` 为 `[platform, adapterId, adapterRevision, canonicalUrl, mediaId, playbackUnitId, part, title, author, durationSeconds, currentTimeSeconds, transcriptAvailability, observedAt]`——**无** `bvid`、**无** `cid`、**无** `partId`。`part` 仅含 `id/index/count/label`。`MediaTask.sourceIdentity` 的 pattern 为通用五段 `portal:<adapterId>:<x>:<x>:<x>`，未绑定 B站字面量。

`PortalCredentialLease` 仅含 `adapterId/browserProfileSha256/credentialNameSetSha256/credentialPolicyRevision/transport/storage/issuedAt/expiresAt`，不含 Cookie 值字段。

Positive fixture 内 `mediaId=BV1ZpYd66ELP`、`playbackUnitId=41828944992` 是运行时值，不是 Schema 字段定义；映射关系在 `BilibiliMediaPortalAdapter` 内部完成，符合路线 A「B站字段只留在 adapter 内」。

---

## 4. Portal Registry 机器复算

文件：`14-portal-registry.json`，原始字节 SHA-256 = `4c3a21037d1c6199e9bd968ed51b9741884d655f96ce1aa3a4bc6b1b5f60bce6`。权威源 `contracts/v3-media-portal-registry.json` 字节完全相同。

| 检查 | 结果 |
|---|---|
| `registryMode` | `build_time_closed_set` ✓ |
| adapter 数 | 1（仅 `bilibili`） |
| `bilibili.adapterRevision` | 1 |
| `bilibili.platform` | `bilibili` |
| `bilibili.status` | `v3_primary_target_unimplemented`（**M1 已修订**；与 `futureExamplesAreNotImplemented` 风格一致） |
| `bilibili.implementationTarget` | `apps/chrome-extension/src/modules/media_companion/adapters/bilibili/BilibiliMediaPortalAdapter.ts` |
| `bilibili.staticMatches` | `["https://www.bilibili.com/video/*"]` ✓ |
| `bilibili.webAccessibleResourceMatches` | `["https://www.bilibili.com/video/*"]` ✓ |
| `bilibili.capabilities` | `[page_identity, public_transcript_discovery, session_capability, playback_read, playback_seek]` ✓ |
| `bilibili.identityMapping.sourceIdentityTemplate` | `portal:bilibili:<mediaId>:<playbackUnitId>:<partId>` 与 Schema pattern 兼容 ✓ |
| `bilibili.sessionProfile.brokerId` | `bilibili` ✓ |
| `bilibili.sessionProfile.optionalPermissions` | `["cookies"]`（仅 B站） |
| `bilibili.sessionProfile.optionalHostPermissions` | `["https://*.bilibili.com/*"]`（仅 B站） |
| `bilibili.sessionProfile.credentialPolicy` | `bilibili-cookie-policy/v1`（独立命名空间） |
| `bilibili.sessionProfile.leaseAdapterId` | `bilibili` |
| `extensionPolicy.remoteAdaptersAllowed` | `false` ✓ |
| `extensionPolicy.wildcardAllUrlsAllowed` | `false` ✓ |
| `extensionPolicy.equivalentGlobalHttpMatchesAllowed` | `false` ✓ |
| `extensionPolicy.futureExamplesAreNotImplemented` | `["youtube", "xiaohongshu"]` ✓ |
| `extensionPolicy.newAdapterRequires` 8 项必备 | prd_scope / narrow_host_permissions / identity_mapping / capability_matrix / real_sample_registry / negative_contract_cases / independent_document_audit / independent_implementation_audit ✓ |
| `genericPageEntry.trigger` | `action_or_command` ✓ |
| `genericPageEntry.permission` | `activeTab` ✓ |
| `genericPageEntry.surface` | `native_side_panel` ✓ |
| `genericPageEntry.staticInjection` | `false` ✓ |

### 4.1 Portal Registry → Positive Fixture 交叉对账

Positive fixture `validation.portalRegistryArtifact` 三字段实测：

```text
path        = docs/active/project/contracts/v3-media-portal-registry.json
sha256      = 4c3a21037d1c6199e9bd968ed51b9741884d655f96ce1aa3a4bc6b1b5f60bce6
adapterIds  = ["bilibili"]
```

- `path` 与权威源相对路径一致 ✓
- `sha256` 与 `14-portal-registry.json` 原始字节 SHA-256 完全一致 ✓
- `adapterIds` 与 registry 中实际 adapter 数一致（仅 bilibili）✓

`task.sourceIdentity` 实际值 `portal:bilibili:BV1ZpYd66ELP:41828944992:p1` 由 `mediaPageContext.{mediaId,playbackUnitId,part.id}` 确定性派生，与 `identityMapping.sourceIdentityTemplate` 一致；V3-N-025 在本候选仍能正确生效。

### 4.2 M1 状态字段修订 vs 其他字段保持

逐字段对比 `contracts/v3-media-portal-registry.json`（权威源）与本轮重建包的 14 号载荷，确认**只有 `bilibili.status` 字段发生变化**，其他 adapter 描述符字段、`extensionPolicy`、`genericPageEntry` 全部维持轮-1 语义：

| 字段 | 轮-1（关闭前） | 轮-2（M1 修订后） | 是否变化 |
|---|---|---|:---:|
| `bilibili.adapterId` | `bilibili` | `bilibili` | 否 |
| `bilibili.adapterRevision` | `1` | `1` | 否 |
| `bilibili.platform` | `bilibili` | `bilibili` | 否 |
| `bilibili.status` | `enabled_v3_primary` | `v3_primary_target_unimplemented` | **是（仅此字段）** |
| `bilibili.implementationTarget` | (同上) | (同上) | 否 |
| `bilibili.staticMatches` | `["https://www.bilibili.com/video/*"]` | 同 | 否 |
| `bilibili.webAccessibleResourceMatches` | `["https://www.bilibili.com/video/*"]` | 同 | 否 |
| `bilibili.capabilities` | 5 项 | 同 | 否 |
| `bilibili.identityMapping` | 4 项 | 同 | 否 |
| `bilibili.sessionProfile` | 6 项 | 同 | 否 |
| `extensionPolicy.*` | 全部 | 同 | 否 |
| `genericPageEntry.*` | 4 项 | 同 | 否 |
| `registryMode` | `build_time_closed_set` | 同 | 否 |

**结论**：M1 修订是单一字段最小变更，未改 adapterId / revision / matches / capabilities / identityMapping / sessionProfile / extensionPolicy / genericPageEntry 任何一项，路线 A 语义与 hash-bound 一致性未受影响。

---

## 5. Draw.io XML 结构复算

文件：`11-gap.drawio`，52275 字节。

| 检查 | 结果 |
|---|---|
| `<diagram>` 页数 | 8 ✓（要求恰好 8） |
| 全部 8 页名称 | `01 用户入口与目标体验`、`02 当前与目标代码实体`、`03 双容器路由与组件`、`04 Cookie媒体与双回退`、`05 任务证据Ask与反跳`、`06 BiliNote迁移与治理`、`07 开发里程碑与自动验收`、`08 人类验收与出门条件` ✓ 全部中文 |
| mxCell 总数 / 唯一数 | 182 / 182 ✓ |
| 重复 ID | 0 |
| 断裂 edge reference（source/target 缺 ID） | 0 |
| 越界 mxGeometry（x/y < 0 或 x+w > pageWidth、y+h > pageHeight） | 0 |
| 节点 / 边计数 | p1:14/7, p2:20/8, p3:20/5, p4:14/10, p5:18/8, p6:12/6, p7:14/7, p8:17/2 |
| 当前/目标实体覆盖 | 第 2、3、4、6 页均含 `当前/目标` 实体 |
| 数据流覆盖 | 第 4、6 页 |
| 里程碑覆盖 | 第 7 页 |
| 验收与出门条件 | 第 7、8 页含 `验收/出门/NO-GO/禁止` |
| 关键词 `NO-GO / 禁止 / 不得 / degraded / blocked / fallback` 出现 | 全部命中 |

8/8 要求主题齐全；NO-GO 与禁止性术语在 8 页均显式声明。

---

## 6. 跨权威文档一致性（轮-2 复算）

### 6.1 路线 A 权限边界

| 文件 | 关键句 | 一致 |
|---|---|:---:|
| `02-prd.md` §最小入口权限 | 「B站详情页使用窄域自动入口；其他普通网页由用户点击扩展按钮或快捷键后以 `activeTab` 打开原生 Side Panel，不再申请全站静态注入。」 | ✓ |
| `02-prd.md` §Cookie | 「禁止 `<all_urls>` 或等价全站静态匹配。」 | ✓ |
| `03-architecture.md` §路线 A | 「不得用 `http://*/*`、`https://*/*` 等价替代 `<all_urls>`。」 | ✓ |
| `03-architecture.md` §权限分离 | 「不得扩大到 `<all_urls>` 或等价全站模式。」 | ✓ |
| `10-risk-adr.md` ADR-V3-10 | 「拒绝：使用 `http://*/*`、`https://*/*`、可选全站 host 或其他等价方式恢复全站注入」 | ✓ |
| `07-v3-stage-gate.md` §No-Go | 「`<all_urls>` 或未审计 Cookie 名称」列入 No-Go | ✓ |
| `16-v3-1-acceptance-plan.md` A13 | 「不得用 `http://*/*` / `https://*/*` 等等价写法伪装移除 `<all_urls>`」 | ✓ |
| `04-interaction-prd.md` | 「其他普通网页不再通过全站 content script 自动注入」 | ✓ |
| `14-portal-registry.json` | `wildcardAllUrlsAllowed=false`、`equivalentGlobalHttpMatchesAllowed=false` | ✓ |
| `15-v3-1-development-plan.md` §2 | 明确自报当前产品代码含 `<all_urls>` 与 V3-1 处置计划 | ✓ |

实地核对当前产品代码 `apps/chrome-extension/wxt.config.ts`：

```text
host_permissions: ["<all_urls>", "http://127.0.0.1:17861/*", "http://localhost:17861/*"]
```

与 `15-v3-1-development-plan.md` §2 自报一致；V3-1 阶段要求按获批路线 A 重写。**说明**：本结论只验证文档一致性与候选自报的真实性，不为当前产品代码背书。

### 6.2 普通网页 UX 变更（取消常驻 launcher）

| 文件 | 关键句 | 一致 |
|---|---|:---:|
| `04-interaction-prd.md` | 「自 V3 Media Companion 路线 A 起，上述『普通网页默认常驻 launcher』只对…受支持门户页面自动启用；V3 首批仅为 `https://www.bilibili.com/video/*`。其他普通网页不再通过全站 content script 自动注入，用户点击扩展按钮或执行快捷键后，由 `activeTab` 在当前页面读取上下文并打开 Chrome 原生 Side Panel。」 | ✓ |
| `02-prd.md` | 同上 | ✓ |
| `03-architecture.md` §路线 A 段 | 「其他普通网页只在 action/command 用户手势后使用 `activeTab` 和原生 Side Panel。」 | ✓ |
| `07-v3-stage-gate.md` | 「V3-1 路线 A 已由用户选定：…普通网页只在 action/command 用户手势后通过 `activeTab` 打开原生 Side Panel」 | ✓ |
| `16-v3-1-acceptance-plan.md` | 真实验收要求 Side Panel 显示能力入口；不允许「无回归地隐藏为无 UX 变更」 | ✓ |
| `14-portal-registry.json` `genericPageEntry` | `trigger=action_or_command`, `permission=activeTab`, `surface=native_side_panel`, `staticInjection=false` | ✓ |

UX 变更已在交互 PRD 显式声明为「有声明的 UX 变更」，未包装为「无回归」。

### 6.3 通用 Runtime 接口与平台泄漏

| 检查 | 结果 |
|---|---|
| Schema `MediaPageContext` 含 `bvid` / `cid` 顶层属性 | 无 |
| `PortalCredentialLease` 含 Cookie 值字段 | 无；只含 `adapterId / browserProfileSha256 / credentialNameSetSha256 / credentialPolicyRevision / transport / storage / issuedAt / expiresAt` |
| `MediaTask.sourceIdentity` pattern 含 B站字面量 | 无；通用 `portal:<adapterId>:<x>:<x>:<x>` |
| UI 通用组件（Side Panel/Workspace）依赖 `bvid/cid` | 组件设计文档禁止；要求 Runtime 唯一代理 |

通用接口足以让 YouTube、小红书后续独立 adapter 复用，无需改动 Schema / UI / Runtime 字段。路线 A 当前的「仅 B站 adapter 实现」与开放门户接口的「可扩展但不预先实现」同步成立。

### 6.4 Session 凭据与租约边界

- `bilibili.sessionProfile.credentialPolicy = bilibili-cookie-policy/v1`（独立命名空间，未来门户不得继承）。
- `optionalHostPermissions` 仅 `https://*.bilibili.com/*`，无 `<all_urls>`、无 `http://*/*`、无 `https://*/*`。
- `optionalPermissions: ["cookies"]` 仅 B站。
- V3-1 验收 A05 要求界面只显示 `available/unavailable/unknown`，0 Cookie 值；V3-1-A14 要求全树秘密扫描 0 Cookie 值。

### 6.5 V4 知识边界

- Schema 中 `exportManifest.knowledgeImportStatus: { "const": "deferred_to_v4" }` 强制为延迟到 V4。
- 权威文档 PRD / 架构 / 验收 / V3 详细计划 / Stage gate 全部一致声明 V3 不调用 KnowledgeAdapter；导出合同固定 `deferred_to_v4`，UI 不得宣称「已保存到知识库」。
- 接受为有声明的边界，未发生范围漂移。

---

## 7. 重点攻击路径实际复算（轮-2）

| 攻击 | 候选防线 | 机器验证 |
|---|---|---|
| `http://*/*` + `https://*/*` 替代 `<all_urls>` | 架构 § 路线 A + ADR-V3-10 + registry `equivalentGlobalHttpMatchesAllowed=false` + 验收 A13 | 三层（权威文档 / registry / 验收）全部明文禁止 |
| 在代码注册未进入 registry 的 adapter | `extensionPolicy.remoteAdaptersAllowed=false` + build-time closed set + `newAdapterRequires` 8 项门禁 | registry 当前仅 `bilibili`；未来 adapter 必须新注册并经两轮独立审计 |
| B站 adapterId 改 YouTube 但保留 cookie policy | V3-N-024 `portal_adapter_binding` + registry 每个 adapter 独立 `sessionProfile` | V3-N-024 schema-valid，semantic 拒；cookie policy 命名空间独立（`bilibili-cookie-policy/v1`） |
| UI / 通用 Runtime / task contract 依赖 `bvid/cid` | Schema 删除顶层字段；组件文档显式禁止 | 字段 grep：schema=0 hits、fixture=0 hits |
| 修改 context 后保留旧 sourceIdentity | V3-N-025 `source_identity_matches_page_context` | schema-valid，semantic 拒 |
| 仅检查 `adapterId=bilibili` 字符串 | 19 号内审 §2 增 `V3_PORTAL_ADAPTER_BINDING_INVALID` + `V3_SOURCE_IDENTITY_MISMATCH`；生产 validator 重算 portal registry 字节 SHA-256 | 新增防线已纳入 requirement registry 的 semantic 失败码 |
| 用 fixture / V3-1P / 原型冒充产品 | fixture `evidenceClass=contract_fixture`；V3-1 验收 V3-1-A01 强调不可复制 V3-1P 结果 | fixture notice 显式拒绝生产声明；V3-1-A01..A14 全部要求真实 Chrome |
| 普通网页取消 launcher 包装为「无回归」 | 04-interaction-prd §自 V3 Media Companion 路线 A 起显式声明 UX 变更 | 显式说明，不隐藏 |
| 用 `v3_primary_target_unimplemented` 掩盖实现就绪声明 | M1 修订后明确为「目标 + 未实现」；与 `futureExamplesAreNotImplemented` 风格一致 | 字段字面不含 `enabled` / `production` / `live` 字样 |
| 通过 fixture 篡改 portal registry hash 冒充新 adapter | positive fixture `validation.portalRegistryArtifact.sha256` 与原始字节 SHA-256 已逐字节对账 | fixture 与 registry hash 一致；adapterIds 与 registry 实际匹配 |

---

## 8. V3-1 子阶段计划与候选声明一致性

- `15-v3-1-development-plan.md`：明确 V3-1.1..1.4 四个子阶段文件级实体；要求路线 A 同步 → 独立文档审查 → 产品代码；每一子阶段强制 real-Chrome 验收与 false-green 审计。
- `16-v3-1-acceptance-plan.md`：A01..A14 必须全部 PASS，不允许 N/A；A13 显式禁止 `<all_urls>` 等价改写；A14 强制全树秘密扫描。
- `07-v3-stage-gate.md` §3「V3-1 出门判定」一致：锚点 + 5 页真实 Chrome 身份与会话能力准确；0 Cookie 值持久化。
- `17-preimplementation-audit.md`：当前门禁已声明 PENDING EXTERNAL REVIEW；候选修订后只欠第二轮独立复算。
- `18-minor-m1-closure.md`：M1 单一字段修订；明确 hash-bound 重建包需要第二轮独立复算，不能直接沿用轮-1 19 项 hash。

未发现 V3-1 子阶段计划把未来门户（YouTube / 小红书）混入首批分母、未发现缩小 12 页分母、未发现 mock 计为已通过、未发现 fixture 冒充产品 evidence。

---

## 9. M1 闭环与本轮专项复算

### 9.1 轮-1 Minor M1 状态

```text
Minor M1：14-portal-registry.json 中 bilibili.status = "enabled_v3_primary"
        字面读起来像「已上线」，但实际语义为「V3 首批实现目标 / 未上线」。
```

**轮-1 结论**：「不影响当前 GO；进入 V3-1.1 前关闭」。

### 9.2 轮-2 闭环验证

1. `bilibili.status` 已由 `enabled_v3_primary` → `v3_primary_target_unimplemented`。
2. 变更仅为单一字段；其他 adapter 描述符字段、`extensionPolicy`、`genericPageEntry` 全部维持轮-1 语义（见 §4.2 表）。
3. portal registry 原始字节 SHA-256 更新为 `4c3a21037d1c6199e9bd968ed51b9741884d655f96ce1aa3a4bc6b1b5f60bce6`。
4. positive fixture `validation.portalRegistryArtifact.sha256` 同步更新到新 hash。
5. fixture 文件自身 hash 更新为 `e05c72f0…`（其余字段未变）。
6. `manifest § 当前候选声明` 显式声明：「Minor M1: CLOSED in this hash-bound candidate」。
7. `18-minor-m1-closure.md` 解释最小修订范围并明确第二轮独立复算要求。

### 9.3 M1 修订未引入新矛盾

- 路线 A 权限（窄域静态 / WAR / session cookies + B站 host）：未变。
- 通用接口字段（`MediaPageContext` / `PortalCredentialLease`）：未变。
- 25 项 requirement/case 映射：未变；5 Schema + 20 semantic 复算结果与轮-1 完全一致。
- Draw.io 8 页结构与节点/边：未变。
- 跨权威文档 14 处关键句：与轮-1 一致。
- V3-1 子阶段计划、Stage gate、Preimplementation 审计、UX 变更声明：未变。

**结论**：M1 闭环有效；hash-bound 修订未产生新的 hash/合同不一致；未产生新的权限/UX/接口语义漂移。

---

## 10. 候选自报复算

| 候选声明 | 独立复算 | 一致 |
|---|---|:---:|
| Route A round-1 external audit: Fatal=0 / Major=0 / Minor=1 | 与轮-1 一致 | ✓ |
| Minor M1: CLOSED in this hash-bound candidate | 字段已修订；其他字段保持；fixture 同步；hash 一致 | ✓ |
| Round-2 independent review: PENDING | 本报告完成 PENDING → REPRODUCED | ✓ |
| V3-1.1 product implementation: NO-GO until round-2 Fatal=0/Major=0 | 本轮 Fatal=0/Major=0；仍需 V3-1.1..1.4 子阶段实施前审计与真实验收 | ✓ |
| YouTube/Xiaohongshu adapters: NOT_IMPLEMENTED | registry `futureExamplesAreNotImplemented` 显式；权威文档未声明已实现 | ✓ |
| Schema v3 Draft 2020-12 元校验 PASS | PASS | ✓ |
| Positive 0 errors | 0 errors | ✓ |
| 25/25 registry-case 对齐 | 25/25 | ✓ |
| 5/5 Schema negatives 拒绝 | 5/5 | ✓ |
| 20/20 semantic negatives schema-valid | 20/20 | ✓ |
| portal registry 字节 SHA-256 对账 | `4c3a2103…bce6` 与权威源一致 | ✓ |
| Fixture `portalRegistryArtifact.sha256` 与原始字节一致 | 一致 | ✓ |
| Registry 仅 `bilibili` 且 build-time closed set | 仅 bilibili；closed set | ✓ |
| 全站匹配 = 0 | 0 hits | ✓ |
| 通用 context 0 `bvid`/`cid` 字段 | 0 hits | ✓ |
| Route A 权限 = 窄域 + session 独立 | 一致 | ✓ |

候选未自报任何超出独立复算能力之外的声明。

---

## 11. 分级与依据

| 级别 | 计数 | 依据 |
|---|---:|---|
| **Fatal** | 0 | 19 项载荷 + manifest 自身与权威源逐字节一致；Schema / positive / registry / Draw.io 全部通过；M1 修订未引入新矛盾；跨权威文档权限与 UX 显式一致；无篡改、无矛盾 |
| **Major** | 0 | 攻击路径全部有候选防线或机器校验；`<all_urls>` / 等价绕过在权威文档 + registry + 验收三层同时禁止；UI/Runtime 接口无 B站字段泄漏；fixture hash 与 registry 字节 hash 严格对账 |
| **Minor** | 0 | M1 已由候选方在 V3-1.1 之前闭环；状态字段语义与 `futureExamplesAreNotImplemented` 风格一致；本轮未发现新增的可改进项 |

---

## 12. 决策与最小下一阶段

### 12.1 门禁结论

```text
GO: V3-1 Route A document candidate passes round-2 independent external audit.
     Fatal=0 / Major=0 / Minor=0.
     M1 closure reproduced; no new contradictions introduced.

NO-GO: V3-1 product implementation is still NO-GO until the
       V3-1.1..V3-1.4 sub-stage implementation exit audits pass
       V3-1-A01..V3-1-A14 on a fresh real-Chrome run, including:
         - real-Chrome identity mapping on 12 unique URLs
         - 0 Cookie value persistence / evidence leak
         - 0 <all_urls> / http://*/* / https://*/* in build output
         - full-tree secret scan = 0
         - production validator recomputes portal registry
           raw byte SHA-256 (NOT fixture hash string compare)
       This is consistent with stage gate V3-1 row.
```

### 12.2 允许进入的最小下一阶段

允许进入 **V3-1.1 媒体页面采集流程**：

- 新增 `apps/chrome-extension/src/modules/media_companion/` 下通用合同、`MediaPortalAdapter`、`MediaPortalRegistry`、`adapters/bilibili/BilibiliMediaPortalAdapter`、`bilibiliUrl.ts`、`bilibiliPageState.ts`、adapter 单元测试。
- `validation.portalRegistryArtifact.sha256` 必须以原始字节 SHA-256 重新生成并写入 contract fixture；机器审计不可退化为字符串比较。
- 修改 `apps/chrome-extension/src/contentBridge.ts`、`entrypoints/content/index.ts`，按获批权限路线注册媒体桥接；**禁止**用 `http://*/*` + `https://*/*` 替代 `<all_urls>`（V3-1-A13）。

V3-1.2（授权与会话 Broker）、V3-1.3（Runtime 租约边界）、V3-1.4（双容器入口）仍受各自子阶段实施前审计约束，不得跨阶段。

### 12.3 不再保留的 Minor

M1 已闭环；本轮不再保留任何未关闭 Minor。

---

## 13. 限制与边界

- 本审查为独立只读文档审查；未运行 V3-1 产品 E2E、未运行 PX-6 或 V2 generator、未覆盖任何历史 evidence。
- 当前产品代码仍含 `<all_urls>`，与 V3-1 处置计划一致；本审查只验证文档一致性与候选自报的真实性，不为当前产品代码背书。
- V3-1P 探测样本注册表 SHA-256=`b71588928db4a0cb371152999052ae6b511b076377df427d74e680119491d8c1` 已固定且仅作为 V3-1 输入边界，本审查不重审其平台内容。
- 旧 PX / V2 / V3-0 外审包、旧合同版本均不在本轮范围内。
- 本轮不重写轮-1 历史 evidence；轮-1 报告继续保留在权威 evidence 目录作为历史结论，与本轮并存。
- 本轮不修改 audit-package 中任何文件；唯一写入为本文档本身。

审查完毕。
