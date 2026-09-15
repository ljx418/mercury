# V2 Memory / Personal Knowledge Base Gap Companion

本 companion 解释 `v2-memory-personal-knowledge-base-gap.drawio` 的最新图纸口径。图纸以当前代码、active PRD、目标架构和已通过的 V2 planning-aligned evidence 为事实基线，补充下一阶段“Side Panel 快捷面 + 独立 Extension Workspace 管理面”的产品化目标。

本图纸对应的当前开发门禁统一称为 `V2-PX External Brain Productization`。V2.x 自动整理、摘要刷新、遗忘候选和 `Knowledge Dream Cycle` 只作为后续路线登记，不属于 PX-0..PX-6 的实现或出门承诺。

Workspace 宿主路线已经冻结为路线 A `Extension Workspace Page`。路线 B `localhost Web Workspace` 只在 PX-1 entrypoint spike 被可复现的 WXT / Manifest V3 / CSP 技术事实阻塞后，打回 PX-0 重新评审；不得在实现阶段静默切换。详细取舍见 `v2-external-brain-workspace-hosting-adr.md`。

2026-09-14 状态同步：T02.5 为唯一 production-positive R2 输入；T03 R3 与 T04 R4 均已独立审查限定通过。T04 完成 R4-P frozen-input replay 与 R4-E fresh real-Chrome 两条不可拼接泳道，外审为 Fatal 0/Major 0/Minor 1。当前 T04.1 全量重跑修复与 PX-6 machine/human/final 两阶段合同均为文档候选；外部文档审查和用户代码授权前不得实施。Human Review、G7、final 仍 pending/pending/false，PX-5/PX-6/RKM 仍未通过。新增真实知识/对话记忆/可逆维护见 [V2-RKM图纸索引](v2-real-knowledge-maintenance-gap.md)，不计本 PX 范围。

## 1. 当前结论

当前允许声明：

```text
V2 Memory / Personal Knowledge Base passed planning-aligned local knowledge acceptance.
```

它证明合同、Runtime API、mock-first / controlled-boundary Adapter、Knowledge Workspace 组件基线和 planning-aligned 验收已形成；独立页面当前已有后续实现，但不能由V2-7证据证明其本轮验收通过。

当前生产代码事实：

```text
普通网页
-> contentBridge.ts
-> sidepanel.html?naviaInPage=1
-> entrypoints/sidepanel/main.tsx
-> Chat 中 SaveToKnowledgeCard
-> 右侧 Know 工具按钮
-> activeView = knowledge
-> KnowledgeWorkspaceShell 在 Side Panel 内渲染
```

当前已存在且 PX-1..4 已验收；T03/T04 证据链已限定通过，但 PX-5 最终出门仍待 T04.1 与 PX-6：

```text
entrypoints/workspace/index.html
entrypoints/workspace/main.tsx
workspace.html 独立页面
OpenWorkspaceAction
“打开工作台 / 查看来源”生产入口
独立 Workspace route / reload / recovery
```

上述 legacy 侧栏调用链不是当前全部实现。实际已有 Background 打开 Workspace、独立路由与拆分组件；T03 已从 T02.5 完整 raw 输入生成并验证 production candidate，T04 已完成 clean snapshot replay 与全新 real-Chrome R4 复验。当前仅因 replay step `artifactRoot` 命名 Minor 尚未由新 T04.1 run 关闭，且 PX-6 人工审查尚未执行，所以 PX-5 FAIL/REOPENED、PX-6 BLOCKED。原型中的两容器并排只用于比较，不代表实际产品会在宿主网页中同时显示两块界面。

## 2. 双容器目标体验

| 容器 | 用户职责 | 不承担 |
|---|---|---|
| 网页内 Side Panel | 保存当前页、服务状态摘要、当前 source build / trace、问当前空间、打开 Trace、进入 Workspace | 长期来源管理、宽图谱、权限和删除审计主界面 |
| Extension Workspace Page | Workspace 切换、来源库与详情、跨来源问答、Graph、PermissionRoot、Forget、服务诊断 | 自动读取网页、直接控制宿主 DOM、绕过 Runtime 生成事实 |

两个容器共享：

```text
workspaceId
sourceId
operationId
EvidenceRef
runtimeClient.ts
Navia Runtime /v1/knowledge/*
V2 Adapter / Governance
```

两个容器不共享或传递大块事实 payload。Workspace route 只携带稳定 ID，页面打开后再通过 `runtimeClient.ts` 读取权威状态。

## 3. 用户入口与打开行为

目标至少提供三个入口：

| 入口 | 出现条件 | 打开目标 |
|---|---|---|
| `查看来源` | 当前页保存进入 `trace_ready` | 对应 `workspaceId + sourceId` 的 Source Detail |
| `打开工作台` | Side Panel 快捷动作 | 当前 Workspace 的来源库 |
| `在工作台中打开` | Side Panel 的 Know 顶部 | 保留当前 Knowledge 子视图或回到来源库 |

目标打开链路：

```text
用户点击入口
-> Side Panel 发送 OpenWorkspaceAction
-> background 使用 chrome.runtime.getURL(...)
-> background 按 focus_existing_or_create 聚焦已有 tab 或 chrome.tabs.create({ url })
-> 新标签页打开 Extension Workspace Page
-> route 读取 workspaceId / sourceId
-> runtimeClient.ts 重新获取权威数据
```

浏览器行为要求：

- 新页面在扩展新标签页中打开，不嵌入宿主网页。
- 原网页和 Side Panel 可以保留，用户可继续伴读。
- 同一入口重复点击应复用或聚焦已有 Workspace 页，具体策略在实现门禁冻结。
- 页面必须支持直接打开、刷新、重开和无效 ID 恢复。
- 不跳转到 data_service Console。

目标路由合同：

```text
workspace.html#/knowledge/sources?workspaceId=:workspaceId
workspace.html#/knowledge/sources/:sourceId?workspaceId=:workspaceId
workspace.html#/knowledge/ask?workspaceId=:workspaceId
workspace.html#/knowledge/graph?workspaceId=:workspaceId
workspace.html#/knowledge/settings/permissions?workspaceId=:workspaceId
```

`workspace.html` 和上述五类 route path 均已冻结为 Route A 公开合同；PX-1 只能验证 WXT 构建映射，不能临时改名。若构建事实阻塞，必须返回 PX-0。稳定 ID 交接、Runtime 重新取数、刷新可恢复、无效 ID 不使用虚构默认数据同样不得变化。

## 4. 当前架构与目标架构 Gap

| 平面 | 当前实体与状态 | 具体 Gap | 目标修改 / 新增 |
|---|---|---|---|
| P0 Browser Host | 普通网页、PageContext、用户动作，已实现保持 | 无 | 继续只响应用户动作，不自动保存 |
| P1 Extension Shell | contentBridge及Background打开动作已存在；PX-1..4与T04 R4-E已复验 | 产品行为无新增 Gap | 保留OpenWorkspaceAction稳定ID边界 |
| P2a Side Panel | 快捷面和三个入口已存在；T04 R4-E全量复验完成 | 待PX-6可见Chrome人工体验核查 | 保持轻量，不重建已存在入口 |
| P2b Workspace Entry | workspace/index.html、main.tsx、style.css已存在；Route A与T04均已验收 | 待PX-6人工核查五route恢复体验 | 保持Route A，不冒充新建工作 |
| P2c Workspace Components | Source/Ask/Trace/Graph/Permission/Forget拆分组件已存在并由T04新run复验 | 待PX-6人工检查可理解性和危险操作 | 不以legacy聚合文件推断未拆分 |
| P3 Runtime Client | `runtimeClient.ts` V2 knowledge section 已存在；T04状态与离线权威复验通过 | 无产品代码新增；待人工观察文案 | 两个容器复用同一 client；按 ID poll / reconnect |
| P4 Local Runtime API | `app.py /v1/knowledge/*` 已有基线 | 产品化入口未做真实 Chrome 验收 | 保持稳定 envelope、errorCode、requestId、operationId |
| P5 Adapter / Governance | `modules/memory/*` 基线已存在 | 真实 data_service 产品化仍需复核 | 继续作为唯一跨项目受控边界 |
| P6 data_service | 外部候选；当前参考commit见RKM架构，旧1.5.0 spike只作历史 | 不是Navia已集成后端/UI | PX继续受控边界，RKM真实HTTP需另审 |
| P7 Evidence | T03链与T04 SnapshotBuilder/Comparator/Revalidation/ExitManifest 已限定通过 | T04.1 root统一及新全量run；PX-6 CandidateBinding/MachineExitAudit/ReviewSubmission/FinalDisposition 待实现 | 旧报告链只作负向输入；机器先停在人审等待态，人类提交后才最终化 |

### 4.1 目标文件

保持并修改：

```text
apps/chrome-extension/src/contentBridge.ts
apps/chrome-extension/entrypoints/background/index.ts
apps/chrome-extension/entrypoints/sidepanel/main.tsx
apps/chrome-extension/src/runtimeClient.ts
apps/chrome-extension/src/modules/knowledge_workspace/KnowledgeWorkspaceShell.tsx
apps/chrome-extension/src/modules/knowledge_workspace/SaveToKnowledgeCard.tsx
apps/chrome-extension/src/modules/knowledge_workspace/ServiceStatusBanner.tsx
apps/chrome-extension/src/modules/knowledge_workspace/KnowledgeBuildStatus.tsx
```

原计划新增、当前已存在需复验（路由实现以workspaceRoutes/workspaceAuthority为准）：

```text
apps/chrome-extension/entrypoints/workspace/index.html
apps/chrome-extension/entrypoints/workspace/main.tsx
apps/chrome-extension/entrypoints/workspace/style.css
apps/chrome-extension/src/modules/knowledge_workspace/workspaceRoutes.ts
apps/chrome-extension/src/modules/knowledge_workspace/workspaceAuthority.ts
apps/chrome-extension/src/modules/knowledge_workspace/SourceLibraryPanel.tsx
apps/chrome-extension/src/modules/knowledge_workspace/SourceDetailReader.tsx
apps/chrome-extension/src/modules/knowledge_workspace/AskWithSourcesPanel.tsx
apps/chrome-extension/src/modules/knowledge_workspace/EvidenceTraceDrawer.tsx
apps/chrome-extension/src/modules/knowledge_workspace/KnowledgeGraphCanvas.tsx
apps/chrome-extension/src/modules/knowledge_workspace/PermissionRootManager.tsx
apps/chrome-extension/src/modules/knowledge_workspace/ForgetSourceDialog.tsx
```

`workspace.html` 是 Route A 冻结的公开产物名。PX-1 只验证 WXT entrypoint 能否稳定生成该文件；不能生成时必须返回 PX-0，不得由实现者临时改名或修改合同。

## 5. 生命周期

### 5.1 保存与构建

```text
页面已读取 / not_saved
-> 用户点击一次保存
-> 创建 idempotencyKey / operationId / sourceId
-> queued
-> ingesting
-> building
-> trace_ready
-> 显示“查看来源”
-> 打开 Workspace Source Detail
```

规则：

- 页面已读取不等于已保存。
- 正常生命周期不要求用户手动点击“继续构建”。
- Side Panel 与 Workspace 必须展示同一 `operationId` 和 `sourceId`。
- Workspace 打开时不能重复导入当前页。
- `degraded` 保留原因和可用证据；`failed` 只支持用户主动重试。当前 public contract 不支持 cancel / resume，UI 必须隐藏相关命令或显示 `UNSUPPORTED_CAPABILITY`，不得伪造取消成功。
- Runtime 重启后按稳定 ID 重新查询；若 Runtime 不再返回 source / operation，显示 recoverable error。当前基线不承诺恢复旧 operation，也不得从前端缓存伪造 `trace_ready`。

### 5.2 Forget

```text
Source Detail
-> 用户发起 Forget
-> 二次确认
-> 幂等 ForgetRequest
-> 删除 / 重算派生项、Graph、Trace
-> Library / Ask / Graph / Trace 四面验证
-> forgotten 或 shared item recomputed
```

只隐藏 UI 卡片不算 Forget。共享 `KnowledgeItem` 仍有其他来源支撑时，必须解释保留和重算结果。

当前 Forget 必须由用户主动发起。自动维护任务不得绕过 Source Detail 的影响说明、二次确认和四面验证。

### 5.3 服务状态

必须区分：

```text
runtimeStatus:
  checking（仅 UI 瞬态）/ online / offline（报告只允许 online / offline）

adapterStatus:
  ready / degraded / blocked / unchecked

dataServiceStatus:
  unchecked / connected / auth_required / unreachable /
  version_mismatch / degraded

sourceBuildStatus:
  not_saved / queued / ingesting / building / trace_ready /
  degraded / failed / forgotten / unknown
```

Runtime 离线由 `runtimeClient.ts` 的 transport failure / timeout 推导。Runtime 离线时 Adapter / data_service 只能是 `unchecked`，source build 只能是 `unknown`；不能假设 `/v1/knowledge/status` 仍能返回成功响应。

### 5.4 后续 Knowledge Dream Cycle 边界

V2.x 可研究后台整理、去重、摘要刷新、archive / forget candidate 和 Maintenance Inbox，但当前 PX 只登记以下边界：

```text
默认 suggest-only
-> metadata / tag / virtual folder / workspace proposal
-> user review
-> future reversible archive / quarantine
-> future high-risk opt-in forget
```

- 自动维护不进入 PX 代码或 PX 验收。
- 物理文件移动、重命名、删除和永久自动遗忘默认关闭。
- 每个 proposal 未来必须绑定 source revision、EvidenceRef、理由、置信度、可逆性和审计记录。
- 本路线详见 PRD 17.2 和 `v2-knowledge-maintenance-dream-cycle-adr.md`。

## 6. 产品化开发计划

| 子阶段 | 开发目标 | 用户最终看到的效果 | 出门证据 |
|---|---|---|---|
| PX-0 | 文档、Drawio、原型和人类方向核查 | 外部挑战审计后已重开 | 旧 PASS 结论废止 |
| PX-0.1 | active 状态、合同、原型、生命周期和负向夹具首轮闭环 | 三入口 route intent 正确；原型可恢复；Forget 四面可观察 | 历史第二轮外部审计发现 5 个 Major，未通过并转入 PX-0.1b |
| PX-0.1b | Manifest v5 / Report v12 / Screenshot v6 / Execution v6 / Human Review v3 / Validation v4 / Architecture Scan Manifest v2 / RFC 6902 夹具 / 自包含原型 / Gate 算法闭环 | 合同互相可满足；真实 PNG 尺寸和 surface 可核；跨对象因果在 semantic 层；mandatory requirement、逐路径 artifact 字节与 G4 扫描输入可重算；一般成功 route 与 Forget 生命周期均跨 direct-open/reload/reopen/Back 一致 | 九份 schema、65 个 positive ID、109 个 mandatory RFC 6902 用例、63 个 RuleId（41 semantic）、文件/hash 清单和独立复审无 fatal / major |
| PX-0.2 | 实现独立 semantic validator 命令和负向测试 | 验收报告无法用失败子结果、伪造计数或缺失文件冒充通过 | validator 命令、日志、全部失败码；通过前 PX-1 No-Go |
| PX-1 | 独立 Workspace entrypoint 与 router | 新标签页可直接打开、刷新和恢复 | route tests、真实页面截图 |
| PX-2 | Side Panel 快捷面 | 保存后出现查看来源，能打开工作台 | Side Panel 420/360 截图 |
| PX-3 | Background action 与状态同步 | 两个容器共享 workspace/source/operation | message / ID / reconnect tests |
| PX-4 | Workspace 组件产品化拆分 | 宽屏来源库、Ask、Graph、权限、Forget | 组件测试、交互截图 |
| PX-5 | T01→T02.x→T03→T04→T04.1 线性修复与复验 | 从网页入口进入独立 Workspace 的体验由单一 sealed run 原始事实证明，并可在隔离快照复现 | T03/T04 已 LIMITED PASS；T04.1 必须新run关闭Minor |
| PX-6 | A01..A14机器重算→H01..H07人类可见Chrome→A15/A16最终化 | 人类实际确认双容器入口、路由、Forget、状态和UX后形成有限结论 | 16项机器/最终门禁、7项人审、20负例、最终外审Fatal0/Major0 |

后续 `KM-0..KM-7` 不属于本表；必须建立独立 stage gate 后才可开发。

## 7. 验收计划

### 7.1 自动化路径

1. 普通网页 Launcher → Side Panel → 读取 → 保存 → `trace_ready` → 查看来源 → 新标签页 Source Detail。
2. Side Panel “打开工作台”与 Know 顶部入口打开同一 Workspace。
3. Sources、Ask、Graph、Permissions 路由直接打开、刷新、重开和错误恢复。
4. Side Panel 与 Workspace 的 `workspaceId / sourceId / operationId` 一致。
5. Ask 引用、Source Detail 和 Graph 节点打开同一 Evidence Trace。
6. Runtime offline、Adapter blocked、data_service unreachable、source failed / degraded 文案和动作不同。
7. Permission grant / revoke 与 Forget 四面验证完成；同一 forgotten source 的 direct-open、reload、Back、reopen 均恢复到来源库并显示 `SOURCE_NOT_FOUND`。

### 7.2 证据要求

- Headless 和静音优先；需要真实扩展行为时使用受控 Chrome。
- 入口截图必须同时证明宿主网页、Side Panel 和用户动作。
- Workspace 截图必须记录扩展页面 route metadata；Manifest viewport 与 Screenshot Metadata 的 width/height 逐项相等，`composite_review_only` 只作审查对照且不计入产品证据。
- `report.json` 记录 canonical route、逐容器 observed IDs、四域状态、Permission / Forget before-after、截图/metadata/log 路径；每个 `screenshotPaths[i]` 必须与 paired Screenshot Metadata 的 `imagePath` 完全相同并解析到同一原始图片字节。
- Workspace / Manifest v5 / Report v12 / Screenshot Metadata v6 / Execution Observation v6 / Human Review v3 / Validation Contracts v4 / Architecture Scan Manifest v2 八份 PX schema 必须通过；基础 Knowledge Status 的 offline 跨字段约束也必须通过；semantic validator 重算 sourceKinds、summary 和 G1-G7，并逐项核对 63 RuleId、41 semantic RuleId、65 positive ID、109 条 `requirementId + key + rule/layer/failure`、四视口真实图片/surface、成功 Back/reopen、跨对象 identity/时序、逐路径 artifact 字节、Human Review 声明等级和 G4 scan manifest。
- G4 的 contract fixture 必须通过 Architecture Scan Manifest v2 的 `trackedPaths[].inlineSource` 为三个 tracked path 提供源码原始字节并重算 blob/tree；production 则读取验收 commit 的 Git blob并禁止 inline source。Ruleset 固定 import-AST 与 Call/New/endpoint normalization 两种 AST 算法，allowlist 的不可覆盖集合必须与 ruleset 完全相等；PX-N-104..109 直接修改源码并同步 hash，validator 必须自行扫描，不能用 `violations=0` 自报替代扫描。
- T03 只允许按 `sealed raw/artifacts/Git snapshot -> ArtifactReader -> DerivedFacts -> shared Schema/Semantic/TypeScript AST -> ProductionValidation -> pending Human Review -> pure Report JSON/HTML -> ProductionPackage -> InvocationRecord` 单向生成。Report 不是 validator 输入；缺观察只写 CollectionDiagnostic 并 exit 2；旧 production generator/validator 不得作为 fallback。
- T03 固定 T03-A01..A14 十四项分母：63 RuleId、109 contract fixtures、42 production mutations、12 个真实 source、五 route×四恢复、三条 durable Forget、四故障、四视口、Axe/Keyboard、G4 Git blob 重算和两轮内部加外部审查均不可缩减，N/A 固定为 0。
- T04 固定为两条不可拼接泳道：R4-P 在 detached local acceptance commit 中对 T02.5/T03 `134804` 实际重放，十项产物 raw-byte 相等且 Invocation 只允许忽略 `/recordedAt`；R4-E 从同一快照新建 build/profile/Runtime/database/raw/seal，再完整执行 T02 与 T03 分母，最终 R4 candidate 只引用 R4-E。
- T04 使用 SnapshotInputManifest v1、SnapshotRevalidation v1、unsigned ExitManifest v1，固定 T04-A01..A14 与 T04-N-001..025。实现依赖闭包必须包含 T01/R2/T03/T04 transitive imports、Schema/spec/registry/fixture、lockfile 和 toolchain；禁止从主工作树读取未声明文件。
- T04.1 必须把 Replay InvocationRecord 外层和 step implementation/stdout/stderr ArtifactRef 全部统一为 `replay_validation`，然后从空目录完整重跑 R4-P/R4-E/T02/T03/T04；旧 T04 候选保持不可变。
- PX-6 先绑定单一 T04.1 ExitManifest/public archive/独立审计原始 hash，重算 A01..A14 并停在 `waiting_for_human_review`；人类在可见 Chrome 完成 H01..H07 后提交 ReviewSubmission，finalizer 才可重算 A15/A16、G7 和 final。自动化不得生成 reviewer、reviewedAt、Human passed 或成功 claim。
- 验证 420px Side Panel、360px 窄视口和至少 1280px Workspace。
- 验证焦点、Escape、对话框、错误恢复和 reduced-motion。
- 旧 V2-7 的 24 source / 38+ scenario 作为后端和合同回归输入，不替代新入口与双容器证据。

### 7.3 人工核查

- 用户能否发现入口，并理解会打开新标签页。
- 保存后“查看来源”是否出现在自然位置。
- Workspace 是否清楚说明当前来源来自哪个网页和哪个 Workspace。
- Side Panel 是否保持快捷，而不是继续塞入完整管理面。
- Browser Back、刷新、重开是否符合用户预期。
- Forget 是否充分说明影响并展示验证结果。

## 8. 出门条件与 False-Green

全部满足后才能声明产品化阶段验收通过：

```text
入口 Gate
路由 Gate
生命周期 Gate
架构 Gate
UX Gate
证据 Gate
人工产品体验核查
```

以下任一出现必须打回开发：

- 没有 `workspace` entrypoint，或只能通过开发 URL 打开。
- “打开工作台”实际仍只切换 Side Panel 内 `activeView`。
- Side Panel 与 Workspace 使用不同 source，或打开页面时重复导入。
- 页面刷新后丢失 Workspace / Source，且没有明确恢复。
- Runtime offline、Adapter blocked、data_service unreachable 和 source failed 被合并成 generic error。
- 用交互原型、旧 V2-7 场景卡或 data_service Console 冒充产品化 Workspace。
- B 前端直接调用 data_service 或生成 Knowledge Graph 事实。
- 默认读取本地目录。
- 把自动遗忘、Knowledge Dream Cycle、自动文件整理或摘要刷新写成 PX 已实现。

即使产品化阶段通过，仍不得声明：

```text
V2 / RAG ready。
完整外脑产品完成。
自动化知识维护 / 自动遗忘完成。
最终 Monica-like UX complete。
默认本地文件读取。
复杂站点与媒体内容全量高质量理解。
data_service console 等同 Navia UI。
```

## 9. Drawio 页面说明

| 页 | 标题 | 审查重点 |
|---|---|---|
| 01 | 用户入口与双容器目标体验 | 当前真实入口、目标入口、两个容器不是同时显示 |
| 02 | 当前架构与目标架构差异 | 当前代码、未实现 Gap、目标新增文件与调用关系 |
| 03 | 用户入口、路由与状态交接 | 三个入口、background action、目标 URL 和 ID 交接 |
| 04 | 保存、构建与遗忘生命周期 | 单次保存自动推进、异常恢复、Forget 四面验证 |
| 05 | 双容器共享架构与服务状态 | 共享 Runtime / Adapter、四个状态域、data_service 边界 |
| 06 | 产品化开发计划与里程碑 | PX-0 / PX-0.1 / PX-0.1b / PX-0.2 / PX-1..PX-6、目标体验与停止条件 |
| 07 | 自动化与人工验收计划 | 真实 Chrome 路径、证据要求和人工产品体验 |
| 08 | 验收门槛、出门条件与声明 | 六类 Gate、拒绝条件和声明边界 |

第 04、06、08 页必须明确：当前 Forget 由用户发起；V2.x Dream Cycle 为延期路线，不计入 PX 出门。

## 10. 审计结论

本轮修订后，Drawio 已明确：

- legacy聚合组件仍存在，但不代表当前管理面只在Side Panel。
- 独立Extension Workspace Page、入口和拆分管理组件已经实现，本轮验收未通过。
- 目标用户如何从 Side Panel 打开新页面。
- 两个容器如何通过稳定 ID 和 Runtime 共享状态。
- 保存、构建、Trace 和 Forget 如何跨容器延续。
- 当前用户主动 Forget 与未来 suggest-only maintenance 的边界。
- 新阶段开发、自动化验收和人工核查如何拒绝 false-green。

当前图纸已同步为 T04 实施前架构、开发和验收输入，不构成 T04、PX-5 或 PX-6 通过证据。只有 T04 外部文档审查 Fatal 0/Major 0 且用户另行明确批准，才允许进入 T04 代码开发；RKM 另有八页图纸与旧图逐页映射，不覆盖该阶段门禁。
