# Navia / 伴航 V1 开发计划大纲

> 2026-09-14 V2-PX 当前状态：T02.5 是唯一生产正输入；T03 R3 与 T04 R4 均已取得独立实现出门限定通过。T04 独立审计为 Fatal 0/Major 0/Minor 1。当前已完成 T04.1 全量重跑修复文档与 PX-6 machine/human/final 两阶段文档、Schema 和负例候选；外部文档审查及用户另行代码授权前不得实施。Human Review、G7、final 仍 pending/pending/false，PX-5/PX-6/RKM 均未通过。

> 2026-09-10 `DOC-Closure`：当前只允许细化D01..D09需求和验收义务，不表示T05/RKM-0已开始。T01..T04仅原PX修复，完成PX-6、获得用户代码批准且T05实施前审计Fatal=0/Major=0后，才实施T05..T10 RKM增量；不允许从文档阶段分叉并行实施。RKM-1保留真实DS协议spike但不冒充UI E2E；T04/T10独立审查者轮换、证据目录隔离，见详细开发计划5。

> 2026-09-09 新增V2-RKM文档规划：先完成原R1->R2->R3->R4->PX-6，再RKM-0合同/原型、RKM-1真实适配、RKM-2持久问答、RKM-3对话记忆、RKM-4可逆维护、RKM-5全量出门。DOC-Closure及实施任务T01..10的目标体验见 [详细开发计划](design/v2-real-knowledge-maintenance-development-plan.md)。R1仅后端限定通过；当前用户只批准文档，不批准生产开发或云调用。

> 2026-09-10风险再核查：RC-01..04补齐维护运行/日程、turn事务outbox/授权游标、离线撤销控制面、Forget与restore/备份优先级。T05先冻结合同和故障负例，T07..09按详细计划分别实现，T10全量重跑；当前不执行代码、迁移或模型调用。

> 本轮多轮独立审查：RKM详细开发6已拆T01..10及D01..09；验收9逐卡AC01..10对应。原PX卡不依赖后续RKM合同，T05产出合同而非先验要求产物；后续阶段依赖实际冻结版本。顶层必需断言固定39条（S01..14、S-01..16、RC六条、IR三条），G-1..G-7均在合同/ADR/验收中给出确定性处置；用户只批准文档。

> 2026-09-09 当前PX修复顺序：R0合同审计 -> R1 Runtime权限/前端 -> R2原始证据 -> R3共享校验 -> R4隔离快照复验 -> PX-6人工。每步独立记录验收与PRD检视，不跨越未关闭Major。执行细则见 [修复执行合同](design/v2-px-5-repair-execution-contract.md)。用户已批准此计划，尚未验收完成。

版本：V1.0 Development Plan Baseline
日期：2026-05-31

---

## 1. 开发总原则

V1 开发必须坚持：

```text
先底座，后 PRD 页面内体验。
先可控，后智能。
先单 Session，后长期记忆。
先 Headless Runtime，后多端 UI。
先状态机和监督，后复杂任务执行。
```

V1 不允许在开发过程中临时扩大到：

- MCP。
- Skill。
- 长期记忆。
- 完整 RAG。
- 多 Agent。
- 浏览器自动操作。
- 本地文件默认搜索。
- 深度研究。
- PPT 生成。
- 桌面宠物。

V1 后续开发必须执行阶段门禁：

- 每个子阶段开始前，先基于总 PRD 制定单独开发计划和验收标准。
- 每个子阶段开始前，必须输出审计意见，并闭环所有致命或重大规格偏差和 false-green 风险。
- 每个子阶段完成后，必须使用真实数据完成端到端验收。
- 每个子阶段完成后，必须做 PRD 规格复检。
- 验收失败时不得进入下一阶段，必须打回开发计划阶段重新思考并执行。
- Codex 自动完成开发、验收、审计和文档同步；人类只处理高风险确认。

---

## 2. 阶段总览

```text
V1.0-0：Contracts & Runtime Skeleton
V1.0-A：AgentCore Baseline
V1.0-B：状态机与可观测
V1.0-C：Governance / Budget Supervisor
V1.0-D：Chrome 插件页面内交互壳与 PageContext
V1.0-E：网页内 AI 双轨面板与伴读工具
V1.0-F：PRD A-F 布局状态与 Resize
V1.0-G：Session 质量与恢复
V1.0-H：V1 Closure / Regression / Documentation
```

### 2.1 首轮规划落地范围

当前项目仍处于规划阶段，第一轮只要求落盘设计文档，不创建工程代码。

首轮底座实施计划锁定为 V1.0-0/A/B/C：

- V1.0-0：Contracts & Runtime Skeleton，冻结 API / Event / State / Tool / Budget / Error / ID 合同。
- V1.0-A：Contract-First Python Local Runtime + AgentCore 最小闭环。
- V1.0-B：完整状态机、事件流、Trace、Mermaid 状态图。
- V1.0-C：Budget / Permission / Context / File Query / Approval 的治理底座。

这不是 V1 complete 的范围。V1 complete 必须继续完成 V1.0-D/E/F/G，并交付一个可在 Chrome 浏览器安装的插件形态，让用户在普通网页内通过悬浮球展开 AI 双轨面板，基于当前网页进行基础文字对话。

首轮底座暂不进入 V1.0-D/E/F/G：

- 不创建 Chrome 插件工程，但记录 WXT + React + TypeScript + Content Script 注入式页面内交互为 V1 插件基线。
- 不接 FunASR；语音输入不阻塞 Chrome 文字对话主链路。
- 不接真实本地模型。
- 不实现 Mindmap 模型。
- 不做长期记忆、RAG、MCP、Skill、多 Agent、浏览器自动操作、桌宠或云化。

### 2.2 V1 complete 的用户可见目标

V1 结束时，用户必须能在自己的 Chrome 浏览器中完成：

```text
安装 Navia Chrome 插件
-> 打开任意网页
-> 页面边缘出现可移动悬浮球
-> hover 悬浮球出现小长条
-> 点击小长条展开网页内 AI 双轨面板
-> 插件连接 127.0.0.1 Local Runtime
-> Runtime 接收当前网页 PageContext
-> 用户输入自然语言问题
-> AgentCore 基于当前网页返回基础回答或摘要
-> 对话、工具调用、事件和结果可在 Session Trace 中追踪
```

V1 的最低可演示能力：

- Chrome 插件可通过 unpacked extension 方式安装。
- 页面内悬浮球默认态、hover 态、展开态、半屏态、覆盖态、收起态必须可验证。
- 网页内 AI 面板可展示 Runtime 连接状态。
- Runtime 未启动时，网页内 AI 面板必须给出明确提示。
- 用户可以进行文字对话，不依赖语音。
- 当前网页的 `title`、`url`、`domain`、`headings`、`cleanedText` 可进入 Runtime。
- 至少支持“总结这篇文章”和“基于当前页面回答问题”两类对话。
- 每次对话都产生 `session_id`、`turn_id`、AgentEvent、ToolCallRecord 和 Trace。
- 默认不读取本地文件，不联网搜索，不执行浏览器自动操作。

### 2.3 阶段门禁总流程

每个 V1 子阶段都必须产生独立 stage-gate 文档：

```text
docs/active/project/stage-gates/v1.0-x-<stage-name>.md
```

阶段执行顺序固定为：

```text
PRD 规格检视
-> 单独制定开发计划和验收标准
-> 预审计
-> 闭环致命/重大审计意见
-> 实质开发
-> 真实数据端到端验收
-> PRD 规格复检
-> 阶段放行或打回
```

如果预审计或验收复检发现重大偏差、致命风险或虚假验收风险，必须停止进入下一阶段，并找人类确认或回到开发计划阶段修正。

---

## 3. V1.0-0：Contracts & Runtime Skeleton

### 3.1 目标

在写业务 loop 之前冻结 V1 最小合同，避免 V1.0-A 先写临时结构、V1.0-B/C 再返工。

### 3.2 范围

必须定义：

- API response envelope。
- ErrorCode enum。
- State enum。
- Transition table schema。
- AgentEvent envelope。
- Session / Turn / Message schema。
- ToolSpec / ToolCallRecord / ToolResult schema。
- BudgetLedger / BudgetCost / TurnBudget schema。
- ID 生成与关联规则。
- `/v1/chat/stream` SSE event protocol。
- EventStore 与 EventStream 接口边界。
- Store interface，包括 SessionStore、EventStore，可先有 InMemory 实现。

必须明确：

- 一个 user message 触发一个 turn。
- 每个 turn 必须有 `turn_id`、`trace_id`、`request_id`。
- 每个 tool call 必须关联 `session_id`、`turn_id`。
- 每个 artifact 必须关联 `turn_id` 和 `tool_call_id`，并有 `source_page_id` 或明确 `source=null`。
- 执行中事件必须关联 `turn_id`。
- `/v1/chat/stream` 在 V1 使用 SSE，返回 `text/event-stream`。
- `EventStore` 用于持久化 trace/replay，`EventStream` 用于实时推送 UI，二者不得合并成单一临时流。

暂不实现：

- 真实网页抽取。
- 真实模型调用。
- Chrome 插件。
- 完整审批 workflow。
- SQLite 复杂恢复。

### 3.3 交付物

- Contract definitions。
- 最小 Runtime skeleton。
- Schema validation tests。
- State transition table 的最小可生成 Mermaid 输出。
- API envelope / error / SSE 示例。

### 3.4 验收

- 所有 schema 有基础单测或 schema validation。
- 示例 AgentEvent 可通过 schema validation。
- 示例 ToolResult 可通过 schema validation。
- 示例 API success/error envelope 可通过 schema validation。
- Mermaid 状态图可由 transition table 生成空图或基础图。
- `/v1/chat/stream` 的 SSE 事件格式被文档和测试固定。

---

## 4. V1.0-A：Contract-First AgentCore Baseline

### 4.1 目标

建立 Local Runtime 和 AgentCore 最小闭环。

实现基线：

- Runtime 主栈为 Python。
- API Gateway 建议采用 FastAPI 风格实现。
- V1.0-A 先用 rule-based IntentRouter，保留 ModelAdapter 接口。
- 存储可先使用内存实现验证合同，但接口必须可替换为 SQLite / JSONL EventLog。
- AgentCore 一轮最小 loop 必须通过 `StateMachine.transition()` 执行，不允许在 `TurnRunner` 里手写临时状态字符串。
- ToolExecutor 从第一天就必须经过 `PreToolUse` / `PostToolUse` hook；A 阶段可用安全 mock tool 的 DefaultAllowPolicy 和高风险工具 DefaultDenyPolicy。
- `EventStore` 和 `EventStream` 必须同时有接口；A 阶段实现可先用 InMemory / JSONL。

### 4.2 范围

必须实现：

- Local Runtime 启动。
- `/v1/health`。
- `/v1/models/status`。
- `/v1/sessions`。
- `/v1/chat/stream` SSE。
- SessionStore 最小实现。
- MessageStore 最小实现。
- EventStore 最小实现。
- EventStream 最小实现。
- ToolRegistry 最小实现。
- StateMachine 主路径最小实现。
- PreToolUse / PostToolUse 空实现。
- IntentRouter mock / rule-based。
- AgentCore 一轮最小 loop。
- AgentEvent 最小输出。
- Mock `summarize_page` / `answer_from_page` 工具。

暂不实现：

- Chrome 插件。
- FunASR。
- 真正本地模型。
- Mindmap 模型。
- 长页面 chunk。
- 完整异常路径。
- 完整 BudgetSupervisor。

### 4.3 交付物

- `services/local-runtime` 可运行。
- `AgentRuntime`。
- `AgentLoop`。
- `SessionStore`。
- `EventStore`。
- `EventStream`。
- `EventBus`。
- 最小 `StateMachine`。
- 最小 governance hooks。
- 基础单元测试。

### 4.4 验收

- Runtime 可启动。
- 可创建 session。
- 可写入 user / assistant / tool / event message。
- 可执行一轮 `user -> intent -> tool -> response`。
- 可输出 AgentEvent 流。
- 一轮 chat 必须产生 `turn_id`。
- `/v1/chat/stream` 必须输出 `state.transition`、`intent.detected`、`tool.started`、`response.delta`、`response.done`。
- Trace API 能看到同一个 turn 的事件。
- ToolExecutor 不能绕过 PreToolUse。
- `read_local_file`、`shell`、`browser_automation` 等高风险工具在 A 阶段默认 deny。

---

## 5. V1.0-B：状态机与可观测

### 5.1 目标

Agent 状态机成为正式 runtime contract。

### 5.2 范围

必须实现：

- StateMachine。
- TransitionTable。
- Mermaid renderer。
- 非法 transition 拒绝。
- `INVALID_TRANSITION` error。
- `state.transition` event。
- AgentEvent schema validation。
- Trace export。
- Mermaid graph snapshot test。
- `/v1/agent/state`。
- `/v1/agent/state-machine/mermaid`。
- `/v1/sessions/{session_id}/trace`。

### 5.3 状态路径

主路径：

```text
idle -> observing_page -> waiting_user -> detecting_intent -> planning -> budget_checking -> running_tool -> validating_result -> streaming_response -> persisting_turn -> waiting_user
```

异常路径：

```text
intent_unknown -> fallback_reply -> persisting_turn
budget_exceeded -> budget_exhausted -> persisting_turn
tool_failed -> error -> waiting_user
result_invalid -> repairing_result -> streaming_response/error
```

### 5.4 交付物

- 状态机代码。
- Mermaid 状态图输出。
- Event schema。
- Trace API。
- 状态机测试。
- Event schema validation tests。
- Trace export tests。

### 5.5 验收

- Transition table 存在。
- 非法 transition 被拒绝。
- 每个 transition 产生 event。
- Mermaid 图由代码生成。
- 测试覆盖主路径和异常路径。
- 非法 transition 必须返回或抛出 `INVALID_TRANSITION`。
- Mermaid 图和 transition table 一致。
- Trace 可按 `turn_id` 过滤。

---

## 6. V1.0-C：Governance / Budget Supervisor

### 6.1 目标

先把 Agent 管住，防止工具、上下文、token 消耗失控。

### 6.2 范围

必须实现：

- BudgetSupervisor。
- ToolPermissionSupervisor。
- ContextSupervisor。
- FileQuerySupervisor 默认关闭。
- ApprovalGate 最小实现。
- PreToolUse hook。
- PostToolUse hook。
- BudgetLedger。
- Budget check 必须发生在 `tool.started` 前。
- Permission check 必须发生在 `tool.started` 前。
- `approval_required` 只产生事件和记录，不执行工具 side effect。

默认预算：

```text
maxModelCalls = 3
maxToolCalls = 5
maxInputTokens = 12000
maxOutputTokens = 3000
maxContextBytes = 256KB
maxRuntimeMs = 60000
maxRetries = 1
```

默认权限：

```text
allow: read_current_page, summarize_page, answer_from_page, explain_selection, generate_mindmap, asr_transcribe
deny: read_local_file, search_local_workspace, shell, browser_click, browser_automation, network_crawl
```

### 6.3 交付物

- Governance 模块。
- BudgetLedger 存储。
- Tool policy 配置。
- Approval event。
- 并发/幂等基础测试。

### 6.4 验收

- TurnBudget 生效。
- 超预算进入 `budget_exhausted`。
- `read_local_file` 默认禁用。
- 工具调用前经过 policy check。
- 工具调用后记录结果。
- high-risk 工具审批前不得执行 side effect。
- `maxToolCalls=1` 时第二个工具不得产生 `tool.started`。
- `maxRetries=1` 时不得出现第三次重试。
- `read_local_file` deny 时不得产生 side effect。
- high-risk tool 审批前 `ToolCallRecord.status` 必须是 `denied` 或 `waiting_approval`，不得进入 `running`。

---

## 7. V1.0-D：Chrome 插件页面内交互壳与 PageContext

### 7.1 目标

打通当前网页到 Local Runtime 的上下文链路，并交付符合 `docs/active/project/interaction-prd/窗口交互_PRD.md` 的页面内交互入口。

### 7.2 范围

必须实现：

- Chrome extension scaffold。
- Unpacked extension 安装说明。
- Background Worker 作为消息桥。
- Content Script 页面抽取。
- Content Script 注入页面内交互容器。
- Shadow DOM 或等价 CSS 隔离方案。
- 页面边缘悬浮球默认态。
- hover 高亮与伸出小长条。
- 点击小长条展开网页内 AI 面板。
- 默认窄距面板约 `440px`。
- PageContext 合同。
- `/v1/page/context`。
- Runtime 记录 activePage。
- Runtime detection：未启动、连接失败、Origin 被拒绝时 UI 可解释。

Chrome Side Panel 可作为调试入口保留，但不得作为 V1.0-D 交互验收通过条件。

### 7.3 PageContext 字段

必须包含：

- pageId。
- url。
- title。
- domain。
- capturedAt。
- contentHash。
- headings。
- selectedText optional。
- visibleText optional。
- cleanedText optional。

### 7.4 交付物

- Chrome 插件可加载。
- Chrome 插件可通过 unpacked extension 安装到开发者 Chrome。
- 普通网页内可出现悬浮球。
- 悬浮球 hover 后出现小长条。
- 点击小长条后可展开网页内 AI 面板。
- 当前网页信息可显示。
- PageContext 可提交 Runtime。
- Session activePage 可更新。
- Runtime 未启动时，网页内 AI 面板展示启动提示，不出现空白页。

### 7.5 验收

- 开发者可按 README 在 Chrome 中安装 unpacked extension。
- 打开普通网页后，页面边缘出现悬浮球。
- 悬浮球可上下拖动并贴边。
- hover 后出现高亮和小长条。
- 点击小长条展开网页内 AI 面板。
- 可显示当前 tab title / url / domain。
- Content Script 可抽取 headings / cleanedText。
- 切换页面后 PageContext 更新。
- Runtime 可记录 page.context.received event。
- Runtime 未启动时 UI 给出明确提示；Runtime 启动后可重新连接。

---

## 8. V1.0-E：网页内 AI 双轨面板与网页伴读工具

### 8.1 目标

实现 V1 用户可感知价值：在网页内 AI 双轨面板中完成摘要、问答、选区解释、Mindmap。

### 8.2 工具

必须实现：

```text
summarize_page
answer_from_page
explain_selection
generate_mindmap
```

### 8.3 摘要能力

支持：

- TL;DR。
- 结构化摘要。
- 要点式摘要。
- 项目启发摘要。

### 8.4 问答能力

要求：

- 优先基于当前 PageContext。
- 长页面按 chunk 检索相关上下文。
- 不知道就说明信息不足。
- 不默认联网搜索。
- 不默认读取本地文件。

### 8.5 Mindmap 能力

流程：

```text
PageContext -> Outline Extractor -> Mindmap Prompt Builder -> MindmapModelAdapter -> Mermaid Validator -> Repair Once -> Return
```

约束：

- 使用 Mermaid mindmap。
- 节点层级不超过 4。
- 节点数量默认不超过 40。
- 校验失败只修复一次。

### 8.6 交付物

- 网页内双轨面板。
- `/v1/chat/stream` SSE 消费。
- 伴读工具实现。
- Prompt 模板。
- Mermaid validator。
- ArtifactRecord。
- 前端预览。

### 8.7 验收

- “总结这篇文章”可用。
- 用户在网页内 AI 面板输入问题后可收到基于当前网页的回答。
- “解释选中内容”可用。
- “生成思维导图”可用。
- Mermaid 可预览。
- 每次 tool call 可在 trace 中看到。
- Artifact 可追踪到 sourcePageId。

---

## 9. V1.0-F：PRD A-F 布局状态与 Resize

### 9.1 目标

完成 `docs/active/project/interaction-prd/窗口交互_PRD.md` 中 A-F 状态的真实 Chrome 验收能力，补齐 resize、挤压、覆盖、收起恢复和响应式降级。

本阶段是 V1 complete 的前端体验硬门槛。

### 9.2 范围

必须实现：

- 状态 A：悬浮球默认态。
- 状态 B：悬浮球 hover 预展开态。
- 状态 C：窄距展开态，默认约 `440px`，挤压网页。
- 状态 D：半屏展开态，约 `50vw`，继续挤压网页。
- 状态 E：宽工作区覆盖态，超过 `52vw` 覆盖网页，最大 `80vw`。
- 状态 F：点击悬浮球或收起按钮后收起，网页恢复原始布局。
- 面板左边界 resize handle。
- 拖回 `<48vw` 后恢复挤压式。
- 记住最近吸附边和垂直位置。
- 视口 `<900px` 时禁用挤压式，降级为覆盖式或全屏侧栏。

暂不做：

- 划词菜单。
- 网页内右键菜单。
- 全局搜索框。
- 多窗口停靠。
- 站点级深度适配。

### 9.3 交付物

- 布局状态机。
- resize handle。
- 挤压/覆盖切换逻辑。
- 小视口降级逻辑。
- 真实 Chrome 交互验收脚本或手工验收记录。

### 9.4 验收

- 状态 A-F 全部可在真实 Chrome 普通网页复现。
- 窄距和半屏挤压不破坏网页主内容可读性。
- 覆盖态符合 `>52vw` 阈值，拖回 `<48vw` 后恢复挤压式。
- 收起后网页恢复原始布局。
- 面板拉伸或切换覆盖态时保持聊天滚动位置。
- 小视口 `<900px` 正确降级。

---

## 10. V1.0-G：Session 质量与恢复

### 10.1 目标

单 Session 历史做实，支撑后续 V2 Memory Plane。

### 10.2 范围

必须实现：

- SQLite 持久化。
- Message history。
- ToolCallRecord。
- ArtifactRecord。
- BudgetLedger。
- SessionCheckpoint。
- Session trace export。
- 网页内面板 refresh / reopen recovery。

### 10.3 交付物

- SQLite schema。
- Session restore API。
- Trace export。
- Checkpoint mechanism。
- Recovery tests。

### 10.4 验收

- 刷新网页或重新展开网页内面板后 Session 不丢。
- 对话、工具、Artifact、事件可追踪。
- 可导出 Session Trace。
- 长 Session 可 checkpoint。
- EventLog 可重建一次 turn。

---

## 11. V1.0-H：Closure / Regression / Documentation

### 11.1 目标

收口 V1，不扩大 ready 声明。

### 11.2 范围

必须完成：

- 全链路 smoke。
- 状态机测试。
- Governance 测试。
- Chrome 插件页面内交互验收。
- API 文档同步。
- README / 启动说明。
- Known limitations。

### 11.3 交付物

- Final V1 report。
- Acceptance evidence。
- Test results。
- Developer setup guide。
- User-facing limitations。

### 11.4 验收

本节为未来完整 V1 候选审计模板，不代表当前 V1-HR/CC 阶段已经允许声明完整 V1 complete。当前允许状态仍以 `V1 mainline closeout candidate passed automated acceptance.` 和 `Ready for V1 human product review and complete-candidate audit preparation.` 为边界。

只能声明：

```text
V1 complete: installable Chrome extension with PRD-aligned floating ball, embedded dual-track AI panel, push/overlay/resize interaction, and current-page companion reading through controlled single-session AgentCore is ready.
```

不能声明：

```text
personal knowledge base ready
long-term memory ready
RAG ready
deep research ready
PPT generation ready
browser automation ready
desktop pet ready
cloud sync ready
V2/V3/V4/V5 ready
```

---

## 12. V1.1：Frontend Fidelity / Figma Visual Alignment

### 12.1 目标

V1.1 是 V1.0 complete 之后的前端体验质量阶段。目标是在不重开 Runtime / AgentCore / API 合同的前提下，高保真还原 Figma Make 原型给出的“浏览器页面 + 浮动球 + 侧边插件面板 + 聊天区域”样式。

V1.1 成功后，后续开发者应能用真实 Chrome 和截图基线判断：当前页面内悬浮球与 AI 面板是否既满足 `docs/active/project/interaction-prd/窗口交互_PRD.md` A-F 交互状态，又在视觉上对齐 Figma 原型。

### 12.2 阶段拆分

```text
V1.1-A：Figma 视觉规格冻结
V1.1-B：前端结构与 visual token 重构
V1.1-C：高保真样式实现与状态补齐
V1.1-D：Playwright 截图基线与真实 Chrome 复验
V1.1-E：文档收口与出门评审
```

### 12.3 开发范围

必须完成：

- 将 Figma Make 资源清单中的 `MainLayout / MockPage / FloatingBall / Sidebar / ChatArea` 映射为真实注入面板的组件语义。
- 统一视觉 token：颜色、字体、轨道宽度、面板宽度、阴影、圆角、状态色、动画时间。
- 保留并高保真呈现 Runtime offline、PageContext missing、tool running、tool failure、Mermaid fallback、streaming response。
- 新增截图验收矩阵：默认态、hover 态、`440px` 展开态、`50vw` 半屏态、`>52vw` 覆盖态、小视口态。
- 更新 V1.1 stage-gate 与 gap drawio，记录当前架构、目标架构、差异、里程碑、验收门槛、出门条件。

明确不做：

- 不新增 Runtime API。
- 不改 AgentEvent / ToolResult / PageContext 合同。
- 不引入 MCP / Skill / RAG / 多 Agent / 浏览器自动操作。
- 不用 Chrome Side Panel 替代页面内悬浮球验收。
- 没有 Figma 截图或普通 Figma `/design` 节点时，不声明视觉高保真通过。

### 12.4 验收

V1.1 Go 条件：

- PRD A-F 状态在真实 Chrome 普通网页中仍全部通过。
- Playwright 截图基线覆盖关键状态并纳入验收记录。
- Figma 对照验收有截图或普通 Figma `/design` 节点作为基线。
- 页面内面板的 Runtime、PageContext、SSE、Mermaid、Session restore 链路不回退。
- drawio gap 文档完整反映目标架构、当前差异、开发计划、里程碑、验收门槛和出门条件。

V1.1 No-Go 条件：

- 只能 Side Panel 通过。
- 缺少视觉基线却声明高保真完成。
- 截图明显偏离 Figma 关键布局比例。
- 面板交互断裂，或网页布局无法恢复。
- Runtime / Trace / Session 链路因视觉重构断开。

---

## 13. V1.2：AI 伴读四模块架构深化

### 13.1 目标

V1.2 是 V1.1 前端体验对齐后的 AI 伴读架构深化阶段。目标是把当前“聊天”功能拆成四个清晰模块：

```text
A Page Perception / AgentCore Eyes
基于网页内容的流式渲染
基于网页内容的思维导图生成
CoreProvider + Adapter Layer 实现可替换 Core 接入和 ChatBox turn 编排边界
```

V1.2 不改变 V1 外部 API 合同，不扩大到 V2 知识库、RAG、长期记忆、多 Agent、浏览器自动操作、联网搜索、语音、桌宠、深度研究或 PPT 生成。V1.2 允许轻量 MCP / Skill / API Adapter 合同，但所有 Adapter 必须通过 D 模块 Adapter Layer 和 governance hooks 接入。

模块内部任务统一使用 `MODULE_VERSIONING.md` 中定义的编号。项目级 `V1.2-A` 表示 V1.2 阶段里的 A 模块工作；A 模块内部能力使用 `A-V1.x-*` 编号。当前继续使用 `A-V1.2` 作为 A 模块高质量网页感知阶段编号。

### 13.2 阶段拆分

```text
V1.2-0：AI 伴读合同与工作区冻结
V1.2-0R：Readiness Closure / ChatGPT audit package
V1.2-A：A Page Perception / AgentCore Eyes
V1.2-B：结构化数据、流式文本和 Mindmap 前端实时渲染
V1.2-C：基于结构化网页 JSON 的 Mindmap 生成与反跳来源
V1.2-D：CoreProvider + Adapter Layer、piAgentProvider 合同与 MCP / Skill / API Adapter 编排
V1.2-E：Integration Codex wiring、真实网页端到端验收与文档收口
```

### 13.3 开发范围

必须完成：

- 新增并维护 `design/v1.2-ai-reading-modular-architecture.md`。
- 新增并维护 `design/v1.2-ai-reading-workspace-partition.md`。
- 新增并维护 `design/v1.2-module-local-design-package.md`。
- 新增并维护 `design/v1.2-automation-readiness-gap.md`。
- 新增并维护 `design/v1.2-prd-coverage-matrix.md`。
- 新增并维护 `design/v1.2-integration-contract-matrix.md`。
- 新增并维护 `design/v1.2-ai-reading-automation-gap.drawio` 与 companion markdown。
- 新增并维护 `design/v1.2-readiness-closure-audit.md`，作为 V1.2 全量开工前的 ChatGPT 审计包和剩余开发验收计划。
- 新增并维护 `contracts/v1_2_adapter_contracts.md`。
- 新增并维护 `stage-gates/v1.2-0-ai-reading-contract-and-workspace-freeze.md`。
- 明确四模块职责、输入输出、边界和 No-Go 条件。
- 明确模块内部编号规则，所有 A 模块新增任务使用 `A-V1.x-*`，当前阶段继续使用 `A-V1.2`。
- 明确 A 模块是 AgentCore 的眼睛，负责感知和结构化事实，不负责推理、最终回答或工具编排。
- 明确每个模块的 `public-api.md`、`executable-contract.md`、`fixture-spec.md`、`test-and-evidence-plan.md`。
- 明确 A/C/D service 工作区、B app 工作区和禁止跨区修改规则。
- 明确 Integration Codex 的 wiring / E2E / 审计职责。
- 明确 D 模块以 CoreProvider + Adapter Layer 为主，不从零硬编码完整 AgenticLoop。
- 明确 piAgentProvider 是 V1.2 首选 CoreProvider，MockCoreProvider 是测试 fallback，FutureCoreProvider 是替换扩展点。
- 明确真实 piAgent 接入前必须锁定仓库、版本或 commit、license、运行时和工具调用模型。
- 保持 `/v1/page/context`、`/v1/chat/stream`、trace API 作为 V1 伴读主链路。
- 所有网页伴读工具必须消费真实 `session.activePage`。
- 所有工具必须返回 `ToolResult` envelope。
- 所有成功 D / Integration 工具必须创建 `ArtifactRecord`；A 页面感知模块只输出 page perception contracts 与 evidence files，不创建 artifact。
- 每个 artifact 必须关联 `sourcePageId`、`turnId`、`toolCallId`。
- Mermaid validation / repair 详情必须写入 tool 或 artifact metadata，不新增 ad-hoc event。
- 前端只维护展示态，不拥有 AgentCore 状态。
- MCP / Skill / API Adapter 必须注册到 D 模块 AdapterRegistry，不得由前端或 B 模块直接调用。
- piAgent 或其他 CoreProvider 不得直接写 ArtifactRecord、SSE、EventStore 或 UI，必须经 D Adapter Layer 映射。
- A/C/D 功能代码必须分别落在 `services/local-runtime/navia_runtime/modules/page_reading/`、`services/local-runtime/navia_runtime/modules/mindmap/`、`services/local-runtime/navia_runtime/modules/agent_loop/` 和 `services/local-runtime/navia_runtime/modules/adapters/`。
- B 功能代码必须落在 `apps/chrome-extension/src/modules/*_renderer/`。
- 既有 `apps/` 与 `services/` 入口文件只由 Integration Codex 做 wiring，不作为 A/B/C/D 模块长期工作区。
- V1.2 complete 只能由 V1.2-E Integration 阶段声明；A/B/C/D 单模块通过只代表模块 ready。

A 模块内部路线：

```text
A-V1.0-0：感知合同冻结
A-V1.0-1：文本 / DOM 结构识别
A-V1.0-2：图文网页识别
A-V1.0-3：OCR 识别规划
A-V1.0-4：表格 / 列表 / 代码块识别
A-V1.0-5：页面区域与信息密度识别
A-V1.1：High-Signal Page Perception 合同与 DOM baseline 能力
A-V1.2：Production Page Perception，高质量网页感知、结构化页面摘要、可反跳证据、Debug 可验证 JSON、100-page corpus gate
A-V1.12+：视频 / 直播等未来感知规划，不能声明为 A-V1.2 完成项
```

A-V1.0 阶段只允许规划 OCR、视频和直播的合同、边界与验收口径，不实现默认 OCR engine、视觉模型、视频流分析或直播流分析。任何 OCR / 视觉 / 媒体识别引擎执行都必须在未来通过 D Adapter Layer 和 governance 接入。

A-V1.2 默认组合路线：

```text
DOM baseline
+ extractor ensemble
+ A-owned schema normalization
+ SourceMap / jumpback
+ Quality Evaluator
+ DebugEvidenceBundle
+ 100-page corpus gate
```

A-V1.2 子阶段：

```text
A-V1.2-0：合同与目标冻结
A-V1.2-1：100-page 验收集
A-V1.2-2：主体内容识别
A-V1.2-3：噪声过滤与密度提升
A-V1.2-4：结构化页面摘要
A-V1.2-5：SourceMap 与反跳证据
A-V1.2-6：质量评估模型
A-V1.2-7：Debug JSON 证据包
A-V1.2-8：100-page 出门验收
```

建议完成：

- 在不改变外部行为的前提下，逐步把 `tools.py` 拆分为阅读工具、Mindmap 工具、ToolExecutor。
- 在不改变 public `TurnRunner` 入口的前提下，把 AgenticLoop 编排、SSE response 组织、artifact persistence 拆出内部边界。
- 把前端 Chat 渲染、Debug 面板、Artifact 渲染继续拆成独立模块。

明确不做：

- 不新增 V2 Memory Plane。
- 不新增 RAG 或知识库蒸馏。
- 不新增未受控 MCP / Skill 直连。
- 不新增多 Agent。
- 不新增浏览器自动点击、自动导航或联网搜索。
- 不把 Mindmap 视觉失败伪装成通过。
- 不默认接入 OCR、视觉模型、视频识别或直播识别引擎。

### 13.4 验收

V1.2 Go 条件：

- V1.2-0 自动化开发 readiness gate 已通过。
- V1.2-0R readiness closure audit 已通过 ChatGPT 审计，且无致命或重大规格偏差。
- 每个模块均有 public API、executable contract、fixture spec 和 evidence plan。
- PRD coverage matrix 中关键体验路径均有负责模块和证据路径。
- Integration contract matrix 已明确字段所有权和接线边界。
- V1.2 drawio gap 图谱可打开，且包含当前/目标架构差异、模块内部架构、公共 API、关键体验路径、开发验收、里程碑和出门条件。
- 真实网页可完成读取、总结、基于网页问答、Mindmap artifact 生成。
- `/v1/chat/stream` 可输出 state、intent、budget、tool、artifact、response、error 事件。
- trace 可按 `turn_id` 还原一次完整伴读 turn。
- 缺少 activePage 时返回 `PAGE_CONTEXT_REQUIRED`，且不产生 `tool.started` 或假 artifact。
- 前端未知 SSE event 不崩溃。
- Mermaid render failure 有 source fallback。
- Mindmap 节点 source map 可追溯到 A 模块的 paragraph/chunk。
- A/C/D service 工作区与 B app 工作区隔离规则已冻结。
- 四模块边界已在设计文档、开发计划和验收计划中同步。
- A 模块内部编号 `A-V1.x-*` 已在 PRD、开发计划、验收计划和 stage gate 中同步；当前阶段继续使用 `A-V1.2`。
- A-V1.2 drawio gap 图谱包含当前/目标差异、目标架构、公共 API 调用关系、关键体验路径、开发验收计划、里程碑、验收门槛和出门条件。
- A-V1.2 100-page corpus gate 已冻结为完成声明硬门槛，少于 100 个最终计入网页不得声明 A-V1.2 完成。
- OCR、视频、直播识别仅作为规划能力登记，未被声明为 V1.2 完成项。

V1.2 No-Go 条件：

- 任一模块缺少 public API、fixture spec 或 evidence plan。
- PRD coverage matrix 缺少主路径覆盖。
- Integration Codex 为了联调重写模块业务逻辑。
- 工具未消费真实 `session.activePage`。
- 前端绕过 Runtime 直接生成总结、回答或 Mindmap。
- 成功工具没有 artifact。
- artifact 缺少 `sourcePageId`、`turnId` 或 `toolCallId`。
- 只有实时事件，没有 EventStore trace。
- 新增事件类型但未更新合同和测试。
- MCP / Skill / API 绕过 D 模块。
- piAgent 或其他 CoreProvider 绕过 D Adapter Layer。
- piAgent 具体依赖未锁定就进入真实 provider 集成。
- PRD coverage matrix 仍是 placeholder 却声明 V1.2 complete。
- 引入长期记忆、RAG、多 Agent、浏览器自动操作或其他 V1 禁止范围能力。
- A 模块绕过 D Adapter Layer 调用 OCR、视觉模型、视频流或直播流识别能力。
- A-V1.2 使用 URL-only、`planned` 或 `annotated` gold 页面计入最终通过率。
- A-V1.2 Debug JSON 不能解释 pass / degraded / fail，却声明质量评估通过。

### 13.5 当前阶段：A 优化、C 补强与 AC 联动

本阶段承接当前实现事实：

```text
A：已有 StructuredPageContext、高信号感知、107-page corpus evidence
C：已有 deterministic Mermaid generator、validator、repair once、nodeSourceMap
D：已有 CoreProvider / Adapter Layer 和 c_mindmap_adapter wiring
B：以 Side Panel / Debug 承载当前用户验收
```

阶段目标不是重新规划 V1.2 全量模块，而是把 A 和 C 从“各自可用”推进到“主链路可联动”：

```text
V1.2-AC-0：阶段合同与验收冻结
V1.2-AC-1：A high-signal perception bundle 进入 Runtime 主链路
V1.2-AC-2：A Debug JSON 可视化与质量状态可见
V1.2-AC-3：C digest-first Mindmap 生成
V1.2-AC-4：C nodeSourceMap 对齐 A SourceRef
V1.2-AC-5：AC 端到端联调，读取网页 -> A JSON -> C Mermaid -> Debug/Artifact 展示
V1.2-AC-6：真实网页验收、PRD 复检、false-green audit
```

开发计划：

| 子阶段 | 开发重点 | 验收重点 |
|---|---|---|
| `V1.2-AC-0` | 冻结 `PerceptionBundle` 在 Runtime / Debug / C 输入中的字段映射，不新增公共事件类型 | 文档、schema、测试计划无重大规格偏差 |
| `V1.2-AC-1` | `/v1/page/context` 在保持旧 activePage 兼容的同时产出 high-signal perception bundle | 真实 HTML fixture 和 Chrome PageContext 均能返回 structured + highSignal + digest + sourceMap + quality |
| `V1.2-AC-2` | Debug 页展示 A JSON 和 quality state | 人类可快速判断 A 是否提取出高质量结构化内容 |
| `V1.2-AC-3` | C 支持优先消费 `PerceptionDigest.items`，headingTree 仅 fallback | 同一页面的 mindmap 节点来自 digest item，且节点数、层级、标签受限 |
| `V1.2-AC-4` | C `nodeSourceMap` 绑定 A `SourceRef` | 每个主要节点具备 sourceRefId、textQuote/fallbackText、paragraphId/chunkId |
| `V1.2-AC-5` | D adapter 以 ToolResult / Artifact 形式串起 A/C，不让 A/C 写 EventStore | `/v1/chat/stream` 输出 tool、artifact、response 事件；artifact 可追踪 sourcePageId/turnId/toolCallId |
| `V1.2-AC-6` | 真实网页 E2E、PRD 复检、false-green audit | 未通过则打回对应 AC 子阶段 |

本阶段验收数据：

- 至少 12 个真实网页或可复现 snapshot：文章、技术文档、GitHub README、表格页、代码页、图片富集页、中文页、低信号页均需覆盖。
- 至少 3 个真实 Chrome 页面手工或自动验收，必须包含 1 个中文复杂网页。
- 可复用 A-V1.2 107-page corpus 作为回归证据，但不能只引用旧报告声明 AC 联动完成。

本阶段 No-Go：

- A high-signal 输出只在离线 evidence 存在，Runtime 主链路不可见。
- C 仍只消费 headingTree / paragraph fallback，却声明已基于 A 高信号生成。
- Mindmap 节点没有 SourceRef 或 fallbackText。
- Debug 页只能显示原始大 JSON，不能解释 quality pass / degraded / fail。
- A 直接创建 artifact、SSE、EventStore 或调用 C/D/B。
- C 直接抽取网页正文或调用 Chrome DOM。
- D 被绕过，工具结果没有 ToolResult envelope、ArtifactRecord 或 trace。

### 13.6 当前体验补强阶段：V1.2-AC-Native 原生 Side Panel 稳定化

本阶段承接 V1.2-AC 功能链路，不重写 A/C/D，也不扩大 V1.2 范围。阶段目标是把已在 direct extension page 中跑通的读取、Debug、总结、问答、Mindmap 和 source fallback，稳定放回 Chrome 原生 Side Panel 容器中完成验收。

当前差异：

| 维度 | 当前状态 | 目标状态 |
|---|---|---|
| 入口 | direct extension page 烟测可用，原生 Side Panel 打开不稳定 | 扩展 action / 快捷键可稳定打开右侧原生 Side Panel |
| 证据 | 部分截图是全屏 `chrome-extension://.../sidepanel.html` | 截图必须同时包含真实网页和右侧 Navia Side Panel |
| 布局 | 窄宽度下部分入口可能被挤出或不可见 | 读取、提交、总结、Mindmap、Debug 入口在 Side Panel 宽度内可达 |
| 自动化 | probe 可证明失败/阻塞，但不能完整 UX pass | `native-probe` + `native-ux` 分层验收；无法自动化时产出结构化 blocker |
| 声明口径 | direct page 只能作为功能 smoke | 只有原生 Side Panel 完整路径通过，才能声明 Native 阶段完成 |

阶段拆分：

```text
V1.2-AC-Native-0：阶段合同、验收口径和截图标准冻结
V1.2-AC-Native-1：Chrome action / keyboard -> native Side Panel 打开稳定化
V1.2-AC-Native-2：Side Panel 窄宽度 UI 可达性和状态展示
V1.2-AC-Native-3：自动化锚点、test id、probe / UX 脚本分层
V1.2-AC-Native-4：原生 Side Panel 中完成读取 -> Debug -> 摘要/问答 -> Mindmap
V1.2-AC-Native-5：真实网页验收、PRD 复检、false-green audit 和出门报告
```

开发计划：

| 子阶段 | 开发重点 | 验收重点 |
|---|---|---|
| `V1.2-AC-Native-0` | 冻结 native-only 通过口径、截图命名、证据路径、No-Go 条款 | 外部审计无 fatal / major；direct page 不再作为 UX 通过依据 |
| `V1.2-AC-Native-1` | 修正 manifest / background / sidePanel API / action 绑定，保证真实网页内可打开原生 Side Panel | Chrome 可见截图中同时出现网页和右侧 Navia；失败时有结构化 blocker |
| `V1.2-AC-Native-2` | 调整 Side Panel 宽度下的 Chat / Debug / Mindmap 布局、滚动和按钮可达性 | `读取当前页面`、`提交上下文`、`总结`、`Mindmap`、Debug 入口在窄宽度内可见或可滚动到 |
| `V1.2-AC-Native-3` | 增加稳定 `data-testid`、自动化 target 识别、probe 与 UX 脚本拆分 | 自动化不依赖脆弱坐标；未知 Chrome 行为必须生成 blocker 而不是 pass |
| `V1.2-AC-Native-4` | 在原生 Side Panel 中串起 activePage、A Debug、C Mindmap、summary / QA 工具 | 同一真实网页完成读取、Debug JSON、总结、问答、Mindmap、source fallback |
| `V1.2-AC-Native-5` | 真实网页矩阵、截图报告、PRD 复检、false-green audit | 至少 3 个真实 Chrome 页面、1 个中文复杂页、1 个 low-signal 页完成 native gate |

自动化证据输出要求：

- `native-sidepanel-probe/report.json` 只能证明原生 Side Panel 是否可打开，不得单独声明体验通过。
- `native-sidepanel-ux/report.json` 才能承载完整用户体验通过结论。
- 每张计入通过的截图必须配套同名 `*.metadata.json`。
- 自动化无法稳定复核时必须输出 structured blocker JSON；`blocksCompletion=true` 时不得进入阶段完成声明。

本阶段验收数据：

- 至少 3 个真实 Chrome 页面，必须包含普通文章 / 技术文档或 README / 中文复杂网页。
- 至少 1 个 low-signal 或空内容页面，必须在 Side Panel 中可见 degraded / fail，不得伪正常通过。
- 每个通过页必须保留截图、URL、Runtime 状态、activePage 状态、工具结果和结论。
- 可复用 AC 功能 smoke 和 A corpus 作为背景证据，但不得替代 native Side Panel 体验验收。

本阶段 No-Go：

- 使用全屏 `chrome-extension://.../sidepanel.html` 截图声明原生 Side Panel 通过。
- 真实 Chrome 截图中没有右侧 Navia Side Panel。
- 只通过 direct extension page 功能烟测，却声明用户体验完成。
- Side Panel 打开依赖无法复现的鼠标坐标，且没有稳定自动化锚点或 blocker。
- `Mindmap` 或 Debug 入口在原生 Side Panel 宽度下不可达。
- Runtime offline、PageContext missing、tool failure 或 Mermaid render failure 在原生 Side Panel 中不可见。

### 13.7 下一阶段：V1.2-AC-Quality A/C 质量深化与真实网页扩展

本阶段承接 V1.2-AC-Native 的原生 Side Panel 验收成果，不重做 B 容器，不扩大 D 的 CoreProvider 范围。目标是继续增强 A 高质量网页感知和 C digest-first Mindmap，让当前 AC 链路在更多真实网页中稳定、可解释、可反跳。

阶段拆分：

```text
V1.2-AC-Quality-0：阶段合同、真实网页矩阵和审计口径冻结
V1.2-AC-Quality-1：A 真实网页样本扩展与质量基线
V1.2-AC-Quality-2：A 高信号 digest / sourceRef / quality report 强化
V1.2-AC-Quality-3：C digest-first Mindmap 与 fallback 原因显式化
V1.2-AC-Quality-4：AC Debug 可读性与 source evidence 复核增强
V1.2-AC-Quality-5：原生 Side Panel 真实网页矩阵 E2E 与 HTML 报告
V1.2-AC-Quality-6：PRD 复检、false-green audit 和阶段出门
```

开发计划：

| 子阶段 | 开发重点 | 验收重点 |
|---|---|---|
| `V1.2-AC-Quality-0` | 冻结本阶段不改公共合同、不新增能力、不声明完整 V1.2 的口径；确定真实网页矩阵 | 外部审计无 fatal / major；样本分类、证据路径、No-Go 固化 |
| `V1.2-AC-Quality-1` | 扩展真实网页 / snapshot 样本，至少覆盖中文复杂、图文混排、技术文档、README、低信号、长内容 | 每个样本有 URL 或 snapshotPath、category、expectedRisk、goldStatus 或审计备注 |
| `V1.2-AC-Quality-2` | 优化 A 噪声过滤、digest 密度、SourceRef 覆盖和 low-signal 降级解释 | `sourceCoverage`、`groundingCompleteness`、`jumpbackCoverage` 可机器校验；low-signal 不得 pass |
| `V1.2-AC-Quality-3` | C 在 readiness pass 时优先使用 `PerceptionDigest.items + SourceRef`，fallback 必须写明原因 | Mindmap 主要节点具备 `sourceRefIds` 或明确 `fallbackReason` |
| `V1.2-AC-Quality-4` | Debug 展示 A quality、digest item、sourceRef、C nodeSourceMap、fallback reason | 人类能在 Debug 中快速判断 A/C 质量，不需要读原始大 JSON |
| `V1.2-AC-Quality-5` | 原生 Side Panel 中跑真实网页矩阵：读取 -> Debug -> Mindmap -> source fallback | HTML 报告列出页面、截图、quality、mindmap、source 证据和结论 |
| `V1.2-AC-Quality-6` | PRD 复检、false-green audit、阶段出门文档 | 没有 fatal / major；未通过则打回对应子阶段 |

本阶段验收数据：

- 至少 12 个真实网页或可复现 snapshot，必须覆盖不少于 6 类页面。
- 至少 5 个真实 Chrome 原生 Side Panel 页面验收，必须包含 1 个中文复杂页和 1 个 low-signal degraded/fail 页。
- 可复用 A-V1.2 107-page corpus 作为回归背景，但不能只引用旧报告声明本阶段完成。
- 每个通过页必须保留 URL、截图、metadata、A quality、C source map、Runtime 状态和结论。

样本矩阵最小字段：

```text
pageId
url
snapshotPath optional
category
complexityTags[]
expectedRisk[]
expectedReadiness
goldStatus
runtimeEvidencePath
nativeScreenshotPaths[]
qualityReportPath
mindmapEvidencePath
conclusion
```

阶段证据包必须产出：

```text
docs/active/project/evidence/v1_2_ac_quality/matrix.json
docs/active/project/evidence/v1_2_ac_quality/report.json
docs/active/project/evidence/v1_2_ac_quality/acceptance-report.html
docs/active/project/evidence/v1_2_ac_quality/false-green-audit.md
docs/active/project/evidence/v1_2_ac_quality/prd-review.md
```

子阶段打回规则：

- `V1.2-AC-Quality-1` 样本少于 12 页、类别少于 6、缺少中文复杂页或 low-signal 页时，打回样本矩阵阶段。
- `V1.2-AC-Quality-2` low-signal 被标记 pass、quality 指标缺 numerator / denominator / method / threshold / passed 时，打回 A 强化阶段。
- `V1.2-AC-Quality-3` C 主要节点缺 sourceRefIds / fallbackText / fallbackReason，或 heading-only 被声明 digest-first 时，打回 C 强化阶段。
- `V1.2-AC-Quality-4` Debug 仍需阅读原始大 JSON 才能判断质量时，打回 Debug 可读性阶段。
- `V1.2-AC-Quality-5` 原生 Side Panel 截图缺网页主体、缺右侧 Navia、缺 metadata 或 report 结论与截图不一致时，打回 E2E 阶段。
- `V1.2-AC-Quality-6` PRD 复检或 false-green audit 出现 fatal / major 时，打回对应开发阶段。

本阶段 No-Go：

- A/C 质量增强只在离线脚本中存在，Runtime 主链路不可见。
- C 使用 heading-only fallback，却声明 digest-first。
- Mindmap 主要节点没有 sourceRef / fallbackText / fallbackReason。
- Debug 页仍然只能显示不可读原始 JSON。
- low-signal 页面被标记为 pass。
- A 或 C 绕过 D 写 Artifact、SSE、EventStore 或 Trace。
- 借本阶段引入 RAG、长期记忆、多 Agent、浏览器自动操作、OCR/VLM/ASR/video/live engine。

### 13.8 下一阶段：V1.2-AC-Jumpback MVP 来源反跳最小闭环

本阶段承接 V1.2-AC-Quality，不重做 A/C/D/B 主体能力。目标是把 C 已输出的 `nodeSourceMap` 和 A 的 SourceRef 证据变成用户可点击的最小反跳体验：节点点击后展示来源证据卡片，并在可行时让网页滚动 / 高亮到来源位置。

阶段拆分：

```text
V1.2-AC-Jumpback-0：节点 ID、jumpback payload、证据卡片和 No-Go 冻结
V1.2-AC-Jumpback-1：C 稳定 Mermaid node id 与 nodeSourceMap key
V1.2-AC-Jumpback-2：B 来源证据卡片与 fallback 展示
V1.2-AC-Jumpback-3：Content Script selector / domPath / textQuote 定位
V1.2-AC-Jumpback-4：Integration wiring 与 D 边界复检
V1.2-AC-Jumpback-5：真实 Chrome 验收、PRD 复检、false-green audit
```

开发计划：

| 子阶段 | 开发重点 | 验收重点 |
|---|---|---|
| `V1.2-AC-Jumpback-0` | 冻结 `MindmapNodeBinding`、`SourceEvidenceCard`、`JumpbackRequest`、`JumpbackResult`、DOM 定位优先级 | 外部审计无 fatal / major；`v1_2_adapter_contracts.md` 13.1 无新增 P0 gap |
| `V1.2-AC-Jumpback-1` | C Mermaid source 生成稳定 node id，主要节点带 sourceRef 或 fallback | 点击事件可稳定定位 `nodeSourceMap[nodeId]` |
| `V1.2-AC-Jumpback-2` | B 点击节点后展示 source evidence card | 卡片展示 node label、sourceRefIds、textQuote/fallbackText、fallback reason |
| `V1.2-AC-Jumpback-3` | content script 按 selector -> domPath -> textQuote 尝试定位和高亮 | 成功时滚动高亮；失败时返回 structured failure reason |
| `V1.2-AC-Jumpback-4` | B -> content script wiring，D 仍是 Artifact/Event/Trace 出口 | A/C/B/D 边界不被打破，未知失败不伪 pass |
| `V1.2-AC-Jumpback-5` | 真实网页矩阵、截图报告、PRD 复检和 false-green audit | 至少 3 个真实网页，含中文复杂页、技术文档页、GitHub/长文页，low-signal 正确降级 |

本阶段验收数据：

- 至少 3 个真实 Chrome 页面完成 Mindmap 节点点击 -> 证据卡片 -> DOM 定位或 fallback。
- 至少 1 个中文复杂页。
- 至少 1 个技术文档或代码 / README 页。
- 至少 1 个 low-signal / degraded 页面，不得伪 pass。
- 每个页面必须记录 URL、截图、nodeId、sourceRefIds、attemptedStrategies、result、failureReason optional。
- 点击绑定和 content script 请求 / 响应必须符合 `contracts/v1_2_adapter_contracts.md` 的 `13.1 V1.2-AC-Jumpback MVP 点击绑定合同`。

阶段证据包必须产出：

```text
docs/active/project/evidence/v1_2_ac_jumpback/report.json
docs/active/project/evidence/v1_2_ac_jumpback/acceptance-report.html
docs/active/project/evidence/v1_2_ac_jumpback/false-green-audit.md
docs/active/project/evidence/v1_2_ac_jumpback/prd-review.md
```

子阶段打回规则：

- `V1.2-AC-Jumpback-1` Mermaid 节点点击无法映射到 `nodeSourceMap` 时，打回 C。
- `V1.2-AC-Jumpback-2` 点击后没有证据卡片，或卡片缺 `textQuote/fallbackText` 时，打回 B。
- `V1.2-AC-Jumpback-3` DOM 定位失败但没有 structured failure reason 时，打回 content script。
- `V1.2-AC-Jumpback-4` B 绕过 Runtime/D 或 C 读取 DOM 时，打回 Integration。
- `V1.2-AC-Jumpback-5` 截图、metadata、report 结论不一致时，打回验收阶段。

本阶段 No-Go：

- 只展示 Mermaid，不支持节点点击来源证据。
- 将 source fallback 文本展示冒充 DOM 反跳成功。
- 使用不可复现坐标点击冒充反跳。
- C 调用 DOM / content script。
- Content script 执行非用户触发的浏览器自动操作。
- 借本阶段引入 RAG、Memory、Web Research、OCR/VLM、视频 / 直播理解、PPT 或深度研究。

### 13.9 V1.2-Closeout 收关阶段

V1.2-Closeout 是 V1.2 生产级完成声明前的最后阶段。它把 AC-Jumpback MVP 的 P1 补强项转为正式目标，重点是用真实 Chrome 证据证明用户体验路径，而不是新增大能力。

阶段拆分：

```text
V1.2-Closeout-0：收关合同、证据标准、No-Go 和外部审计闭环
V1.2-Closeout-1：真实 Chrome Jumpback 截图级验收脚本
V1.2-Closeout-2：A SourceRef / selector / textQuote / fallbackText 质量补强
V1.2-Closeout-3：C Mindmap 节点去重、稳定绑定和同名节点 disambiguation
V1.2-Closeout-4：B Mindmap 交互细化，含 hover / selected / evidence panel / failure message
V1.2-Closeout-5：20 页真实网页 / snapshot 收关矩阵
V1.2-Closeout-6：最终 PRD 复检、false-green audit、HTML 验收报告和完成声明
```

开发计划：

| 子阶段 | 开发重点 | 验收重点 |
|---|---|---|
| `V1.2-Closeout-0` | 冻结收关声明、截图级 Jumpback 标准、证据字段、打回规则 | 外部审计无 fatal / major；不得把 closeout 扩大到 V2/V3/V4/V5 |
| `V1.2-Closeout-1` | 自动化点击来源卡片或 Mindmap 节点，并截图证明网页正文高亮或 fallback | 每个样本记录 before / after 截图、nodeId、strategy、result |
| `V1.2-Closeout-2` | A 输出更稳定的 SourceRef 证据，改进 selector/textQuote/fallback 可用性 | jumpbackCoverage、sourceCoverage、fallback readability 可统计 |
| `V1.2-Closeout-3` | C 对同名节点、重复 digest item 和 fallback 节点做稳定绑定 | nodeBindings 与 nodeSourceMap 一一对应，重复标签不误跳 |
| `V1.2-Closeout-4` | B 优化来源证据面板、节点选中态、失败提示和窄侧栏可达性 | 人类能从截图快速判断点击、证据、定位结果 |
| `V1.2-Closeout-5` | 扩展真实网页矩阵 | 至少 20 页，含中文复杂、技术文档、GitHub/README、长文、低信号 |
| `V1.2-Closeout-6` | 生成最终 HTML 报告、PRD coverage、false-green audit | 允许声明 V1.2 mock-first product path complete；仍不得声明完整 V1 complete |

证据包路径：

```text
docs/active/project/evidence/v1_2_closeout/report.json
docs/active/project/evidence/v1_2_closeout/acceptance-report.html
docs/active/project/evidence/v1_2_closeout/prd-review.md
docs/active/project/evidence/v1_2_closeout/false-green-audit.md
docs/active/project/evidence/v1_2_closeout/screenshots/
```

本阶段打回规则：

- 截图不能同时证明真实网页主体、右侧 Navia Side Panel、点击后结果时，打回 `V1.2-Closeout-1`。
- SourceRef 只有 fallback、没有可解释 textQuote/selector 质量指标时，打回 `V1.2-Closeout-2`。
- 同名 Mindmap 节点点击后映射错误或无法解释时，打回 `V1.2-Closeout-3`。
- 证据面板在窄侧栏不可读或失败状态不可见时，打回 `V1.2-Closeout-4`。
- 真实网页少于 20 页或缺少中文复杂 / 技术文档 / GitHub / 长文 / low-signal 类别时，打回 `V1.2-Closeout-5`。
- HTML 报告、JSON 结论、截图元数据不一致时，打回 `V1.2-Closeout-6`。

---

### 13.10 V1.3 Evidence Card Mindmap 阶段

V1.3 承接 V1.2-Closeout，目标是把 Mindmap 的主体验从 Mermaid 默认图升级为 Evidence Card Mindmap。它不新增 A/C/D 能力边界，不做 Canvas Knowledge Map，不引入 RAG / Memory / Web Research / PPT。

用户已确认 V1.3 作为当前阶段目标。本阶段以“Chrome 原生 Side Panel 中的 Evidence Card Mindmap 体验完整可验收”为开发终点；已有 Evidence Card 基线和 C 标签压缩改进只能算阶段输入，不能替代最终验收报告。

本阶段开发主线：

```text
文档门禁冻结
-> B-local EvidenceCardViewModel 派生
-> Evidence Card 卡片树布局和可读性
-> 节点交互与 source evidence panel
-> DOM jumpback / fallback / blocked 状态闭环
-> 真实网页矩阵、PRD 复检、false-green audit、HTML 报告
```

阶段拆分：

```text
V1.3-0：Evidence Card view model、schema、验收口径、No-Go 和截图标准冻结
V1.3-1：B Mindmap Renderer 从 Artifact + nodeSourceMap 派生 EvidenceCardViewModel
V1.3-2：卡片树布局、视觉 token、边线层级、窄 Side Panel 适配
V1.3-3：hover / selected / neighbor highlight / source evidence panel
V1.3-4：复用 V1.2 Jumpback / fallback 状态，完成 source interaction
V1.3-5：真实网页 E2E、PRD 复检、false-green audit、HTML 报告
```

开发计划：

| 子阶段 | 开发重点 | 验收重点 |
|---|---|---|
| `V1.3-0` | 冻结 Evidence Card 节点字段、状态、降级口径、`report.json` schema 和截图证据 | 文档一致性审计无 fatal / major |
| `V1.3-1` | 实现 `EvidenceCardViewModel` 派生，不改变 Artifact 合同 | normal / missing source / duplicate label / long text fixture 全覆盖 |
| `V1.3-2` | 实现 Evidence Card 布局和视觉系统 | Side Panel 窄宽度截图无文本溢出、节点重叠或不可读 |
| `V1.3-3` | 实现选中、hover、邻接高亮和 source panel | 点击节点后可稳定展示来源证据 |
| `V1.3-4` | 整合 DOM jumpback success、fallback shown、blocked 状态 | UI 与报告严格区分成功和 fallback |
| `V1.3-5` | 真实 Chrome / snapshot 验收与报告 | 至少 8 页矩阵，3 个原生 Side Panel 截图级样本 |

当前里程碑状态口径：

| 里程碑 | 当前判断 | 下一步 |
|---|---|---|
| `V1.3-0` 文档门禁 | 需补齐并复核 | 同步 PRD、目标架构、gap drawio、验收计划、stage gate |
| `V1.3-1` view model | 基线存在，需证据闭环 | 补 fixture class gate 和 schema validation 记录 |
| `V1.3-2` 布局可读性 | 基线存在，需截图验收 | 补窄 Side Panel 截图和文本溢出检查 |
| `V1.3-3` 交互状态 | 基线存在，需统一验收 | 补 selected / neighbor / source panel 截图证据 |
| `V1.3-4` source interaction | 基线存在，需状态一致性审计 | 严格区分 highlighted、fallback_shown、blocked |
| `V1.3-5` 出门验收 | 未完成 | 产出 8 页矩阵、3 个 native Side Panel 截图级样本、HTML 报告 |

打回规则：

- `V1.3-1` 无法从现有 Artifact 派生 view model，或要求 C 输出前端组件结构时，打回合同阶段。
- `V1.3-2` 卡片文本溢出、节点重叠、窄 Side Panel 不可读时，打回布局阶段。
- `V1.3-3` 点击节点无法稳定打开 evidence panel，或 selected 状态不明显时，打回交互阶段。
- `V1.3-4` fallback 被标记为 DOM success，或失败原因不可见时，打回 source interaction 阶段。
- `V1.3-5` HTML 报告、截图、JSON 结论不一致时，打回验收阶段。

证据包路径：

```text
docs/active/project/evidence/v1_3_evidence_card_mindmap/report.json
docs/active/project/evidence/v1_3_evidence_card_mindmap/acceptance-report.html
docs/active/project/evidence/v1_3_evidence_card_mindmap/prd-review.md
docs/active/project/evidence/v1_3_evidence_card_mindmap/false-green-audit.md
docs/active/project/evidence/v1_3_evidence_card_mindmap/screenshots/
```

V1.3 可执行合同：

```text
docs/active/project/contracts/v1_3_evidence_card_mindmap.schema.json
```

启动口径：

```text
V1.3-0: Go for documentation and audit closure.
V1.3-1+: Conditional Go after V1.3-0 closes with no fatal / major issue.
```

本阶段禁止把以下内容作为 V1.3 任务：

- 网页内最终悬浮球 / 双轨面板补齐，除非另起 V1 final interaction stage gate。
- Canvas Knowledge Map、长期记忆、RAG、Web Research、PPT、Deep Research、多 Agent。
- 默认本地文件读取、浏览器自动操作、语音、桌宠。
- 让 B 直接调用 A/C/D 服务，或让 C 输出前端组件结构。

---

### 13.11 V1.4 Reading Map Side Panel Navigation

V1.4 承接 V1.3，不重开 A/C/D 合同。目标是把 Evidence Card Mindmap 变成 Side Panel 内的双栏阅读地图：左栏提供主题 / 节点导航，右栏提供选中节点详情、来源证据和 jumpback / fallback 状态。

阶段拆分：

```text
V1.4-0：PRD、stage gate、验收口径、No-Go 和审计闭环
V1.4-1：B-local ReadingMapViewModel，从 EvidenceCardViewModel 派生
V1.4-2：双栏 Reading Map UI，适配 Side Panel 窄宽度
V1.4-3：节点选择、详情、source evidence、jumpback / fallback 状态
V1.4-4：自动化验收、PRD 复检、false-green audit、报告
```

开发计划：

| 子阶段 | 开发重点 | 验收重点 |
|---|---|---|
| `V1.4-0` | 冻结阶段边界、验收门槛和文档审计 | 无 fatal / major 文档风险 |
| `V1.4-1` | 从 V1.3 ViewModel 派生 ReadingMapViewModel | normal / missing source / dense theme fixture 覆盖 |
| `V1.4-2` | 在 Mindmap artifact 中渲染左导航 + 右详情 | 组件测试证明双栏可见、文本不溢出 |
| `V1.4-3` | 选择节点、来源详情、jumpback / fallback 状态 | located / fallback shown / blocked 不混淆 |
| `V1.4-4` | 真实 Chrome 或可复现 snapshot 验收 | 产出 report、PRD review、false-green audit |

V1.4 禁止：

- 改变 Runtime public contract。
- 让 C 输出前端组件结构。
- 把 Reading Map 扩大为 Canvas Knowledge Map、多网页知识图谱、Memory、RAG、Web Research、PPT、Deep Research 或多 Agent。
- 借 V1.4 声明完整 V1 complete。

### 13.12 V1 Gemini Style Pass 开发计划

本阶段承接 Gemini 原型审查结果，只在当前实现范围内提升样式、按钮设计和状态反馈。它不新增真实产品页面，不实现 floating ball / collapse / resize，不改变 Runtime 合同。

阶段拆分：

```text
V1-GSP-0：PRD、架构、开发计划、验收计划、gap drawio、No-Go 口径冻结
V1-GSP-1：Gemini 原型和 UX review HTML 落盘到 active docs
V1-GSP-2：sidepanel 视觉 token、按钮系统、右侧工具栏、Header 样式升级
V1-GSP-3：当前网页上下文卡、Runtime 状态、Source Evidence 状态色增强
V1-GSP-4：类型检查、组件测试、构建和选择器回归
V1-GSP-5：真实 Chrome 截图、PRD review、false-green audit、出门报告
```

开发计划：

| 子阶段 | 开发重点 | 验收重点 |
|---|---|---|
| `V1-GSP-0` | 同步 stage gate、PRD、架构、计划、验收、drawio | 文档无冲突，范围不扩大 |
| `V1-GSP-1` | 保存 Gemini sandbox 和审查页 | humans 可打开 review HTML 快速理解目标体验 |
| `V1-GSP-2` | 应用 Gemini 样式 token 和按钮系统 | 不破坏 Chat / Agent / Debug / Settings |
| `V1-GSP-3` | 增强当前网页上下文与 Source Evidence 状态 | located / fallback / blocked 可区分 |
| `V1-GSP-4` | 跑 typecheck、focused tests、build | 现有体验和测试选择器不回归 |
| `V1-GSP-5` | 真实 Chrome 视觉验收 | 截图、PRD review、false-green audit 一致 |

打回规则：

- 如果新增真实产品页面、launcher、折叠或 resize，打回 stage gate。
- 如果样式升级导致历史会话、快捷操作、composer、Agent、Debug、Settings、Mindmap、Reading Map 或 Source Evidence 不可用，打回实现阶段。
- 如果 fallback evidence 被展示为 DOM highlight success，打回 Source Evidence 阶段。
- 如果测试或构建失败，打回实现阶段。

证据包建议路径：

```text
docs/active/project/evidence/v1_gemini_style_pass/acceptance-report.md
docs/active/project/evidence/v1_gemini_style_pass/prd-review.md
docs/active/project/evidence/v1_gemini_style_pass/false-green-audit.md
docs/active/project/evidence/v1_gemini_style_pass/screenshots/
```

### 13.13 V1 Launcher / Collapse / Resize 开发计划

本阶段把 Gemini 原型中的外层交互控制提升为真实 content script 能力。

开发计划：

| 子阶段 | 开发重点 | 验收重点 |
|---|---|---|
| `V1-LCR-0` | 冻结 launcher / collapse / resize stage gate | 文档边界不引入禁用能力 |
| `V1-LCR-1` | content script 状态机和 launcher | 默认贴边、hover / focus 弹出、点击展开 / 收起 |
| `V1-LCR-2` | resize handle 和 push / overlay | 宽度限制、页面 margin 正确 |
| `V1-LCR-3` | launcher 拖拽和状态持久化 | 垂直位置、左右贴边、localStorage |
| `V1-LCR-4` | 回归验证 | page context、jumpback、sidepanel 体验不回归 |

### 13.14 V1 Mainline Closeout Candidate 开发计划

本阶段把当前认可的 V1 主线目标收束为可执行、可验收、可审计的总计划。它不新增新的产品能力，而是补齐 V1.3 / V1.4 / complex-site hardening / Gemini style / Launcher Resize 之间的证据链和完成声明边界。

阶段拆分：

```text
V1-MC-0：PRD、目标架构、开发计划、验收计划、stage gate、gap drawio 同步
V1-MC-1：Launcher / Collapse / Resize 正式 closeout
V1-MC-2：复杂站点读取与 Mindmap 质量证据整理
V1-MC-3：V1 主线自动化总体验收报告
V1-MC-4：人工产品体验核查准备
V1-MC-5：V1 complete 候选审计
```

当前剩余目标补充拆分：

```text
V1-MC-DOC-0：当前文档和 drawio 基线闭环，只做文档，不进入代码实现
V1-MC-QA-1：Chrome 自动化环境阻塞处理，明确真实登录态、CDP 连接或 public no-login 降级路径
V1-MC-QA-2：B站指定详情页 fresh validation，重点复核摘要、Mindmap、source jumpback 和状态卡
V1-MC-QA-3：B站 / 小红书 / 观察者网首页与详情页 fresh evidence，明确 public no-login / logged-in / degraded
V1-MC-QA-4：Mindmap / Reading Map / Source Evidence 截图级可读性验收
V1-MC-QA-5：总报告、PRD review、false-green audit、human review checklist 更新
```

当前质量硬化子阶段：

```text
V1-MC-SJ-0：Source Jumpback Hardening 文档、架构和验收口径冻结
V1-MC-SJ-1：A Page Reading 复杂站点主内容识别和 SourceRef 质量提升
V1-MC-SJ-2：C Mindmap / B Renderer source card 排序和主内容优先级提升
V1-MC-SJ-3：Content Script 多 sourceRef / selector / domPath / textQuote / href-card jumpback 策略
V1-MC-SJ-4：E2E source card 选择策略、headless-first、mute-audio 和报告语义修订
V1-MC-SJ-5：真实站点 6 样本复验、PRD review、false-green audit 和 V1-MC 总报告再聚合
```

开发计划：

| 子阶段 | 开发重点 | 验收重点 |
|---|---|---|
| `V1-MC-0` | 统一 PRD、架构、计划、验收、stage gate、drawio；补齐当前实现实体映射 | 文档无冲突，drawio 不超过 8 页，完成声明边界清楚，能看出 `contentBridge.ts`、iframe React、B Renderer、background proxy、Runtime A/C/D/C Mindmap 和 source jumpback 的交互关系 |
| `V1-MC-1` | 对 launcher、collapse、resize、push / overlay 做正式验收闭环 | 真实 Chrome 截图和报告覆盖默认贴边、hover / focus 弹出、点击展开、点击收起、恢复 margin、拖拽、resize |
| `V1-MC-2` | 汇总 B站 / 小红书 / 观察者网等复杂站点质量证据 | public no-login 与登录态边界清楚，degraded 不冒充 pass |
| `V1-MC-3` | 生成 V1 主线总体验收 HTML / JSON 报告，并逐个校验上游 evidence 路径、`passed`、`fatalIssues`、`majorIssues`、允许声明和固定验证命令 | 读取、Debug、总结、问答、Evidence Card、Reading Map、source evidence 全链路通过；`report.json` 记录 `testCommands` 和上游 evidence 语义校验结果 |
| `V1-MC-4` | 输出人工体验核查清单和待审核证据路径 | 人类能快速检查目标体验、目标架构和关键截图；清单必须包含 `reviewStatus`、`reviewer`、`reviewedAt`、`blockingIssues` 字段，初始状态为 `pending` |
| `V1-MC-5` | PRD 复检、false-green audit、旧证据冲突处理、fallback 覆盖口径核对 | 无 fatal / major，才允许进入完整 V1 complete 候选审计；若当前 V1-MC 样本 `fallbackSamples = 0`，必须引用 V1.3 / V1.4 fallback evidence，不能声明本轮真实站点 fallback 抽样已覆盖 |

Source Jumpback Hardening 开发及验收计划：

| 子阶段 | 开发重点 | 验收重点 |
|---|---|---|
| `V1-MC-SJ-0` | 同步 PRD、架构、开发计划、验收计划、stage gate、drawio；记录当前 real-site 6/6 pass、0 degraded、0 blocked、`fallbackSamples = 0`、人工核查 pending 和 cookie-injected 复核边界 | 文档无 fatal / major；自动化候选通过事实不被升级为完整 V1 complete；drawio 仍不超过 8 页 |
| `V1-MC-SJ-1` | A Page Reading 对复杂站点主内容提权：小红书 feed card、观察者 article 正文、B站视频主内容；过滤评论、推荐、站点壳、footer、活动广告 | `perception-summary.json` 中 sourceRefs 和 digestItems 能对应主内容；噪声不主导摘要和 Mindmap |
| `V1-MC-SJ-2` | C/B 对 Mindmap 节点和 source card 排序：root / 高层节点优先正文和可定位来源，避免默认卡片指向评论或推荐 | `source-cards.json` 前几张卡片包含主内容来源；E2E 不再因第 0 张卡片选错导致假失败 |
| `V1-MC-SJ-3` | Content Script jumpback 在用户触发后尝试多个 sourceRef，并按 selector、domPath、textQuote、href/card 文本评分定位 | DOM highlight 成功时必须出现 Navia source marker；失败必须 fallback_shown，blocked 必须单独记录 |
| `V1-MC-SJ-4` | E2E 选择“主内容且可定位概率最高”的 source card；报告记录选择原因；真实站点默认 headless 和 `--mute-audio` | 自动化不抢焦点、不发声；`jumpback.json` 记录 selectedSourceCardIndex / reason / result |
| `V1-MC-SJ-5` | 重新跑 B站、小红书、观察者网首页和详情页 6 样本；重新聚合 V1-MC 总报告 | 当前已恢复 6/6 pass、0 degraded、0 blocked 和 V1-MC 自动化候选通过；后续若任一样本 degraded / blocked，必须打回质量硬化并恢复 no-completion claim |

专项质量闭环：

| 专项 | 开发重点 | 验收重点 |
|---|---|---|
| Chrome 自动化环境 | 复核真实 Chrome profile、`NAVIA_CDP_URL`、unpacked extension load、service worker 暴露 | 不能接管登录态或无法加载扩展时，报告写 blocked / degraded，不得伪造截图通过 |
| B站详情页 | 指定 `https://www.bilibili.com/video/BV1gcyFBZEUf...` 作为固定样本之一 | 摘要和 Mindmap 不被推荐列表、弹幕设置、活动横幅、QQ群 / 微信、自动连播、订阅合集主导 |
| Mindmap 可读性 | 复核 Evidence Card Mindmap、Reading Map、状态卡和目录浮层层级 | 真实截图中无文本虚影、节点重叠、卡片截断、输入框遮挡 |
| Source Jumpback | 复核 located / fallback_shown / blocked 三态 | DOM highlighter、Navia source marker、fallback evidence 和 blocked 原因在 UI / report 中一致 |
| 小红书首页 | feed card sourceRef、source card 排序和跳转定位 | 不得仅 `fallback_shown`；无法稳定定位时必须作为 degraded/blocker 留在报告中 |
| 观察者详情页 | article 正文、标题、作者、发布时间和正文段落提权 | 默认 source card 不得指向评论、推荐、最新视频或头条侧栏 |

Chrome 验收技术路线矩阵：

| 路线 | 使用条件 | 优点 | 缺点 | 允许声明 |
|---|---|---|---|---|
| B. 新建专用 Chrome 测试 profile 并手动登录 / cookie 注入 | 自动化 profile 能加载 unpacked extension；用户可在该 profile 登录 B站 / 小红书，或注入用户授权 cookie | 首选路线；可重复、不会锁用户主 profile；适合长期回归 | 初次登录需要人工；cookie 可能过期；登录态有效期依赖站点策略 | 可声明 dedicated-profile / cookie-injected validation，仅限该专用 profile 和实际覆盖页面 |
| A. 连接用户已打开的登录态 Chrome CDP | 路线 B 出错、cookie 失效、专用 profile 风控或无法加载扩展时，用户主动以 remote debugging 方式启动或提供 `NAVIA_CDP_URL`；Navia extension 已可见 | 最接近真实登录态体验；可验证 B站详情页登录态；适合作为 B 失败后的复验路线 | 需要人类配合启动浏览器；不能由自动化强制接管现有 profile | 可声明 logged-in validation，仅限实际截图和 report 覆盖的页面 |
| C. public no-login 临时 profile | 登录态不可用但 extension 可加载 | 自动化程度高；适合公开态回归 | 不能证明登录态高质量；小红书 / B站详情可能降级 | 只能声明 public no-login / degraded，不得冒充 logged-in |
| D. 结构化 blocker + 人工截图补位 | Chrome profile locked、extension not loaded、Playwright/Chrome 环境不可用 | 不做虚假验收；保留风险事实 | 不能自动化通过；会阻塞完整 V1 candidate | 只能声明 blocked / manual review required |

默认执行顺序固定为 B -> A -> C -> D。路线 B 出错时再走路线 A 进行登录态 CDP 复验；任一低等级路线不得覆盖高等级路线的失败事实，例如 C 通过不能抵消 B/A 登录态 blocked。

每个子阶段完成后必须留下可审查产物：

| 子阶段 | 必须产物 |
|---|---|
| `V1-MC-0` | PRD、架构、开发计划、验收计划、stage gate、drawio gap 内容一致性审计结论；当前实现实体与目标架构差异映射 |
| `V1-MC-1` | docked launcher / hover or focus peek / expand / collapse / drag / resize / push 或 overlay 的真实 Chrome 截图和 JSON report |
| `V1-MC-2` | B站、小红书、观察者网首页 / 详情页的 public no-login 或 logged-in 边界说明 |
| `V1-MC-3` | 汇总 HTML report、机器可读 `report.json`、截图索引、`testCommands`、逐个上游 evidence 校验结果 |
| `V1-MC-4` | 面向人类产品核查的 checklist，覆盖目标体验、目标架构和关键截图，并包含 `reviewStatus: pending` 等人工核查状态字段 |
| `V1-MC-5` | PRD review、false-green audit、旧 failed / superseded evidence 处理说明、fallback coverage 来源说明 |

打回规则：

- `V1-MC-0` 如果 PRD、架构、验收或 drawio 对当前目标有冲突，打回文档门禁。
- `V1-MC-1` 如果 launcher 只完成视觉 probe，或折叠 / resize / margin 恢复没有真实浏览器证据，打回交互验收。
- `V1-MC-2` 如果 public no-login 样本被写成登录态高质量通过，打回复杂站点验收。
- `V1-MC-3` 如果总报告与阶段 report 结论不一致、上游 evidence 路径缺失、上游 report 存在 fatal / major、或 `testCommands` 未记录，打回报告生成。
- `V1-MC-4` 如果 checklist 不能指导人类快速核查 launcher、sidebar、读取、问答、导图和 source evidence，或缺少 review status 字段，打回人工核查材料。
- `V1-MC-5` 如果旧 failed closeout 证据未解释、废止或重跑，或 fallback coverage 没有说明当前抽样 / 上游继承来源，不得进入完整 V1 complete 候选审计。
- `V1-MC-SJ-5` 如果重新生成后的 `v1_real_site_complex_pages/report.json` 出现 degraded / blocked，或 `v1_external_visual_acceptance/report.json` 未通过，必须撤回 V1-MC passed claim 并生成 no-completion claim。

固定验证命令：

```bash
npm --prefix apps/chrome-extension run typecheck
npm --prefix apps/chrome-extension test -- contentBridge mindmap_renderer ArtifactInlineCard
npm --prefix apps/chrome-extension run build
npm --prefix apps/chrome-extension run e2e:chrome:launcher-resize-closeout
npm --prefix apps/chrome-extension run e2e:chrome:external-visual-acceptance
npm --prefix apps/chrome-extension run e2e:chrome:v1-mainline-closeout
```

证据包建议路径：

```text
docs/active/project/evidence/v1_mainline_closeout/acceptance-report.html
docs/active/project/evidence/v1_mainline_closeout/report.json
docs/active/project/evidence/v1_mainline_closeout/prd-review.md
docs/active/project/evidence/v1_mainline_closeout/false-green-audit.md
docs/active/project/evidence/v1_mainline_closeout/human-review-checklist.md
docs/active/project/evidence/v1_mainline_closeout/screenshots/
```

---

## 14. 推荐开发顺序

以下顺序是早期 V1 底座从零建设时的历史推荐顺序，用于理解 Runtime / AgentCore / 插件底座的依赖关系；它不再代表 2026-06-25 当前 V1 主线收口阶段的直接执行顺序。

```text
1. contract freeze: API envelope / ErrorCode / State / Event / Tool / Budget / ID / SSE
2. local-runtime health/session/event skeleton
3. minimal StateMachine main path
4. AgentCore loop through StateMachine.transition()
5. PreToolUse / PostToolUse hooks
6. EventStore + EventStream separation
7. governance: budget / permission / context / file deny
8. page context API
9. Chrome content script + injected floating ball
10. embedded dual-track AI panel + page context
11. summarize/ask tools
12. Chrome 网页内文字对话 E2E
13. PRD A-F layout states + resize
14. deterministic mindmap fallback, then model adapter
15. session restore + trace export
```

当前 V1 主线收口推荐顺序固定为：

```text
1. V1-MC-0 文档门禁和 drawio gap 同步
2. V1-MC-1 launcher / collapse / resize 正式 closeout
3. V1-MC-2 complex-site 读取和导图证据整理
4. V1-MC-3 V1 主线自动化总体验收报告
5. V1-MC-4 人工产品体验核查材料
6. V1-MC-5 V1 complete 候选审计
```

当前仍然不要扩展到本地知识库、RAG、Memory、Web Research、PPT、Deep Research、多 Agent、语音、桌宠、浏览器自动操作产品能力或默认本地文件读取。V1 主线成败取决于当前网页伴读链路是否可被真实 Chrome 证据、PRD 复检和人工体验核查共同证明。

### 14.1 V1-HR/CC 人工产品核查与 Complete Candidate 准备计划

前一阶段自动化候选验收和审查报告已确认通过。本阶段只做文档开发和验收基线整理，不进入产品代码实现。目标是把当前 active 文档、drawio、证据路径和人工核查材料整理到可直接支持人工产品体验核查的水平。

阶段拆分：

```text
V1-HR-0：文档基线同步，确认当前允许声明仍是 V1 mainline closeout candidate passed automated acceptance
V1-HR-1：人工核查材料整理，明确报告、截图、JSON、PRD review、false-green audit 入口
V1-HR-2：体验场景清单固化，覆盖 launcher、sidebar、Chat、Debug、Settings、Mindmap、Reading Map、source evidence
V1-HR-3：证据一致性复核，确认自动化报告、drawio、stage gate 和 active PRD 不冲突
V1-HR-4：Complete candidate 审计准备，列出人工 passed 后需要复跑的验证命令和 No-Go
V1-HR-5：人工结论落盘后再进入完整 V1 complete 候选审计
```

开发及验收计划：

| 子阶段 | 文档开发重点 | 验收重点 |
|---|---|---|
| `V1-HR-0` | 更新 PRD、架构、开发计划、验收计划、stage gate、gap companion、drawio | 当前状态不被写成完整 V1 complete；drawio 不超过 8 页 |
| `V1-HR-1` | 整理人工核查入口和证据路径 | 人类可从一组 active 文档快速打开总报告、截图和 checklist |
| `V1-HR-2` | 固化最小体验路径和复杂站点场景 | 覆盖普通网页、B站、小红书、观察者网、source located/fallback/blocked |
| `V1-HR-3` | 对齐 report、PRD review、false-green audit、fallback coverage 继承口径 | 不出现 Cookie-injected 冒充用户主 Profile 的描述 |
| `V1-HR-4` | 准备人工 passed 后的 complete candidate 审计路线 | 明确必须复跑自动化验证、重新聚合报告、确认无 fatal / major |
| `V1-HR-5` | 人工核查结果落盘模板 | `reviewStatus`、`reviewer`、`reviewedAt`、`blockingIssues` 必须完整 |

本阶段出门材料：

```text
docs/active/project/01-prd.md
docs/active/project/02-architecture.md
docs/active/project/03-development-plan.md
docs/active/project/04-acceptance-plan.md
docs/active/project/stage-gates/v1-mainline-closeout.md
docs/active/project/design/v1-mainline-closeout-gap.md
docs/active/project/design/v1-mainline-closeout-gap.drawio
docs/active/project/design/v1-mainline-closeout-readiness-audit.md
docs/active/project/evidence/v1_mainline_closeout/human-review-checklist.md
```

打回规则：

- 如果任一 active 文档把当前状态写成完整 V1 complete，打回 `V1-HR-0`。
- 如果 drawio 只画抽象“前端 / 后端 / AI 模块”，看不到具体代码实体和交互关系，打回 `V1-HR-0`。
- 如果人工核查材料不能让人类快速找到体验路径、截图和报告，打回 `V1-HR-1`。
- 如果 B站 / 小红书 / 观察者网验证边界没有区分 temporary cookie profile、public no-login 和用户主 Profile，打回 `V1-HR-3`。
- 如果 fallback coverage 被写成本轮 fresh 样本已覆盖，打回 `V1-HR-3`。

### 14.2 V1-MVP-QH 基础 MVP 确认后的质量硬化开发计划

基础 MVP 体验已被人工确认可用。本阶段不扩展产品能力，不新增 RAG、Memory、Web Research、PPT、Deep Research、多 Agent、语音、桌宠、浏览器自动操作产品能力、OCR/VLM/ASR 或默认本地文件读取。开发目标限定为：提升复杂站点、国内外主流图文网页和门户网站的主内容抽取、Mindmap 可读性和 Source Jumpback 准确性。

阶段拆分：

```text
V1-MVP-QH-0：文档与审计冻结，确认 PRD / 架构 / 计划 / 验收 / stage gate / drawio 一致。
V1-MVP-QH-1：48 页样本 manifest、当前 6 样本基础 evidence 与扩展验收基线诊断计划冻结。
V1-MVP-QH-2：A Page Reading 主内容抽取、噪声过滤和 SourceRef 质量硬化。
V1-MVP-QH-3：C Mindmap 主题归并、节点文本压缩和 nodeSourceMap 绑定质量硬化。
V1-MVP-QH-4：B Renderer 导图可读性、source card 排序和三态 evidence 展示硬化。
V1-MVP-QH-5：Content Script Source Jumpback 多线索定位、fallback 和 blocked 语义硬化。
V1-MVP-QH-6：国内外 48 页主流图文网页 / 门户网站矩阵复验、PRD review、false-green audit、可视化验收报告。
```

开发及验收计划：

| 子阶段 | 开发重点 | 验收重点 |
|---|---|---|
| `V1-MVP-QH-0` | 同步 active PRD、目标架构、开发计划、验收计划、stage gate、gap companion、drawio；记录基础 MVP 人工确认和剩余质量问题 | 文档无 fatal / major；drawio 不超过 8 页；不得把基础 MVP 确认写成完整 V1 complete |
| `V1-MVP-QH-1` | 冻结 48 页 `sample-manifest.json`、页面分类、登录态策略、替代样本规则、质量阈值和当前 6 样本基础 evidence 边界 | 当前 6 样本只写成 prior baseline；manifest 必须通过 `v1_mvp_quality_hardening_sample_manifest.schema.json`；manifest 缺失或扩展矩阵未跑通前不得声明 expanded acceptance passed |
| `V1-MVP-QH-2` | A Page Reading 提升复杂站点主内容识别，降低站点壳、推荐、评论、弹幕设置、活动广告、版权提示、重复文本权重 | B站 / 小红书 / 观察者网样本及扩展图文网页 digest 和 sourceRefs 能说明主内容优先；低价值文本不得主导摘要 |
| `V1-MVP-QH-3` | C Mindmap 做主题归并、标签压缩、节点层级控制和 `nodeSourceMap` 绑定复核 | 高层节点来自主内容；节点短标签可读；主要节点绑定 sourceRef 或明确 fallback reason |
| `V1-MVP-QH-4` | B Renderer 优化 Evidence Card Mindmap、Reading Map、source card 排序、三态状态样式和窄屏布局 | 截图无文本虚影、节点重叠、卡片截断、输入框遮挡；source card 前置主内容 |
| `V1-MVP-QH-5` | Content Script jumpback 在用户触发后按 selector、domPath、textQuote、href/card 多线索定位；失败时保留 fallback / blocked | located 必须有 Navia source marker；fallback_shown 和 blocked 不得合并为 success |
| `V1-MVP-QH-6` | 复验国内外 48 页主流图文网页 / 门户网站矩阵；重新生成独立 QH JSON / HTML / screenshot 证据、PRD review 和 false-green audit，并再聚合到 V1 mainline closeout | 真实数据验收通过才允许 expanded quality hardening passed；任一类别低于门槛或出现 major false-green 风险，打回对应子阶段 |

真实数据样本要求：

- B站详情页：摘要和 Mindmap 高层节点必须来自视频标题、简介、UP主 / 发布信息、播放 / 弹幕等主内容。
- 小红书首页 / 详情页：source evidence 优先 feed card、标题、作者、正文或可定位链接；风控或虚拟列表阻断时必须 degraded / blocked。
- 观察者网首页 / 详情页：正文标题、作者、发布时间、正文段落优先；评论、推荐、最新视频、头条侧栏不得作为默认主 source。
- 国内新闻 / 门户首页不少于 8 页，国内新闻 / 图文详情页不少于 8 页，国内图文社区 / 内容平台不少于 8 页。
- 国外新闻 / 门户首页不少于 8 页，国外新闻 / 图文详情页不少于 8 页，国外百科 / 博客 / 文档型图文页不少于 8 页。
- 总样本不少于 48 页，国内不少于 24 页，国外不少于 24 页；至少 44/48 页 pass，每个类别至少 7/8 页 pass。
- 每个类别至少覆盖 4 个不同站点；同一站点在同一类别最多计入 2 页，避免用少数网站堆样本数。
- 每个样本必须记录 URL、countryRegion、contentCategory、loginStatePolicy、mainContentSignals、summaryGrounding、mindmapTopNodes、selectedSourceCardIndex、selectionReason、jumpbackResult、screenshotPath、noiseFindings 和 conclusion。
- 每个样本必须记录 qualityMetrics：`groundedClaimRate >= 0.8`、`topNodeGroundingRate >= 0.9`、`noisyTopNodeRate <= 0.1`、`duplicateTopNodeRate <= 0.05`、`overlongTopNodeRate <= 0.15`、`jumpbackSemanticConsistency = true`。
- 每个样本必须覆盖至少一个 `解释选中内容` 检查点：选区解释不能被网站壳、图片序号、时间戳、重复文本、推荐列表或评论区主导。
- 如果 Mindmap 或 source evidence 展示图片证据，只能使用当前页已有图片 URL、alt、caption 或媒体 metadata；不得新增 OCR/VLM 或外部搜索。
- 视频 / 直播 / 音频页面只验收 DOM 可见文本、简介、字幕文本、评论、弹幕统计或 metadata；不得声称理解画面、音频或未出现在页面文本中的视频内容。

证据路径：

```text
docs/active/project/evidence/v1_mvp_quality_hardening/report.json
docs/active/project/evidence/v1_mvp_quality_hardening/acceptance-report.html
docs/active/project/evidence/v1_mvp_quality_hardening/sample-manifest.json
docs/active/project/evidence/v1_mvp_quality_hardening/prd-review.md
docs/active/project/evidence/v1_mvp_quality_hardening/false-green-audit.md
docs/active/project/evidence/v1_mvp_quality_hardening/evidence-manifest.json
docs/active/project/evidence/v1_mvp_quality_hardening/screenshots/
docs/active/project/contracts/v1_mvp_quality_hardening_sample_manifest.schema.json
docs/active/project/contracts/v1_mvp_quality_hardening_report.schema.json
```

`v1_mainline_closeout` 只能在 QH expanded evidence 通过后重新聚合，不得直接替代 QH 出门证据。

QH-6 必须先生成独立 QH report，再聚合 mainline closeout。目标命令顺序为：

```bash
NAVIA_REAL_SITE_HEADLESS=1 npm --prefix apps/chrome-extension run e2e:chrome:v1-mvp-quality-hardening
node apps/chrome-extension/e2e/generate-v1-mvp-quality-hardening-report.mjs
node apps/chrome-extension/e2e/generate-v1-mainline-closeout-report.mjs
```

其中 `generate-v1-mvp-quality-hardening-report.mjs` 必须验证 manifest / report schema，并输出 `freshFallbackSamples`、`referencedFallbackSamples`、`blockedSamples`、`locatedSamples` 与 `referencedFallbackEvidencePaths`。

该 reporter 命令是 QH-6 必须提供的目标验收命令；如果实现阶段脚本不存在、不能生成独立 QH `report.json`，或只生成 `v1_mainline_closeout` 聚合报告，则 QH-6 不得通过。

打回规则：

- `V1-MVP-QH-0` 如文档把 expanded quality hardening 写成完整 V1 complete，打回文档门禁。
- `V1-MVP-QH-1` 如 48 页 `sample-manifest.json`、替代样本规则、质量阈值或当前 6 样本 baseline 边界不清，打回样本计划。
- `V1-MVP-QH-2` 如摘要仍由首页、导航、评论、推荐、广告或版权提示主导，打回 A Page Reading。
- `V1-MVP-QH-3` 如 Mindmap 高层节点重复、过长、无来源或由低价值文本主导，打回 C Mindmap。
- `V1-MVP-QH-4` 如真实截图仍有文本虚影、重叠、截断或遮挡，打回 B Renderer。
- `V1-MVP-QH-5` 如 fallback / blocked 被标成 highlighted，或 marker 不可见，打回 Content Script。
- `V1-MVP-QH-6` 如 48 页矩阵不足、国内 / 国外类别缺失、任一类别低于 7/8 pass、manifest / report schema validation 失败、report / PRD review / false-green audit / 截图证据结论不一致、fallback fresh/reference/blocked 口径缺失，或 QH expanded evidence 被 mainline closeout 聚合报告替代，打回报告生成和对应开发阶段。

允许声明：

```text
V1 MVP quality hardening passed expanded real-site acceptance.
```

不得声明：

```text
完整 V1 complete。
最终 Monica-like UX complete。
复杂站点全量高质量通过。
国内外主流网站全量高质量通过。
用户主 Profile 登录态全站高质量通过。
只凭标题、导航或首页卡片标题生成摘要 / Mindmap，却声明完成网页内容理解。
```

### 14.3 V1-MVP-CQ 内容理解质量增强开发计划

`V1-MVP-CQ` 在 QH passed 之后执行。它承认 QH 48 页矩阵已经通过，但不把 QH 通过解释为内容理解已达用户满意。新阶段以 strict gold notes、内容角色识别、grounded summary / QA / explain-selection、语义 Mindmap 和可解释 source evidence 为主线。

阶段拆分：

```text
V1-MVP-CQ-0：文档与审计冻结，确认 QH passed 但内容质量仍不足，CQ 不声明完整 V1 complete。
V1-MVP-CQ-1：36+ strict 样本 manifest、gold notes 模板、质量阈值和报告 schema 冻结。
V1-MVP-CQ-2：A Page Reading 内容角色识别、正文密度评分、噪声惩罚、互动补充分层。
V1-MVP-CQ-3：总结 / 问答 / 解释选区 grounding 质量硬化。
V1-MVP-CQ-4：C Mindmap 语义主题归并、节点类型、短标签和证据绑定硬化。
V1-MVP-CQ-5：B Renderer 证据关系说明、source card 解释、degraded 展示和窄侧栏可读性硬化。
V1-MVP-CQ-6：Content Script jumpback 语义一致性、marker 说明、fallback / blocked 复验。
V1-MVP-CQ-7：严格真实网页验收、人工 gold 对照、HTML 报告、PRD review 和 false-green audit。
```

开发及验收计划：

| 子阶段 | 开发重点 | 验收重点 |
|---|---|---|
| `V1-MVP-CQ-0` | 更新 PRD、架构、开发计划、验收计划、stage gate、gap companion；明确 QH passed 不是完整内容理解完成 | active 文档无 fatal / major；不得把 CQ 写成完整 V1 complete 或视频 / 图片 / 音频理解完成 |
| `V1-MVP-CQ-1` | 冻结 36+ strict 样本、gold notes、schema、报告字段和人工复核口径 | `sample-manifest.json` 与每个 `gold-notes/*.json` 通过 CQ schema；每页有 expectedMainClaims / expectedMindmapThemes / prohibitedNoiseThemes / requiredEvidenceTargets，且 `finalStrictEligible=true` |
| `V1-MVP-CQ-2` | A 侧为 DOM block 增加内容角色、正文密度、噪声惩罚、互动补充分层 | 主内容 signals 必须覆盖正文、简介、caption、作者 / 时间、可见互动补充；噪声不能主导 digest |
| `V1-MVP-CQ-3` | 总结、问答、解释选区必须从 SourceRef / fallbackText grounding | summaryGroundingRate、qaGroundingRate 达标；解释选区不被图片序号、时间戳、站点壳和重复文本主导 |
| `V1-MVP-CQ-4` | Mindmap 高层节点从主题 / 论点 / 事实 / 步骤 / 结论生成，压缩重复和长文本 | mindmapSemanticCoverageRate 达标；节点绑定 sourceRef 或 degraded reason |
| `V1-MVP-CQ-5` | B 侧展示证据为何支撑节点 / 答案，修复窄侧栏可读性和 degraded 状态 | 截图证明无虚影、重叠、截断；source card 解释清楚 |
| `V1-MVP-CQ-6` | jumpback marker 显示证据关系；fallback / blocked 理由具体 | jumpbackSemanticMatch 为 true，或正确 degraded / blocked |
| `V1-MVP-CQ-7` | 运行 36+ strict real-site acceptance，生成独立 CQ report 和 HTML | 至少 34/36 strict pass；PRD review / false-green audit 无 fatal / major |

证据路径：

```text
docs/active/project/design/v1-mvp-content-quality-gap.md
docs/active/project/design/v1-mvp-content-quality-gap.drawio
docs/active/project/evidence/v1_mvp_content_quality/sample-manifest.json
docs/active/project/evidence/v1_mvp_content_quality/gold-notes/
docs/active/project/evidence/v1_mvp_content_quality/report.json
docs/active/project/evidence/v1_mvp_content_quality/acceptance-report.html
docs/active/project/evidence/v1_mvp_content_quality/prd-review.md
docs/active/project/evidence/v1_mvp_content_quality/false-green-audit.md
docs/active/project/evidence/v1_mvp_content_quality/evidence-manifest.json
docs/active/project/evidence/v1_mvp_content_quality/screenshots/
docs/active/project/contracts/v1_mvp_content_quality_sample_manifest.schema.json
docs/active/project/contracts/v1_mvp_content_quality_gold_notes.schema.json
docs/active/project/contracts/v1_mvp_content_quality_report.schema.json
```

`V1-MVP-CQ-7` 的 report generator 必须先验证 manifest、gold notes 和独立 CQ report，再允许 `v1_mainline_closeout` 聚合。若只生成 HTML 报告、只生成 mainline 聚合报告或缺少 schema validation，本阶段验收必须失败。

`V1-MVP-CQ-7` 的每个 metric 必须记录 `operator`：分数型最低门槛使用 `gte`，`noiseLeakageRate` 使用 `lte`，布尔一致性使用 `eq`。独立 CQ report 必须记录 `summary.categoryResults[]`，每类至少 6 页、至少 5 页 strict pass。

打回规则：

- CQ-1 若没有 gold notes，不得进入实现。
- CQ-0 若 drawio 超过 8 页、不是中文、缺少具体代码实体状态，或看不到当前架构与目标架构关系，打回文档门禁。
- CQ-2 若主内容 signals 仍由导航、推荐、广告、cookie wall、版权提示或低价值重复文本主导，打回 A。
- CQ-3 若总结 / 问答 / 解释选区不能追溯到 SourceRef 或 fallbackText，打回 grounding。
- CQ-4 若 Mindmap 仍是标题堆叠、重复节点或无证据节点，打回 C。
- CQ-5 若真实截图仍有导图虚影、重叠、截断或 source explanation 不可理解，打回 B。
- CQ-6 若 located marker 不说明证据关系，或 fallback / blocked 被伪装成 success，打回 Content Script。
- CQ-7 若 strict pass 低于 34/36、任一类别低于 5/6、PRD review / false-green audit 有 fatal / major，打回对应阶段。

允许声明：

```text
V1 MVP content quality prove-out passed strict real-site acceptance.
```

不得声明：

```text
完整 V1 complete。
最终 Monica-like UX complete。
复杂站点全量高质量通过。
视频 / 音频 / 图片内容已被理解。
V2 Memory / RAG ready。
Web Research / PPT / Deep Research ready。
```

## 15. V1.0.x Post-V1 Hardening 开发计划

本阶段发生在 V1 complete 之后，只做后续质量硬化。它不重新打开 V1 complete 结论，不把历史 QH/CQ 证据改写为新验收。

阶段拆分：

```text
V1.0.x-H-0：文档门禁，冻结 PRD、目标架构、开发计划、验收计划、stage gate、gap companion、drawio。
V1.0.x-H-1：真实网页回归矩阵，冻结 100+ candidate 和自动化验收子集。
V1.0.x-H-2：Source Jumpback 精度，冻结 source card 选择、marker 文案、fallback / blocked reason。
V1.0.x-H-3：Mindmap / Reading Map 质量，冻结语义归并、短标签、去重、低价值文本过滤和 source binding。
V1.0.x-H-4：窄侧栏 UX polish，冻结导图、source card、状态卡、聊天输入区的可读性验收。
V1.0.x-H-5：自动化验收报告，冻结 HTML 报告、截图、JSON、PRD review、false-green audit。
V1.0.x-H-6：出门审计，无 fatal / major 后仅声明 post-V1 hardening passed。
```

开发及验收计划：

| 子阶段 | 开发重点 | 验收重点 |
|---|---|---|
| `V1.0.x-H-0` | 更新 active PRD、架构、开发计划、验收计划、stage gate、gap companion、drawio | 文档无 fatal / major；drawio 不超过 8 页；不改写 V1 complete 历史 |
| `V1.0.x-H-1` | 定义 100+ candidate matrix 和可重复验收子集 | 覆盖国内外门户、详情、社区、文档、动态页、低信号页；登录边界和替代规则明确 |
| `V1.0.x-H-2` | 规划 source card 排序、selection reason、located marker、fallback reason、blocked reason | located 不准不得计 pass；fallback / blocked 与 UI、JSON、HTML、截图一致 |
| `V1.0.x-H-3` | 规划 Mindmap 语义节点、短标签、重复压缩、噪声过滤、nodeSourceMap 质量 | 顶层节点表达主题、论点、事实、步骤、结论；噪声节点被降级或抑制 |
| `V1.0.x-H-4` | 规划 B 侧窄侧栏视觉和 source explanation | 截图证明无虚影、重叠、截断、状态卡遮挡或输入区遮挡 |
| `V1.0.x-H-5` | 规划自动化验收工具、semantic validator 和 HTML 报告结构 | headless 优先、`--mute-audio`；`report.json` 包含 `sampleDistribution` / `fallbackPolicy`；固定命令 `npm --prefix apps/chrome-extension run validate:post-v1-hardening` |
| `V1.0.x-H-6` | 汇总 PRD review、false-green audit、UX checklist | 无 fatal / major；只允许 post-V1 hardening passed |

打回规则：

- H-0 若 drawio 超过 8 页、不是中文、缺少具体代码实体状态，或看不到当前架构和目标架构关系，打回文档门禁。
- H-1 若样本矩阵没有 100+ candidate、没有可重复验收子集、没有登录 / 替代 / low-signal 规则，打回矩阵计划。
- H-2 若 located、fallback_shown、blocked 混淆，或 marker 不说明证据关系，打回 jumpback 计划。
- H-3 若 Mindmap 规则允许导航、推荐、广告、重复卡片、时间戳或图片序号主导顶层节点，打回 Mindmap 计划。
- H-4 若验收不覆盖窄侧栏虚影、截断、遮挡和状态卡层级，打回 UX polish 计划。
- H-5 若报告不能作为人类唯一审查入口，或没有截图证据、PRD review、false-green audit、`sampleDistribution`、`fallbackPolicy`、semantic validator 固定命令，打回验收计划。
- H-6 若出现 fatal / major，或声明被扩大为最终 Monica-like UX、V2 或媒体理解，打回对应阶段。

允许声明：

```text
V1.0.x post-V1 hardening passed source jumpback, Mindmap quality, and real-site regression acceptance.
```

不得声明：

```text
最终 Monica-like UX complete。
复杂站点全量高质量通过。
视频 / 音频 / 图片内容已被理解。
V2 Memory / RAG ready。
Web Research / PPT / Deep Research ready。
```

## 16. V1.0.x Baseline Maintenance + UX Polish 开发计划

本阶段承接已冻结的 `V1.0.x Post-V1 Hardening` 基线，只做基线维护和当前 V1 范围内的体验打磨。它不重新打开 V1 complete，不把 post-V1 hardening 证据改写为新阶段通过证据，也不引入 V2/V4 能力。

实现阶段必须同时参考：

- `docs/active/project/design/v1-baseline-maintenance-ux-polish-prototype-review/index.html`：目标体验、目标总体设计、详细模块设计和用户操作路径。
- `docs/active/project/design/v1-baseline-maintenance-ux-polish-gap.drawio`：目标架构、当前架构差异、开发及验收计划、项目里程碑和出门条件。
- `docs/active/project/evidence/v1_post_v1_hardening/`：只读 frozen baseline，用于证明新阶段未退化。

阶段拆分：

```text
V1.0.x-BM-0：文档门禁，冻结 PRD、架构、开发计划、验收计划、stage gate、drawio 和 evidence 边界。
V1.0.x-BM-1：基线维护，复验 build、Runtime health、post-V1 validator、HTML 审查报告、人工冻结记录和敏感信息扫描。
V1.0.x-BM-2：启动与诊断 polish，优化本地启动、Runtime 离线提示、报告入口和诊断可读性。
V1.0.x-BM-3：V1 UX polish，优化 launcher、sidebar、按钮、状态卡、Mindmap、source evidence 和窄屏布局。
V1.0.x-BM-4：视觉与交互回归验收，截图证明无遮挡、截断、虚影、焦点抢占和 false-green。
V1.0.x-BM-5：出门审计，PRD review、false-green audit、HTML 报告、截图和人工 spot-check 无 fatal / major。
```

开发及验收计划：

| 子阶段 | 开发重点 | 验收重点 |
|---|---|---|
| `V1.0.x-BM-0` | 同步 active PRD、目标架构、开发计划、验收计划、stage gate、gap companion、drawio | 文档无 fatal / major；不改写 post-V1 frozen baseline |
| `V1.0.x-BM-1` | 构建、Runtime、validator、报告、冻结记录的回归维护 | `build`、`validate:post-v1-hardening`、Runtime health、敏感信息扫描均通过 |
| `V1.0.x-BM-2` | 启动脚本、README、Runtime offline / reconnect 诊断、报告入口 polish | 人工按最小路径可启动；Runtime 离线不空白；诊断信息可理解 |
| `V1.0.x-BM-3` | 当前 V1 范围内 launcher / sidebar / controls / status / Mindmap / source evidence polish | 不新增页面或能力；截图证明关键路径仍可操作 |
| `V1.0.x-BM-4` | Headless 优先视觉回归和必要 Chrome 截图 | 无遮挡、截断、虚影、焦点抢占；located / fallback / blocked 不混淆 |
| `V1.0.x-BM-5` | HTML 报告、PRD review、false-green audit、人工 spot-check | 无 fatal / major；只允许 scoped baseline maintenance / UX polish 声明 |

BM-3 完成后用户应看到的目标体验：

- 默认状态只看到低打扰贴边 launcher，不自动弹出大面板。
- hover / focus 后 launcher 明确显形；click 后展开当前 V1 sidebar。
- sidebar 中 Chat、Mindmap、Source Evidence、Debug、Settings 保持可达，按钮层级和状态卡不遮挡主任务。
- 窄侧栏下 Mindmap / Reading Map 节点、source card 和输入区不出现明显虚影、重叠或不可读截断。
- Runtime 离线、fallback、blocked 等异常状态有清晰文案，不冒充成功。

打回规则：

- BM-0 若文档没有明确本阶段不引入 V2/V4，打回文档门禁。
- BM-1 若 build、Runtime health、post-V1 validator 或敏感信息扫描失败，打回基线维护。
- BM-2 若 Runtime 离线仍空白或启动说明不可复现，打回启动诊断 polish。
- BM-3 若 UI polish 引入新顶级页面、默认本地文件读取、浏览器自动操作产品能力或最终 Monica-like UX 声明，打回。
- BM-4 若截图出现明显遮挡、截断、虚影或 source 状态混淆，打回 UX polish。
- BM-5 若报告不能作为人类审计入口，或 PRD review / false-green audit 出现 fatal / major，打回对应阶段。

允许声明：

```text
V1.0.x baseline maintenance and scoped UX polish passed regression acceptance.
```

不得声明：

```text
最终 Monica-like UX complete。
复杂站点全量高质量通过。
视频 / 音频 / 图片像素内容已被理解。
V2 Memory / RAG ready。
Web Research / PPT / Deep Research ready。
```

文档与证据入口：

```text
docs/active/project/stage-gates/v1-baseline-maintenance-ux-polish.md
docs/active/project/design/v1-baseline-maintenance-ux-polish-gap.md
docs/active/project/design/v1-baseline-maintenance-ux-polish-gap.drawio
docs/active/project/design/v1-baseline-maintenance-ux-polish-development-acceptance-plan.md
docs/active/project/design/v1-baseline-maintenance-ux-polish-readiness-audit.md
docs/active/project/evidence/v1_baseline_maintenance_ux_polish/
```

## 17. V2 Memory / Personal Knowledge Base 文档与后续开发计划

V2 的目标是把 Navia 从当前页伴读扩展为个人知识资产管理：用户主动保存当前网页、显式授权本地资料、进入 Knowledge Workspace、跨来源问答、查看 Source Trace / Knowledge Graph，并能撤销授权或删除 / 遗忘 source。

当前开发状态：

```text
V2-DOC / V2-0：文档门禁、合同草案、data_service spike、生命周期 ADR、semantic validator 规格已形成基线。
V2-1..V2-6：mock-first / controlled-boundary 自动化实现基线已完成并有子阶段 evidence。
V2-7：真实数据验收、截图、HTML 报告、PRD review、false-green audit 和最终 report.json 已通过。
```

阶段拆分：

```text
V2-DOC-0：文档门禁，补齐 PRD、目标架构、开发计划、验收计划、stage gate、gap companion 和 drawio。
V2-DOC-1：data_service 候选基线评估，明确可复用能力、不可直接复用能力、HTTP / MCP / CLI 接入边界和风险。
V2-DOC-2：V2 Adapter / Governance 合同冻结，定义 MemoryCandidate、KnowledgeSource、KnowledgeItem、EvidenceRef、Workspace、PermissionRoot、ForgetRequest。
V2-DOC-3：前端组件、服务状态和路由规格冻结，对齐原型审查页中的 SaveToKnowledgeCard、WorkspaceSwitcher、SourceLibrary、AskWithSources、EvidenceTrace、KnowledgeGraph、PermissionRoot、ForgetSource，并补充 ServiceStatusBanner、DataServiceStatusCard、KnowledgeBuildStatus。
V2-DOC-4：验收矩阵和 false-green 防线冻结，定义当前页保存、显式本地授权、跨来源问答、trace、graph、delete / forget 和 HTML 报告。
V2-DOC-5：文档审计，确认无 fatal / major 规格偏差后，才能进入未来 V2 实现规划。
```

当前放行口径：

```text
Go for V2 Memory / Personal Knowledge Base implementation-baseline record through V2-6.
V2-7 evidence passed; the active allowed claim is V2 planning-aligned local knowledge acceptance only. No-Go for V2 ready / RAG ready claims.
```

V2 实现阶段状态：

| 子阶段 | 状态 | 开发重点 | 验收重点 |
|---|---|---|---|
| `V2-0` | 已完成基线 | 复检 V2 文档门禁、合同、原型、data_service spike、Workspace 路由和验收 schema | 不把 prototype 或 data_service 能力写成 Navia 已实现 |
| `V2-1` | 已完成基线 | V2 Adapter / Governance skeleton | Adapter 能接收当前页 MemoryCandidate；权限、错误、trace、No-Go 语义可审计 |
| `V2-2` | 已完成基线 | SaveToKnowledgeCard、ServiceStatusBanner 和当前页保存入口 | 用户主动保存当前页，能在保存前看到 Runtime / Adapter / data_service 状态，并在保存后看到 ingest / build / trace 状态 |
| `V2-3` | 已完成基线 | data_service HTTP / MCP / CLI 受控边界适配，默认禁用真实外部服务 | 只经受控边界写入 / 查询 source；不得直接读写内部 workspace |
| `V2-4` | 已完成基线 | Knowledge Workspace shell | workspace switcher、source library、source detail、trace drawer 和服务状态条可用 |
| `V2-5` | 已完成基线 | Ask with Sources / Knowledge Graph | 回答和图谱节点必须显示 evidence refs 或 degraded reason |
| `V2-6` | 已完成基线 | PermissionRoot / ForgetSource | 显式授权、撤销、删除 / 遗忘和 before / after query 验证 |
| `V2-7` | 已完成 | 真实数据验收 | 当前页样本、本地显式授权样本、跨来源问答、trace、graph、删除验证、HTML 报告无 fatal / major |

用户目标体验：

- 用户在网页上只需点击一次“保存到知识库”，即可把当前页作为可追溯 source 进入指定 workspace。
- 用户在 Knowledge Workspace 中可以查看来源、摘要、证据、图谱、构建状态和后端服务状态，而不是只在聊天框里堆消息。
- 用户能明确区分 Navia Runtime 离线、V2 Adapter 未配置或 blocked、data_service 不可达 / 鉴权失败、单个 source 构建失败，不会把不同后端问题误读成同一个 generic error。
- 用户跨多个来源提问时，答案必须带 evidence refs 和 source trace，不允许无证据成功。
- 用户授权本地目录前，系统不读取任何本地文件；撤销授权后不得继续扫描。
- 用户删除 / 遗忘 source 后，可以通过再次查询确认该 source 不再参与回答、图谱或 trace。

V2-7 已完成出门证据：

| 任务 | 必须产物 | 目的 |
|---|---|---|
| 样本矩阵 | `sample-manifest.json` | 至少 24 source：12 web、6 explicit local docs、6 notes / markdown / other |
| 操作场景 | operation scenarios metadata | 至少 38 个场景：mixed query、Ask、Graph / Trace、Permission、Forget、service status |
| 自动化报告 | `report.json`、semantic validator log | 通过 `v2_memory_report.schema.json` 和跨字段语义校验 |
| 可视化报告 | `acceptance-report.html`、`screenshots/` | 人类可审计，包含服务状态、保存、问答、图谱、权限、遗忘截图 |
| 审计闭环 | `prd-review.md`、`false-green-audit.md` | 无 fatal / major；不把 mock-first 基线误声明为真实数据通过 |

打回规则：

- V2-DOC-0 若 active PRD、架构、开发计划、验收计划、stage gate、drawio 名称或范围不一致，打回文档门禁。
- V2-DOC-1 若把 data_service console 写成 Navia 产品 UI，或把 data_service 内部 workspace 写成 Navia 直接依赖，打回候选基线评估。
- V2-DOC-2 若未冻结权限、删除、trace、错误和跨服务边界，打回合同冻结。
- V2-DOC-3 若前端组件只停留在概念图，没有对应用户操作、服务状态、失败和验收证据，或没有区分 Runtime / Adapter / data_service / source build 状态，打回组件规格。
- V2-DOC-4 若验收不能证明删除 / 遗忘、显式授权和 evidence refs，打回验收计划。
- V2-DOC-5 若仍存在 `V2 ready`、默认本地读取、Web Research、PPT、Deep Research 或多 Agent 过度声明，打回审计。
- 后续若重新生成 V2-7 证据，仍必须包含真实数据 manifest、截图、HTML 报告、schema validation 和 semantic validator；缺任一项不得重新声明 planning-aligned local knowledge acceptance passed。

允许声明：

```text
V2 Memory / Personal Knowledge Base passed planning-aligned local knowledge acceptance.
```

V2-7 已通过后最多允许声明：

```text
V2 Memory / Personal Knowledge Base passed planning-aligned local knowledge acceptance.
```

当前实现基线不得声明：

```text
V2 implemented。
V2 Memory / RAG ready。
完整个人知识库产品完成。
默认本地文件读取。
data_service console 已等同 Navia 产品 UI。
Web Research / PPT / Deep Research ready。
```

文档入口：

```text
docs/active/project/stage-gates/v2-memory-personal-knowledge-base.md
docs/active/project/design/v2-memory-personal-knowledge-base-gap.md
docs/active/project/design/v2-memory-personal-knowledge-base-gap.drawio
docs/active/project/design/v2-memory-personal-knowledge-base-development-acceptance-plan.md
docs/active/project/design/v2-memory-personal-knowledge-base-readiness-audit.md
docs/active/project/design/v2-memory-personal-knowledge-prototype-review/index.html
```

### 17.1 V2-PX External Brain Productization 开发计划

V2-PX 只负责把已通过 planning-aligned acceptance 的 V2 Knowledge 能力形成可发现、可路由、可恢复的双容器产品体验。路线 A `Extension Workspace Page` 已冻结，PX-0..PX-4 已通过各自门禁；PX-5 因证据假绿被重新打开。当前 T02.2 输入已限定通过，下一项是 T03/R3 共享 semantic/AST 校验与纯报告流水线。路线 A/B 决策仍由 `design/v2-external-brain-workspace-hosting-adr.md` 约束，T03 不改变产品宿主或 public API。

| 子阶段 | 开发内容 | 开发前门禁 | 子阶段 E2E / PRD 检视 |
|---|---|---|---|
| `PX-0` | 冻结双容器、三个入口、Workspace route、`OpenWorkspaceAction`、验收 schema 和 semantic validator | PRD / 架构 / stage gate / drawio / 原型一致；合同 schema 可解析 | 外部挑战审计后重开为 PX-0.1，旧 PASS 结论废止 |
| `PX-0.1` | 同步 V2-7 完成态；修复原型 route/Back/Forget/a11y；冻结生命周期；收紧首批 Workspace/Report/截图合同和负向夹具 | 初版四份 schema、canonical route、逐容器 ID、before/after、artifact existence 和 summary 规则 | 历史第二轮外部审计发现 5 个 Major；本阶段未通过，转入 PX-0.1b |
| `PX-0.1b` | 修复外部审计的 lifecycle、source identity、scenario-aware observation、prior context/tab reuse、结构化 G4/G6/G7、可执行夹具和完整审计包问题 | Manifest v5、Report v12、Screenshot v6、Execution Observation v6、Human Review v3、63 条 RuleId、109 个 RFC 6902 case、自包含原型、durable Forget 和确定性 Gate 算法一致 | 完整包经独立复审无 fatal / major；否则 PX-0.2 No-Go |
| `PX-0.2` | 实现 semantic validator 命令、summary/G1-G7 重算、artifact/hash 检查和 RFC 6902 正负测试 runner | PX-0.1b 九份机器合同、Gate 算法、完整审计包和 fixture suite 经独立复审无 fatal / major | validator 与全部失败码通过；否则 PX-1 No-Go |
| `PX-1` | 先完成 WXT / Manifest V3 / CSP entrypoint spike，再新增 Extension Workspace entrypoint、router、直接打开 / 刷新 / Back / 重开 / 无效 ID 恢复 | 路线 A ADR、五类 route、extension permission 和回退条件审计闭环 | spike 六项事实、route component tests、真实扩展页面截图、PRD route review；失败则打回 PX-0，不静默切路线 B |
| `PX-2` | Side Panel 改为 Quick Surface，增加查看来源、打开工作台、在工作台中打开 | 420 / 360 UX 验收标准和入口文案冻结 | 三入口实际可点击；窄侧栏无遮挡；PRD 入口 review |
| `PX-3` | Background `OpenWorkspaceAction`、标签页复用、稳定 ID 交接、poll / reconnect | message / route 合同、非法 ID、重复打开与恢复语义闭环 | Side Panel / Workspace ID 一致；重复点击不重复 ingest；PRD 生命周期 review |
| `PX-4` | 宽屏 Workspace 组件拆分与产品化 | 组件责任、事实来源、键盘 / dialog / responsive 标准冻结 | Sources / Ask / Trace / Graph / Permission / Forget 真实数据交互截图；PRD UX review |
| `PX-5` | 按 T01→T02.x→T03→T04→T04.1 修复真实 Chrome 原始证据、共享验证、隔离重放与 root 一致性 | 前一 T 阶段限定 PASS；每条 candidate 单一 sealed run；不跨 run 拼接 | T03/T04 已限定通过；T04.1 必须新 run 全量重跑并独立审计 Fatal 0/Major 0 |
| `PX-6` | PX6-0..5 重算机器出门包，PX6-6 真实人类可见 Chrome 审查，PX6-7 最终化 | T04.1 artifactRoot closed；PX-6 文档外审和用户授权 | A01..A16、H01..H07、G1..G7 全绿且最终独立审计 Fatal 0/Major 0 后才允许有限声明 |

固定开发顺序为 `PX-0 -> PX-0.1 -> PX-0.1b -> PX-0.2 -> PX-1 -> PX-2 -> PX-3 -> PX-4 -> PX-5 -> PX-6`。PX-0.1b 未通过独立复审时不得进入 PX-0.2；PX-0.2 未通过可执行负向测试时不得进入 PX-1。每个子阶段必须先单独落盘 development / acceptance plan 和审计意见；失败时回到该子阶段计划，不得用后续截图掩盖前序合同或路由失败。

PX-5 内部修复严格为 `T01 -> T02.x -> T03 -> T04 -> T04.1 -> PX-6`。T03/T04 目标实体已在限定范围实现并通过独立审查。T04.1 不允许局部补 JSON：它保留 T03 原始 `validation_run` InvocationRecord 用于确定性比较，另生成 `replay_validation`-only resolved InvocationRecord 供 PX-6 解析，并在新空目录完整执行 R4-P/R4-E/T02/T03/T04，重新生成 unsigned ExitManifest 和独立审计。随后 PX6-0..5 只生成 machine-only package 并停止；PX6-6 等待真实人类提交；PX6-7 才允许最终化。

目标实现位置：

```text
apps/chrome-extension/entrypoints/background/index.ts
apps/chrome-extension/entrypoints/sidepanel/main.tsx
apps/chrome-extension/entrypoints/workspace/index.html
apps/chrome-extension/entrypoints/workspace/main.tsx
apps/chrome-extension/entrypoints/workspace/style.css
apps/chrome-extension/src/runtimeClient.ts
apps/chrome-extension/src/modules/knowledge_workspace/WorkspaceRouter.tsx
apps/chrome-extension/src/modules/knowledge_workspace/*Panel.tsx
apps/chrome-extension/src/modules/knowledge_workspace/*Drawer.tsx
apps/chrome-extension/src/modules/knowledge_workspace/*Dialog.tsx
apps/chrome-extension/e2e/*v2-external-brain-productization*
docs/active/project/evidence/v2_external_brain_productization/
```

历史 PX-5 package scripts 已由 T01..T04 分阶段入口取代，不得重新运行旧 generator/validator 覆盖候选。未来授权后的唯一顺序入口为：

```text
pnpm --dir apps/chrome-extension exec node e2e/run-v2-px-r4-snapshot-revalidation.mjs \
  --input-manifest <absolute-t04.1-input> --output-root <new-empty-t04.1-root>

pnpm --dir apps/chrome-extension exec node e2e/run-v2-px-6-exit-audit.mjs \
  --candidate-binding <absolute-json> --output-root <new-empty-px6-root>

pnpm --dir apps/chrome-extension exec node e2e/run-v2-px-6-exit-audit.mjs \
  --candidate-binding <absolute-json> --output-root <existing-waiting-px6-root> \
  --review-submission <human-authored-absolute-json>
```

第一条当前已有 T04 实现，但 T04.1 重跑未授权；后两条是 PX-6 待新增入口，当前不存在也不得提前运行。每个入口必须记录 argv、cwd、允许环境、exit result、带 SHA-256 的 stdout/stderr 和结构化 InvocationRecord；计划命令不能写成已通过。

V2-PX 实现不得修改 A Page Reading、C Mindmap 或 data_service 内部仓库，也不得为了打开 Workspace 新增 Runtime 平行事实接口。若确需公共合同变更，必须打回 PX-0。

### 17.2 V2.x Knowledge Dream Cycle 自动化知识维护后续开发路线

该路线当前只完成问题、边界和候选架构登记，不满足实际开发门禁，也不属于 PX-0..PX-6。未来建议顺序：

```text
KM-0 开源方案 spike、隐私威胁模型和用户研究
KM-1 KnowledgeMaintenancePolicy / MaintenanceRun 合同与状态机
KM-2 suggest-only duplicate / stale / organization proposals
KM-3 evidence-grounded SummaryRevision 与冲突保留
KM-4 Knowledge Maintenance Inbox、批量审查与“永不再建议”
KM-5 archive / quarantine / restore 可逆生命周期
KM-6 高风险 opt-in forget、物理文件操作沙箱和安全审计
KM-7 真实数据质量、false-forget、恢复和无越权验收
```

进入 KM-1 前必须先完成人类对 KM-0 技术路线的选择。当前不得直接开发自动遗忘或宿主文件移动，也不得把候选开源项目视为已选依赖。

## 18. V3 Media Companion 文档与后续开发计划

当前只执行 V3 文档开发，不进入实际代码开发。V3 的目标是把 Navia 从当前网页伴读扩展为视频页伴随理解，体验参考 Monica 在 YouTube 的视频总结 / Ask Video / Mindmap，以及 B站 AI 视频总结账号和工具中常见的视频省流总结、章节大纲、视频导图、字幕搜索、时间戳跳转和截图证据。

阶段拆分：

```text
V3-DOC-0：文档门禁，补齐 PRD、目标架构、开发计划、验收计划、stage gate、gap companion 和 drawio。
V3-DOC-1：竞品和目标体验冻结，明确 Monica-like YouTube 体验、B站 AI 视频总结体验、视频概览图、Media Mindmap、截图证据和视频反跳。
V3-DOC-2（历史基线）：原 V3.0 Transcript-first 与 YouTube+B站并行范围已由 §18.1 的 B站优先 B0..B6 替代。
V3-DOC-3（修订后）：V3.x 规划通用/云端 ASR、VLM、OCR、Gemini Video、live input、采样、隐私、成本、延迟和治理；显式当前标签页音频到本地 ASR 属于 V3-B3，不再延后。
V3-DOC-4：验收矩阵和 false-green 防线冻结，定义真实样本、degraded / blocked、timestamp jumpback、截图证据和 HTML 报告。
V3-DOC-5：文档审计，确认无 fatal / major 规格偏差后，才能进入未来 V3.0 实现规划。
```

未来 V3.0 实现阶段建议顺序：

| 子阶段 | 开发重点 | 验收重点 |
|---|---|---|
| `V3.0-0` | 复检 V3 文档门禁和实现前 audit | 不把 V3.x 多模态写成 V3.0 交付；不复用 V1 验收声明视频理解 |
| `V3.0-1` | Content Script Media Collector 和 `MediaPageContext` | YouTube / B站 metadata、标题、简介、时长、当前播放时间、字幕可用性和 degraded reason 可被真实页面采集 |
| `V3.0-2` | Transcript / subtitle / chapter / visible comment ingestion | transcript segment、chapter、评论 / 弹幕可见文本有 source、timestamp 和 fallback |
| `V3.0-3` | A Media Page Perception | 生成 media digest、timeline events、quality report；无字幕 / 无可见文本必须 degraded |
| `V3.0-4` | C Media Mindmap | 生成章节图、主题图、事件 / 论点 / 结论节点，并绑定 timeline source refs |
| `V3.0-5` | B Media Companion Renderer | 展示视频概览卡、章节时间轴、Media Mindmap、截图证据卡、Ask Video 问答 |
| `V3.0-6` | Media Jumpback | 节点 / 证据卡点击后 seek 到时间点；失败时 fallback / blocked 可见 |
| `V3.0-7` | 历史联合验收设想 | 已由 `V3-B6` 的 B站 12 页固定分母替代；YouTube 作为 `V3-Y1` 后续映射，不参与首轮出门 |

用户目标体验：

- 用户能像使用 Monica YouTube 视频助手一样，在视频页侧栏里快速看到视频概览、章节、重点和可继续追问的问答入口。
- 用户能像看 B站 AI 视频总结账号内容一样，看到结构化省流总结、时间线大纲、视频导图和可复制摘要。
- 用户能点击视频导图节点或证据卡，跳到对应视频时间点，而不是只看到不可验证的文字总结。
- 用户能看到目标时间点的视频截图证据，但 V3.0 不声称理解截图内容；真正画面理解归入 V3.x 多模态路线。
- 无字幕、无转录、无简介、无评论或平台限制导致低信号时，系统明确 degraded / blocked，不伪装成功。

打回规则：

- V3-DOC-0 若 active PRD、架构、开发计划、验收计划、stage gate、drawio 名称或范围不一致，打回文档门禁。
- V3-DOC-1 若竞品对标只写抽象口号，没有映射到 Monica-like YouTube 体验和 B站 AI 视频总结体验，打回目标体验。
- V3-DOC-2 若 V3.0 混入通用/云端 ASR、VLM 或 Gemini Video 真实交付承诺，打回范围冻结；显式当前标签页音频到本地 ASR 是已冻结例外。
- V3-DOC-3 若多模态路线缺少用户授权、隐私、采样、成本、延迟、EventStore / Trace 和 false-green 防线，打回架构规划。
- V3-DOC-4 若验收无法区分 timestamp seek、screenshot evidence、fallback 和 blocked，打回验收计划。
- V3-DOC-5 若仍存在“完整 Monica-like parity complete”“真实视频画面已理解”“直播理解 ready”等过度声明，打回审计。

允许声明：

```text
V3 Media Companion planning baseline ready for review.
```

未来 V3.0 完成后最多允许声明：

```text
V3.0 Bilibili-first video companion passed the frozen 12-page production acceptance.
```

当前实现基线不得声明：

```text
V3.0 implemented.
完整 Monica-like YouTube parity complete。
真实视频画面 / 音频已被理解。
通用/云端 ASR / VLM / OCR / Gemini Video ready；显式本地 ASR fallback 除外。
直播实时理解 ready。
跨视频知识库 / RAG ready。
```

文档入口：

```text
docs/active/project/stage-gates/v3-media-companion.md
docs/active/project/design/v3-media-companion-gap.md
docs/active/project/design/v3-media-companion-gap.drawio
docs/active/project/design/v3-media-companion-development-acceptance-plan.md
docs/active/project/design/v3-media-companion-readiness-audit.md
```

### 18.1 修订后的 B站优先实施顺序

原 `V3.0-1..7` 被下列更具体工作包 supersede；YouTube 只能在 B站锚点通过后复用已冻结合同，不得与首轮并行扩大范围。

| 子阶段 | 开发实体 | 验收和停止条件 |
|---|---|---|
| `V3-B0` | 冻结 BiliNote 研究决定、B站合同、H01-RDS 依赖和首个 BV | 文档/Draw.io/合同审计 Fatal=0、Major=0 |
| `V3-B1` | `BilibiliMediaCollector`、`MediaPageContext` | 真实 BV1ZpYd66ELP 得到正确 bvid/cid/时长/单P/字幕不可用；不得仅用 fixture |
| `V3-B2` | 页内字幕 resolver、字幕 hash 和 degraded UI | 至少 6 个有字幕 B站样本；无字幕样本不能生成大纲 |
| `V3-B3` | `MediaCaptureController`、`MediaCaptureGrant`、`LocalAsrAdapter`、`MediaIngestRun` | 指定 BV 真实标签页音频本地转写；取消/关页/Runtime 离线均清理；无自动下载请求 |
| `V3-B4` | A `VideoOutline`、`TimelineSegment`、C `MediaMindmapProjection` | 同一强类型对象派生图文与导图；节点证据覆盖率达门槛 |
| `V3-B5` | B `MediaCompanionRenderer`、`MediaJumpbackController` | Side Panel 420/360、Workspace 768/1280；时间跳转、fallback、键盘和 Axe 通过 |
| `V3-B6` | 真实 B站矩阵、持久化和出门报告 | 12 个 B站页；指定 BV 必须走 ASR 成功；H01-RDS 真实保存通过；独立审计 0 Fatal/0 Major |
| `V3-Y1` | YouTube collector mapping | 复用 `MediaPageContext/VideoOutline`，不得另造平行协议 |

每个子阶段开始前必须单独落盘开发计划、验收计划和实施前审计；每个子阶段完成后必须保存真实 Chrome 证据、PRD review 和 false-green audit。B3、B6 涉及音频授权与真实数据服务，属于高风险人类确认点。

### 18.2 H01-RDS 解阻先于 V3-B1

执行顺序固定为：

```text
PX-6 旧机器候选保持只读
-> H01-RDS Runtime adapter 修复与服务级验收（已完成候选）
-> 人类在真实 Chrome 完成 RDS-03/04 并重新执行 H01
-> V3-B0 文档/合同出门
-> V3-B1..B6
-> V3-Y1
```

不得把已通过的 Mock PX 路径改名为 real adapter；不得跨 Mock/real 两个 run 拼接 H01 或 V3 production evidence。

当前停点：H01-RDS 服务级候选已完成；V3-B0 文档已冻结并通过内部静态检查，但外部文档审查与用户代码授权尚未完成。不得越过 H01 三入口人工证据直接进入 V3-B1。
