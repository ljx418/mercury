# V2 Memory / Personal Knowledge Base Stage Gate

本阶段是 `V2 Memory / Personal Knowledge Base` 的实现基线同步与 V2-7 真实数据验收门禁。它不修改 V1 complete 或 post-V1 hardening 基线，也不把 V2-1..V2-6 mock-first / controlled-boundary 实现基线声明为 V2 ready。

## 1. 允许声明

当前 V2-7 证据已经通过，最多允许声明：

```text
V2 Memory / Personal Knowledge Base passed planning-aligned local knowledge acceptance.
```

当前不得声明：

```text
V2 implemented。
V2 Memory / RAG ready。
完整个人知识库产品完成。
默认本地文件读取。
data_service console 已等同 Navia 产品 UI。
Web Research / PPT / Deep Research ready。
多 Agent、产品浏览器自动操作、语音、桌宠或媒体理解 ready。
```

当前门禁判断：

```text
Go for V2 Memory / Personal Knowledge Base implementation-baseline record through V2-6.
V2-7 evidence passed; the active allowed claim is V2 planning-aligned local knowledge acceptance only. No-Go for V2 ready / RAG ready claims.
```

## 2. 阶段目标

V2 承接 V1 当前页伴读能力，把用户主动保存的网页、显式授权导入的本地资料和后续结构化摘要，沉淀为可追踪、可删除、可授权的个人知识资产。

目标用户路径：

```text
当前网页
-> Navia launcher / sidebar
-> 用户主动保存到知识库
-> workspace 选择、后端服务状态和 ingest / build / trace 状态
-> V2 Adapter / Governance 映射 PageContext / SourceRef
-> 候选 Local Knowledge Governance Service 接收 source
-> Knowledge Workspace 展示 source library / detail / ask / trace / graph
-> 用户查看证据、跨来源问答、撤销授权、删除或遗忘 source
-> 再次查询验证删除结果
```

## 3. 当前文档输入

```text
docs/active/project/01-prd.md
docs/active/project/02-architecture.md
docs/active/project/03-development-plan.md
docs/active/project/04-acceptance-plan.md
docs/active/project/design/v2-memory-personal-knowledge-prototype-review/index.html
```

`/mnt/c/workspace/data_service` 可作为候选后端基线进行评估，但只能以 HTTP / MCP / CLI 边界接入。Navia 不得直接读写它的内部 workspace，也不得把它的 console 当作 Navia 产品 UI。

当前实现证据输入：

```text
docs/active/project/evidence/v2_memory_personal_knowledge_base/v2-1-development-acceptance-plan.md
docs/active/project/evidence/v2_memory_personal_knowledge_base/v2-1-prd-review.md
docs/active/project/evidence/v2_memory_personal_knowledge_base/v2-1-false-green-audit.md
...
docs/active/project/evidence/v2_memory_personal_knowledge_base/v2-6-development-acceptance-plan.md
docs/active/project/evidence/v2_memory_personal_knowledge_base/v2-6-prd-review.md
docs/active/project/evidence/v2_memory_personal_knowledge_base/v2-6-false-green-audit.md
docs/active/project/evidence/v2_memory_personal_knowledge_base/v2-7-acceptance-blocked-audit.md
```

## 4. 模块边界

| 状态 | 实体 | V2 责任 |
|---|---|---|
| 已实现保持 | `pageContext.ts` | 提供当前页 DOM / metadata / selection 输入，不读取本地文件 |
| 已实现保持 | `contentBridge.ts` | 保持 launcher / sidebar / source marker；不做自动保存或自动浏览器任务 |
| 已实现需验收 | B `chat_renderer` / sidepanel shell | 展示保存入口、ask with sources、evidence refs，不生成长期知识事实 |
| 已实现保持 | B `mindmap_renderer` | 继续服务 V1 当前页导图；Knowledge Graph 事实来自服务侧 |
| 已实现需验收 | B `debug_renderer` / Settings | 展示 Runtime 和调试信息；V2 需在 V2-7 证明 Runtime、Adapter、data_service、source 状态可区分 |
| 已实现保持 | A Page Reading | 生成 PageContext / SourceRef / QualityReport，不写长期记忆 |
| 已实现保持 | C Mindmap | 生成候选主题和 source binding，不写 Knowledge Graph |
| 已实现保持 | D Agent Loop / Adapter | 保持 ToolResult / Artifact / Event / Trace 边界 |
| 已实现需验收 | V2 Adapter / Governance | mock-first / controlled-boundary 权限、映射、trace、错误、删除语义和 data_service 接入 |
| 已实现需验收 | Memory Plane contracts | `MemoryCandidate`、`KnowledgeSource`、`KnowledgeItem`、`EvidenceRef`、`Workspace`、`PermissionRoot`、`ForgetRequest` |
| 已实现需验收 | Knowledge Workspace | source library、detail、ask、trace、graph、permission、forget、ServiceStatusBanner、DataServiceStatusCard、KnowledgeBuildStatus |
| 外部候选 | `data_service` | Local Knowledge Governance Service 候选基线，只能经受控边界接入 |

## 5. 文档与 V2-7 门禁

- [x] PRD、架构、开发计划、验收计划、stage gate、gap companion、drawio 使用同一阶段名。
- [x] drawio 不超过 8 页，中文书写。
- [x] drawio 包含目标架构与当前架构差异、开发及验收计划、项目里程碑、验收门槛及出门条件。
- [x] 架构图出现具体代码实体、状态、交互方向和分层结构。
- [x] data_service 只作为候选服务，不写成 Navia 已默认启用能力。
- [x] V2 Adapter / Governance 是唯一跨项目接入层。
- [x] 前端服务状态被规划为用户可见能力，区分 Runtime offline、Adapter degraded / blocked、data_service auth_required / unreachable / version_mismatch、source build failed / degraded / forgotten。
- [x] B 前端不直接探测 data_service；状态经 `runtimeClient.ts` V2 knowledge section 调用 Navia Runtime `/v1/knowledge/status` 或同等 V2 Adapter 聚合接口。
- [x] 本地文件导入默认关闭，必须显式授权。
- [x] 删除 / 遗忘通过 before / after query 证明。
- [x] No-Go 覆盖 V2 ready、默认本地读取、Web Research、PPT、Deep Research、多 Agent、产品浏览器自动操作、媒体理解。
- [x] V2-1..V2-6 子阶段 evidence 被记录为实现基线，不被误用为 V2-7 真实数据验收通过。
- [x] V2-7 独立证据包已生成并通过；`v2-7-acceptance-blocked-audit.md` 仅作为过期阻塞记录保留。

## 6. 实现阶段状态

```text
V2-0 已完成：实现前审计、合同草案、data_service spike、生命周期和验收 schema 基线。
V2-1 已完成：V2 Adapter / Governance skeleton。
V2-2 已完成：SaveToKnowledgeCard、ServiceStatusBanner 和当前页保存入口。
V2-3 已完成：data_service HTTP 受控边界适配，默认禁用真实外部服务。
V2-4 已完成：Knowledge Workspace shell。
V2-5 已完成：Ask with Sources / Knowledge Graph preview。
V2-6 已完成：PermissionRoot / ForgetSource mock governance UX。
V2-7 已完成：真实数据验收和出门审计。
```

V2-7 已补齐的出门证据：

- `sample-manifest.json`：至少 24 source，且 source corpus 与 query / operation scenarios 分开统计。
- `report.json`：通过 `v2_memory_report.schema.json` 和 semantic validator。
- `acceptance-report.html`：中文、人类可读、含截图证据。
- `screenshots/`：覆盖保存、服务状态、source detail、Ask with Sources、Graph / Trace、Permission、Forget。
- `prd-review.md` 与 `false-green-audit.md`：无 fatal / major。

V2-7 证据通过后允许声明 `V2 Memory / Personal Knowledge Base passed planning-aligned local knowledge acceptance`；仍不得声明 V2 implemented、V2 ready、默认本地文件读取或 RAG ready。

后续 data_service 产品化适配或更完整个人知识库阶段，必须重新制定开发与验收计划，再进入代码开发；每个子阶段完成后必须有 PRD review、false-green audit 和真实数据或真实浏览器证据。

当前后续产品化阶段已经独立登记为：

```text
docs/active/project/stage-gates/v2-external-brain-productization.md
```

该 stage gate 只覆盖 Side Panel Quick Surface 与 Extension Workspace Page 的双容器产品化，不重新打开 V2-7 通过结论。自动化知识维护、自动文件整理、摘要刷新、遗忘候选和 `Knowledge Dream Cycle` 仍属于 V2.x 研究路线，必须另建 stage gate；当前 Forget 继续由用户主动发起。

## 7. 出门证据

当前同步与 V2-7 出门证据：

```text
docs/active/project/design/v2-memory-personal-knowledge-base-gap.md
docs/active/project/design/v2-memory-personal-knowledge-base-gap.drawio
docs/active/project/design/v2-memory-personal-knowledge-base-development-acceptance-plan.md
docs/active/project/design/v2-memory-personal-knowledge-base-readiness-audit.md
docs/active/project/evidence/v2_memory_personal_knowledge_base/
```
