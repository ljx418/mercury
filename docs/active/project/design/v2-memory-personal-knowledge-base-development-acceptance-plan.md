# V2 Memory / Personal Knowledge Base Development And Acceptance Plan

本计划用于记录 V2-1..V2-6 mock-first / controlled-boundary 实现基线，以及已经完成的 V2-7 真实数据验收。V2-7 的要求继续作为后续产品化回归基线，不再描述为待完成工作。

当前放行口径：

```text
V2-7 real-data acceptance: PASSED.
Allowed claim: V2 Memory / Personal Knowledge Base passed planning-aligned local knowledge acceptance.
No-Go for V2 implemented, V2 ready, complete external brain, default local-file reading or RAG ready.
```

## 1. 文档阶段计划

| 子阶段 | 目标 | 出门条件 |
|---|---|---|
| `V2-DOC-0` | 文档门禁 | PRD、架构、开发计划、验收计划、stage gate、gap、drawio 阶段名一致 |
| `V2-DOC-1` | data_service 候选基线评估 | 明确可复用能力、不可直接复用能力和 HTTP / MCP / CLI 边界 |
| `V2-DOC-2` | V2 Adapter / Governance 合同冻结 | MemoryCandidate、KnowledgeSource、KnowledgeItem、EvidenceRef、Workspace、PermissionRoot、ForgetRequest 已定义为目标合同 |
| `V2-DOC-3` | 前端组件、服务状态和路由规格冻结 | 8 个原型组件以及 ServiceStatusBanner、DataServiceStatusCard、KnowledgeBuildStatus 均有用户操作、状态、失败和验收证据 |
| `V2-DOC-4` | 验收矩阵和 false-green 防线冻结 | 保存、授权、问答、trace、graph、delete / forget 均有验收场景 |
| `V2-DOC-5` | 文档审计 | 无 fatal / major 文档缺口 |

## 2. 实现阶段状态

| 子阶段 | 状态 | 开发内容 | 验收内容 |
|---|---|---|---|
| `V2-0` | 已完成基线 | 实现前审计 | 合同 schema、OpenAPI、错误码、data_service spike、Workspace 承载形态、验收 schema、semantic validator 和生命周期 ADR 已作为基线输入 |
| `V2-1` | 已完成基线 | V2 Adapter / Governance skeleton | Adapter 接收 MemoryCandidate，输出受控调用计划和错误语义 |
| `V2-2` | 已完成基线 | SaveToKnowledgeCard / ServiceStatusBanner | 当前页可主动保存；保存前显示 Runtime / Adapter / data_service 状态，保存后显示 ingest / build / trace 状态 |
| `V2-3` | 已完成基线 | data_service 受控边界适配 | 只经 HTTP boundary 写入、查询、trace；真实 data_service 默认禁用；不得读写内部 workspace |
| `V2-4` | 已完成基线 | Knowledge Workspace shell | workspace switcher、source library、source detail、trace drawer、service status banner 可用 |
| `V2-5` | 已完成基线 | Ask with Sources / Knowledge Graph | 回答和图谱节点有 evidence refs 或 degraded reason |
| `V2-6` | 已完成基线 | PermissionRoot / ForgetSource | 显式授权、撤销、删除 / 遗忘和 before / after query 验证 |
| `V2-7` | 已完成 | 真实数据验收 | 独立 evidence package、HTML report、PRD review、false-green audit 已生成并通过，fatal / major 为零 |

## 2.1 当前实现实体和 V2-7 完成记录

| 子阶段 | 目标文件 / 目录 | 目标职责 |
|---|---|---|
| `V2-1` | `services/local-runtime/navia_runtime/modules/memory/` | 新增 MemoryCandidate、KnowledgeSource、KnowledgeItem、EvidenceRef、Workspace、PermissionRoot、ForgetRequest、ForgetVerification、KnowledgeOperation、data_service adapter |
| `V2-1` | `services/local-runtime/navia_runtime/app.py` | 新增 `/v1/knowledge/*` 路由；避免混淆产品 V2 和历史 `navia_runtime/v2/` evidence 工具 |
| `V2-2` | `apps/chrome-extension/src/runtimeClient.ts` V2 knowledge section | 封装 Runtime knowledge API，禁止 B 直连 data_service |
| `V2-2` | `apps/chrome-extension/src/modules/knowledge_workspace/ServiceStatusBanner.tsx`、`DataServiceStatusCard.tsx`、`KnowledgeBuildStatus.tsx` | 展示 Runtime / Adapter / data_service / source build 状态和用户下一步动作 |
| `V2-2` | `apps/chrome-extension/src/contentBridge.ts` | 增加保存入口和 trace marker 状态，不做自动保存 |
| `V2-2` | `apps/chrome-extension/entrypoints/sidepanel/main.tsx` | 挂载 V2 保存入口和 Workspace 路由，不破坏 V1 Chat / Debug / Settings |
| `V2-4` | `apps/chrome-extension/src/modules/knowledge_workspace/` | 新增 8 个 Knowledge Workspace 组件 |
| `V2-7` | `apps/chrome-extension/e2e/chrome-v2-memory-personal-knowledge.mjs` 或同等 headless runner | 真实 Chrome 或 headless 验收保存、授权、问答、trace、graph、forget |
| `V2-7` | `docs/active/project/evidence/v2_memory_personal_knowledge_base/` | 独立 V2 证据包 |

## 3. V2-7 已执行验收矩阵

V2-7 已按以下冻结口径完成真实数据验收；后续回归不得降低这些口径：

Source corpus：

- 12 个真实网页保存样本。
- 6 个显式授权本地文档样本。
- 6 个 notes / markdown / other supported source 样本。

Query and operation scenarios：

- 6 个混合 workspace / cross-source query 样本。
- 12 个 Ask with Sources 样本，必须包含 evidence refs。
- 8 个 Knowledge Graph / Source Trace 样本。
- 6 个 PermissionRoot 授权 / 撤销样本。
- 6 个 ForgetSource 删除 / 遗忘和再次查询验证样本。
- 4 个服务状态样本，覆盖 Runtime offline、Adapter blocked / degraded、data_service auth_required / unreachable / version_mismatch、source build failed / degraded。

每个样本必须记录：

```text
workspace_id
source_id
source_type
frontend_inferred_runtime_status
adapter_status
data_service_status
ingest_status
build_status
trace_status
evidence_refs
permission_state
forget_state
query_result
degraded_reason
screenshot_paths
```

注意：Runtime offline 必须由前端 transport failure / timeout 推导。Runtime 离线时 `/v1/knowledge/status` 不可达，不能把 Runtime offline 写成 Runtime 在线返回的成功响应。

V2-7 已覆盖以下服务状态样本；后续产品化回归必须继续覆盖：

- Runtime offline：UI 不空白，提示启动 Runtime / 重试 / 打开 Debug。
- Adapter degraded 或 blocked：UI 说明 V2 Adapter / Governance 未就绪或策略阻止，不误写为 data_service 错误。
- data_service auth_required / unreachable / version_mismatch 至少一种：UI 提供配置、重连或升级提示。
- source build failed / degraded：Source detail 和 SaveToKnowledgeCard 显示失败原因、重试或降级路径。

## 3.1 V2-7 已完成出门产物

以下证据已经生成并通过；它们是 V2 planning-aligned local knowledge acceptance 的权威 active 证据：

```text
docs/active/project/evidence/v2_memory_personal_knowledge_base/sample-manifest.json
docs/active/project/evidence/v2_memory_personal_knowledge_base/report.json
docs/active/project/evidence/v2_memory_personal_knowledge_base/acceptance-report.html
docs/active/project/evidence/v2_memory_personal_knowledge_base/screenshots/
docs/active/project/evidence/v2_memory_personal_knowledge_base/prd-review.md
docs/active/project/evidence/v2_memory_personal_knowledge_base/false-green-audit.md
```

V2-7 已使用以下冻结合同与语义校验；重新生成证据时必须继续验证：

```text
docs/active/project/contracts/v2_memory_sample_manifest.schema.json
docs/active/project/contracts/v2_memory_report.schema.json
docs/active/project/design/v2-memory-personal-knowledge-semantic-validator.md
```

真实 data_service 产品化前仍必须复核 Adapter 路线：

| 路线 | 适用条件 | 验收 |
|---|---|---|
| MockKnowledgeServiceAdapter first | data_service spike 未完成或能力缺口较大 | deterministic fixtures、error fixtures、status fixtures、forget verification fixtures |
| data_service adapter first | data_service API、auth、版本和删除语义全部锁定 | adapter spike report 和真实 API mapping 全部通过 |
| Hybrid mock + spike | 希望前后端并行 | mock 合同不得偏离 spike 后冻结的 OpenAPI / schema |

## 4. 固定 No-Go

- 默认读取本地文件。
- 默认扫描目录。
- B 前端直接读写 data_service workspace。
- B 前端直接探测 data_service health 或绕过 Runtime / V2 Adapter 展示服务状态。
- Runtime offline、Adapter blocked、data_service unreachable、source build failed 被合并成同一个 generic error。
- 用 V2-1..V2-6 mock-first 子阶段 evidence 替代已通过的 V2-7 真实数据验收，或用 V2-7 证据冒充独立 Workspace Page 产品化证据。
- cross-source query 被计入 source corpus。
- evidence_refs 仅检查非空，不验证语义支撑。
- data_service console 冒充 Navia 产品 UI。
- 无 evidence refs 的跨来源回答显示为成功。
- 删除 / 遗忘只隐藏 UI 卡片。
- 用原型图冒充实现截图。
- 当前实现基线声明 V2 implemented 或 V2 ready。
- Web Research、PPT、Deep Research、多 Agent、产品浏览器自动操作、语音、桌宠或媒体理解 ready。

## 5. 基线同步验收命令建议

```bash
python3 - <<'PY'
import xml.etree.ElementTree as ET
ET.parse('docs/active/project/design/v2-memory-personal-knowledge-base-gap.drawio')
print('drawio xml ok')
PY

rg -n "V2 implemented|V2 ready|默认读取本地文件|Web Research ready|PPT ready|Deep Research ready" docs/active/project
```

`rg` 命令若命中，必须人工确认命中均为 No-Go 或禁止声明语境。
