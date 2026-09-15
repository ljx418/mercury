# V2-PX External Brain Productization Stage Gate

## 1. 阶段定位

V2-PX 在已通过的 `V2 Memory / Personal Knowledge Base planning-aligned local knowledge acceptance` 基线上，补齐 Side Panel Quick Surface 与 Extension Workspace Page 的真实产品入口、路由、状态恢复、宽屏管理体验和真实 Chrome 证据。

后续真实知识与可逆维护已进入 [V2-RKM文档设计](v2-real-knowledge-maintenance.md)，不扩大本PX验收范围，不批准实现，不改变下面门禁。

当前门禁：

```text
PX-0 documentation gate: PASS after PX-0.1b independent re-audit.
PX-0 human drawio direction review: approved on 2026-07-14.
PX-0.1b: PASS on 2026-08-31. Independent review: Fatal 0, Major 0, Minor 0.
PX-0.2 executable acceptance tooling: PASS on 2026-09-01 after fifth independent re-audit (Fatal 0 / Major 0 / Minor 0).
PX-1 implementation and Major repair: PASS on 2026-09-08 after independent re-audit (Fatal 0 / Major 0 / Minor 0).
PX-2 implementation and acceptance: PASS on 2026-09-08 after real-Runtime and Headless Chrome evidence, PRD review and independent audit passed (Fatal 0 / Major 0 / Minor 0).
PX-3 implementation and acceptance: PASS on 2026-09-08 after real-Runtime lifecycle E2E, PRD review and independent audit passed (Fatal 0 / Major 0 / Minor 0).
PX-4 implementation and acceptance: PASS on 2026-09-08 (Fatal 0 / Major 0 / Minor 0).
PX-5 automated evidence candidate: FAIL / REOPENED on 2026-09-09; five Major evidence groups confirmed. Previous PASS and zero-issue audit claims withdrawn.
PX-6 exit audit: `px6-machine-exit-20260914t164500z` received PX6-0..5 LIMITED PASS after independent implementation audit (Fatal 0 / Major 0 / Minor 0); A01..A14 passed, A15/A16 and Human/G7/final remain pending. PX6-7 production finalizer is fail-closed pending an independently auditable two-step finalization handshake.
No-Go for claiming V2 ready, complete external brain, automated forgetting, Knowledge Dream Cycle or RAG ready.
```

2026-09-14 PX-5 修复子阶段当前状态：

```text
T01 / R1 frontend + real Chrome repair: PASS（限定 T01）
T02 / R2 sealed raw evidence: PASS（限定 T02）；独立审查 Fatal 0 / Major 0
T02.1/T02.2: 历史限定 PASS，保留为 fail-closed 对照
T02.3: REJECTED AS T03 POSITIVE BASE；offline interval 含成功 Runtime response
T02.4: FAIL-CLOSED REGRESSION INPUT；缺 sealed T01 structured assertion
T02.5: PASS（唯一 production-positive R2 input）
T03 / R3 production-candidate evidence pipeline: LIMITED PASS；独立实现审查 Fatal 0 / Major 0 / Minor 5
T03 final: NOT PASSED；Human Review pending / G7 pending / final=false
T04 / R4 isolated snapshot revalidation: LIMITED PASS；独立实现出门审查 Fatal 0 / Major 0 / Minor 1
T04.1 artifactRoot remediation: LIMITED PASS；独立实现审查 Fatal 0 / Major 0 / Minor 0
PX-6 machine/human/final contracts: DOCUMENT PASS；自动化实现已获用户授权，人类签署仍 pending
PX-5: FAIL / REOPENED
PX-6: PX6-0..5 LIMITED PASS；PX6-6 人类审查仍 PENDING / HUMAN-ONLY，PX6-7 终审握手未冻结
```

T02.3/T02.4 的失败分别关闭了 Status 枚举与 Runtime offline authority 假绿路径；T02.5 再将 T01 36 个唯一 assertion 纳入单一 raw seal，成为 T03 唯一正输入。T03 候选 `t03-r3-production-exit-candidate-20260914T134804` 已通过独立实现出门审查；T04.1 候选 `t04-r4-resolved-invocation-20260914t145648z` 随后以全新隔离重放与真实 Chrome 复验关闭 artifactRoot Minor，并获 Fatal 0 / Major 0 / Minor 0 的 LIMITED PASS。PX6-0..5 候选 `px6-machine-exit-20260914t164500z` 也已取得独立机器阶段 LIMITED PASS；禁止执行 PX6-6 人类代签或提前生成 final success claim。

2026-09-09 的 [PX-5 中断恢复证据复核](../evidence/v2_external_brain_productization/px-5/resumption-evidence-audit-2026-09-09.md) 和 [R1 后端修复审计](../evidence/v2_external_brain_productization/px-5/r1-backend-closure-audit-2026-09-09.md) 保留为历史风险来源，不再代表当前执行位置。T01、T02、T02.1、T02.2 及 T03-0..3 的限定结论不得反向改写这些历史报告，也不得扩大为 PX-5 通过。

T03 流水线已在限定范围实现并独立验证：`sealed raw/artifacts/Git snapshot -> ArtifactReader -> DerivedFacts -> shared Schema/Semantic/TypeScript AST -> ProductionValidation -> pending Human Review -> pure Report JSON/HTML -> ProductionPackage -> InvocationRecord`。T04 已从 detached local acceptance commit 实际执行 R4-P frozen-input deterministic replay 与 R4-E fresh real-Chrome full rerun；两泳道未拼接，最终 R4 candidate 只引用 R4-E。T04 独立实现出门审计见 `../evidence/v2_external_brain_productization/px-5/t04-r4-snapshot-revalidation/independent-implementation-exit-audit.md`，SHA-256 为 `cd64f8dbe685be7e252f65b1226a248885eb7b1a642651cd58c79ba752090c9b`。该审计授予 T04 LIMITED PASS，但不签署 Human Review，不放行 PX-5/PX-6。

## 2. 已冻结事实

- V2-7 证据只证明 planning-aligned local knowledge acceptance，不证明独立 Workspace Page 已实现。
- 独立 `workspace.html` entrypoint、生产入口、route recovery及管理组件已有PX-1..4实现记录；旧Side Panel聚合组件仍存在不等于目标缺失。当前R1前端/真实Chrome与PX-5证据须重新验收，不能以历史PASS替代。
- data_service 是 P6 外部候选服务；Navia 前端只能经 `runtimeClient -> Runtime -> V2 Adapter / Governance` 调用。
- Forget 当前由用户主动发起、二次确认并完成 Library / Ask / Graph / Trace 四面验证。
- V2.x 自动维护、摘要刷新和“做梦”机制只作为后续路线登记，不属于 PX。
- Workspace 宿主选择路线 A `Extension Workspace Page`；路线 B localhost Web Workspace 仅在 PX-1 spike 被可复现技术事实阻塞后，打回 PX-0 重新评审。

## 3. 范围

```text
PX-0 文档 / 原型 / 合同 / 审计门禁
PX-0.1 active 状态同步、可执行合同、原型路由/Forget、生命周期决策和防假绿负向夹具闭环
PX-0.1b Manifest v5 / Report v12 / Screenshot Metadata v6 / Execution Observation v6 / Human Review v3 / Validation Contracts v4 / Architecture Scan Manifest v2 / RFC 6902 夹具 / 自包含原型审计件 / G1-G7 推导闭环
PX-0.2 实现 semantic validator 命令、文件/hash 检查、summary/G1-G7 重算和负向测试；这是 PX-1 前唯一允许的代码工作包
PX-1 Workspace entrypoint + router
PX-2 Side Panel Quick Surface + 三个入口
PX-3 OpenWorkspaceAction + stable IDs + tab reuse + reconnect
PX-4 Workspace component productization
PX-5 real-Chrome E2E + evidence
PX-6 exit audit + human product review
```

## 4. 责任边界

| 层 | 允许 | 禁止 |
|---|---|---|
| Extension Shell | 打开或聚焦 extension Workspace 标签页，传递 route intent 和稳定 ID | 携带网页正文、答案、graph facts；自动保存 |
| Side Panel | 当前页保存、状态摘要、快捷 Ask / Trace、Workspace 入口 | 承载完整长期管理面；直连 data_service |
| Workspace Page | Sources / Ask / Graph / Permission / Forget 的宽屏管理与恢复 | 自动读取宿主 DOM；控制网页；生成知识事实 |
| Runtime Client | 两个容器共享 API、offline 推导、poll / reconnect | 前端各自维护冲突的事实缓存 |
| Runtime / Adapter | 保持 V2 合同、权限、trace、forget 和 service status | 因 UI 路由随意扩大 public contract |
| data_service | 继续作为受控候选后端 | Console 冒充 Navia UI；前端直接访问内部 workspace |

## 5. 权威文档与合同

```text
docs/active/project/01-prd.md
docs/active/project/02-architecture.md
docs/active/project/03-development-plan.md
docs/active/project/04-acceptance-plan.md
docs/active/project/design/v2-memory-personal-knowledge-base-gap.md
docs/active/project/design/v2-memory-personal-knowledge-base-gap.drawio
docs/active/project/design/v2-external-brain-productization-prototype-review/index.html
docs/active/project/design/v2-external-brain-productization-prototype-review/AUDIT_PACKAGE.md
docs/active/project/design/v2-external-brain-productization-prototype-review/audit-package-manifest.json
docs/active/project/design/v2-external-brain-productization-development-acceptance-plan.md
docs/active/project/design/v2-external-brain-productization-semantic-validator.md
docs/active/project/design/v2-external-brain-workspace-hosting-adr.md
docs/active/project/contracts/v2_knowledge_status.schema.json
docs/active/project/contracts/v2_external_brain_workspace_contracts.schema.json
docs/active/project/contracts/v2_external_brain_acceptance_manifest.schema.json
docs/active/project/contracts/v2_external_brain_report.schema.json
docs/active/project/contracts/v2_external_brain_screenshot_metadata.schema.json
docs/active/project/contracts/v2_external_brain_execution_observation.schema.json
docs/active/project/contracts/v2_external_brain_human_review.schema.json
docs/active/project/contracts/v2_external_brain_validation_contracts.schema.json
docs/active/project/contracts/v2_external_brain_architecture_scan_manifest.schema.json
docs/active/project/contracts/fixtures/v2_external_brain/px-0.1-contract-fixtures.json
docs/active/project/contracts/fixtures/v2_external_brain/px-0.1b-positive-instances.json
docs/active/project/contracts/fixtures/v2_external_brain/px-0.1b-positive-evidence-payload.json
```

## 6. PX-0 出门条件

- PRD、架构、开发计划、验收计划、stage gate、gap companion 和 drawio 使用同一 `V2-PX` 范围。
- drawio 不超过 8 页，明确当前 / 待修改 / 待新增 / 外部候选状态、双容器关系、入口、路由、生命周期、服务状态、开发计划、验收和声明边界。
- Knowledge Status 与八份 PX JSON Schema 可解析并通过 Draft 2020-12 元校验，共九份 schema。
- Workspace action / route / result fixture 的 `$defs` 独立验证方式明确。
- semantic validator 的跨字段规则、统计口径和失败码明确。
- 自动知识维护明确延期，不进入 PX 实现或验收。
- PX-0.1b 独立复审已于 2026-08-31 返回 Fatal 0 / Major 0 / Minor 0；审计记录固定在 `evidence/v2_external_brain_productization/px-0.1b-independent-audit.md`。后续合同变更会使该 PASS 失效并要求回到 PX-0.1b。
- 路线 A/B ADR 已冻结，PX-1 spike 的六项通过条件和回退门禁明确。
- source corpus 与操作场景分开统计；manifest / report 不允许用重复 route 冒充唯一真实 source。
- active V2-7 文档统一为已完成态；原型真实实现 canonical route、direct-open/reload/Back、可恢复错误和 Forget 四面状态变化。
- semantic-positive 基线固定为 29 个 scenario、29 个 Execution Observation、29 个 Screenshot Metadata，标记 `contract_fixture`，使用四种真实解码尺寸 PNG 和 12 份不同 source bytes；每个 Report screenshot path 必须等于 paired metadata imagePath 并解析到同一图片字节；四个命名 viewport variant 的 Manifest/metadata/图片尺寸与 Side Panel/Workspace surface 必须一致，review-only composite 不计入 G6。负向夹具固定为 109 个唯一 `requirementId + requirementKey + ruleIdUnderTest` RFC 6902 case，并与 mandatory registry 逐字段一致；41 个 semantic RuleId 必须全部有对应 semantic case；三个 Forget 场景必须各有同一 workspace/source 的 direct-open/reload/Back/reopen 失败链。
- 五类 route 均必须有一般成功 direct-open/reload/Back/reopen 证据；Forget 失败恢复链不能替代成功恢复矩阵。虚拟 artifact 必须逐路径绑定一次解析的 UTF-8 或 canonical JSON 精确字节，禁止二次反转义。
- G4 ArchitectureResult 必须绑定 Architecture Scan Manifest v2，由 tracked path/mode/blob、排序、source tree/path index、封闭排除项、ruleset、allowlist 和 tracked source 原始字节重算；ruleset 必须冻结 import-AST 与 Call/New/endpoint normalization 两种 AST 算法，allowlist 不得覆盖三类不可覆盖边界；PX-N-104..109 必须修改源码字节并同步 hash，同时保持 Report `violations=0`，以证明 validator 自行扫描而非信任结果字段。Report 与 Human Review evidenceClass/claim 等级必须一致；`contract_fixture`、`virtual/*`、原型和 review-only composite 均不得提升为 PX-5 产品证据。
- PX-0.1b 已满足独立复审 fatal / major 均为 0，PX-0.2 验收工具代码工作包现为 Conditional Go；不得借此进入 PX-1 产品代码。
- PX-0.2 首轮至第四轮独立审计发现的 FixtureSuite、PNG、G4、RFC 6902、metadata artifact、图片/metadata 配对和重复 image path 假绿均已闭环。第五轮独立复审记录在 `evidence/v2_external_brain_productization/px-0.2/independent-reaudit-4.md`，结论为 Fatal 0 / Major 0 / Minor 0。PX-0.2 已通过；PX-1 仅在单独开发计划、验收计划和实现前审计闭环后 Conditional Go，不得据此声明 PX-1 已实现或产品 real-Chrome 验收通过。
- PX-1 的自动验收曾产生 20 项全绿结果，但 2026-09-01 独立只读审计发现 `WORKSPACE_NOT_FOUND` 恢复循环、并发打开竞争和五路由 Back/reopen 证据矩阵不完整，共 3 个 Major。审计记录为 `evidence/v2_external_brain_productization/px-1/independent-audit.md`；PX-1 已重新打开，PX-2+ 保持 No-Go。
- PX-1 Major repair 的开发计划、验收计划和实现前审计已于 2026-09-08 落盘。修复只允许修改 Workspace authority recovery、同一 Service Worker 生命周期内的并发 tab 协调、五路由四恢复证据和 Drawio 状态；Runtime API、Workspace Schema、permissions、CSP 与 PX-2+ 产品能力均不得修改。
- PX-1 Major repair 的真实 Chrome 报告重算得到五类 route x 四种恢复 20/20、8 个并发入口请求只创建 1 个标签页、7 个请求聚焦同一 tab、打开过程 0 次 ingest；缺失 workspace 恢复到 Runtime 实际存在的 `ws_default`。全量前端 140 项、Runtime V2 API 4 项、typecheck、build 和 PX-0.2 109 个负向夹具回归均通过。独立复审记录为 `evidence/v2_external_brain_productization/px-1/major-repair/independent-reaudit.md`，结论 Fatal 0 / Major 0 / Minor 0。`FORBIDDEN` 仍仅为注入式合同分支，不声明真实 Runtime/Chrome Forbidden 证据。
- PX-2 已将 Side Panel 收敛为 Quick Surface：Save/Status、查看来源、打开工作台、在工作台中打开、问当前空间和只读 Trace。真实 PRD source、46 项 Chrome 断言、360/420 无横向溢出、五 route x 四恢复 20/20、8 并发单标签和 0 ingest 均通过；全量前端 144 项、Runtime API 4 项、build/typecheck 与 PX-0.2 109 个负例回归通过。独立审计见 `evidence/v2_external_brain_productization/px-2/independent-audit.md`。
- PX-3 实现前审计已冻结 sender window -> focused window -> lowest tabId 的复用顺序、Service Worker 重启重新 query、用户再次触发后的 tab close 恢复，以及 Runtime 状态 poll/reconnect 退避和权威边界。审计见 `stage-gates/v2-px-3-preimplementation-audit.md`。
- PX-3 最终证据为 148 项前端测试、4 项 Runtime API、109 个 validator 负例、51 项 Chrome 检查和 20/20 route matrix；offline->reconnect、双容器 source/operation ID、tab close/create/reuse 与 0 ingest 均通过。独立审计见 `evidence/v2_external_brain_productization/px-3/independent-audit.md`。
- PX-4 已实现八个 Workspace 交付组件并接入真实 Runtime。最终证据为 153 项前端测试、4 项 Runtime API、109 个 validator 负例、60/60 Chrome checks、五 route x 四恢复 20/20、四视口真实 PNG、Permission grant/revoke 和独立 source Forget 四面验证。实现中发现并闭环 route authority 竞态、跨 source ID 错误比较及 forgotten source 仍出现在 Library API 三项问题；独立审计见 `evidence/v2_external_brain_productization/px-4/independent-audit.md`，结论 Fatal 0 / Major 0 / Minor 0。
- PX-5 实现前门禁已冻结：自动化证据候选通过不等于最终 Report 通过；在 PX-6 人工核查前，Human Review 必须 pending、Report 必须 `passed=false` 且使用 not-passed claim。实现计划、验收计划和实现前审计分别见 `design/v2-px-5-development-plan.md`、`design/v2-px-5-acceptance-plan.md`、`stage-gates/v2-px-5-preimplementation-audit.md`。
- PX-5 历史候选包含12份source字节、39场景及77项Chrome断言记录，但2026-09-09复核确认生成观察与原始事实不一致、合同结果冒充生产执行及G4/G7校验缺口。上述数量不证明G1-G7通过。原始证据保留供诊断，当前处置见 `evidence/v2_external_brain_productization/px-5/acceptance-disposition.json`。
- PX-6 原机器出门 PASS 已撤回。T04.1 隔离快照复验已经实施并通过独立实现出门审查；PX6-0..5 已获授权、实现并取得 `LIMITED PASS`，对应独立审计 SHA-256 为 `d43f8f98b46e1813d95894830032074572b4fd6834e642e7ec4447217ac42f50`。Human Review、G7 与 `finalPassed` 仍分别为 pending、pending、false；人工核查不得替代 T04.1 机器证据或自动回写已封存候选。

## 7. 实现期硬规则

- 每个子阶段开发前单独落盘 development / acceptance plan 和审计意见。
- 每个子阶段完成后执行 E2E、PRD review 和 false-green audit。
- 真实内容数据必须来自真实网页、显式授权本地文档和用户 notes；服务故障可用确定性 fault fixture。
- E2E 从真实用户入口开始；只打开 `workspace.html` 截图不算入口通过。
- 自动化优先 headless 和静音；可见 Chrome 测试前告知用户并在结束后清理实例。
- 任一 fatal / major、架构偏离、重复 ingest、ID 不一致或证据冒充都必须打回当前子阶段。

## 8. 允许声明与 No-Go

PX-6 全绿并完成人工产品体验核查后最多允许：

```text
V2-PX External Brain Productization passed dual-container real-Chrome acceptance.
```

不得声明：

```text
V2 ready。
完整外脑产品完成。
RAG ready。
Knowledge Dream Cycle implemented。
自动遗忘或自动文件整理完成。
默认本地文件读取。
data_service Console 等同 Navia UI。
```
