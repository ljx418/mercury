# V3-1 路线 A 开放门户架构外部独立文档审查

日期：2026-09-17
审查性质：独立只读文档审查（实施前）
审查范围：`docs/active/project/external-audit-package/` 19 项载荷 + manifest
审查方法：哈希复算、Schema Draft 2020-12 元校验、25 项 requirement 与 case 双向映射、变异应用、portal registry 原始字节对账、Draw.io 结构解析、跨权威文档权限/UX/接口一致性比对。
不修改：产品代码、权威文档、审计包或任何历史 evidence。

---

## 1. 总评

| 维度 | 结果 |
|---|---|
| 19 项载荷 SHA-256 | 19/19 与权威源逐字节匹配 |
| Schema Draft 2020-12 元校验 | PASS |
| Positive instance | PASS, 0 errors |
| Schema-layer 变异（5） | 5/5 被 Draft 2020-12 拒绝 |
| Semantic-layer 变异（20） | 20/20 在 Schema 层保持合法（必须由 semantic validator 拒绝） |
| Requirement registry 与 negative case 映射 | 25/25 ID/key/enforcementLayer/failureCode 精确一致 |
| Portal registry 原始字节对账 | PASS（`1d4b40d9…3ba70`） |
| Fixture 内 `portalRegistryArtifact.sha256` | PASS，与原始字节完全一致 |
| Draw.io 结构 | 恰好 8 页，全部中文；0 重复 ID；0 断裂 edge；0 越界 |
| 路线 A 权限一致性 | PRD/架构/ADR/组件/Stage gate/V3-1 开发验收一致 |
| 普通网页 UX 变更一致性 | 交互 PRD 明确取消常驻 launcher；接受为有声明的 UX 变更 |
| 开放门户接口可扩展性 | 通用 `MediaPageContext`/`PortalCredentialLease` 不泄漏 B站专有字段 |
| `<all_urls>` / 等价绕过 | 权威文档与 registry 一致禁止；产品代码当前确有 `<all_urls>`，与 V3-1 处置计划吻合 |

候选声明「Route A internal documents: Fatal=0 / Major=0 / Minor=0」经本轮独立复算得到一致复现，未发现种子文件被篡改或候选自报失真。

---

## 2. 19 项载荷 SHA-256 复算

逐字节重算所有 19 项载荷 + manifest，并对照权威源；权威源已逐项比对。

| # | 平铺文件 | 复算 SHA-256 | 字节数 | 权威源 | 权威源复算 |
|---:|---|---|---:|---|---|
| 1 | `01-audit-request.md` | `55bd4a6705a703ca319e03fd047253957e405b6fa5e3c6ae83759f3e347340e2` | 4346 | `evidence/.../route-a-external-document-audit-request.md` | OK |
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
| 13 | `13-contract-fixtures.json` | `4fbba07177281a20b5ccdfcba4a9d4b6f494c982a823a75cc42d9659e1964227` | 19668 | `fixtures/v3-media-companion-contract-fixtures.json` | OK |
| 14 | `14-portal-registry.json` | `1d4b40d9d771a9063ffc191c1efb1edfb352da89eab8d302455337a9e383ba70` | 1996 | `contracts/v3-media-portal-registry.json` | OK |
| 15 | `15-v3-1-development-plan.md` | `67c9808679aec7e47782722b47a02a868b3cd5bbff948232066aac2d3c4ffd34` | 6040 | `evidence/.../v3-1-development-plan.md` | OK |
| 16 | `16-v3-1-acceptance-plan.md` | `c8dc057b46a9ddef462dd2f6a40486f0f4f334707845e7c27d4ce96f542f0751` | 4389 | `evidence/.../v3-1-acceptance-plan.md` | OK |
| 17 | `17-preimplementation-audit.md` | `ced0cd8fb06ec39ac956738ab56ea76c1381ec006cfa5013ffcf76ff981ac341` | 2410 | `evidence/.../v3-1-preimplementation-audit.md` | OK |
| 18 | `18-route-a-architecture-audit.md` | `00104f19e08c27154da48dd74704af0808de7239653767f49184d99202fea374` | 2667 | `evidence/.../route-a-internal-architecture-audit.md` | OK |
| 19 | `19-route-a-false-green-audit.md` | `6fd8133f67f387c60d296d74fc106097d9c7087be3f82a738634adedd22ea721` | 3103 | `evidence/.../route-a-internal-contract-false-green-audit.md` | OK |
| — | `AUDIT_MANIFEST.md` | `c90408fdfc33da90a714d634dc53cebcc2d06347d360d17118819f6e63bef29c` | 5800 | （清单本身） | — |

19/19 一致；无篡改。

---

## 3. Schema v3 机器复算

工具：`ajv@8.18.0` + `ajv-formats@3.0.1`（Draft 2020-12 模块）。
源：`12-contract.schema.json`（`$schema=https://json-schema.org/draft/2020-12/schema`）。

| 检查 | 结果 |
|---|---|
| 声称 Draft | `https://json-schema.org/draft/2020-12/schema` |
| ajv 2020 模块 meta-compile | OK；validator 编译成功 |
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

5/5 schema 拒绝通过。

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

20/20 在 Schema 层保持合法，验证了 semantic validator 不可被 Schema 偶然命中取代。

### 3.3 Schema 平台字段泄漏检查

`MediaPageContext.required` 为 `[platform, adapterId, adapterRevision, canonicalUrl, mediaId, playbackUnitId, part, title, author, durationSeconds, currentTimeSeconds, transcriptAvailability, observedAt]`——**无** `bvid`、**无** `cid`、**无** `partId`（`part.id` 不等于 `partId`，后者已删除）。`part` 仅含 `id/index/count/label`。`MediaTask.sourceIdentity` 的 pattern 为通用五段 `portal:<adapterId>:<x>:<x>:<x>`，未绑定 B站。

Positive fixture 内 `mediaId=BV1ZpYd66ELP`、`playbackUnitId=41828944992` 是运行时值，不是字段定义；映射关系在 `BilibiliMediaPortalAdapter` 内部完成，符合路线 A「B站字段只留在 adapter 内」。

---

## 4. Portal Registry 机器复算

文件：`14-portal-registry.json`，原始字节 SHA-256 = `1d4b40d9d771a9063ffc191c1efb1edfb352da89eab8d302455337a9e383ba70`。

| 检查 | 结果 |
|---|---|
| `registryMode` | `build_time_closed_set` ✓ |
| adapter 数 | 1（仅 `bilibili`） |
| `bilibili.adapterRevision` | 1 |
| `bilibili.staticMatches` | `["https://www.bilibili.com/video/*"]` ✓ |
| `bilibili.webAccessibleResourceMatches` | `["https://www.bilibili.com/video/*"]` ✓ |
| `bilibili.sessionProfile.brokerId` | `bilibili` ✓ |
| `bilibili.sessionProfile.optionalHostPermissions` | `["https://*.bilibili.com/*"]` ✓ |
| `bilibili.sessionProfile.credentialPolicy` | `bilibili-cookie-policy/v1` ✓ |
| `bilibili.sessionProfile.leaseAdapterId` | `bilibili` ✓ |
| `bilibili.identityMapping.sourceIdentityTemplate` | `portal:bilibili:<mediaId>:<playbackUnitId>:<partId>` 与 Schema pattern 兼容 ✓ |
| `extensionPolicy.remoteAdaptersAllowed` | `false` ✓ |
| `extensionPolicy.wildcardAllUrlsAllowed` | `false` ✓ |
| `extensionPolicy.equivalentGlobalHttpMatchesAllowed` | `false` ✓ |
| `extensionPolicy.futureExamplesAreNotImplemented` | `["youtube","xiaohongshu"]` ✓ |
| `extensionPolicy.newAdapterRequires` 8 项必备 | prd_scope/narrow_host_permissions/identity_mapping/capability_matrix/real_sample_registry/negative_contract_cases/independent_document_audit/independent_implementation_audit ✓ |

### 4.1 Portal Registry → Positive Fixture 交叉对账

Positive fixture `validation.portalRegistryArtifact.sha256` = `1d4b40d9d771a9063ffc191c1efb1edfb352da89eab8d302455337a9e383ba70`，与 `14-portal-registry.json` 原始字节 SHA-256 完全一致；`adapterIds = ["bilibili"]` 与 registry 中实际 adapter 数一致。

生产 validator 必须重算原始字节 SHA-256 的要求（`19-route-a-false-green-audit.md` §2）已在 schema `portalRegistryArtifact` 字段固定。

---

## 5. Draw.io XML 结构复算

文件：`11-gap.drawio`，52275 字节。

| 检查 | 结果 |
|---|---|
| `<diagram>` 页数 | 8 ✓（要求恰好 8） |
| 全部 8 页名称 | `01 用户入口与目标体验`、`02 当前与目标代码实体`、`03 双容器路由与组件`、`04 Cookie媒体与双回退`、`05 任务证据Ask与反跳`、`06 BiliNote迁移与治理`、`07 开发里程碑与自动验收`、`08 人类验收与出门条件` ✓ 全部中文 |
| 节点/边计数 | 21/7、28/8、25/5、24/10、26/8、18/6、21/7、19/2 ✓ |
| 重复 ID | 0 |
| 断裂 edge reference（source/target 缺 ID） | 0 |
| 越界 mxGeometry（x/y < 0 或 x+w > pageWidth、y+h > pageHeight） | 0 |
| 当前/目标实体覆盖 | 第 2 页（当前与目标代码实体）、第 3、4、6 页都含 `当前/目标` |
| 数据流覆盖 | 第 4、6 页 |
| 里程碑覆盖 | 第 7 页 |
| 验收与出门条件 | 第 7、8 页含 `验收/出门/NO-GO/禁止` |
| 中文标签密度 | 含中文节点文本 |
| 跨页 ID 冲突 | 每页独立，无全局 id 越界 |

8/8 要求主题齐全。

---

## 6. 跨权威文档一致性

### 6.1 路线 A 权限边界

| 文件 | 关键句子 | 一致 |
|---|---|:---:|
| `02-prd.md` | 「最小入口权限：B站详情页使用窄域自动入口；其他普通网页由用户点击扩展按钮或快捷键后以 `activeTab` 打开原生 Side Panel，不再申请全站静态注入。」 | ✓ |
| `02-prd.md` | 「禁止 `<all_urls>` 或等价全站静态匹配。」 | ✓ |
| `03-architecture.md` | 「不得用 `http://*/*`、`https://*/*` 等价替代 `<all_urls>`。」 | ✓ |
| `03-architecture.md` | 「不得扩大到 `<all_urls>` 或等价全站模式。」 | ✓ |
| `10-risk-adr.md` ADR-V3-10 | 「拒绝：使用 `http://*/*`、`https://*/*`、可选全站 host 或其他等价方式恢复全站注入」 | ✓ |
| `07-v3-stage-gate.md` | 「`<all_urls>` 或未审计 Cookie 名称」列入 No-Go | ✓ |
| `16-v3-1-acceptance-plan.md` V3-1-A13 | 「不得用 `http://*/*`/`https://*/*` 等等价写法伪装移除 `<all_urls>`」 | ✓ |
| `14-portal-registry.json` | `wildcardAllUrlsAllowed=false`、`equivalentGlobalHttpMatchesAllowed=false` | ✓ |
| `15-v3-1-development-plan.md` | 「这些权限支撑 V1 PRD 的『普通网页默认出现常驻 launcher』」明确问题位置 | ✓ |

实地检查当前产品代码 `apps/chrome-extension/wxt.config.ts`：
```text
host_permissions: ["<all_urls>", "http://127.0.0.1:17861/*", "http://localhost:17861/*"]
```
以及 `entrypoints/content/index.ts` 与构建产物 manifest 均含 `<all_urls>`。这与 `15-v3-1-development-plan.md` §2 的自报一致；新计划要求在 V3-1 阶段按获批路线重写。**说明**：本结论只验证文档一致性与候选自报的真实性，不为当前产品代码背书；产品代码当前确实存在 `<all_urls>`，但处置已在 V3-1 计划中明确。

### 6.2 普通网页 UX 变更（取消常驻 launcher）

| 文件 | 关键句 | 一致 |
|---|---|:---:|
| `04-interaction-prd.md` | 「自 V3 Media Companion 路线 A 起，上述『普通网页默认常驻 launcher』只对…受支持门户页面自动启用；V3 首批仅为 `https://www.bilibili.com/video/*`。其他普通网页不再通过全站 content script 自动注入，用户点击扩展按钮或执行快捷键后，由 `activeTab` 在当前页面读取上下文并打开 Chrome 原生 Side Panel。」 | ✓ |
| `02-prd.md` | 「其他普通网页由用户点击扩展按钮或快捷键后以 `activeTab` 打开原生 Side Panel，不再申请全站静态注入。」 | ✓ |
| `03-architecture.md` § 路线 A 段 | 「其他普通网页只在 action/command 用户手势后使用 `activeTab` 和原生 Side Panel。」 | ✓ |
| `07-v3-stage-gate.md` | 「V3-1 路线 A 已由用户选定：…普通网页只在 action/command 用户手势后通过 `activeTab` 打开原生 Side Panel」 | ✓ |
| `16-v3-1-acceptance-plan.md` | 真实验收要求 Side Panel 显示能力入口；不允许「无回归地隐藏为无 UX 变更」 | ✓ |

UX 变更已在交互 PRD 显式声明为「有声明的 UX 变更」，未试图包装为「无回归」。

### 6.3 通用 Runtime 接口与平台泄漏

| 检查 | 结果 |
|---|---|
| Schema `MediaPageContext` 含 `bvid` / `cid` 顶层属性 | 无 |
| `PortalCredentialLease` 含 Cookie 值字段 | 无；只含 `adapterId/browserProfileSha256/credentialNameSetSha256/credentialPolicyRevision/transport/storage/issuedAt/expiresAt` |
| `MediaTask.sourceIdentity` pattern 含 B站字面量 | 无；通用 `portal:<adapterId>:<x>:<x>:<x>` |
| UI 通用组件（Side Panel/Workspace）依赖 `bvid/cid` | 组件设计文档禁止；要求 Runtime 唯一代理 |

通用接口足以让 YouTube、小红书后续独立 adapter 复用，无需改动 Schema/UI/Runtime 字段。

### 6.4 Session 凭据与租约边界

- `bilibili.sessionProfile.credentialPolicy` = `bilibili-cookie-policy/v1`（独立命名空间，未来门户不得继承）。
- `optionalHostPermissions` 仅 `https://*.bilibili.com/*`，无 `<all_urls>`、无 `http://*/*`、无 `https://*/*`。
- `optionalPermissions: ["cookies"]` 仅 B站。
- V3-1 验收 `V3-1-A05` 要求界面只显示 `available/unavailable/unknown`，0 Cookie 值；`V3-1-A14` 要求全树秘密扫描 0 Cookie 值。

---

## 7. 重点攻击路径实际复算

| 攻击 | 候选防线 | 机器验证 |
|---|---|---|
| `http://*/*` + `https://*/*` 替代 `<all_urls>` | 架构 § 路线 A、ADR-V3-10、registry `equivalentGlobalHttpMatchesAllowed=false` | 三层均明文禁止；生产 validator 须做 host-scope 归一化（v3-1-acceptance V3-1-A13） |
| 在代码注册未进入 registry 的 adapter | `extensionPolicy.remoteAdaptersAllowed=false` + build-time closed set + `newAdapterRequires` 8 项门禁 | registry 当前仅 `bilibili`，未来 adapter 必须新注册并经两轮审计 |
| B站 adapterId 改为 YouTube 但保留 cookie policy | `V3-N-024` portal_adapter_binding + registry 每个 adapter 独立 `sessionProfile` | V3-N-024 schema-valid，semantic 拒绝；cookie policy 命名空间独立 |
| UI/通用 Runtime/task contract 依赖 `bvid/cid` | Schema 删除顶层字段；组件文档显式禁止 | 字段 grep：schema=0 hits、fixture=0 hits |
| 修改 context 后保留旧 sourceIdentity | `V3-N-025` source_identity_matches_page_context | schema-valid，semantic 拒绝 |
| 仅检查 `adapterId=bilibili` 字符串 | 19-内部假绿审计 §2 增 `V3_PORTAL_ADAPTER_BINDING_INVALID` + `V3_SOURCE_IDENTITY_MISMATCH`；生产 validator 重算 portal registry 字节 SHA-256 | 新增防线已纳入 requirement registry 的 semantic 失败码 |
| 用 fixture/V3-1P/原型冒充产品 | fixtures `evidenceClass=contract_fixture`；V3-1 验收 V3-1-A01 强调不可复制 V3-1P 结果 | fixture notice 显式拒绝生产声明；V3-1-A01..A14 全部真实 Chrome |
| 普通网页取消 launcher 包装为「无回归」 | 04-interaction-prd §自 V3 Media Companion 路线 A 起显式声明 UX 变更 | 显式说明，不隐藏 |

---

## 8. V3-1 子阶段计划与候选声明一致性

- `15-v3-1-development-plan.md`：明确 V3-1.1..1.4 四个子阶段文件级实体；要求路由 A 同步 → 独立文档审查 → 产品代码；每一子阶段强制 `real-Chrome` 验收与 false-green 审计。
- `16-v3-1-acceptance-plan.md`：A01..A14 必须全部 PASS，不允许 N/A；A13 显式禁止 `<all_urls>` 等价改写；A14 强制全树秘密扫描。
- 与 `07-v3-stage-gate.md` §3「V3-1 出门判定」一致：锚点 + 5 页真实 Chrome 身份与会话能力准确；0 Cookie 值持久化。

未发现 V3-1 子阶段计划把未来门户（YouTube/小红书）混入首批分母、未发现缩小 12 页分母、未发现 mock 计为已通过。

---

## 9. 分级与依据

| 级别 | 计数 | 依据 |
|---|---:|---|
| **Fatal** | 0 | 19 项哈希一致；Schema/positive/registry/Draw.io 全部通过；跨文档权限与 UX 显式一致；无篡改、无矛盾 |
| **Major** | 0 | 攻击路径全部有候选防线或机器校验；`<all_urls>` / 等价绕过在权威文档 + registry + 验收三层同时禁止；UI/Runtime 接口无 B站字段泄漏 |
| **Minor** | 1 | 见下 |

### 9.1 Minor 说明（不阻断）

**Minor M1**：`14-portal-registry.json` 中 `bilibili.status = "enabled_v3_primary"` 字面读起来像「已上线」，但实际语义为「V3 首批实现目标/未上线」。
- 影响：术语歧义可能被未来审计或新成员误解。
- 不阻断原因：registry 全文与 `extensionPolicy.futureExamplesAreNotImplemented=["youtube","xiaohongshu"]` 形成对照；`newAdapterRequires` 8 项门禁锁死未来扩 adapter 路径；portal registry 与 stage gate 双向声明 V3-1 仍 NO-GO。
- 建议处置：进入 V3-1.1 前关闭——可改字段为 `v3_primary_target_unimplemented` 或同等明确短语，以与 `futureExamplesAreNotImplemented` 风格保持一致；本轮不阻断实施 GO。

---

## 10. 候选自报复算

| 候选声明 | 独立复算 | 一致 |
|---|---|:---:|
| Schema v3 Draft 2020-12 元校验 PASS | PASS | ✓ |
| Positive 0 errors | 0 errors | ✓ |
| 25/25 registry-case 对齐 | 25/25 | ✓ |
| 5/5 Schema negatives 拒绝 | 5/5 | ✓ |
| 20/20 semantic negatives schema-valid | 20/20 | ✓ |
| portal registry 字节 SHA-256 对账 | `1d4b40d9…3ba70` 匹配 | ✓ |
| Fixture `portalRegistryArtifact.sha256` 与原始字节一致 | 一致 | ✓ |
| Registry 仅 `bilibili` 且 build-time closed set | 仅 bilibili；closed set | ✓ |
| 全站匹配 = 0 | 0 hits | ✓ |
| 通用 context 0 `bvid`/`cid` 字段 | 0 hits | ✓ |
| Route A 权限 = 窄域 + session 独立 | 一致 | ✓ |

候选未自报 Minor 项；本独立审查独立标出 Minor M1（registry 状态字面歧义），属可改进项，不阻断。

---

## 11. 决策与最小下一阶段

### 11.1 门禁结论

```text
GO: V3-1 Route A document candidate passes independent external audit.
NO-GO: V3-1 product implementation is still NO-GO until the
       V3-1.1..V3-1.4 sub-stage implementation exit audits pass
       V3-1-A01..V3-1-A14 on a fresh real-Chrome run, including:
         - real-Chrome identity mapping on 12 unique URLs
         - 0 Cookie value persistence / evidence leak
         - 0 <all_urls> / http://*/* / https://*/* in build output
         - full-tree secret scan = 0
       This is consistent with stage gate V3-1 row.
```

### 11.2 允许进入的最小下一阶段

允许进入 **V3-1.1 媒体页面采集流程**：

- 新增 `apps/chrome-extension/src/modules/media_companion/` 下通用合同、`MediaPortalAdapter`、`MediaPortalRegistry`、`adapters/bilibili/BilibiliMediaPortalAdapter`、`bilibiliUrl.ts`、`bilibiliPageState.ts`、adapter 单元测试。
- `validation.portalRegistryArtifact.sha256` 必须以原始字节 SHA-256 重新生成并写入 contract fixture；机器审计不可退化为字符串比较。
- 修改 `apps/chrome-extension/src/contentBridge.ts`、`entrypoints/content/index.ts`，按获批权限路线注册媒体桥接；**禁止**用 `http://*/*` + `https://*/*` 替代 `<all_urls>`（V3-1-A13）。

V3-1.2（授权与会话 Broker）、V3-1.3（Runtime 租约边界）、V3-1.4（双容器入口）仍受各自子阶段实施前审计约束，不得跨阶段。

### 11.3 Minor M1 关闭窗口

进入 V3-1.1 之前关闭：调整 `14-portal-registry.json` 中 `bilibili.status` 字段，避免与 `enabled_v3_primary` 字面歧义（与 `futureExamplesAreNotImplemented` 风格保持一致）。

---

## 12. 限制与边界

- 本审查为独立只读文档审查；未运行 V3-1 产品 E2E、未运行 PX-6 或 V2 generator、未覆盖任何历史 evidence。
- 当前产品代码仍含 `<all_urls>`，与 V3-1 处置计划一致；本审查只验证文档一致性与候选自报的真实性，不为当前产品代码背书。
- V3-1P 探测样本注册表 SHA-256=`b71588928db4a0cb371152999052ae6b511b076377df427d74e680119491d8c1` 已固定且仅作为 V3-1 输入边界，本审查不重审其平台内容。
- 旧 PX/V2/V3-0 外审包、旧合同版本均不在本轮范围内。

审查完毕。