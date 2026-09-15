# V2-PX Semantic Validator Specification

## 1. 输入

```text
contracts/v2_external_brain_workspace_contracts.schema.json
contracts/v2_external_brain_acceptance_manifest.schema.json
contracts/v2_external_brain_report.schema.json
contracts/v2_external_brain_screenshot_metadata.schema.json
contracts/v2_external_brain_execution_observation.schema.json
contracts/v2_external_brain_human_review.schema.json
contracts/v2_external_brain_validation_contracts.schema.json
contracts/v2_external_brain_architecture_scan_manifest.schema.json
evidence/v2_external_brain_productization/acceptance-manifest.json
evidence/v2_external_brain_productization/report.json
evidence/v2_external_brain_productization/screenshots/
V2-7 report and validator result
```

## 2. 跨字段规则

| 规则 | 失败码 |
|---|---|
| `report.passed=true` 时 fatal / major 必须为空 | `PX_REPORT_ISSUES_NOT_EMPTY` |
| `report.passed=true` 时每个 scenario 和 test command 必须 `passed=true` | `PX_CHILD_RESULT_FAILED` |
| `passed=true` 只能使用 success claim；`passed=false` 必须使用 not-passed claim | `PX_CLAIM_STATUS_MISMATCH` |
| success claim 必须引用通过 Human Review schema 的记录，且 status=passed、reviewer/reviewedAt 完整、blockingIssues 为空 | `PX_FINAL_GATE_OR_HUMAN_REVIEW_FAILED` |
| source corpus 中 `sourceSampleId` 唯一，且至少 12 个唯一 source | `PX_SOURCE_CORPUS_INVALID` |
| manifest 内 scenarioId 唯一 | `PX_SCENARIO_ID_DUPLICATED` |
| report scenario 与 manifest scenarioId 一一对应 | `PX_SCENARIO_SET_MISMATCH` |
| `summary.scenariosTotal == len(scenarioResults)`，`scenariosPassed` 和全部覆盖计数均从底层事实重算 | `PX_SUMMARY_RECOMPUTE_MISMATCH` |
| corpus 分布满足 real_web >= 6、explicit_local_document >= 3、note_markdown >= 3；scenario 总数 >= 12 | `PX_SOURCE_DISTRIBUTION_FAILED` |
| 每个 scenario 的 `sourceSampleIds` 均存在于 corpus，重复 route 不增加 corpus 数量 | `PX_SCENARIO_SOURCE_REFERENCE_INVALID` |
| `scenarioResult.sourceKinds` 必须由其 `sourceSampleIds` 指向的 corpus 重新计算，不接受报告自报 | `PX_SOURCE_KIND_RECOMPUTE_MISMATCH` |
| 三个 entryPoint 各 >= 2；view_source >= 3 个 trace_ready source | `PX_ENTRY_COVERAGE_FAILED` |
| source_detail / source_library / ask / graph / permissions 均有 direct-open + reload | `PX_ROUTE_COVERAGE_FAILED` |
| invalid / forbidden ID recovery >= 2 | `PX_RECOVERY_COVERAGE_FAILED` |
| 跨容器 ID 一致样本 >= 4，且成功样本 `duplicateIngestDetected=false` | `PX_IDENTITY_OR_IDEMPOTENCY_FAILED` |
| runtime_offline / adapter_blocked / data_service_unreachable / source_failed_or_degraded 均有证据 | `PX_STATUS_COVERAGE_FAILED` |
| Permission grant/revoke >= 3，Forget 四面验证 >= 3 | `PX_GOVERNANCE_COVERAGE_FAILED` |
| 每个 passed 场景截图存在且不位于 prototype 或旧 V2-7 目录 | `PX_SCREENSHOT_EVIDENCE_INVALID` |
| screenshot metadata 通过独立 schema，且和 report 的 scenarioId、route、IDs、状态一致；其 `viewport.width/height` 必须与 Manifest 场景一致 | `PX_SCREENSHOT_METADATA_MISMATCH` |
| screenshot、metadata、log、test log 和全部 `auditArtifacts` 路径存在，image hash 一致 | `PX_ARTIFACT_PATH_OR_HASH_INVALID` |
| V2-7 schema / semantic / core regression 为 pass | `PX_V2_REGRESSION_FAILED` |
| report capability 不得包含自动遗忘、Dream Cycle、自动文件整理或 RAG ready | `PX_SCOPE_OVERCLAIM` |
| manifest 与 report 的 `faultInjection` 完全一致，`none` 不计入故障覆盖 | `PX_FAULT_INJECTION_MISMATCH` |
| `coverageTags` 与 `entryPoint / routeIntent / faultInjection` 相容，不能只靠标签增加覆盖 | `PX_COVERAGE_TAG_SEMANTIC_MISMATCH` |
| `origin=open_workspace` 只能进入 source_library；`view_source` 只能进入带 sourceId 的 source_detail | `PX_ACTION_ROUTE_MISMATCH` |
| `routeRecoveryResult`、`openOutcome`、`errorCode` 必须与 execution observation 和 manifest expected 逐字段一致 | `PX_EXPECTED_RESULT_MAPPING_MISMATCH` |
| routeIntent 映射 canonical path，path 内 workspaceId/sourceId 与结构化字段逐字一致 | `PX_ROUTE_PATH_ID_MISMATCH` |
| Route A 成功 URL 必须是 `chrome-extension://.../workspace.html#/knowledge/...` | `PX_HOST_STRATEGY_URL_MISMATCH` |
| invalid / forbidden 恢复场景记录 canonical errorCode，并与 manifest expectedErrorCode 一致 | `PX_ROUTE_ERROR_CODE_MISMATCH` |
| Report 与 Screenshot 的 `statusObservation` 必须通过完整 `v2_knowledge_status` 合同；Runtime offline 时 `frontendInferredRuntimeStatus=offline`、`runtimeStatus=null`、Adapter / data_service 为 unchecked、source build 为 unknown | `PX_RUNTIME_OFFLINE_AUTHORITY_VIOLATION` |
| Permission revoke 记录 granted -> revoked、停止新扫描和保留已导入来源策略 | `PX_PERMISSION_VERIFICATION_INVALID` |
| Forget 记录 Library / Ask / Graph / Trace 四面的 before/after | `PX_FORGET_FOUR_SURFACE_INVALID` |
| Forget observation 的四类 reopen shape、错误码和终态必须通过 schema | `PX_FORGET_DURABLE_RECOVERY_INVALID` |
| Forget attempt、route event、reopen check 与 lifecycle root 必须始终引用同一 `workspaceId + sourceId` | `PX_FORGET_DURABLE_IDENTITY_INVALID` |
| sharedItemRecomputed 与 supportingSourceIds 满足生命周期 ADR | `PX_SHARED_ITEM_RECOMPUTE_INVALID` |
| 每个 test command 的 `checkId / testKind / result` 类型匹配，exitCode / signal / passed 一致，logArtifact 存在且 hash 匹配 | `PX_TEST_COMMAND_RESULT_INVALID` |
| 每个 scenario 的 Execution Observation 通过 schema，path/hash 匹配，且 entry/background/route/Runtime 原始观察链可重算 | `PX_EXECUTION_OBSERVATION_INVALID` |
| G1 入口不得读取自报布尔值；用户入口必须由 trustedUserGesture action 证明 | `PX_ENTRY_ACTION_OBSERVATION_INVALID` |
| 每个 attempt 的 entry action 与 background result 必须使用同一 requestId | `PX_REQUEST_ID_CORRELATION_INVALID` |
| `open_in_workspace` prior-context shape 必须通过 schema | `PX_OPEN_IN_WORKSPACE_CONTEXT_INVALID` |
| 有效 prior context 必须保持原 route；无效 context 只能恢复到 Source Library | `PX_OPEN_IN_WORKSPACE_CAUSALITY_INVALID` |
| attempt sequence 必须唯一递增，action/result 时间不倒序且后续 attempt 晚于前序 attempt | `PX_ATTEMPT_SEQUENCE_INVALID` |
| route event 的 workspaceId/sourceId 必须与对应 action、Runtime observation、Report 和 Forget lifecycle 一致 | `PX_ROUTE_EVENT_IDENTITY_INVALID` |
| tab reuse 必须有两次有序 attempt，第二次聚焦同一 tab 且 ingest counter 不增加 | `PX_TAB_REUSE_SEQUENCE_INVALID` |
| schema meta / fixture 结果必须携带八个 canonical `schemaIds`，且 `schemasChecked == unique(schemaIds).length` | `PX_SCHEMA_CHECK_SET_MISMATCH` |
| SemanticResult 必须声明 `v2-px-semantic-rules/v6`、Validation Contracts SHA-256、63 个唯一 RuleId、完整 65 个 positive instance ID、完整 109 个 fixture requirement ID 及其集合 hash；不得只上报计数 | `PX_SCHEMA_CHECK_SET_MISMATCH` |
| semantic-positive fixture 必须从底层场景和 observation 重算满足全部 G1-G7；不得仅因 JSON Schema 通过就填写 success claim 或空 `failedRules` | `PX_SEMANTIC_POSITIVE_BASE_INVALID` |
| G4 必须同时具备 dependency boundary 和 forbidden-call scan 的结构化零违规结果 | `PX_ARCHITECTURE_CHECK_COVERAGE_MISSING` |
| 任一 ArchitectureResult 的 `violations > 0`，或扫描结果证明前端直连 data_service、跨越 Runtime/Adapter 边界或生成知识事实 | `PX_ARCHITECTURE_BOUNDARY_FAILED` |
| ArchitectureResult 的 commit、三项 scanRoots、tracked path index、ruleset 与 allowlist hash 必须与实际执行输入一致 | `PX_ARCHITECTURE_SCAN_SCOPE_INVALID` |
| G6 必须由结构化 axe、keyboard、420/360/1280/768 viewport 结果与截图 metadata 共同证明 | `PX_UX_ACCESSIBILITY_FAILED` |
| 截图必须通过 magic、完整解码，且实际像素尺寸逐项等于 Screenshot Metadata | `PX_SCREENSHOT_DECODED_DIMENSION_MISMATCH` |
| `viewport_sidepanel_360/420` 只能使用 Side Panel 单面证据；`viewport_workspace_768/1280` 只能使用 Workspace 单面证据；composite 不计产品覆盖 | `PX_VIEWPORT_SURFACE_MAPPING_INVALID` |
| `contract_fixture`、`virtual/*` 或示例夹具不得被提升为 PX-5 production acceptance | `PX_FIXTURE_EVIDENCE_PROMOTION_INVALID` |
| contract fixture 的 `sourceSampleId` 以及 canonical `originRef + fingerprint` 组合必须唯一 | `PX_SOURCE_FIXTURE_UNIQUENESS_INVALID` |
| Human Review 每个 gate 的 evidence artifact 必须存在且 SHA-256 匹配 | `PX_HUMAN_REVIEW_EVIDENCE_INVALID` |

## 3. 稳定 ID 一致性

每一层先声明 `observed / not_applicable / unavailable`，Validator 按场景决定哪些层必须参与，不得要求不存在的参与方制造 ID：

```text
view_source / open_workspace / open_in_workspace:
  sidePanel=observed, background=observed, workspace=observed

direct_route:
  sidePanel=not_applicable, background=not_applicable, workspace=observed

Runtime online response:
  runtime=observed，必须存在 responseFingerprint

Runtime timeout / connection_refused:
  runtime=unavailable，必须存在 transportErrorCode + transportEvidence
  禁止 responseFingerprint

所有 status=observed 的参与层：
  workspaceId == report.workspaceId
  source_detail / view_source => sourceId == report.sourceId
  operationId 在保存与 build 未终止前保持一致
```

如果共享 KnowledgeItem 因 Forget 重算而保留，必须记录 `sharedItemRecomputed=true` 和剩余 `supportingSourceIds`。当前 mock path 必须记录 `sharedItemRecomputed=false` 和空列表，不能虚构共享重算能力。

## 4. Canonical route、open outcome 与覆盖推导

```text
source_library -> #/knowledge/sources?workspaceId={workspaceId}
source_detail  -> #/knowledge/sources/{sourceId}?workspaceId={workspaceId}
ask            -> #/knowledge/ask?workspaceId={workspaceId}
graph          -> #/knowledge/graph?workspaceId={workspaceId}
permissions    -> #/knowledge/settings/permissions?workspaceId={workspaceId}
```

Validator 必须解析 route path 和 query，不允许只检查字符串前缀。覆盖按底层事实推导：

- `entry_open_workspace` 只来自 `entryPoint=open_workspace + routeIntent=source_library`。
- `entry_view_source` 只来自 `entryPoint=view_source + routeIntent=source_detail + sourceId`。
- `runtime_offline` 只来自 faultInjection 和符合权威边界的状态组合。
- `forget_four_surface` 只来自完整 `forgetVerification.before/after`；durable Forget 还必须来自同一 source 的四种重开检查和 `statusBefore/statusAfter`。
- G1-G7 从场景、命令、文件存在性和 screenshot metadata 重算，不直接信任 report 布尔值。
- `routeRecoveryResult=restored_direct_open/restored_after_reload/restored_after_back/restored_after_reopen` 必须分别存在对应 kind 的 route event。五类 route 的成功恢复覆盖按 `successfulRecoveryModes` 与底层 `initial/reload_restore/back_restore/reopen_restore` 事件联合重算，不能只信任数组自报。
- `openOutcome=focused_existing/created_new` 必须来自 background result；`direct_open_restored` 只能用于 direct route；`recovered/blocked` 必须携带匹配的 canonical errorCode。
- `open_in_workspace` 的 `entryContext.status` 必须是 `observed_valid` 或 `observed_invalid`。`observed_valid` 时最终 route 必须逐字等于 `priorRouteIntent/priorResolvedPath`；`observed_invalid` 时必须提供 `attemptedPath + fallbackReason`，最终只能恢复到 Source Library，且 background errorCode 必须等于 fallbackReason。
- `tab_reuse` 必须在同一 Execution Observation 中记录至少两次有序 attempt：第一次 `created_new`、第二次 `focused_existing`、两次 `tabId` 相同、requestId 各自与 action/result 对应，且 `ingestCounters.after == before`。
- Manifest `expected.outcome/openOutcome/routeRecoveryResult/expectedErrorCode` 与 Report 对应字段采用逐字段相等规则；`recoverable_error -> recovered + recovered_to_library`，`blocked -> blocked + blocked_with_recovery_action`。

## 5. 证据真实性

- `dataMode=real` 的 source 内容来自真实网页、显式授权文件或用户 note。
- `sourceCorpus.originRef` 和 `contentFingerprint` 必填；本地路径必须脱敏。Fingerprint 固定为 `algorithm=sha256`、`inputMode=raw_bytes_v1`，Validator 对 evidence 根目录下 `artifactPath` 指向文件的原始字节直接计算 SHA-256，不做换行、Unicode、HTML 或 JSON 规范化，再与 64 位小写十六进制 `value` 比较。绝对路径、URL 和越出 evidence 根目录的路径必须拒绝。
- 故障态可由确定性 fault fixture 产生，但必须记录非 `none` 的 faultInjection 和注入点。
- 原型 HTML、AI 目标图、data_service Console 和旧 V2-7 截图不能计入 PX UI pass。
- Headless 截图必须保留 extension route metadata；真实入口截图必须证明宿主网页、Side Panel 和用户动作关系。
- `screenshotPaths.length == screenshotMetadataPaths.length`，每一对图片和 metadata 使用相同 scenarioId；Report 的 `screenshotPaths[i]` 必须与对应 Screenshot Metadata 的 `imagePath` 字节级相等，并从同一个 artifact 字节映射解析，禁止用 `fixtures/.../screen.png` 与 `virtual/screenshots/...png` 两套命名空间指代同一证据。
- Product evidence 的 Screenshot Metadata 必须为 `captureMode=product_surface`，并用 `captureSurface=host_page|side_panel|workspace_page|route_error` 表明单一真实捕获面；`composite_review_only` 只用于审查对照，不计入 G6 或产品截图覆盖，也不得声称 Side Panel 与 Workspace 在实际产品中同时可见。
- `ScreenshotMetadata.viewport.width/height` 必须逐场景等于 Manifest Scenario 的 viewport；`deviceScaleFactor` 单独校验，不参与宽高相等比较。实际截图还必须验证 PNG/JPEG magic、可解码性和像素尺寸，不能只检查扩展名、文件存在和 SHA-256。
- G6 的四个命名 capture variant 固定为：`viewport_sidepanel_360 -> side_panel`、`viewport_sidepanel_420 -> side_panel`、`viewport_workspace_768 -> workspace_page`、`viewport_workspace_1280 -> workspace_page`。前两者必须 `sidePanelVisible=true/workspaceVisible=false`，后两者必须相反；其他窄宽 Workspace 截图不能替代这四项门槛。
- semantic-positive 的虚拟 PNG 也必须物化真实 IHDR/IDAT/IEND 并按 metadata 尺寸完整解码；1x1 占位图只能用于负向测试。`imageSha256` 正确不能替代实际尺寸校验。
- `sourceSampleId` 属于验收样本命名空间，Runtime `sourceId` 属于产品实体命名空间；两者不得使用同一值冒充关联，关联只能来自场景中的显式映射。
- `evidenceClass=contract_fixture` 必须与 `acceptanceMode/executionMode=contract_fixture` 同时出现。生产出门证据必须为 `production_acceptance + real_chrome_dual_container`，且不得引用 `virtual/*`；两类证据禁止互相提升。
- `virtualArtifactContract.artifactsByPath` 是合同夹具唯一的虚拟路径字节权威。`literal_utf8_no_bom` 使用 JSON 解析后的字符串一次性编码为 UTF-8，不允许二次反转义；`navia_canonical_json_v1` 递归按 Unicode code point 排序对象 key、保持数组顺序、使用紧凑分隔符、无 BOM、无尾部换行；`base64_decoded_bytes_v1` 按 RFC 4648 对解析后的 base64 字符串只解码一次，对解码后二进制字节计算 SHA-256，并拒绝空白、URL-safe 别名、无效 padding 或尾随字节。Execution Observation、Screenshot Metadata、Screenshot PNG、Human Review、日志和审计 artifact 必须逐路径解析并对这些精确字节重算 SHA-256。
- Report 与 Human Review 的 `evidenceClass` 必须相同；contract fixture 只能签署“contract fixture review passed; not product acceptance evidence”，production acceptance 才能签署 dual-container real-Chrome pass。
- headless 不能证明扩展 API 时才使用受控 visible Chrome；提前告知用户并在结束后清理实例。

## 6. G1-G7 确定性推导

Validator 不得直接使用 `gateResults`、旧 `userEntryObserved` 或旧 `idsConsistent` 作为通过依据。它先按以下算法计算 `computedGateResults`，再要求它与 report 的 G1-G7 完全相同：

| Gate | 机器输入与计算 | 最低阈值 |
|---|---|---|
| G1 | Execution Observation 的 user action、background result、requestId、截图 metadata；只计 `actor=user + trustedUserGesture=true` | 三个入口各 >= 2，view_source 的 trace_ready source >= 3 |
| G2 | manifest route、routeEvents、resolvedPath、routeRecoveryResult、successfulRecoveryModes、openOutcome、errorCode、四层 IDs | 五类 route 各有 direct-open + reload + Back + reopen；invalid/forbidden >= 2；所有 canonical path/ID 一致 |
| G3 | scenario-aware layer IDs、Runtime observation、attempts、ingestCounters、Permission / Forget | ID 一致 >= 4；tab reuse 两次 attempt 同 tab 且 `after-before=0`；Permission >= 3；Forget >= 3；每个 Forget 均有四种同源重开失败链且最终状态为 forgotten |
| G4 | `checkId=architecture_dependency_boundary` 与 `architecture_forbidden_call_scan` 的 `ArchitectureResult`；architecture review artifact | 两类 check 各 >= 1；repositoryCommit 等于验收 commit；三项 scanRoots 完整；tracked path index、source tree、ruleset、allowlist hash 可重算；`scannedFiles >= 1`、`violations=0`、命令 exitCode=0 |
| G5 | faultInjection、Runtime observation、status metadata | runtime_offline / adapter_blocked / data_service_unreachable / source_failed_or_degraded 各 >= 1，且权威状态组合合法 |
| G6 | `AxeResult / KeyboardResult / ViewportResult` 与四视口截图 metadata | axe serious/critical=0；键盘 `assertionsPassed=assertionsTotal` 且 focus-return/Escape/reduced-motion 全过；420/360/1280/768 各至少有一个 ViewportResult 和一个同尺寸 Screenshot Metadata，scrollWidth 不超容器且 blocker=0 |
| G7 | 九份 schema、全部 ArtifactRef、SemanticResult v6、V2-7 regression result、Human Review v3 | meta 结果严格覆盖九份 schema 且 `instancesChecked=9`；fixture 结果携带 65 个 positive ID、109 个 requirement ID、集合 hash 和 `instancesChecked=175`；SemanticResult 的 63 个 RuleId、41 个 semantic RuleId、65 个 positive ID、109 个 requirement ID 与冻结 registry/fixture 逐项相等且 hash 可重算；semantic spec、validator implementation、positive raw payload 三个文件 hash 均匹配；failedRules 为空；全部 path/hash 通过；Human Review 无 blocker；fatal/major 为空 |

G4 的扫描输入固定为 Git tracked files under `apps/chrome-extension/entrypoints/sidepanel/`、`entrypoints/workspace/` 和 `src/modules/knowledge_workspace/`。禁止模式至少包括直接 `fetch` data_service URL、导入 Runtime A/C/D service 模块、在前端 fixture 之外创建 `KnowledgeItem/EvidenceRef/graph relation` 事实。允许清单只能列 `runtimeClient.ts`、纯 ViewModel、类型声明和测试 fixture；任何新增允许项必须回到 PX-0.1b 审计。

`architecture-scan-manifest.json` v2 冻结 G4 的可重算输入：路径分隔符 `/`、UTF-8、Unicode code point 升序、path index 行格式 `<path>\n`、source tree 行格式 `<mode> <blobSha256> <path>\n`、原始文件字节 hash、symlink target UTF-8 hash，以及封闭排除项 `node_modules/dist/.output`。tracked path 必须全部位于三项 scan root 下；排除项不得等于、包含或遮蔽任一 scan root / tracked path；Report 的 commit、tree/path-index/ruleset/allowlist hash 与 scan manifest 必须逐字段相等。Contract fixture 的每个 tracked path 必须携带 `inlineSource`，production acceptance 则禁止该字段并从冻结 commit 的 Git blob 取证。

G4 还必须解析 ruleset canonical JSON。`architecture_dependency_boundary` 的算法固定为 `typescript_ast_import_specifier_literal_v2`：使用 TypeScript AST 提取静态 import、export-from 与可静态折叠字符串的 dynamic import module specifier，并对 `forbiddenImportFragments` 做区分大小写包含匹配。`architecture_forbidden_call_scan` 的算法固定为 `typescript_ast_call_new_expression_and_endpoint_normalization_v2`：解析 `CallExpression`、`NewExpression` 和可静态折叠的字符串连接或无表达式模板字面量；忽略调用名周围空白与括号，规范化 `window/globalThis` 前缀、URL scheme/host、`localhost`/`127.0.0.1`/`::1` 等 loopback 别名，并分别检查禁止网络调用、data_service 端点和 `KnowledgeItem` / `EvidenceRef` / graph relation 事实创建。Contract fixture 必须从 Architecture Scan Manifest v2 每个 `trackedPaths[].inlineSource` 读取原始 UTF-8 字节；production acceptance 必须从 `repositoryCommit` 对应 Git blob 读取原始字节，且 production manifest 禁止携带 `inlineSource`。两者都必须重算 `blobSha256`、canonical path index 和 canonical source tree。Allowlist 中任何条目均不得覆盖 ruleset 的 `nonOverridableRules`。

G4 的通过结果不能信任 Report 中的 `violations=0`。Validator 必须对每个 tracked source 自行执行上述两个 AST 扫描，并将重算出的违规数与 ArchitectureResult 对比。强制源码级负例会在同步更新 blob/source-tree hash 后向 tracked source 插入静态 import、dynamic import、空白变体 `fetch`、`KnowledgeItem`、`EvidenceRef` 或 graph relation；若 validator 仅校验 hash 或读取自报 `violations`，这些负例必须失败。

Ruleset 根对象只允许 `schemaVersion / matchEncoding / pathSeparator / checks / nonOverridableRules`；每个 check 必须有 canonical `checkId + algorithm + scanExtensions`，并按 check 类型携带 `forbiddenImportFragments` 或 `forbiddenLiteralPatterns`。Allowlist 根对象只允许 `schemaVersion / entries / forbiddenOverrides`；每个 entry 必须记录 `kind / value / allowedRoots / reason`，且 `forbiddenOverrides` 必须与 ruleset 的 `nonOverridableRules` 做无序集合完全相等比较。未知算法、未知字段、空规则集、tracked source ArtifactRef 缺失、source bytes 与 `blobSha256` 不一致或上述集合不相等，统一返回 `PX_ARCHITECTURE_SCAN_SCOPE_INVALID`。PX-N-087/PX-N-088 继续作为 ruleset/allowlist 绑定失败的主回归入口，局部分支诊断不得发明新失败码。

G6 的结构化结果必须逐项记录 focus entry、Tab/Shift+Tab、Escape、dialog/drawer focus return 和 reduced-motion；ViewportResult 固定记录实际 viewport、document/容器 scrollWidth 和 blocker 数量。420、360、1280、768 每种尺寸都必须存在至少一个 Manifest 场景、同宽高 Screenshot Metadata 和对应 ViewportResult；命令结果、日志、伪造 metadata 或 review-only 合成图均不能代替。日志是可追溯附件，不能替代结构化结果；截图也不能单独替代 axe/键盘结果。

## 6.1 冻结 Rule / Failure Registry

`v2_external_brain_validation_contracts.schema.json` v4 是 PX-0.1b 的机器权威 registry：`RuleId` 固定为 63 条，其中 `enforcementLayer=semantic` 41 条、`schema` 22 条；63 个规则各有一个 canonical failure code，另有通用 `SCHEMA_VALIDATION_FAILED`；`x-navia-requirement-registry` 固定 109 条 mandatory negative 的 key、描述、RuleId、执行层与主要失败码；`FixtureSuite` 固定为 v10 和 109 个 RFC 6902 case。PX-0.2 不得在代码中临时增加、别名化或猜测规则、要求或失败码。

集合 hash 算法固定如下：

- `ruleSetSha256`：Validation Contracts Schema 原始文件字节的 SHA-256。
- `fixtureSuiteSha256`：v10 RFC 6902 fixture 原始文件字节的 SHA-256。
- `positiveInstanceIndexSha256`：按 fixture 中固定顺序，对 65 个 `positiveInstanceIdsChecked` 组成的 JSON 数组执行无空格 UTF-8 `JSON.stringify` 后计算 SHA-256。
- `rulesChecked == unique(checkedRuleIds).length == 63`；`semanticRuleIdsCovered` 必须与 registry 中 41 个 semantic RuleId 完全相等。
- `semanticSpecArtifact` 绑定本规格文件原始字节；`validatorImplementationArtifact` 在 PX-0.2 绑定实际实现文件，PX-0.1b 的 virtual artifact 只验证合同 shape，不构成实现证据；`positiveEvidencePayloadArtifact` 绑定排除自引用 Report 的原始正例载荷文件。
- `semanticSpecArtifact.sha256` 必须绑定本规格文件的原始文件字节。
- `positiveEvidencePayloadArtifact.sha256` 必须绑定不包含 Report、自引用哈希或 validator 结果的 positive evidence payload 原始文件字节。
- `fixtureSuiteSha256` 必须绑定 RFC 6902 fixture suite 文件的原始文件字节。
- 不定义 `positiveFixtureFileSha256` 或独立 `semanticSpecSha256` 字段；实现不得自行增加别名，也不得对包含 Report 本身的 positive-instances 文件建立自引用哈希。
- fixture validation 的 `instancesChecked == 65 positive + 109 patched case + 1 FixtureSuite root == 175`。

## 7. 夹具执行协议

`px-0.1b-positive-instances.json` v10 提供一个 29 场景的 semantic-positive Manifest / Report、逐场景 Execution Observation / Screenshot Metadata、Human Review、Architecture Scan Manifest、有效/无效 prior context recovery 和 online/offline Knowledge Status 完整根实例；四类虚拟 PNG 必须真实解码为 360x900、420x900、768x900、1280x900，12 个 source 必须使用不同原始字节。它只使用 `evidenceClass=contract_fixture` 和逐路径 `virtualArtifactContract.artifactsByPath` 做合同 runner 输入，不得计入产品验收。`px-0.1-contract-fixtures.json` v10 使用 RFC 6902，并必须通过 Validation Contracts `$defs/FixtureSuite`。Runner 必须：

1. 按 `base` JSON Pointer 深拷贝根实例。
2. 严格按顺序应用 `patch`；不接受自然语言 mutation。
3. `targetDef` 存在时校验对应 `$defs`，否则校验完整根文档。
4. 先核对 `expectedSchemaValid`；只有 schema-valid 用例才进入 semantic failure 检查。
5. 每条 case 必须携带唯一 `requirementId + requirementKey`、`ruleIdUnderTest`、`expectedLayer`、`expectedPrimaryFailure` 和 `allowedWarnings`；semantic 负例必须只产生该 RuleId 在 registry 中映射的主要失败码，额外诊断只能出现在 `allowedWarnings`。
6. Runner 必须逐项比较 `x-navia-requirement-registry` 与 FixtureCase：requirementId 集合完全相等，key/rule/layer/primary failure 逐字段相等；不允许只比较编号或用“相近用例”替代。
7. semantic-positive 基线必须先从场景和原始 observation 重算并通过全部 G1-G7，负向 patch 才可执行；不得用只通过 JSON Schema 的根实例作为 semantic base。
8. fixture 的 `virtualArtifactContract` 仅用于合同 runner，不得计入真实产品验收证据。
9. 先验证 Validation Contracts registry；再拒绝任何不在封闭 `FailureCode` 枚举内的 `expectedPrimaryFailure / allowedWarnings / failedRules`。
10. G7 必须逐项比较 63 个 RuleId、41 个 semantic RuleId、65 个 positive instance ID、109 个 requirement ID，不接受仅比较 `rulesChecked / instancesChecked` 数值；每个 semantic RuleId 至少有一个 `expectedLayer=semantic` 的 case。

## 8. 必须保留的负向夹具

以下夹具必须被 schema 或 semantic validator 拒绝，并在 PX-0.1 / PX-5 日志中逐项列出失败码：

```text
open_workspace -> graph/source_detail
source_library + graph path
extension_workspace_page + localhost URL
passed report + failed scenario
passed report + failed test command
伪造 summary 计数
缺失 screenshot/log/audit artifact
coverageTags 与 entry/route/fault 不一致
Runtime offline + ready/connected/trace_ready
Forget 只有 toast 或缺少四面 before/after
Forget 后 direct-open / reload / Back / reopen 任一路径仍成功、缺 SOURCE_NOT_FOUND、不是同一 sourceId，或最终状态不是 forgotten
sharedItemRecomputed=true 但无 supportingSourceIds
Manifest v2 字符串 fingerprint 或绝对 artifactPath
recoverable/blocked 场景缺 expectedErrorCode
Report 缺 routeRecoveryResult / openOutcome
passed command 的 exitCode 非 0 或 log hash 不匹配
自报入口通过但 Execution Observation 无 trusted user action
自报 ID 一致但 Side Panel / Background / Runtime / Workspace 原始 ID 不一致
human review pending/failed 却声明 success
axe/keyboard/viewport 任一失败但 G6=true
Screenshot Metadata viewport 与 Manifest 场景宽高不一致；review-only composite 被计入 G6
图片 magic、解码尺寸或 metadata 尺寸与真实文件不一致
360/420 capture variant 使用 Workspace surface，或 768/1280 capture variant 使用 Side Panel surface
entry action 与 background result 的 requestId 不一致
valid prior context 未保持 route，或 invalid prior context 恢复到非 Source Library
Forget attempt/reopen/route event 使用不同 workspaceId 或 sourceId
attempt sequence 重复、非递增或时间倒序；route event ID 与 action/Runtime/Report 不一致
Runtime timeout/refused 仍携带 responseFingerprint，或缺少 transportEvidence
不参与层携带 workspaceId/sourceId/operationId
open_in_workspace 缺少 prior route context
open_in_workspace 的无效上下文缺 attemptedPath / fallbackReason，或恢复 errorCode 不一致
tab reuse 第二次使用不同 tabId 或 ingest counter 增加
schema result 缺 canonical schemaIds，或 schemasChecked 与唯一 ID 数不一致
SemanticResult 缺 41 个 semantic RuleId 覆盖、semantic spec/implementation/positive payload 原始文件 hash，或只列 ID 却未执行规则
sourceKinds 与 corpus 重算结果不一致
Human Review evidence 缺 path/hash
ArchitectureResult 扫描错误 commit、缺少任一固定 scan root、tracked path index/ruleset/allowlist hash 不一致
contract_fixture 或 virtual artifact 被提升为 production acceptance
source fixture 的 canonical originRef + fingerprint 组合重复
passed scenario 的 conclusion 不是 passed
```

## 9. 输出

```text
passed
checkedRules
failedRules[]
fatalIssues[]
majorIssues[]
warnings[]
validatedAt
```

任一失败码阻止 PX completion claim。Validator 通过也不能替代人工产品体验核查。
