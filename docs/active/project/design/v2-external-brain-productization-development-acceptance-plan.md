# V2-PX External Brain Productization Development And Acceptance Plan

## 1. 目标

把当前窄 Side Panel 中的 V2 Knowledge 组件基线拆分为：

```text
Side Panel Quick Surface
+
Extension Workspace Page
```

用户从普通网页的 Navia 入口保存当前页，并能自然打开同一 source / workspace 的宽屏管理页。两个容器共享 Runtime 权威状态，不重复导入、不丢失 EvidenceRef、不混淆服务状态。

## 2. 子阶段执行表

| 子阶段 | 计划修改位置 | 验收重点 | 停止条件 |
|---|---|---|---|
| PX-0 | active docs / schemas / drawio | 文档、合同、原型、声明一致 | 外部挑战审计发现 7 个 major，门禁已重开 |
| PX-0.1 | V2-7 状态、首批四份 PX schema、semantic validator、生命周期 ADR、原型、负向夹具 | active 阶段事实一致；错误 action/route/report 被机器拒绝；原型行为与 PRD 一致 | 历史第二轮外部审计发现 5 个 Major，本阶段未通过并转入 PX-0.1b |
| PX-0.1b | Manifest v5、Report v12、Screenshot v6、Execution Observation v6、Human Review v3、Validation Contracts v4、Architecture Scan Manifest v2、RFC 6902 夹具、自包含原型审计件、Gate 推导算法 | 最新外部审计的有效问题全部闭环并形成自包含的 20 文件平铺包 | 任一合同互斥、原型身份/Back 错误、生命周期冲突、Gate 依赖计数/自由文本/自报布尔值或独立复审存在 fatal / major |
| PX-0.2 | docs contract tooling + evidence validator（非产品功能） | 实现 report semantic validator、artifact/hash 检查、summary/G1-G7 重算和负向测试命令 | 任一负向夹具未拒绝、路径不存在仍通过、PX-1 在 validator 前启动 |
| PX-1 | `entrypoints/workspace/*`、`WorkspaceRouter.tsx` | route 直达、刷新、Back、重开、invalid ID 恢复 | 只能开发 URL 打开或 fixture 静默兜底 |
| PX-2 | `sidepanel/main.tsx`、Save / Status / Quick actions | 三个入口可发现；420 / 360px 可用 | Side Panel 仍塞入完整管理面或入口不可理解 |
| PX-3 | `background/index.ts`、`runtimeClient.ts` | action schema、标签页复用、ID 一致、poll / reconnect | 重复 ingest、ID 漂移、状态缓存冒充权威状态 |
| PX-4 | `knowledge_workspace/*` | Sources / Ask / Trace / Graph / Permission / Forget 宽屏交互 | B 生成事实、直连 data_service、Forget 仅隐藏 UI |
| PX-5 | T01 前端修复 -> T02.x 原始证据 -> T03 共享校验/报告 -> T04 双泳道快照复验 | 12 个唯一真实 source、用户操作、故障态、截图和报告可追溯到各自单一 sealed run；T04 可隔离重建 | 任一子阶段 Fatal/Major、跨 run/泳道拼接、输入被 Mock、依赖闭包不完整，或报告先于验证生成 |
| PX-6 | PRD / architecture / false-green / human review | G1-G7 全绿、实现与 drawio 同步 | 自动报告与人工观察不一致 |

Workspace 宿主固定使用路线 A `Extension Workspace Page`。PX-1 首个工作项是 entrypoint spike，不是可跳过的探索任务；路线 B 只能按 `v2-external-brain-workspace-hosting-adr.md` 的回退门禁重新进入 PX-0。

## 3. 开发前审计模板

每个 PX 子阶段必须单独记录：

```text
PRD requirements
target files and ownership
public contract impact
real-data fixtures
E2E paths
acceptance thresholds
known risks
audit findings and closure
```

公共 Runtime 合同默认 `none`。若实现需要新增 `/v1/knowledge/*` 字段或错误码，必须回到 PX-0 并同步 OpenAPI、schema、架构和验收。PX-0.1 仅收紧 Workspace 与 evidence 文档合同，不修改生产 Runtime API。

## 4. 真实数据矩阵

产品化 source corpus 至少 12 个唯一真实 source：

| Source 类型 | 最少数量 | 目的 |
|---|---:|---|
| 真实网页 source | 6 | 从宿主网页 Launcher / Side Panel 完成保存和 Workspace 打开 |
| 显式授权本地文档 | 3 | 验证 Workspace 管理、Permission 和路径脱敏 |
| Notes / Markdown | 3 | 验证非网页 source 的 route、Ask、Trace 和 Forget |

操作场景与 source corpus 分开统计。操作场景至少 12 条，通过 `sourceSampleIds` 引用 corpus；一个 source 可以用于多个 route、故障或治理场景，但只能计作一个唯一 source。旧 V2-7 24 source / 38+ operation scenarios 继续作为 Runtime / contract 回归，不计入新入口和独立页面截图数量。

## 5. 子阶段详细开发与验收基线

### 5.0 PX-0.1b Executable Contract And Audit-Package Closure

PX-0.1b 只允许修改 active 文档、Schema、负向夹具和审查原型包，不允许修改 Workspace 产品代码或实现 validator。固定产物：

```text
v2_external_brain_acceptance_manifest.schema.json          # v5
v2_external_brain_report.schema.json                       # v12
v2_external_brain_screenshot_metadata.schema.json          # v6
v2_external_brain_execution_observation.schema.json        # v6
v2_external_brain_human_review.schema.json                 # v3
v2_external_brain_validation_contracts.schema.json         # v4 Rule/Failure/Fixture registry
v2_external_brain_architecture_scan_manifest.schema.json   # v2 recomputable G4 inputs and fixture source bytes
v2-external-brain-productization-semantic-validator.md
prototype-review/index.html + assets/ + qa-summary.json + self-contained audit HTML
contracts/fixtures/v2_external_brain/ complete roots + RFC 6902 patches
```

验收：Manifest 的 evidenceClass、`originRef`、唯一 raw-byte fingerprint 和 expected open/recovery/error 自洽；Report v12 / Screenshot v6 的状态快照直接复用 Knowledge Status；Execution Observation v6 可表达 prior context、多次 attempt、Runtime 无响应、不参与层和 durable Forget。29 场景 semantic-positive 使用真实尺寸虚拟 PNG 与不同 source bytes，Report `screenshotPaths` 与 paired metadata `imagePath` 必须完全相同；四个命名 viewport variant 的 Manifest、metadata、实际解码尺寸和 Side Panel/Workspace surface 逐项一致。109 个 RFC 6902 case 携带唯一 `requirementId + requirementKey + ruleIdUnderTest`，并与 mandatory requirement registry 的 layer/failure 逐项相等；41 个 semantic RuleId 均有对应 semantic case。G4 绑定 commit、三项 scan root、tracked path index、source tree、Architecture Manifest v2 inline source bytes、canonical ruleset 和 non-overriding allowlist；两种 AST 算法均必须从原始源码重算，PX-N-104..109 必须在 Report 保持 `violations=0` 时检出源码违规。三个 Forget 场景均记录同一 source 的 direct-open/reload/Back/reopen `SOURCE_NOT_FOUND` 链。G7 精确核对 63 RuleId、41 semantic RuleId、65 positive ID、109 requirement ID 和原始文件 hash。任何缺失均保持 PX-0.1b FAIL、PX-0.2 No-Go。

### 5.1 PX-0.2 Executable Acceptance Tooling

开发前输入：Knowledge Status 与八份 PX schema（含 Validation Contracts 和 Architecture Scan Manifest）、29 场景 semantic-positive 完整根实例、109 个一对一 RFC 6902 fixture、自包含原型审计件、semantic validator 规格和冻结的 evidence 目录结构；PX-0.1b 必须先经独立复审无 fatal / major。

目标产物只允许是验收工具与测试，不包含 Workspace 产品功能：

```text
apps/chrome-extension/e2e/validate-v2-external-brain-productization-report.mjs
apps/chrome-extension/e2e/validate-v2-external-brain-productization-report.test.mjs
package.json 中 validate:v2-external-brain-productization 命令
```

验收：真实读取 manifest/report/screenshot/execution/human-review；重算 summary/sourceKinds/G1-G7；验证 scenario-aware layer、prior route、tab reuse attempts、Runtime transport、结构化 G4/G6/G7 和所有 artifact hash；运行全部 RFC 6902 schema/semantic 负向夹具。任何失败报告、失败命令、伪造计数、缺失文件、状态权威冲突或错误 tab reuse 仍能通过时，PX-0.2 失败，PX-1 不得开始。

### 5.2 PX-1 Workspace Entry And Router

开发前输入：hosting ADR、workspace contracts schema、五类 route 表、现有 WXT 配置和 Manifest V3 permission audit。

计划位置：

```text
apps/chrome-extension/entrypoints/workspace/index.html
apps/chrome-extension/entrypoints/workspace/main.tsx
apps/chrome-extension/entrypoints/workspace/style.css
apps/chrome-extension/src/modules/knowledge_workspace/WorkspaceRouter.tsx
```

实施顺序：先证明构建产物、`chrome.runtime.getURL`、生产入口、route 恢复、CSP / permission、Runtime offline shell 六项 spike；再实现 Source Library、Source Detail、Ask、Graph、Permissions 五类 route 的 direct open、reload、Back / reopen 和 invalid / forbidden ID 恢复。

验收：route contract fixtures、router component tests、构建产物检查和真实 extension-page 截图全部通过。任一 spike 条件被技术事实阻塞，停止 PX-1 并回到 PX-0；禁止临时启动 localhost 页面冒充通过。

### 5.3 PX-2 Side Panel Quick Surface

开发前输入：三个入口的触发条件、文案、目标 route、420 / 360px 原型和 V1 Launcher / Side Panel 回归清单。

计划位置：

```text
apps/chrome-extension/entrypoints/sidepanel/main.tsx
apps/chrome-extension/src/modules/knowledge_workspace/KnowledgeWorkspaceShell.tsx
apps/chrome-extension/src/modules/knowledge_workspace/SaveToKnowledgeCard.tsx
apps/chrome-extension/src/modules/knowledge_workspace/ServiceStatusBanner.tsx
apps/chrome-extension/src/modules/knowledge_workspace/KnowledgeBuildStatus.tsx
```

验收：`查看来源` 只在可审计 source 状态出现；`打开工作台` 指向 Source Library；`在工作台中打开` 保留当前上下文。三个入口都必须真实触发 action，420 / 360px 无遮挡，并证明 V1 Chat / Map / Debug / Settings、Launcher、折叠和 resize 未被回归破坏。

### 5.4 PX-3 Action, Tab Reuse And Reconnect

开发前输入：`OpenWorkspaceAction / WorkspaceRouteState / WorkspaceOpenResult` fixtures、tab reuse policy、stable-ID 和 Runtime reconnect 规则。

计划位置：

```text
apps/chrome-extension/entrypoints/background/index.ts
apps/chrome-extension/src/runtimeClient.ts
```

验收：单窗口、多窗口、已存在标签页、标签页关闭、Runtime offline / reconnect、operation in-flight 和重复点击均有测试；成功路径只传稳定 ID，`focus_existing_or_create` 可观察，重复打开不增加 ingest 次数。Runtime offline 页面 shell 仍可打开，Adapter / data_service 状态不得由前端伪造。

### 5.5 PX-4 Workspace Components And Wide UX

开发前输入：原型组件清单、事实所有权、EvidenceRef、Permission / Forget 生命周期和可访问性标准。

计划位置：

```text
SourceLibraryPanel.tsx
SourceDetailReader.tsx
AskWithSourcesPanel.tsx
EvidenceTraceDrawer.tsx
KnowledgeGraphCanvas.tsx
PermissionRootManager.tsx
ForgetSourceDialog.tsx
DataServiceStatusCard.tsx
```

验收：组件只消费 Runtime 权威响应；Source Detail、Ask 引用和 Graph 节点能打开同一 Trace；无证据回答 degraded；Graph 超过节点上限时降级为可筛选列表；Permission revoke 停止新扫描；Forget 完成 Library / Ask / Graph / Trace 四面验证。1280px 与 768px 可用，焦点、Escape、dialog、危险确认和 reduced-motion 通过。

### 5.6 PX-5 Real-Chrome Evidence

开发前输入：v2 schema、semantic validator、12-source corpus、12+ operation scenarios、故障注入方案和 V2-7 regression commands。

计划位置：

```text
apps/chrome-extension/e2e/chrome-v2-external-brain-productization.mjs
apps/chrome-extension/e2e/generate-v2-external-brain-productization-report.mjs
apps/chrome-extension/e2e/validate-v2-external-brain-productization-report.mjs
docs/active/project/evidence/v2_external_brain_productization/
```

验收：manifest / report schema、semantic validator、真实 Chrome 路径、截图元数据、G1-G7 自动部分和 V2-7 回归通过。Headless 优先、静音；必须可见 Chrome 时提前告知并及时清理实例。原型图、旧 V2-7 截图和 data_service Console 不计入 PX UI 证据。

#### 5.6.1 PX-5 修复链与 T04 当前门禁（2026-09-14）

固定顺序不是并行分支：

```text
T01 / R1 frontend + real Chrome repair（限定 PASS）
  -> T02 / R2 sealed raw（限定 PASS）
  -> T02.1..T02.4 / R2 修复与 fail-closed 对照（历史保留）
  -> T02.5 / R2 structured production input（唯一正输入，限定 PASS）
  -> T03 / R3 shared semantic/AST validation and pure reporting（LIMITED PASS）
  -> T04 / R4 isolated snapshot replay + fresh real-Chrome（LIMITED PASS，Minor 1）
  -> T04.1 replay artifactRoot repair + full R4 rerun（文档候选，实施 NO-GO）
  -> PX-6 machine package + human exit review（文档候选，被 T04.1 阻塞）
```

T03 唯一 production-positive 输入冻结为：

```text
runId=t02-r2-t01-structured-production-input-20260914T125700
snapshotCommit=430cddcb7ff618978851af1f3b9a3c48f2370d36
rawSha256=ce272df479499e10092bc5d6a24610ebcd91782c87d4be34dceb09f296a5f0c3
sealSha256=fed6155ace6c0132c70c86bd3daccef987bd7c441df8960811e734274ea1b70f
```

T03 目标链必须为 `sealed raw/artifacts/Git snapshot -> ArtifactReader -> DerivedFacts -> shared Schema/Semantic/TypeScript AST core -> ProductionValidation -> pending Human Review -> pure Report JSON/HTML -> ProductionPackage -> InvocationRecord`。Report 不得成为 validator 输入；缺观察只能生成 CollectionDiagnostic 并退出 2；旧 production generator/validator 不得作为 fallback。Contract fixture 与 production 使用同一验证 core，但使用不同 reader/profile。

T03 固定 14 项机器验收分母并已取得限定独立通过；唯一 baseline candidate 是 `t03-r3-production-exit-candidate-20260914T134804`，旧 `132413` 只作 Schema 失败回归。T04 已完成两泳道、完整依赖闭包、三份 Snapshot Schema、14 项验收和 25 个负例，独立审计 Fatal 0/Major 0/Minor 1。T04.1 必须完整重跑关闭 `artifactRoot` Minor，旧 T04 候选不得修改或提升。

### 5.7 PX-6 Exit Audit

开发前输入：独立审计 Fatal 0/Major 0 且 `artifactRootConsistency=closed` 的单一 T04.1 候选，以及 PX-6 Schema、20 个负例、E2E、PRD review、architecture review、false-green audit 和人类清单。

验收：PX6-A01..A14 机器项先通过并强制停在 `waiting_for_human_review`；人类在可见 Chrome 执行 H01..H07，提交有效 ReviewSubmission 后才执行 A15/A16 和 G7/final 重算。自动化通过但人工 pending 时只能记录候选态，不得使用成功 claim。完整细则见 `v2-px-6-development-plan.md`、`v2-px-6-acceptance-plan.md` 和 `contracts/v2_px6_exit_contracts.schema.json`。

## 6. 自动化路径

1. Launcher -> Side Panel -> 读取 -> 保存 -> `trace_ready` -> 查看来源 -> Extension Workspace Source Detail。
2. Side Panel “打开工作台”打开当前 Source Library；Know 顶部入口打开同一 Workspace。
3. Source / Ask / Graph / Permissions route 直接打开、刷新、Back、重开。
4. invalid / forbidden workspaceId 或 sourceId 显示可恢复错误，不加载 fixture。
5. 重复入口聚焦已有 Workspace 或安全创建新页，但 source ingest 次数不增加。
6. Side Panel / Workspace 的 workspaceId、sourceId、operationId、EvidenceRef 和状态一致。
7. Runtime offline、Adapter blocked、data_service unreachable、source failed / degraded 有不同解释和下一步动作。
8. Permission grant / revoke 后不继续扫描；Forget 后 Library / Ask / Graph / Trace 四面一致。

## 7. 视觉与可访问性

- Side Panel：420px 和 360px；状态、入口、输入区无重叠、截断或横向滚动。
- Workspace：至少 1280px 宽屏和 768px 窄屏；表格、Source Detail、Graph、drawer 和 dialog 可操作。
- 所有图标按钮有 tooltip / accessible name；焦点可见；Escape 关闭可关闭浮层；危险确认不被误触。
- `prefers-reduced-motion` 下不依赖动画表达状态。
- 打开新标签页的入口文案或 tooltip 必须明确行为。

## 8. 报告与语义校验

固定证据位置：

```text
docs/active/project/evidence/v2_external_brain_productization/
```

semantic validator 至少拒绝：

- `passed=true` 但 fatal / major 非空。
- 场景少于 12 或真实 source 分布不足。
- 三入口、五 route、四故障态、Permission / Forget 覆盖不足。
- screenshot path 缺失或引用原型 / 旧 V2-7 图。
- success 场景稳定 ID 不一致或 `duplicateIngestDetected=true`。
- Runtime offline 被记录为 Runtime status API 成功响应。
- 自动遗忘 / Dream Cycle 被写入 PX 通过能力。
- `open_workspace` 被路由到 graph/detail，或 source_library 使用 graph path。
- Route A 成功 URL 使用 localhost/http(s)。
- `passed=true` 但任一 scenario/test command 失败，或 summary 计数无法从底层结果重算。
- screenshot、metadata、log 或 audit artifact 路径不存在。
- Runtime offline 同时记录 Adapter ready、data_service connected 或 source trace_ready。
- Forget 缺少 Library/Ask/Graph/Trace 四面 before/after，或 shared recompute 缺 supportingSourceIds。

固定命令基线：

```text
npm --prefix apps/chrome-extension run typecheck
npm --prefix apps/chrome-extension test -- WorkspaceRouter OpenWorkspaceAction KnowledgeWorkspaceShell ServiceStatusBanner
npm --prefix apps/chrome-extension run build
npm --prefix apps/chrome-extension run e2e:chrome:v2-memory-personal-knowledge
npm --prefix apps/chrome-extension run e2e:chrome:v2-external-brain-productization
npm --prefix apps/chrome-extension run validate:v2-external-brain-productization
```

后两条由 PX-5 实现并写入 `package.json`；当前文档阶段不得把它们写成已经存在或已经通过。

## 9. 最终出门

```text
G1-G7 all pass
fatalIssues = 0
majorIssues = 0
V2-7 regression = pass
human product review = pass
```

只有全部满足才允许有限声明；否则打回最近失败子阶段。
