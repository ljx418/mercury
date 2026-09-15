# Navia / 伴航 V1 PRD

> 2026-09-15 V2-PX 状态：T04.1 全新隔离重放与真实 Chrome 复验已取得独立实现出门 `LIMITED PASS`（Fatal 0 / Major 0 / Minor 0），候选为 `t04-r4-resolved-invocation-20260914t145648z`。PX6-0..5 的 machine-only 候选 `px6-machine-exit-20260914t164500z` 已通过独立实施出门审计（Fatal 0 / Major 0 / Minor 0），仅取得机器阶段 `LIMITED PASS`：A01..A14 passed、A15/A16 pending。真实人类仍须在可见 Chrome 完成 H01..H07，自动化不得代签。PX6-7 还需先冻结“FinalizationCandidate -> 独立终审 -> FinalDisposition”两步握手，当前 production finalizer fail-closed。Human Review、G7、`finalPassed` 仍为 pending/pending/false，因此 PX-5 仍 FAIL/REOPENED，PX-6 尚未通过，V2/RKM 均不得宣称完成。

> 2026-09-09 V2-RKM 文档增量：本机双服务的真实知识库、指定对话记忆与可逆维护目标见第17.3节。当前只批准文档，不批准代码/模型调用；PX-5仍FAIL、PX-6仍BLOCKED。无费用硬上限，仅用量与估算；永久Forget仍人工确认。

> 2026-09-09 PX-5 修复增量（历史立项基线，当前执行状态见 17.1）：用户批准Runtime显式路径授权、手动扫描/导入、撤销后阻止新扫描/导入，并采用隔离Git验收快照。新增接口/限制/并发语义以 [修复执行合同](design/v2-px-5-repair-execution-contract.md) 与 `contracts/v2_local_permission.schema.json` 为准。该增量当时要求先经实现前审计；当前 T01..T02.2 已取得各自限定结论，但 PX-5 仍 REOPENED、PX-6 仍 BLOCKED，不改变V1历史结论或承诺真实data_service/RAG。

版本：V1.0 PRD Baseline
日期：2026-05-31
产品名：Navia / 伴航
角色名建议：小航
阶段目标：Chrome 插件页面内交互优先的 Headless 伴随式 AI MVP

---

## 1. 产品背景

用户在浏览网页、阅读文章、查看技术文档、调研产品、整理资料时，经常需要即时理解当前页面内容，并进一步提问、总结、结构化整理、生成思维导图。传统 Chatbot 需要复制粘贴内容，缺乏当前页面上下文，也很难沉淀为后续个人知识库和个人 Agent 的底层能力。

Navia / 伴航的目标是构建一个伴随式 AI 系统：前端可以是 Chrome 插件、Web、App、未来桌面宠物，但核心能力必须是 Headless、可复用、可观测、可监督的本地 AI Runtime。

V1 的重点不是“大而全”，而是完成一个稳定闭环：

```text
当前网页上下文
  -> 单 Session AgentCore
  -> 本地意图识别
  -> 受控工具调用
  -> 摘要 / 问答 / Mermaid 思维导图
  -> Session 持久化与事件追踪
```

---

## 2. 一句话定位

Navia / 伴航是一个常驻在网页边缘的本地伴随式 AI 助手。V1 前端页面体验以当前 active 文档 `docs/active/project/interaction-prd/窗口交互_PRD.md` 和后续用户确认的 `V1 Launcher / Collapse / Resize` 阶段为准；较早的“无悬浮球、默认右侧侧边栏聊天面板”只代表历史 baseline，不再作为当前 V1 主线收口目标。系统能够理解当前网页，提供伴读问答、摘要生成、Mermaid / Evidence Card / Reading Map 思维导图，并以可观测、可监督的 Headless AgentCore 为后续个人知识库、观影观赛陪伴、个人秘书与多端产品化打基础。

---

## 3. 产品命名与品牌方向

### 3.1 英文名

Navia

语义方向：navigation、companion、AI、voyage。它代表在信息流、网页、知识和任务中陪用户一起航行。

### 3.2 中文名

伴航

语义方向：陪伴 + 导航。既适合 V1 网页伴读，也适合 V2 知识库、V3 观影观赛、V4 个人秘书和 V5 桌宠。

### 3.3 桌宠 / 角色名

小航

后续可以设计成一个小星舟、小导航精灵、小兽或小 AI 伙伴。

---

## 4. 总体产品路线

```text
V1：网页伴读 Companion + Headless Local AgentCore
V2：本地备忘 / 个人知识库 / 标签化总结 / 类 RAG 蒸馏
V3：伴随式观赛 / 观影 / 看直播体验
V4：个人秘书 / 深度研究 / PPT 生成 / Manus-like Agent 能力
V5：移动端迁移 / 云化部署 / 产品化改造 / 桌面宠物情绪价值
```

### 4.1 V1 定位

V1 是底座阶段：

- Chrome 插件的主前端体验是网页内悬浮球与双轨聊天面板；既有 Side Panel 只作为调试入口、兼容承载或过渡实现。
- Local Headless Runtime 是真正核心。
- AgentCore 是一个可控、可观测的单 Session 状态机。
- 本地模型是能力插件，不进入业务层。
- Session 质量优先于长期记忆。
- 监督机制优先于复杂智能。

---

## 5. V1 目标

V1 必须实现：

0. Contract-first Runtime Skeleton：API / Event / State / Tool / Budget / Error / ID / SSE 合同先于 AgentCore 实现。
1. 可在 Chrome 中安装的页面内 AI 助手插件。
2. 当前网页上下文识别与提取。
3. 基于当前网页的摘要生成。
4. 基于当前网页的问答。
5. Mermaid 思维导图生成与前端预览。
6. 本地小参数模型实现用户意图识别。
7. 网页内 AI 双轨面板支持基础文字对话，不依赖语音即可完成 V1 主流程。
8. 本地可微调模型用于思维导图生成。
9. AgentCore 采用可替换 CoreProvider 策略，V1.2 首选 `piAgentProvider`，并以 `MockCoreProvider` 支撑合同测试和 fallback。
10. 不直接接 MCP / Skill / 长期记忆管理；V1.2 只允许通过 D 模块定义轻量 Adapter 合同，不允许绕过 D Adapter Layer 和治理钩子。
11. 单 Session 聊天历史高质量持久化。
12. Agent 状态机可视化、可验证、可观测、可扩展。
13. Agent 具备预算、权限、上下文和本地文件访问监督机制。

V1 前端交互必须实现：

- 页面边缘可移动悬浮球。
- 悬浮球 hover 高亮与伸出小长条。
- 点击小长条后展开网页内 AI 双轨聊天面板。
- 窄距展开态默认约 `440px`，网页内容向左挤压。
- 半屏展开态约 `50vw`，网页继续被挤压。
- 超过 `52vw` 后进入覆盖式显示，最大覆盖宽度不超过 `80vw`。
- 拖回 `<48vw` 后恢复挤压式。
- 点击悬浮球或收起按钮后，面板收起，网页恢复原始布局。

V1.x 可选增强：

- 已部署 FunASR 后端语音识别接入。
- 语音 transcript 作为普通 user message 进入 AgentCore。

### 5.1 V1.1 前端体验高保真目标

V1.1 是 V1.0 之后的体验质量阶段，不改变 Runtime / AgentCore / API / Event / ToolResult / PageContext 合同。V1.1 的目标是把 V1.0 已打通的页面内悬浮球与 AI 双轨面板，从“功能闭环 + 交互骨架”升级为可对照 Figma 原型验收的高保真前端体验。

V1.1 必须实现的体验目标：

- 高保真还原 Figma Make 原型表达的“浏览器页面 + 浮动球 + 侧边插件面板 + 聊天区域”样式。
- 将当前工程型注入面板升级为设计系统化、组件语义清晰、可截图验收的前端界面。
- 保留 V1.0 已完成的 PageContext、Runtime 连接、SSE Chat、Mermaid Artifact、Session restore、push / overlay / resize / collapse recovery 行为。
- 引入视觉验收口径：Figma 对照、真实 Chrome、Playwright 截图基线、PRD A-F 状态截图。

V1.1 明确不做：

- 不新增 Runtime API。
- 不修改 AgentEvent / ToolResult / PageContext 合同。
- 不引入 MCP、Skill、RAG、多 Agent、浏览器自动操作。
- 不用 Chrome Side Panel 替代页面内悬浮球与网页内面板验收。
- 不在缺少 Figma 截图或普通 Figma `/design/` 节点基线时声明“视觉高保真通过”。

### 5.2 V1.2 AI 伴读架构分工目标

V1.2 仍处于文档开发阶段，目标是冻结“聊天”页签的 A/B/C/D 模块分工、工作区边界和 Adapter 合同，使后续多个 Codex 终端可以独立开发：

- A：网页信息提取、过滤、蒸馏与结构化总结。
- B：结构化数据、流式文本和 Mindmap 前端实时渲染。
- C：基于结构化网页 JSON 的 Mindmap 生成与反跳来源。
- D：CoreProvider + Adapter Layer，负责可替换 Agent Core 适配、MCP / Skill / API Adapter 编排、治理桥和 ToolResult / Artifact / Event / Trace 映射。

其中 A 模块定位为 `Page Perception / AgentCore Eyes`，即 AgentCore 的眼睛。A 负责识别网页和未来媒体环境中的可读事实，并把它们转成可追踪结构化上下文；A 不负责推理、最终回答、AgenticLoop、Artifact 创建、SSE 或外部工具执行。

V1.2 允许：

- 定义轻量 MCP / Skill / API Adapter 合同。
- 单 Session 连续上下文和 checkpoint。
- 结构化网页 JSON、段落标注和 source map。
- Mindmap 节点反跳到源 paragraph/chunk。
- 规划图文网页识别、OCR、表格/代码块识别、未来视频/直播识别的合同和路线。
- 使用 `MockCoreProvider` 做合同测试和自动化 fallback。
- 将 `piAgentProvider` 作为首选 Agent Core Provider，但真实接入前必须锁定 piAgent 仓库、版本或 commit、license、运行时和工具调用模型。

V1.2 明确不做：

- 真实高风险 MCP / Skill side effect 默认执行。
- 长期记忆。
- RAG。
- 多 Agent。
- 浏览器自动操作。
- 默认本地文件读取。
- 前端绕过 D 直接调用外部服务。
- piAgent 或其他 CoreProvider 直接写 `ArtifactRecord`、SSE、EventStore、Trace 或 UI。
- A 模块默认调用 OCR、视觉模型、视频流分析、直播流分析、MCP、Skill 或外部 API。

### 5.3 A 模块感知能力路线

A 模块内部能力统一使用 `A-Vx.y-z` 编号，编号规则见 `MODULE_VERSIONING.md`。

V1.2 阶段的 A 模块规划口径：

```text
A-V1.0-0：感知合同冻结
A-V1.0-1：文本 / DOM 结构识别
A-V1.0-2：图文网页识别
A-V1.0-3：OCR 识别规划
A-V1.0-4：表格 / 列表 / 代码块识别
A-V1.0-5：页面区域与信息密度识别
```

后续媒体感知规划：

```text
A-V1.12+：视频 / 直播等未来媒体感知规划
```

OCR 规划原则：

- OCR 是感知能力，但 OCR engine 执行必须作为受控 Adapter 接入，不能由 A 模块直接绕过治理调用。
- OCR 输出必须带来源、置信度、时间或区域信息。
- 无 OCR 或视觉能力时，A 只能基于 DOM 中的 `alt`、`caption`、`title`、`aria-label`、nearby text 描述图片相关事实。
- 不得把无法识别的图片内容伪装成已理解。

视频 / 直播规划原则：

- 视频和直播识别不进入当前 V1.2 实现，只做未来合同和架构路线规划。
- 视频/直播感知必须有采样策略、延迟预算、用户授权、隐私边界和 EventStore 追踪。
- 实时识别输出不能只存在 EventStream，必须可按时间轴和 session trace 回放。

### 5.4 A-V1.2 高质量网页感知层目标

A-V1.2 的阶段定位收敛为网页感知层，不做学习产物生成。本阶段目标是让 A 模块稳定成为 AgentCore 的“眼睛”，为 B/C/D 提供高密度、可验证、可反跳的页面事实输入。

A-V1.2 必须聚焦：

```text
高质量网页感知
+ 结构化页面摘要
+ 可反跳证据
+ Debug 可验证 JSON
```

A-V1.2 采用的产品技术组合路线：

```text
DOM baseline
+ extractor ensemble
+ A-owned schema normalization
+ SourceMap / jumpback
+ Quality Evaluator
+ DebugEvidenceBundle
+ 100-page corpus gate
```

该组合路线的产品含义是：A 不是“把网页原文塞给 D/C/B”，而是先把网页转换成高信号、低噪声、可追踪来源、可机器评估的事实输入。用户在 Debug 页看到的 JSON 必须能解释“系统读到了什么、过滤了什么、为什么认为可用或不可用”；下游 D/C/B 只能消费通过质量门槛的高信号结果。

A-V1.2 必须输出或规划输出：

- `StructuredPageContext`：当前页面的结构化上下文。
- `HighSignalPageContext`：过滤噪声后的高信号页面视图。
- `PerceptionDigest`：面向下游消费的结构化页面摘要，不是最终 assistant answer。
- `SourceMap / SourceRef`：每个关键内容项的来源证据和反跳 fallback。
- `PagePerceptionQualityReport`：机器可测的质量评估。
- `DebugEvidenceBundle`：用于 Debug 页和自动验收的可解释 JSON 证据包。

A-V1.2 明确不做：

- 不生成最终回答。
- 不生成 Flashcards、Quiz、Podcast、Notebook 或学习工作台产物。
- 不生成 Mindmap；C 模块基于 A 输出生成 Mindmap。
- 不创建 `ArtifactRecord`。
- 不发 SSE。
- 不写 EventStore / Trace。
- 不做 RAG、长期记忆、多 Agent、浏览器自动操作。
- 不直接调用 MCP、Skill、外部 API、OCR、VLM、ASR、视频或直播 engine。

A-V1.2 的最终验收必须使用至少 `100` 个复杂真实网页或可复现 HTML snapshot，覆盖新闻、博客、技术文档、GitHub README、产品文档、电商页、论坛页、表格页、代码页、图片富集页、中文页和低信号页等类别。低信号页必须正确 fail/degrade，不得为了通过率伪装为 pass。

A-V1.2 的公共合同消费规则：

- `HighSignalPageContext`、`PerceptionDigest`、`SourceMap / SourceRef` 和 `PagePerceptionQualityReport` 是 D/C/B 可消费的公共合同。
- 只有 `PagePerceptionQualityReport.downstreamReadiness = "pass"` 时，D/C 才能把 high-signal 输出作为主上下文。
- `degraded` 只能作为 fallback 或 Debug evidence。
- `fail` 必须回退到 `StructuredPageContext` 或返回 `PAGE_CONTEXT_REQUIRED`，不得伪造摘要、问答或思维导图输入。

A-V1.2 的最终 corpus 验收规则：

- 最终计入的页面必须有 `snapshotPath` 或等价可复现 HTML evidence；URL-only 记录只能用于 planning。
- 最终计入的页面必须有 `goldStatus = "reviewed"` 或 `goldStatus = "semi_auto_accepted"`。
- `planned`、`annotated` 或未审阅页面不得计入最终通过率。
- 第三方 extractor 依赖在 license、体积、性能、隐私、fallback 审计未批准前不得安装或成为必需依赖。

A-V1.2 用户验收场景：

- 普通文章页：Debug JSON 能显示主要段落、关键事实、sourceRefs 和 pass 质量原因。
- 技术文档页：列表、代码块、表格或 API 参数不被压成纯文本噪声，摘要项能回指来源。
- 电商 / 论坛 / 新闻页：推荐、广告、评论、导航和 cookie banner 被过滤或降级，并在 filtered evidence 中可见。
- 图片富集页：只能基于 DOM metadata 形成图片相关事实；没有 alt/caption/nearby text 时必须标记 unknown。
- 低信号 / 登录墙 / 付费墙：必须 fail 或 degraded，不能产出看似正常的高信号摘要。

### 5.5 当前阶段：A 高信号主链路与 C Mindmap 补强

当前阶段在已存在的 A-V1.2 和 C-V1.0 基线之上继续推进，不扩大到 V2。阶段目标是：

```text
先优化 A
-> 再补强 C
-> 最后完成 AC 联动并在 Debug/侧边栏中可验收
```

本阶段必须解决的产品问题：

- A 已有 HighSignal / Digest / QualityReport 证据，但主链路仍主要消费 `StructuredPageContext`；用户难以判断“系统到底读懂了什么”。
- C 已能生成 Mermaid，但节点选择主要来自 heading / paragraph fallback，没有优先使用 A 的高信号 digest 和 SourceRef。
- Debug 体验需要能同时查看 A 的结构化感知结果和 C 的思维导图来源，形成可人工快速验收的阅读证据链。

本阶段用户可见目标：

- 用户读取网页后，Debug 页能展示 A 的 `StructuredPageContext`、`HighSignalPageContext`、`PerceptionDigest`、`SourceMap` 和 `PagePerceptionQualityReport`。
- 用户点击 Mindmap 后，C 优先使用 A 的 `PerceptionDigest` 和 `SourceMap / SourceRef` 生成节点，而不是只依赖标题树。
- Mindmap 每个主要节点都能回指 A 的 `sourceRefs`；DOM 跳转失败时仍可展示 `textQuote` 或 `fallbackText`。
- 缺少页面上下文、A 质量为 `fail` 或来源证据不足时，不生成假摘要、假回答或假思维导图。

本阶段明确不做：

- 不新增 RAG、长期记忆、多 Agent、浏览器自动操作、联网搜索、OCR/VLM/ASR/video/live engine。
- 不让 A 创建 `ArtifactRecord`、SSE、EventStore 或 Trace。
- 不让 C 自行抽取网页正文；C 只能消费 A/Runtime 提供的结构化页面事实。
- 不把 piAgent 真实接入质量作为本阶段完成条件；D 只负责保持 CoreProvider / Adapter Layer 边界不被 A/C 绕过。

### 5.6 V1.2-AC-Native 原生侧边栏体验稳定化目标

V1.2-AC-Native 是当前 AC 联动之后的体验验收补强阶段。它不重开 A/C/D 功能范围，目标是把已经在 direct extension page 中跑通的 A/C/D/B 功能链路，稳定落到真实 Chrome 原生 Side Panel 用户体验中。

本阶段的产品目标：

```text
真实网页标签页
  + Chrome 原生右侧 Side Panel
  + Navia 聊天 / Debug / Mindmap
  + 读取当前页面、提交上下文、总结、问答、Mindmap、刷新恢复
```

V1.2-AC-Native 必须解决：

- 用户通过 Chrome 扩展 action 或快捷键稳定打开 Navia 原生 Side Panel。
- 截图证据必须同时显示真实网页与右侧 Navia Side Panel。
- Side Panel 窄宽度下，`读取当前页面`、`提交上下文`、`总结`、`Mindmap` 等入口必须可见、可滚动、可操作。
- Debug 页必须能在原生 Side Panel 中展示页面读取状态、A perception 状态和必要的 source / quality 信息。
- 摘要、页面问答、Mindmap 必须在原生 Side Panel 容器内完成，而不是在全屏 `chrome-extension://.../sidepanel.html` 页面中完成。
- 刷新或重开 Side Panel 后，Runtime session / activePage 状态必须可恢复或给出明确失败提示。

本阶段明确不声明：

- 不声明完整 V1.2 complete。
- 不声明完整 V1 complete。
- 不声明 A-V1.2 100-page production gate 已完成。
- 不以 direct extension page 代替原生 Side Panel 用户体验验收。
- 不引入 RAG、长期记忆、多 Agent、浏览器自动操作、语音、桌宠、PPT 或深度研究。

V1.2-AC-Native 的成功定义：

```text
用户能在真实网页右侧打开 Navia 原生 Side Panel，
并在同一个 Side Panel 中完成读取、Debug、总结、问答、Mindmap 与恢复的核心路径；
所有通过声明都有截图、截图 metadata、Runtime API、native-ux 测试或结构化 blocker 支撑。
```

### 5.7 V1.2-AC-Quality A/C 质量深化目标

V1.2-AC-Quality 是 V1.2-AC-Native 之后的 A/C 质量深化阶段。它不重做原生 Side Panel 容器，不扩大 D/B 职责，目标是把当前已能在原生 Side Panel 中跑通的 A/C 功能链路，提升为更稳定、可解释、可反跳、可扩展验收的真实网页伴读能力。

本阶段目标：

- A 模块继续作为 AgentCore 的“眼睛”，聚焦高质量网页感知、结构化页面摘取、可反跳证据和 Debug 可验证 JSON。
- C 模块继续作为思维导图生成服务，优先消费 A 的 `PerceptionDigest`、`SourceRef` 和 `QualityReport`，生成 digest-first Mermaid mindmap。
- AC 联动必须在 Runtime 主链路中可见，不得只停留在离线 evidence。
- Debug 必须让开发者和验收者快速判断 A 是否提取出高质量内容、C 是否真正使用 A 的 digest/source，而不是 heading-only fallback。
- 真实网页验收样本必须继续扩展，覆盖中文复杂页、图文混排页、技术文档、README、低信号页和长内容页。

本阶段用户可见体验目标：

- 用户在真实网页右侧打开 Navia 原生 Side Panel 后，可以读取当前页面。
- Debug 能用摘要卡片说明 A 的页面质量状态、digest 质量、sourceRef 覆盖和低信号降级原因。
- 用户触发 Mindmap 后，C 输出的 Mermaid 能在 Side Panel 中展示；如果降级，则能看到 fallback 原因和可读 source fallback。
- 验收者能通过 HTML 报告快速看到每个网页的截图、URL、A quality、C nodeSourceMap、source fallback 和最终结论。

本阶段样本要求：

- 至少 `12` 个真实网页或可复现 snapshot 进入样本矩阵。
- 至少覆盖 `6` 类页面：中文复杂页、图文混排页、技术文档、GitHub README、低信号页、长内容页。
- 至少 `5` 个页面必须在真实 Chrome 原生 Side Panel 中完成读取 -> Debug -> Mindmap -> source fallback 验收。
- 每个计入通过的页面必须有 URL 或 `snapshotPath`、category、expectedRisk、runtime evidence、截图、metadata 和结论。

本阶段成功定义：

```text
真实网页 / snapshot
-> A StructuredPage + HighSignal + PerceptionDigest + SourceMap + QualityReport
-> D ToolResult / Artifact / Event / Trace 映射
-> C digest-first Mermaid + nodeSourceMap
-> B Debug / Mindmap / Source fallback 可复核
-> HTML 验收报告和 false-green audit 可追溯
```

本阶段不得声明：

- 完整 V1.2 complete。
- A-V1.2 100-page production gate complete，除非单独跑完 A-V1.2 100-page gate。
- 最终网页内悬浮球 / 双轨面板体验 complete。
- RAG、长期记忆、多 Agent、浏览器自动操作、OCR/VLM/ASR/video/live engine ready。

本阶段完成后只能声明：

```text
V1.2-AC-Quality 阶段 A/C 质量深化与真实网页扩展通过。
```

### 5.8 V1.2-AC-Jumpback MVP 来源反跳最小闭环目标

V1.2-AC-Jumpback MVP 是 V1.2-AC-Quality 之后的 C/B/Integration 体验补强阶段。它不重做 A 的感知质量，也不扩大 D 的 CoreProvider 范围，目标是把 C 已生成的 `nodeSourceMap`、`sourceRefIds`、`fallbackText` 和 `jumpback` 元数据变成用户可操作的最小反跳闭环。

本阶段目标：

- C 模块生成稳定 Mermaid node id，并能与 `MindmapNodeSourceMap` key 一一对应。
- B 模块在用户点击 Mindmap 节点时展示来源证据卡片。
- Content script 在用户触发后尝试基于 `selector`、`domPath` 或 `textQuote` 定位网页来源。
- DOM 定位成功时滚动并临时高亮来源；失败时展示 `fallbackText` / `textQuote` 和结构化失败原因。
- Debug / HTML 报告能让验收者看清每次点击使用了什么定位方式、是否成功、失败时如何降级。

本阶段用户可见体验目标：

- 用户打开真实网页右侧的 Navia Side Panel。
- 用户生成 Mindmap。
- 用户点击一个 Mindmap 节点。
- Side Panel 展示该节点的来源证据卡片。
- 如果来源 DOM 可定位，网页滚动并高亮到对应内容；如果不可定位，Side Panel 展示可读 fallback evidence。

本阶段不得声明：

- Monica 级复杂网页精准反跳完成。
- 完整 V1.2 complete。
- 完整 V1 complete。
- PDF / OCR / 视频 / 直播反跳完成。
- RAG、Memory、Web Research、PPT 或浏览器自动操作 ready。

本阶段完成后只能声明：

```text
V1.2 Mindmap source fallback and basic jumpback MVP complete.
```

---

## 6. V1 非目标

V1 明确不做：

- 完整个人知识库。
- 自动保存所有网页。
- 多网页 RAG。
- 长期记忆管理。
- MCP 直连；V1.2 仅允许通过 D 模块定义受控 Adapter 合同。
- Skills 直连；V1.2 仅允许通过 D 模块定义受控 Adapter 合同。
- 多 Agent 编排。
- 浏览器自动点击和自动操作。
- 深度研究。
- PPT 生成。
- 观赛 / 观影 / 直播实时理解。
- 桌面宠物。
- 云端账号系统。
- 移动端同步。
- 默认读取本地文件。
- 划词菜单、网页内右键菜单、全局搜索框、多窗口停靠等复杂入口。

---

## 7. 用户画像

### 7.1 研究型阅读用户

经常阅读文章、论文、技术博客、产品文档，希望快速理解并追问细节。

典型问题：

- 这篇文章讲了什么？
- 核心观点有哪些？
- 这段话什么意思？
- 能不能生成一张思维导图？
- 这篇文章对我的项目有什么启发？

### 7.2 开发者 / 产品经理

经常浏览技术文档、GitHub README、产品说明、竞品页面。

典型问题：

- 总结这个项目的架构。
- 这个 API 怎么用？
- 帮我把这篇文档整理成开发计划。
- 生成 Mermaid mindmap。

### 7.3 知识管理用户

希望将浏览内容逐步沉淀为个人知识资产。V1 先关注 Session 质量，V2 再做长期知识库。

典型需求：

- 保存这次阅读上下文。
- 下次打开还能看到这次 Session。
- 保留生成的摘要和思维导图。

---

## 8. 核心用户故事

### 8.1 网页伴读摘要

作为用户，我打开一篇文章后，希望通过网页边缘悬浮球展开 AI 面板并点击“总结”，AI 能基于当前网页生成结构化摘要，而不需要我复制粘贴正文。

验收：

- 能显示当前网页 title / url / domain。
- 能抽取正文或可用文本。
- 能生成 TL;DR / 结构化摘要 / 要点式摘要。
- 摘要 Artifact 写入 Session。

### 8.2 当前网页问答

作为用户，我希望直接问“这篇文章里的主要论点是什么”，系统能基于当前网页回答。

验收：

- 用户输入进入 AgentCore。
- IntentRouter 识别 `ask_page`。
- 调用 `answer_from_page` 工具。
- 回答能追踪到 pageRef / chunkRef。
- 当前网页没有足够信息时，应明确说明不足。

### 8.3 选区解释

作为用户，我希望选中网页中的一段内容并让 Navia 解释。

验收：

- Content Script 能读取 selectedText。
- IntentRouter 识别 `explain_selection`。
- 回答优先基于选区和附近上下文。

### 8.4 Mermaid 思维导图

作为用户，我希望一键把当前网页转成 Mermaid mindmap 并预览。

验收：

- 后端生成 Mermaid mindmap 源码。
- Mermaid 语法可渲染。
- 节点层级和数量受限。
- 校验失败自动修复一次。
- 修复失败返回可读错误。

### 8.5 语音输入

语音输入是 V1.x 增强能力，不阻塞 V1 complete 的 Chrome 文字对话验收。

作为用户，我希望点击麦克风，用语音提问当前网页。

验收：

- 浏览器采集音频。
- 后端调用 FunASR 返回 transcript。
- transcript 作为 user message 进入 Session。
- AgentCore 按普通文本输入处理。

### 8.6 可观测 Agent

作为开发者，我希望看到 Agent 当前状态、工具调用、预算消耗和事件流。

验收：

- 前端或调试面板能看到状态流。
- 每次状态迁移写 EventLog。
- `/v1/agent/state-machine/mermaid` 输出状态图。
- `/v1/sessions/{session_id}/trace` 输出本次 Session 追踪。

---

## 9. 功能需求

### 9.1 Chrome Extension

#### 页面内交互 Shell

前端页面体验必须完全对齐 `docs/active/project/interaction-prd/窗口交互_PRD.md`。

必须支持：

- 页面边缘 AI 悬浮球。
- 悬浮球上下拖动与贴边。
- hover 高亮和伸出小长条。
- 点击小长条展开网页内 AI 面板。
- 左轨悬浮球 / avatar。
- 右轨 Chatbox。
- 窄距 `440px` 挤压网页。
- 半屏 `50vw` 挤压网页。
- 超过 `52vw` 覆盖网页，最大 `80vw`。
- 拖回 `<48vw` 恢复挤压式。
- 面板左边界 resize handle。
- 点击悬浮球或收起按钮关闭面板并恢复网页布局。
- Chatbox。
- 当前页面信息。
- 摘要卡片。
- Mermaid mindmap 预览。
- 语音输入按钮。
- Agent 状态。
- 当前预算消耗。
- 错误与重试入口。

Chrome Side Panel 允许保留为内部调试或兼容入口，但不得替代 V1 页面内交互验收。

约束：

- UI 不直接调用模型。
- UI 不保存 Agent 核心状态。
- UI 只调用 Local Runtime API。
- 网页内面板通过 SSE 消费 `/v1/chat/stream`；Agent events 后续可复用 SSE 或扩展 WebSocket。

#### Content Script

必须支持：

- 读取 title / url / domain。
- 抽取 headings。
- 抽取 visibleText。
- 抽取 selectedText。
- 生成 cleanedText。
- 计算 contentHash。
- 发送 PageContext 到 Local Runtime。

V1 优先支持：

- 普通文章页。
- 博客页。
- 新闻页。
- 技术文档页。
- GitHub README 类页面。
- 产品介绍页。

暂不保证：

- PDF 完整解析。
- Canvas 渲染内容。
- 视频字幕。
- iframe-heavy 页面。
- 登录态复杂应用。

### 9.2 Local Headless Runtime

必须提供：

- HTTP API。
- `/v1/chat/stream` 使用 SSE；Agent events 可先用 SSE，ASR 保留 WebSocket 扩展点。
- SessionStore。
- EventLog。
- AgentCore。
- ToolRegistry。
- ModelAdapter。
- Governance Plane。
- Observability Plane。

基础 API：

```text
GET  /v1/health
GET  /v1/models/status
POST /v1/sessions
GET  /v1/sessions/{session_id}
POST /v1/page/context
POST /v1/chat/stream
POST /v1/page/summarize
POST /v1/page/mindmap
WS   /v1/asr/stream
WS   /v1/agent/events
GET  /v1/agent/state
GET  /v1/agent/state-machine/mermaid
GET  /v1/sessions/{session_id}/trace
```

运行约束：

- 默认只监听 localhost。
- 默认只绑定 `127.0.0.1`，不得监听 `0.0.0.0`。
- CORS / Origin allowlist 只允许 Chrome extension origin 和明确配置的 localhost dev origin。
- 普通日志不得打印完整网页正文、选区全文或 transcript 全文。
- 默认不暴露公网。
- 默认不读取本地文件。
- 默认不调用远程模型，除非显式配置。
- 所有工具调用必须通过 Governance Plane。

### 9.3 AgentCore

V1 AgentCore 采用可替换 CoreProvider 策略。V1.2 首选 `piAgentProvider`，但 piAgent 不得直接写 Navia 的 Artifact、SSE、EventStore、Trace 或 UI；所有 Core 输出必须经 D Adapter Layer 映射为 Navia 合同。真实接入前必须完成 piAgent 仓库、版本或 commit、license、运行时和工具调用模型锁定。

保留：

- Agentic Loop。
- Tool Registry。
- Message History。
- Event Stream。
- State Management。
- PreToolUse / PostToolUse Hook。
- Budget Control。
- Permission Gate。
- Trace。

不接入：

- MCP。
- Skills。
- 长期记忆。
- 多 Agent。
- Shell 执行。
- 自动文件系统搜索。
- 自动浏览器操作。

### 9.4 Intent Router

支持意图：

```text
summarize_page
ask_page
explain_selection
generate_mindmap
extract_key_points
voice_command
unknown
```

输出格式：

```json
{
  "intent": "summarize_page",
  "confidence": 0.91,
  "requires_page_context": true,
  "requires_selection": false,
  "tool": "summarize_page",
  "arguments": {
    "style": "structured"
  }
}
```

策略：

- V1 可先用 rule-based + local small model。
- JSON schema 校验必须存在。
- confidence 低时进入 fallback，不应盲目调用高成本工具。

### 9.5 工具清单

V1 默认允许：

```text
read_current_page
summarize_page
answer_from_page
explain_selection
generate_mindmap
asr_transcribe
```

V1 默认禁用：

```text
read_local_file
search_local_workspace
shell
browser_click
browser_automation
network_crawl
```

### 9.6 单 Session 管理

V1 不做长期记忆，但必须把单 Session 做实。

质量要求：

- 刷新网页或重新展开网页内面板后 Session 不丢。
- 每轮问答能追溯到 PageContext。
- 每次工具调用可追踪。
- 每个 Artifact 可追溯到来源网页。
- 长对话支持 checkpoint 压缩。
- 预算消耗进入 budget ledger。
- EventLog 可重建一次 turn。

---

## 10. 非功能需求

### 10.1 隐私

- 默认本地运行。
- 默认不读取本地文件。
- 默认不自动保存所有网页。
- 页面内容只在用户打开插件或触发操作时进入 Runtime。
- 外部模型调用必须明确配置。
- 用户可清空 Session。

### 10.2 性能目标

- 悬浮球首次注入时间 < 1s。
- 网页内 AI 面板展开时间 < 1s。
- 普通文章 PageContext 抽取 < 2s。
- Intent 检测 < 1s。
- 摘要首 token 延迟 < 5s。
- Mindmap 生成 < 20s。
- ASR 短语音转写 < 5s。

### 10.3 可用性

- Local Runtime 不可用时，插件提示启动本地服务。
- 模型不可用时，展示模型状态。
- FunASR 不可用时，禁用语音按钮。
- Mermaid 渲染失败时展示源码和错误。

### 10.4 可扩展性

- Chrome Extension、Web、App 共用 Runtime API。
- AgentCore 与模型解耦。
- AgentCore 与工具解耦。
- Session Plane 可升级为 V2 Memory Plane。
- Governance Plane 可升级为 V4 Approval / Task Safety Gate。

### 10.5 可测试性

- 状态机 transition table 可测试。
- Tool call 可 mock。
- Model adapter 可 mock。
- Session replay 可测试。
- Event schema 可测试。
- Budget exhaustion 可测试。
- Permission denial 可测试。

---

## 11. 成功指标

V1 成功不是功能数量，而是底座质量。

### 用户价值指标

- 用户可在当前网页内嵌 AI 面板完成摘要、问答、mindmap。
- 用户不需要复制粘贴正文。
- 用户能看到 Agent 正在做什么。
- 用户能控制是否继续高成本操作。

### 工程质量指标

- 状态机可视化。
- 事件流可追踪。
- 单 Session 可恢复。
- 工具调用有预算和权限监督。
- Runtime API 可被 Chrome/Web/App 复用。

---

## 12. V1 结论

## 13. V1.2 Closeout 收关目标

`V1.2-Closeout` 是 V1.2-AC-Jumpback MVP 之后的生产级完成声明前收关阶段。它不新增产品大能力，不把 V1.2 扩大为 RAG、长期记忆、Web Research、浏览器自动操作、PPT 或 Deep Research；它只把已完成的 A/C/D/B 主链路从“阶段性可用”推进到“可用真实证据声明 V1.2 完成”。

### 13.1 用户体验目标

用户在真实 Chrome 原生 Side Panel 中可以完成：

```text
打开真实网页
-> 读取当前页面
-> 查看 Debug JSON / A quality / sourceRefs
-> 生成摘要或问答
-> 生成 Mindmap
-> 点击 Mindmap 节点或来源入口
-> 网页正文滚动 / 高亮到对应来源
-> 定位失败时看到清晰 fallback evidence 和失败原因
```

### 13.2 收关范围

必须补强：

- 真实 Chrome 中的 Jumpback 截图级验收。
- A SourceRef / selector / textQuote / fallbackText 质量提升。
- 更多真实网页 Jumpback 样本覆盖。
- Mindmap 节点点击、hover / selected 状态、证据面板和失败提示细化。
- V1.2 complete 声明前的 PRD 复检、false-green audit 和出门报告。

不得声明：

- Monica 级所有网页精准反跳。
- OCR / 视频 / 直播 / PDF / iframe / shadow DOM / 虚拟列表完整反跳。
- RAG、长期记忆、Web Research、PPT、Deep Research、桌宠或多 Agent ready。
- 完整 V1 网页内双轨交互体验完成。

### 13.3 完成声明

只有 `V1.2-Closeout` 通过后，才允许声明：

```text
V1.2 AI Reading mock-first product path complete.
```

即便通过，也仍不得声明完整 V1 complete；V1 complete 仍依赖最终网页内交互体验与全量 PRD A-F 状态验收。

---

## 14. V1.3 Evidence Card Mindmap 体验升级目标

`V1.3` 是 V1.2 AI Reading mock-first product path 完成后的思维导图体验升级阶段。本阶段不新增 RAG、长期记忆、Web Research、PPT、Deep Research、多 Agent 或浏览器自动操作；它只把当前偏 Mermaid 默认渲染的 Mindmap 升级为 Navia 自有的 `Evidence Card Mindmap` 主体验。

### 14.1 用户体验目标

用户在真实 Chrome 原生 Side Panel 中可以完成：

```text
读取当前网页
-> 生成 Mindmap
-> 看到 Evidence Card 风格的结构化导图
-> 点击节点
-> 节点进入 selected 状态，相关边线 / 邻接节点高亮
-> source evidence panel 展示 textQuote / fallbackText / sourceRefIds
-> 用户触发定位时，网页正文 DOM highlight 或显示 fallback evidence
```

### 14.2 节点体验要求

每个主要节点应是可读的证据卡片，而不是单纯 Mermaid 文本节点。卡片至少表达：

- 节点标题。
- 一句话摘要或 note。
- 来源数量。
- 置信度 / quality 提示。
- 标签或节点类型。
- hover / focus / selected 状态。
- 来源缺失或降级原因。

### 14.3 渲染策略

V1.3 采用双轨渲染：

```text
主视图：Evidence Card Mindmap
降级：Mermaid visual / Mermaid source / source fallback
```

Mermaid 继续作为可审计 source 和 fallback，不再作为 V1.3 的体验上限。

### 14.4 边界

V1.3 不改变 A/C/D 的核心职责：

- A 仍只负责 page perception / digest / sourceRefs / qualityReport。
- C 仍只负责 mindmap tree、Mermaid source、nodeSourceMap 和 validation。
- D 仍是 ToolResult / Artifact / Event / Trace 唯一出口。
- B 只负责 Evidence Card Mindmap 渲染和用户触发的 source interaction。

V1.3 完成后只允许声明：

```text
V1.3 Evidence Card Mindmap experience complete.
```

不得声明完整 V1 complete、Canvas Knowledge Map complete、V2 Memory / RAG ready 或 V4 Web Research / PPT / Deep Research ready。

### 14.5 本阶段开发目标和验收计划

用户已确认 V1.3 作为当前阶段目标。本阶段开发和验收以 `docs/active/project/stage-gates/v1.3-evidence-card-mindmap.md` 为门禁入口，并以以下六个子阶段组织：

| 子阶段 | 产品目标 | 出门条件 |
|---|---|---|
| `V1.3-0` | 冻结 Evidence Card view model、schema、截图证据、No-Go 和报告口径 | PRD / 架构 / 验收计划 / gap 图完成一致性审计，无 fatal / major |
| `V1.3-1` | B 从既有 Mindmap Artifact 和 `nodeSourceMap` 派生 EvidenceCardViewModel | normal、missing source、duplicate label、long text fixture 通过 |
| `V1.3-2` | Evidence Card 卡片树、视觉 token、边线层级和窄 Side Panel 可读性 | 截图证明无文本溢出、遮挡、节点重叠或不可读 |
| `V1.3-3` | hover、focus、selected、neighbor highlight 和 source evidence panel | 点击任一主要节点后来源证据可稳定展示 |
| `V1.3-4` | 复用 V1.2 Jumpback / fallback，区分 DOM success、fallback shown、blocked | UI、截图 metadata 和 report.json 三处状态一致 |
| `V1.3-5` | 真实网页 / snapshot 验收矩阵、PRD 复检、false-green audit、HTML 报告 | 至少 8 页矩阵，至少 3 个真实 Chrome 原生 Side Panel 截图级样本 |

本阶段必须优先补齐的体验质量问题：

- C 语义标签压缩：长 digest 句子必须变成卡片可读标签，原始证据仍保留在 source / fallback 字段。
- C 主题归并质量：digest 节点应归入可解释主题，避免大量平级长节点。
- B Mindmap 可读性：窄 Side Panel 中保持两级结构、密度提示、折叠和来源证据可读。
- Source interaction 可信度：DOM highlight 成功、fallback、blocked 必须严格区分，不能把 fallback 伪装成成功。
- 验收证据可信度：截图、HTML 报告、JSON 结论和 PRD 复检必须相互一致。

当前已有实现可作为 V1.3 基线，但不能替代出门验收。只有 `V1.3-0` 到 `V1.3-5` 全部证据闭环后，才能声明 `V1.3 Evidence Card Mindmap experience complete`。

### 14.6 长期规划

长期 Mindmap / Knowledge Map 路线：

```text
V1.3：Evidence Card Mindmap，提高当前单页导图质感、可读性和可验证性。
V1.4 / V1.x：双栏阅读地图，把 Mindmap 变成 Side Panel 伴读导航。
V2：Canvas Knowledge Map，承接多网页知识卡、会话沉淀和本地知识库。
V4：研究任务图谱 / PPT Agent 图谱，承接深度研究和个人秘书能力。
```

### 14.7 V1.4 Reading Map Side Panel Navigation

V1.4 承接 V1.3 Evidence Card Mindmap，不改变 A/C/D 合同，不引入 Canvas / Memory / RAG / Web Research / PPT / Deep Research。阶段目标是把 Evidence Card Mindmap 从“会话中的一张导图结果”升级为 Side Panel 内可连续使用的阅读地图导航。

目标用户路径：

```text
读取当前网页
-> 生成 Mindmap
-> Side Panel 显示 Reading Map 双栏视图
-> 左栏选择主题 / 节点
-> 右栏展示节点摘要、来源数量、质量状态、textQuote / fallbackText
-> 用户触发 source jumpback
-> UI 明确区分 located / fallback shown / blocked
```

V1.4 只允许声明：

```text
V1.4 Reading Map Side Panel navigation experience complete.
```

不得声明完整 V1 complete、Canvas Knowledge Map complete、V2 Memory / RAG ready 或 V4 Web Research / PPT / Deep Research ready。

V1 的核心原则：

```text
先做可控 Agent，再做聪明 Agent。
先做单 Session 质量，再做长期记忆。
先做 Headless Runtime，再做多端 UI。
先做状态机和监督，再做复杂任务执行。
```

### 14.8 V1 Gemini Style Pass 当前侧边栏体验优化

`V1 Gemini Style Pass` 是 V1.3 / V1.4 体验闭环后的当前前端体验质量阶段。它把 Gemini 审查原型中已认可的视觉语言、按钮设计、状态反馈和当前网页上下文呈现迁移到真实 Chrome extension sidepanel，但不扩大产品交互范围。

本阶段目标体验：

```text
用户打开当前右侧 Navia sidepanel
-> 看到清晰的 Navia 品牌、Runtime 状态、历史会话入口和当前网页上下文状态
-> 使用现有按钮完成读取网页、提交上下文、总结、问答、Mindmap、解释选区
-> 在 Chat artifact 中查看 Evidence Card Mindmap、Reading Map 和 Source Evidence
-> 能清楚区分 located、fallback shown、blocked 等来源证据状态
-> Debug / Settings 仍可用但不抢占主阅读流程
```

本阶段必须保持：

- 当前真实产品页面结构仍是 `Chat / Agent / Debug / Settings`。
- Mindmap、Reading Map、Source Evidence 仍属于 Chat artifact 内体验。
- Agent 仍是能力边界占位，不声明多 Agent 能力。
- Runtime public API、Artifact 合同、EvidenceCardViewModel、ReadingMapViewModel 不变。
- Chrome content script 当前右侧 iframe sidebar 行为不变。

本阶段不得引入：

- 新的真实 Map / Sources 顶层产品页。
- 真实 floating ball、hover strip、collapse handle、drag resize、overlay breakpoint。
- RAG、Memory、Web Research、PPT、Deep Research、多 Agent、语音、桌宠、浏览器自动操作产品能力或默认本地文件读取。

本阶段在自动化验收全部通过、PRD 复检和 false-green audit 无 fatal / major、复杂站点边界说明闭环、且人工产品体验核查完成后，才允许进入以下候选声明：

```text
V1 Gemini style pass for current sidebar baseline complete.
```

不得声明：

```text
完整 V1 complete。
最终 Monica-like floating ball / collapse / resize UX complete。
V2 Memory / RAG ready。
Web Research / PPT / Deep Research ready。
```

### 14.9 V1 Launcher / Collapse / Resize 交互基线

用户已确认将 Gemini 原型中的 launcher、折叠、resize、拖拽和状态机提升为当前真实前端体验目标。本阶段在 content script 页面层实现交互外壳，sidepanel iframe 内的 Chat / Agent / Debug / Settings、Mindmap、Reading Map、Source Evidence 体验保持不变。

目标用户路径：

```text
普通网页打开
-> Navia 默认只显示贴边 launcher，不展开 sidebar，不挤压正文
-> 用户 hover 或键盘 focus 后 launcher 从边缘弹出为完整悬浮球
-> 用户点击 floating launcher 展开右侧 sidebar
-> 展开后再次点击 launcher 收起 sidebar，页面恢复可用宽度
-> 用户拖拽 launcher 调整位置并贴边
-> 用户拖拽 sidebar 左边界调整宽度
-> 宽工作区或窄视口进入 overlay，不继续挤压正文
```

不得引入 RAG、Memory、Web Research、PPT、Deep Research、多 Agent、语音、桌宠、浏览器自动操作产品能力或默认本地文件读取。

### 14.10 V1 Mainline Closeout Candidate 主线收口目标

`V1 Mainline Closeout Candidate` 是当前 V1 主线的总收口阶段。它不新增 RAG、Memory、Web Research、PPT、Deep Research、多 Agent、语音、桌宠、浏览器自动操作产品能力或默认本地文件读取；它把已经规划或已实现的 V1.3、V1.4、复杂站点读取 hardening、Gemini 样式、Launcher / Collapse / Resize 统一到一个可审计的用户体验和出门证据链。

目标用户路径：

```text
普通网页打开
-> Navia floating launcher 以贴边低打扰形态可见
-> 用户 hover / focus 后 launcher 弹出
-> 用户点击 launcher 展开右侧 Navia sidebar
-> 用户再次点击 launcher 折叠 sidebar，页面恢复宽度
-> 用户可拖拽 launcher 调整位置，拖拽 sidebar 左边界 resize
-> 用户读取当前网页
-> Chat 中完成总结、页面问答、Mindmap
-> Mindmap 以 Evidence Card / Reading Map 为主体验
-> 用户点击节点或来源
-> 当前网页 DOM 可定位则高亮，失败则展示 fallback evidence，blocked 则明确说明
-> Debug / Settings 仍可用于诊断和配置
```

本阶段必须整合的已有阶段能力：

| 能力 | 当前完成口径 | V1 主线收口要求 |
|---|---|---|
| `V1.3 Evidence Card Mindmap` | 可声明 V1.3 experience complete 时，只代表 Mindmap 主体验闭环 | 作为 V1 Chat artifact 的主导图体验进入总验收 |
| `V1.4 Reading Map` | 可声明 V1.4 Side Panel navigation complete 时，只代表阅读地图闭环 | 作为 Mindmap 的连续伴读导航进入总验收 |
| `V1 Complex Site Reading Hardening` | scoped matrix 通过只代表限定站点矩阵 | public no-login 与登录态边界必须写清，不得冒充全站高质量 |
| `V1 Gemini Style Pass` | 只代表当前 sidebar 视觉和按钮系统完成 | 作为统一视觉语言进入总体验收，不扩大产品范围 |
| `V1 Launcher / Collapse / Resize` | 只代表外层 content script 交互壳完成 | 必须完成正式 closeout 证据，证明不破坏读取、问答、导图和 source jumpback |

本阶段允许声明：

```text
V1 mainline closeout candidate passed automated acceptance.
```

只有在自动化验收、PRD 复检、false-green audit、复杂站点边界说明和人工产品体验核查全部通过后，才允许进入完整 V1 complete 候选审计。

本阶段完成后的用户可见效果必须是：

- 普通网页中 Navia 以插件伴随形态出现，而不是独立营销页或只存在于 Chrome 原生 Side Panel。
- 用户可以通过默认贴边的 floating launcher 感知 Navia 状态，hover / focus 后弹出完整入口，并完成展开、折叠、拖拽、resize 后继续阅读原网页。
- 右侧 sidebar 内的 Chat / Agent / Debug / Settings 入口仍然可发现，不能被视觉优化或布局状态遮挡。
- 用户可以在同一条体验链中完成读取当前页、提交上下文、总结、问答、生成 Mindmap、查看 Evidence Card / Reading Map。
- source evidence 必须给用户明确反馈：能定位时高亮网页正文，不能定位时展示 fallback evidence，被页面或策略阻止时说明 blocked。
- B站 / 小红书 / 观察者网等复杂中文站点的验收结果必须让人类能看出是 public no-login 还是 logged-in，不允许把公开态样本解释成登录态质量通过。

本阶段不得声明：

```text
完整 V1 complete。
最终 Monica-like UX complete。
V2 Memory / RAG ready。
Web Research / PPT / Deep Research ready。
```

完整 V1 complete 的剩余硬门槛：

- Launcher / collapse / resize 必须有正式验收报告，而不是仅有视觉 probe。
- 真实 Chrome 截图必须覆盖普通网页中的 launcher、展开、折叠、resize、overlay 或 push、Chat、Debug、Settings、Evidence Card、Reading Map、source evidence。
- B站 / 小红书 / 观察者网等复杂中文站点必须区分 public no-login 验收和登录态体验核查。
- B站详情页质量必须完成 fresh evidence：摘要和 Mindmap 主节点应来自视频标题、简介、UP主 / 发布信息、播放 / 弹幕等主内容，不得由推荐列表、弹幕设置、活动横幅、QQ群 / 微信、自动连播、订阅合集或版权提示等低价值文本主导。
- Mindmap / Reading Map / 状态卡必须通过真实截图复核：不得出现节点文本虚影、导图卡片互相覆盖、聊天输入框遮挡、当前页面状态卡截断或目录浮层遮挡主要内容。
- source jumpback 必须在真实网页中可见可解释：定位成功时有明确高亮和 Navia source marker；无法定位时展示 fallback evidence；被页面或策略阻止时显示 blocked，不得合并成 success。
- Chrome 自动化环境本身必须可审计：如果真实登录态 profile 被锁定、unpacked extension 未加载、或只能使用 public no-login 临时配置，报告必须标记 blocked / degraded，不能作为登录态通过证据。
- 旧的失败 closeout 证据必须被重新生成、明确废止或在总报告中解释，不能与新的完成声明并存。
- V1 结束前必须安排人工产品体验核查。

当前自动化证据如果通过，只能进入人工产品体验核查；人工核查未完成时，项目状态仍是 `V1 mainline closeout candidate`，不是 `完整 V1 complete`。

当前剩余开发目标按以下顺序纳入本阶段，不得跳过文档与验收闭环：

```text
1. V1-MC-DOC-0：PRD、目标架构、开发计划、验收计划、stage gate、gap drawio 同步。
2. V1-MC-QA-1：修复或明确 Chrome 自动化环境阻塞，支持真实登录态或明确 public no-login。
3. V1-MC-QA-2：B站指定详情页登录态 fresh validation。
4. V1-MC-QA-3：B站 / 小红书 / 观察者网首页与详情页 fresh evidence。
5. V1-MC-QA-4：Mindmap / Reading Map / source jumpback 截图级复核。
6. V1-MC-QA-5：总报告、PRD review、false-green audit、人类 review checklist 更新。
```

### 14.11 V1-MC-SJ 复杂站点 Source Jumpback Hardening 目标

`V1-MC-SJ` 是 V1 Mainline Closeout Candidate 内的复杂站点质量硬化子阶段。它不新增产品能力，不引入 RAG、Memory、Web Research、PPT、Deep Research、多 Agent、浏览器自动操作产品能力、OCR/VLM/ASR 或默认本地文件读取；它只把真实复杂站点验收中可能暴露的 source jumpback、主内容抽取和 source card 选择问题补齐到可稳定维持 V1-MC 自动化候选验收的水平。

当前自动化证据基线：

```text
docs/active/project/evidence/v1_real_site_complex_pages/report.json
passed = true
samplesTotal = 6
passedSamples = 6
degradedSamples = 0
blockedSamples = 0
fallbackSamples = 0
fatalIssues = []
loginStatePolicy = temp-profile-with-injected-auth-cookies

docs/active/project/evidence/v1_external_visual_acceptance/report.json
passed = true

docs/active/project/evidence/v1_mainline_closeout/report.json
passed = true
claim = V1 mainline closeout candidate passed automated acceptance.
```

该基线证明 V1-MC-SJ 复杂站点质量硬化已完成一轮自动化复验：B站、小红书、观察者网首页与详情页 6 个真实样本均通过，且 6 个样本均为 DOM highlighted。真实站点复验使用临时 Chrome profile 注入授权 cookie；cookie 值未进入证据。由于当前 V1-MC 样本 `fallbackSamples = 0`，fallback 路径覆盖必须继续引用 V1.3 / V1.4 或其他 active 阶段证据，不能声称本轮真实站点矩阵已新鲜抽样覆盖 fallback。人工产品体验核查仍为 `pending`，因此该基线只能支持 `V1 mainline closeout candidate passed automated acceptance`，不能支持完整 V1 complete。

本子阶段目标用户路径：

```text
用户在 B站 / 小红书 / 观察者网等复杂中文网页打开 Navia
-> 读取当前页
-> 生成总结 / 问答 / Evidence Card Mindmap / Reading Map
-> 用户点击 Mindmap 节点或 Source Evidence
-> 系统优先定位主内容卡片、文章段落、标题或稳定 sourceRef
-> 成功时网页出现 Navia source marker 和明确高亮
-> 无法定位时展示 fallback evidence 和失败原因
-> blocked 时明确说明环境或页面阻塞
```

必须修复的体验问题：

- 小红书首页不得只依赖整段信息流拼接文本作为 source evidence；应优先绑定可定位的 feed card、标题、作者、链接或卡片文本。
- 观察者网详情页不得默认把评论、推荐、最新视频、头条侧栏或站点壳作为首要 source card；正文标题、作者、发布时间、正文段落必须优先。
- B站详情页继续保持 fresh validation：摘要和 Mindmap 主节点应来自视频标题、简介、UP主 / 发布信息、播放 / 弹幕等主内容。
- E2E 验收不得固定点击第 0 张 source card；必须选择主内容优先、可定位概率最高的 source card，并在报告中记录选择原因。
- `located`、`fallback_shown`、`blocked` 必须在 UI、JSON、HTML 报告和截图证据中一致。

允许的实现方向：

- A Page Reading 改善复杂站点主内容识别、噪声降权和 sourceRef 质量。
- C Mindmap 改善节点与 sourceRef 的主题绑定，避免推荐/评论主导 root 或高层节点。
- B Renderer 改善 source card 排序、展示和 E2E 可观测字段，但不得生成事实内容。
- Content Script Source Jumpback 在用户触发时尝试多个 sourceRef、selector、domPath、textQuote、href/card 线索；失败时保留 fallback，不得伪装成功。

本子阶段完成且 real-site 6/6 pass、0 degraded、0 blocked，并重新聚合 V1-MC 总报告通过后，仍只能支持：

```text
V1 mainline closeout candidate passed automated acceptance.
```

不得支持：

```text
完整 V1 complete。
最终 Monica-like UX complete。
登录态全站高质量通过。
```

### 14.12 V1-HR/CC 人工产品核查与 Complete Candidate 准备目标

前一阶段审查报告已经通过。`V1-HR/CC` 是 V1 主线从自动化候选态进入人工产品体验核查和完整 V1 complete 候选审计准备的文档阶段。它只做文档、验收计划、证据索引和 drawio 架构表达更新，不进入产品代码实现，不改变 Runtime / Artifact / ViewModel 公共合同。

当前事实基线：

```text
docs/active/project/evidence/v1_mainline_closeout/report.json
passed = true
claim = V1 mainline closeout candidate passed automated acceptance.

docs/active/project/evidence/v1_mainline_closeout/human-review-checklist.md
reviewStatus = pending
```

本阶段目标：

- 将自动化候选通过后的下一步明确为人工产品体验核查和 complete candidate audit 准备。
- 把 PRD、目标架构、开发计划、验收计划、stage gate、gap drawio 与当前 active evidence 对齐。
- 让人类能快速理解当前目标体验、当前架构实现、目标架构差异、验收门槛、出门条件和 No-Go。
- 明确 Cookie-injected 真实站点验证、fallback coverage 继承、人工核查 pending 的边界。

用户可见核查路径：

```text
普通网页
-> Navia 默认贴边 launcher
-> hover / focus 弹出完整入口
-> 点击展开右侧 sidebar
-> 读取当前网页
-> 总结 / 问答 / Evidence Card Mindmap / Reading Map
-> 点击 source evidence
-> 网页高亮 located，或展示 fallback evidence，或明确 blocked
-> 人工核查视觉质量、可读性、交互力感和复杂站点边界
```

本阶段允许声明：

```text
Ready for V1 human product review and complete-candidate audit preparation.
```

本阶段仍不得声明：

```text
完整 V1 complete。
最终 Monica-like UX complete。
用户主 Profile 登录态全站高质量通过。
V2 Memory / RAG ready。
Web Research / PPT / Deep Research ready。
```

进入完整 V1 complete 候选审计的前置条件：

- 人工产品体验核查清单从 `pending` 更新为 `passed`，并记录 reviewer、reviewedAt、blockingIssues。
- PRD review 和 false-green audit 无 fatal / major。
- 最新自动化报告、截图证据和人工核查结论一致。
- 旧 failed / superseded evidence 已解释、废止或重新生成。
- `fallbackSamples = 0` 时，总报告继续引用 V1.3 / V1.4 或其他 active fallback evidence，不能写成本轮 fresh fallback 已覆盖。

### 14.13 V1-MVP-QH 基础 MVP 确认后的质量硬化目标

人工产品体验核查已确认基础 MVP 体验可以成立：launcher / sidebar / Chat / Debug / Settings / 当前页读取 / 总结 / Mindmap / Source Evidence 已达到 MVP 层面的可体验状态。该确认只代表基础体验 OK，不代表完整 V1 complete，也不代表复杂站点反跳和 Mindmap 质量已经完成。

当前仍需进入质量硬化的明确问题：

- Source Jumpback 在 B站、小红书、观察者网等复杂站点仍可能识别失败、定位不准或 fallback 语义不清。
- Mindmap / Reading Map 仍可能被推荐、评论、弹幕设置、活动广告、站点壳、版权提示、低价值导航文本或重复文本主导。
- 窄屏或长文本场景仍可能出现节点截断、文本虚影、卡片遮挡或 source evidence 层级不清。
- `解释选中内容` 和 source evidence 仍可能混入网站壳、图片序号、时间戳、重复文本等低信息密度内容。
- 人工核查已确认：当前实现能完成基础交互闭环，但对网页内容的“真实理解”仍不足；如果只提取视频标题、文章标题、站点导航或首页卡片标题，而没有归纳正文、简介、可见评论 / 互动文本或图文说明，则不得计入 V1 complete 的内容理解通过。

本阶段目标用户路径：

```text
用户在真实复杂图文网页、门户首页或文章详情页打开 Navia
-> launcher 默认低打扰贴边，点击展开 sidebar
-> 读取当前页
-> 生成总结 / 问答 / Evidence Card Mindmap / Reading Map
-> 高层节点优先表达主内容，而不是站点壳或推荐区
-> 用户点击节点或 source evidence
-> 成功时网页明确高亮并显示 Navia source marker
-> 无法定位时显示 fallback evidence 和失败原因
-> 被页面、登录态或测试环境阻断时显示 blocked
```

V1 complete 候选验收必须把网页范围从当前 B站 / 小红书 / 观察者网扩展为“国内外主流图文网页与门户网站”矩阵。该矩阵不是 Web Research，不要求联网搜索补充事实，只验证当前页面 DOM / metadata / 用户可见文本的主内容抽取、总结、问答、Mindmap 和 source evidence。

最低验收网页矩阵：

| 类别 | 最低样本 | 示例来源 | 主内容理解要求 |
|---|---:|---|---|
| 国内新闻 / 门户首页 | 8 页 | 新浪、腾讯、网易、搜狐、凤凰、澎湃、观察者网等同类可访问首页或频道页 | 能区分频道导航、热榜、推荐流和主新闻卡片；总结不得只复述导航词 |
| 国内新闻 / 图文详情页 | 8 页 | 澎湃、观察者网、央视网、新华社、36氪、少数派等文章页 | 标题、作者 / 来源、发布时间、正文段落、图片 caption / alt 优先进入摘要和 Mindmap |
| 国内图文社区 / 内容平台 | 8 页 | 小红书、知乎、豆瓣、B站专栏 / 动态等可访问图文页 | 能区分正文、作者、互动计数、评论 / 推荐；评论只能作为补充，不得主导高层节点 |
| 国外新闻 / 门户首页 | 8 页 | BBC、Reuters、AP、The Guardian、CNN、Yahoo News 等可访问首页或频道页 | 能从首页卡片中抽取主要新闻主题，过滤导航、广告、订阅和 cookie banner |
| 国外新闻 / 图文详情页 | 8 页 | Reuters、BBC、The Guardian、AP、The Verge、Wired 等可访问文章页 | 正文段落、作者、发布时间、图片 caption / alt 优先；paywall / cookie wall 必须标记 degraded 或 blocked |
| 国外百科 / 博客 / 文档型图文页 | 8 页 | Wikipedia、Medium / Substack 可访问文章、官方博客、技术文档等 | 能处理长正文、分节标题、列表和代码 / 表格文本；Mindmap 高层节点来自正文主题 |

当前已有 `docs/active/project/evidence/v1_mvp_quality_hardening/` 的 6 样本复杂站点证据。该证据可作为 B站 / 小红书 / 观察者网质量硬化的基础基线，不能替代下一阶段扩展矩阵，也不能单独支持完整 V1 complete 或国内外主流网页高质量通过声明。

V1 complete 候选前的扩展矩阵门槛：

- 总样本不少于 48 页，国内不少于 24 页，国外不少于 24 页。
- 首页 / 频道页与详情 / 文章页都必须覆盖；不能只用详情页规避门户首页信息流。
- 至少 44/48 页达到 pass；任一类别至少 7/8 页 pass。若因登录、地区、付费墙、反爬或 cookie wall 阻断，必须标记 degraded / blocked，并补充同类别替代样本。
- 每个类别至少覆盖 4 个不同站点；同一站点在同一类别最多计入 2 页，避免用少数网站堆样本数。
- 每页必须记录 `mainContentSignals`、`noiseFindings`、`summaryGrounding`、`mindmapTopNodes`、`sourceCardOrder`、`jumpbackResult` 和截图证据。
- 摘要和 Mindmap 高层节点必须基于正文段落、简介、作者 / 来源、发布时间、图文说明、可见评论 / 互动文本或首页主卡片；不得由导航、推荐、广告、版权提示、cookie banner、登录提示、订阅弹窗或低价值重复文本主导。
- 视频 / 直播 / 音频页面在 V1 中只能理解页面 DOM 可见文本、简介、字幕文本、评论、弹幕统计或 metadata；不得声称理解画面、音频或未出现在页面文本中的视频内容。

每页 pass 的最低质量阈值：

- `mainContentSignals.length >= 1`，且至少一个 signal 来自本页主内容区域。
- `summaryGrounding.groundedClaimRate >= 0.8`；未被 sourceRef / fallbackText 支撑的摘要主张不得主导总结。
- `mindmapQuality.topNodeGroundingRate >= 0.9`；高层节点必须绑定 sourceRef 或明确 fallback reason。
- `mindmapQuality.noisyTopNodeRate <= 0.1`；导航、广告、推荐、版权提示、cookie wall、登录提示等低价值节点不能主导高层结构。
- `mindmapQuality.duplicateTopNodeRate <= 0.05`；重复主题必须归并。
- `mindmapQuality.overlongTopNodeRate <= 0.15`；过长节点必须压缩，除非为不可拆分专有名词。
- `jumpbackResult.status` 必须为 `located`、`fallback_shown` 或 `blocked`，且 UI、JSON、HTML 报告和截图 metadata 一致。

本阶段文档开发目标：

```text
V1-MVP-QH-CU/MQ: content understanding and mindmap quality hardening ready for staged implementation.
```

该目标仍属于 `V1-MVP-QH`，不另开互相竞争的阶段名。它只把当前问题收束为主内容识别、Mindmap 质量和 Source Jumpback 质量硬化，不新增 V2+ 能力。

本阶段允许声明：

```text
V1 MVP baseline accepted; content understanding and mindmap quality hardening ready for staged implementation.
```

本阶段完成后最多允许声明：

```text
V1 MVP quality hardening passed expanded real-site acceptance.
```

本阶段仍不得声明：

```text
完整 V1 complete。
最终 Monica-like UX complete。
复杂站点全量高质量通过。
用户主 Profile 登录态全站高质量通过。
V2 Memory / RAG ready。
Web Research / PPT / Deep Research ready。
```

本阶段固定开发顺序：

```text
1. V1-MVP-QH-0：PRD、目标架构、开发计划、验收计划、stage gate、gap drawio 同步。
2. V1-MVP-QH-1：48 页样本 manifest 与当前基线诊断计划冻结。
3. V1-MVP-QH-2：A Page Reading 主内容抽取、噪声过滤和 SourceRef 质量硬化。
4. V1-MVP-QH-3：C Mindmap 主题归并、节点文本压缩和 nodeSourceMap 绑定质量硬化。
5. V1-MVP-QH-4：B Renderer 导图可读性、source card 排序和三态 source evidence 视觉硬化。
6. V1-MVP-QH-5：Content Script Source Jumpback 多线索定位、fallback 和 blocked 语义硬化。
7. V1-MVP-QH-6：国内外 48 页主流图文网页 / 门户网站矩阵复验、PRD review、false-green audit 和可视化报告。
```

本阶段证据必须优先落入独立质量硬化证据包，再汇总进入 V1 mainline closeout：

```text
docs/active/project/evidence/v1_mvp_quality_hardening/
  sample-manifest.json
  report.json
  acceptance-report.html
  prd-review.md
  false-green-audit.md
  evidence-manifest.json
  screenshots/

docs/active/project/contracts/
  v1_mvp_quality_hardening_sample_manifest.schema.json
  v1_mvp_quality_hardening_report.schema.json

docs/active/project/evidence/v1_mainline_closeout/
  仅作为上游聚合和候选态总报告，不得替代 V1-MVP-QH expanded evidence。
```

`解释选中内容` 属于本阶段质量硬化范围，但只能基于当前页已读取文本、用户选区和已有 SourceRef。允许展示页面内已有图片 URL、alt、caption 或媒体 metadata 作为辅助证据；不得引入 OCR/VLM、Web Research 或默认本地文件读取。

`V1-MVP-QH-1` 必须使用 `v1_mvp_quality_hardening_sample_manifest.schema.json` 验证 `sample-manifest.json`。`V1-MVP-QH-6` 必须使用 `v1_mvp_quality_hardening_report.schema.json` 验证独立 QH `report.json`，再由 `v1_mainline_closeout` 做聚合引用。若本轮 expanded matrix 的 fresh fallback 为 0，报告必须分别记录 `freshFallbackSamples`、`referencedFallbackSamples`、`blockedSamples` 和 `locatedSamples`，并列出引用的 active fallback evidence；不得把“全部 located”写成 fallback 路径已新鲜覆盖。

### 14.14 V1-MVP-CQ 内容理解质量增强目标

人工已确认基础 MVP 体验可以成立，但同时确认当前内容理解质量仍不足：部分页面仍偏向提取标题、导航、首页卡片或站点壳，不能稳定归纳正文、简介、图文说明、可见评论 / 互动文本或长文结构。`V1-MVP-QH` 的 48 页矩阵已经支持 expanded real-site acceptance passed，但该结论仍允许少量 degraded / blocked 样本，不能直接支持“用户感到 Navia 真的理解了网页”的产品质量判断。

`V1-MVP-CQ` 是 QH 之后的新阶段，目标是把内容理解质量从“自动化矩阵达标”提升为“用户可感知的主内容理解达标”。本阶段仍只基于当前页面 DOM、metadata、用户选区、页面已有图片 URL / alt / caption / media metadata 和已生成 SourceRef；不引入 RAG、Memory、Web Research、OCR/VLM/ASR、视频 / 音频流理解、PPT、Deep Research、多 Agent、语音、桌宠、浏览器自动操作产品能力或默认本地文件读取。

本阶段核心问题：

- 摘要、问答和 `解释选中内容` 仍可能被站点壳、导航、推荐、评论、版权提示、时间戳、图片序号或重复文本污染。
- Mindmap / Reading Map 高层节点仍可能只表达标题级信息，而不是正文主张、论据、步骤、结论或互动补充信息。
- Source Evidence / Jumpback 虽能达到自动化 pass，但用户仍可能看不出“为什么跳到这里”或“该证据支撑哪个节点”。
- 视频 / 直播 / 音频页面只能理解页面可见文本；如果页面没有简介、字幕文本、评论、弹幕统计或 metadata，就必须 low-signal degraded，不得声称理解视频内容。

目标用户路径：

```text
用户在新闻详情页、门户首页、B站视频详情页、小红书图文页、技术文档或博客打开 Navia
-> 读取当前页
-> 总结优先表达正文 / 简介 / 分节 / 结论 / 图文说明 / 可见互动补充
-> 问答能引用主内容 source evidence
-> Mindmap 高层节点表达“主题、论点、事实、步骤、结论”，而不是导航或标题堆叠
-> 点击节点或 source card 后能看到明确证据关系、located marker 或 fallback reason
-> 对低信号页面明确 degraded / blocked，不伪装为内容理解成功
```

本阶段允许声明：

```text
V1 MVP content quality prove-out ready for staged implementation.
```

本阶段完成后最多允许声明：

```text
V1 MVP content quality prove-out passed strict real-site acceptance.
```

本阶段仍不得声明：

```text
完整 V1 complete。
最终 Monica-like UX complete。
复杂站点全量高质量通过。
视频 / 音频 / 图片内容已被理解。
V2 Memory / RAG ready。
Web Research / PPT / Deep Research ready。
```

本阶段固定开发顺序：

```text
1. V1-MVP-CQ-0：PRD、目标架构、开发计划、验收计划、stage gate、gap 图同步；确认 QH passed 但内容质量仍需增强。
2. V1-MVP-CQ-1：严格样本矩阵和人工 gold review 口径冻结；从 QH 48 页中选核心样本并补充高风险真实页。
3. V1-MVP-CQ-2：A Page Reading 内容角色识别、正文密度评分、噪声惩罚、互动补充文本分层。
4. V1-MVP-CQ-3：总结 / 问答 / 解释选区 grounding 质量硬化，避免标题级和站点壳回答。
5. V1-MVP-CQ-4：C Mindmap 语义主题归并、论点 / 事实 / 步骤 / 结论节点生成和节点证据绑定。
6. V1-MVP-CQ-5：B Renderer 证据关系可视化、source card 解释、窄侧栏导图可读性和 degraded 体验表达。
7. V1-MVP-CQ-6：Content Script jumpback 语义一致性复验，located / fallback / blocked 和 marker 说明一致。
8. V1-MVP-CQ-7：严格真实网页验收、人工 gold 对照、PRD review、false-green audit 和可视化报告。
```

最低验收矩阵：

- 从 QH 48 页中至少选取 24 页核心回归样本，覆盖 6 类页面，每类至少 4 页。
- 新增至少 12 页高风险真实样本，必须包含 B站视频详情页、小红书图文详情页、观察者网 / 新闻详情页、门户首页、技术文档 / 博客长文、低信号页。
- 总样本不少于 36 页；至少 34/36 页 strict pass；任一类别不得低于 5/6 strict pass。
- 每页必须有人工或半自动 gold notes，记录 `expectedMainClaims`、`expectedMindmapThemes`、`prohibitedNoiseThemes`、`requiredEvidenceTargets`。
- 每页必须记录 `contentUnderstandingScore`、`summaryGroundingRate`、`qaGroundingRate`、`mindmapSemanticCoverageRate`、`noiseLeakageRate`、`evidenceExplainabilityScore`、`jumpbackSemanticMatch`。
- 每个 metric 必须记录 `value`、`threshold`、`operator = gte | lte | eq`、`passed`、`numerator`、`denominator`；`noiseLeakageRate` 必须使用 `lte`，其他分数型通过率默认使用 `gte`，布尔一致性使用 `eq`。
- 每个类别必须在独立 CQ report 的 `summary.categoryResults[]` 中记录 `samples >= 6`、`strictPassedSamples >= 5`、`passed=true`。

Strict pass 最低阈值：

- `contentUnderstandingScore >= 0.82`。
- `summaryGroundingRate >= 0.88`。
- `qaGroundingRate >= 0.85`。
- `mindmapSemanticCoverageRate >= 0.85`。
- `noiseLeakageRate <= 0.08`。
- `evidenceExplainabilityScore >= 0.8`。
- `jumpbackSemanticMatch = true`，除非该页明确 degraded / blocked 且理由正确。

本阶段证据必须落入独立证据包：

```text
docs/active/project/evidence/v1_mvp_content_quality/
  sample-manifest.json
  gold-notes/
  report.json
  acceptance-report.html
  prd-review.md
  false-green-audit.md
  evidence-manifest.json
  screenshots/

docs/active/project/contracts/
  v1_mvp_content_quality_sample_manifest.schema.json
  v1_mvp_content_quality_gold_notes.schema.json
  v1_mvp_content_quality_report.schema.json
```

`v1_mainline_closeout` 只能在 CQ strict evidence 通过后重新聚合；不得用 QH passed 或 mainline candidate passed 替代 CQ 出门证据。

`V1-MVP-CQ-1` 必须用 `v1_mvp_content_quality_sample_manifest.schema.json` 验证 `sample-manifest.json`，并用 `v1_mvp_content_quality_gold_notes.schema.json` 验证每个 `gold-notes/*.json`。只有 `finalStrictEligible=true` 的 gold notes 可以计入最终 strict pass。`V1-MVP-CQ-7` 必须用 `v1_mvp_content_quality_report.schema.json` 验证独立 CQ `report.json`。schema validation 只通过在 `v1_mainline_closeout` 聚合报告上无效；聚合只能引用已经通过的独立 CQ evidence。

本阶段 drawio 门禁：

- `docs/active/project/design/v1-mvp-content-quality-gap.drawio` 固定不超过 8 页，中文书写。
- 图中必须展示目标架构与当前架构差异、开发及验收计划、项目里程碑、验收门槛和出门条件。
- 架构页必须使用具体实现实体并标注状态：`pageContext.ts`、A Page Reading、D Adapter / Agent Loop、C Mindmap、B Renderer、`contentBridge.ts`、CQ evidence。
- 不得用抽象“前端 / 后端 / AI 模块”替代具体代码实体。

## 15. V1.0.x Post-V1 Hardening 阶段目标

V1 已经根据自动化验收和人工产品核查记录为 complete，范围限定为 MVP 当前页伴随阅读。`V1.0.x Post-V1 Hardening` 是 V1 complete 之后的质量硬化阶段，不回滚 V1 complete 结论，也不把 post-V1 hardening 扩大为 V2。

本阶段聚焦用户已经感知到的后续质量问题：

- Source jumpback 在复杂动态网页上仍可能定位不准、解释不清或 fallback 不新鲜。
- Mindmap / Reading Map 在推荐流、导航、重复卡片、时间戳、图片序号、版权提示或低价值文本较多的页面上仍可能出现噪声节点、长节点和重复节点。
- 窄侧栏里 source card、状态卡、导图节点和聊天输入区仍需要持续防虚影、防遮挡、防截断。
- 真实网页验收需要从 V1-MVP-QH / V1-MVP-CQ 的阶段证据扩展为可长期回归的 post-V1 baseline。

目标用户路径：

```text
用户打开普通网页或复杂真实网页
-> Navia 以 V1 已完成的 launcher / sidebar 进入
-> 读取当前页
-> Summary / Q&A / Mindmap 继续优先表达主内容
-> 用户点击 source card 或 Mindmap 节点
-> 网页出现语义匹配的 Navia source marker，或显示 fallback / blocked reason
-> HTML 报告记录截图、指标、PRD review 和 false-green audit
```

本阶段允许声明：

```text
V1.0.x post-V1 hardening ready for staged implementation.
```

本阶段完成后最多允许声明：

```text
V1.0.x post-V1 hardening passed source jumpback, Mindmap quality, and real-site regression acceptance.
```

本阶段不得声明：

```text
最终 Monica-like UX complete。
复杂站点全量高质量通过。
视频 / 音频 / 图片像素内容已被理解。
V2 Memory / RAG ready。
Web Research / PPT / Deep Research ready。
```

固定开发顺序：

```text
1. V1.0.x-H-0：文档门禁，PRD、目标架构、开发计划、验收计划、stage gate、gap companion、drawio 一致。
2. V1.0.x-H-1：真实网页回归矩阵冻结，定义 100+ candidate 和可重复验收子集。
3. V1.0.x-H-2：Source Jumpback 精度规则冻结，覆盖 located / fallback_shown / blocked、marker 文案和选择理由。
4. V1.0.x-H-3：Mindmap / Reading Map 质量规则冻结，覆盖语义节点、短标签、去重、噪声过滤和证据绑定。
5. V1.0.x-H-4：窄侧栏 UX polish 规则冻结，覆盖 source card、状态卡、导图、输入区的遮挡和截断风险。
6. V1.0.x-H-5：自动化验收报告规则冻结，优先 headless、mute audio、HTML 报告、截图、PRD review 和 false-green audit。
7. V1.0.x-H-6：出门审计，无 fatal / major 后只允许 post-V1 hardening passed 声明。
```

最低验收门槛：

- `v1-post-v1-hardening-gap.drawio` 不超过 8 页，中文书写，包含目标架构与当前架构差异、开发及验收计划、项目里程碑、验收门槛及出门条件。
- 架构图必须出现具体代码实体：`pageContext.ts`、`contentBridge.ts`、`runtimeClient.ts`、B `chat_renderer`、B `mindmap_renderer`、A Page Reading、C Mindmap、D Adapter / Agent Loop、post-V1 evidence。
- 每个架构实体必须标注状态：已实现、已实现需修改、待新增、保持边界或 No-Go。
- 真实网页矩阵规划必须包含 100+ candidate，并定义较小的可重复自动化验收子集。
- Source jumpback 不准不得计为 located pass；fallback / blocked 必须有可见原因。
- Mindmap 顶层节点不得由导航、推荐、广告、版权提示、登录提示、重复卡片或时间戳主导。
- Fresh fallback 样本必须进入本阶段验收，除非明确 blocked 并记录替代路线。
- 自动化优先 headless 和 `--mute-audio`；如需可见 Chrome 截图，必须提前告知并测试后关闭实例。
- 独立 semantic validator 必须通过；它需要验证 schema 无法表达的跨字段关系，包括 `passed=true`、样本分布、截图证据、metric 阈值方向、fresh fallback / blocked replacement 和 located / fallback / blocked 一致性。
- 后续实现必须提供固定 semantic validator 命令：`npm --prefix apps/chrome-extension run validate:post-v1-hardening`。该命令应调用独立验证入口，例如 `node apps/chrome-extension/e2e/validate-post-v1-hardening-report.mjs`，并验证 `sampleDistribution`、`fallbackPolicy`、截图证据和 located / fallback / blocked 一致性。

本阶段证据目标路径：

```text
docs/active/project/evidence/v1_post_v1_hardening/
  sample-manifest.json
  report.json
  acceptance-report.html
  prd-review.md
  false-green-audit.md
  ux-review-checklist.md
  screenshots/

docs/active/project/contracts/
  v1_post_v1_hardening_sample_manifest.schema.json
  v1_post_v1_hardening_report.schema.json
```

## 16. V1.0.x Baseline Maintenance + UX Polish 下一阶段目标

`V1.0.x Baseline Maintenance + UX Polish` 承接已经冻结的 `V1.0.x Post-V1 Hardening` 基线。该阶段不重新打开 V1 complete，不改变已冻结的 post-V1 hardening 通过结论，也不扩大到 V2/V4 能力。阶段目标是让冻结基线可维护、可重复体验，并在当前已实现范围内继续降低用户可见摩擦。

本阶段由两个并行但有边界的开发目标组成：

1. `V1.0.x Baseline Maintenance`
   - 维护已冻结 evidence package、schema、semantic validator、HTML 审查报告和构建产物。
   - 确保每次回归能复现 Runtime health、Chrome extension build、post-V1 hardening validator 和人工基线冻结记录。
   - 优化依赖、构建体积、测试稳定性、报告可读性和本地启动体验，但不得更改产品能力声明。

2. `V1 UX Polish`
   - 只在当前 V1 已实现的 launcher / sidebar / Chat / Mindmap / Source Evidence / Debug / Settings 范围内做体验打磨。
   - 可优化 launcher 获焦反馈、折叠 / 展开状态、按钮层级、窄侧栏布局、source marker 可见性、Mindmap 可读性、状态卡和输入区遮挡风险。
   - 不新增顶级页面、不新增最终 Monica-like UX 声明、不新增 RAG、Memory、Web Research、PPT、Deep Research、多 Agent、语音、桌宠、浏览器自动操作产品能力、OCR/VLM/ASR、媒体流理解或默认本地文件读取。

本阶段设计输入：

- 已冻结基线：`docs/active/project/evidence/v1_post_v1_hardening/`。
- 本阶段原型审查页：`docs/active/project/design/v1-baseline-maintenance-ux-polish-prototype-review/index.html`。
- 本阶段 drawio gap：`docs/active/project/design/v1-baseline-maintenance-ux-polish-gap.drawio`。
- 当前 active PRD、目标架构、开发计划、验收计划和 stage gate。

原型审查页只用于说明目标体验、模块视觉关系和用户操作路径，不得作为“已实现”或“验收通过”证据。真正的出门证据必须由本阶段独立 evidence package、命令结果、截图、PRD review、false-green audit 和人工 spot-check 共同组成。

本阶段允许声明：

```text
V1.0.x baseline maintenance and UX polish ready for staged implementation.
```

本阶段完成后最多允许声明：

```text
V1.0.x baseline maintenance and scoped UX polish passed regression acceptance.
```

本阶段不得声明：

```text
最终 Monica-like UX complete。
复杂站点全量高质量通过。
视频 / 音频 / 图片像素内容已被理解。
V2 Memory / RAG ready。
Web Research / PPT / Deep Research ready。
```

固定开发顺序：

```text
1. V1.0.x-BM-0：文档门禁，冻结 PRD、目标架构、开发计划、验收计划、stage gate、gap companion、drawio 和证据边界。
2. V1.0.x-BM-1：基线维护，复验 build、Runtime health、post-V1 validator、HTML 报告、人工冻结记录和敏感信息扫描。
3. V1.0.x-BM-2：启动与诊断 polish，优化 README / 启动脚本 / Runtime 离线提示 / report 入口，不改变 Runtime public contract。
4. V1.0.x-BM-3：V1 UX polish，优化当前范围内 launcher、sidebar、按钮、状态卡、Mindmap、source evidence 和窄屏布局。
5. V1.0.x-BM-4：视觉与交互回归验收，使用真实 Chrome 或 headless 优先截图，验证没有遮挡、截断、虚影、焦点抢占和 false-green。
6. V1.0.x-BM-5：出门审计，PRD review、false-green audit、HTML 报告、截图和人工 spot-check 无 fatal / major 后，冻结新的维护基线。
```

最低验收门槛：

- `docs/active/project/evidence/v1_post_v1_hardening/` 仍作为上一阶段冻结基线，不得被重写为新阶段通过证据。
- 新阶段必须建立独立 evidence package，避免把 post-V1 hardening frozen baseline 误当成本阶段验收输出。
- `npm --prefix apps/chrome-extension run build` 必须通过。
- `npm --prefix apps/chrome-extension run validate:post-v1-hardening` 必须仍然通过，证明旧基线未被破坏。
- Runtime `/v1/health` 在本地启动后必须返回 `status=ok`。
- UX polish 必须用截图证明 launcher、sidebar、Mindmap、source evidence、状态卡、输入区和 Debug / Settings 入口仍可用。
- Source highlight、fallback_shown、blocked 仍不得混淆。
- 任何新视觉效果不得遮挡网页主内容到不可恢复状态；折叠 / 展开 / resize / drag 不得造成布局永久错位。
- 自动化优先 headless 和 `--mute-audio`；如需可见 Chrome 截图，必须提前告知并测试后关闭实例。
- PRD review 和 false-green audit 必须明确本阶段只做 baseline maintenance 和 scoped UX polish。
- 原型审查页中的目标图必须被实现阶段截图逐项对照；若实际实现无法达到某个目标图效果，必须在 BM-5 report 中记录偏差、原因和是否阻塞出门。

后续路线登记：

- `V1 Content Quality Plus`：已由 `V1-MVP-CQ` 文档登记为内容理解质量增强方向；若再次启动，必须使用独立 stage gate、36+ strict 样本、gold notes 和独立 report，不得复用 post-V1 hardening 通过结论。
- `V2 Memory / Personal Knowledge Base`：属于 V2 本地备忘、个人知识库、标签化总结和类 RAG 蒸馏方向；必须重新评估长期 Runtime 主栈、Memory Plane、权限治理、数据保留和删除策略。
- `V3 Media Companion`：属于伴随式观赛 / 观影 / 看直播体验方向；必须重新设计视频页媒体上下文、字幕 / 转录 / 时间轴、截图证据、视频反跳、Media Mindmap、多模态 Adapter 和隐私治理，不得复用 V1 网页伴读验收结论声明视频理解 ready。
- `V4 Web Research / PPT / Deep Research`：属于 V4 个人秘书 / 深度研究 / PPT 生成 / Manus-like Agent 能力方向；必须重新设计任务图谱、审批、联网边界、引用证据和安全门禁。

本阶段文档与证据入口：

```text
docs/active/project/stage-gates/v1-baseline-maintenance-ux-polish.md
docs/active/project/design/v1-baseline-maintenance-ux-polish-gap.md
docs/active/project/design/v1-baseline-maintenance-ux-polish-gap.drawio
docs/active/project/design/v1-baseline-maintenance-ux-polish-development-acceptance-plan.md
docs/active/project/design/v1-baseline-maintenance-ux-polish-readiness-audit.md
docs/active/project/evidence/v1_baseline_maintenance_ux_polish/
```

## 17. V2 Memory / Personal Knowledge Base 规划目标

`V2 Memory / Personal Knowledge Base` 承接已经冻结的 V1 当前页伴读基线，目标是把用户主动保存的网页、显式授权导入的本地资料和后续结构化摘要，沉淀为可追踪、可删除、可授权的个人知识资产。本阶段不改写 V1 complete 或 post-V1 hardening 基线，也不声明 V2 ready。

截至本轮文档同步，V2 状态必须按以下事实记录：

```text
V2-DOC / V2-0：文档门禁、合同草案、data_service spike、原型同步要求和生命周期 ADR 已形成基线。
V2-1..V2-6：已经形成 mock-first / controlled-boundary 实现基线。
V2-7：真实数据验收、截图证据、HTML 报告、PRD review、false-green audit 和最终 report.json 已通过。
```

因此当前最多允许声明：

```text
V2 Memory / Personal Knowledge Base passed planning-aligned local knowledge acceptance.
```

V2 目标体验以已落盘原型审查页为设计输入：

```text
docs/active/project/design/v2-memory-personal-knowledge-prototype-review/index.html
```

V2 目标用户路径：

```text
用户打开普通网页
-> Navia 贴边 launcher / sidebar 保持 V1 当前页伴读能力
-> 用户点击“保存到知识库”
-> Navia 显示 workspace 选择、ingest / build / trace 状态
-> V2 Adapter 将 PageContext / SourceRef 映射为 MemoryCandidate / KnowledgeSource
-> 候选 Local Knowledge Governance Service 通过 HTTP / MCP / CLI 接收 source
-> Knowledge Workspace 展示 source library、source detail、trace、graph 和 ask with sources
-> 用户可跨来源问答、查看 evidence refs、打开 source trace
-> 用户可撤销本地授权目录或删除 / 遗忘 source
-> 系统用再次查询证明被删除 source 不再返回
```

V2 必须规划的用户可见能力：

- 保存当前网页：用户主动保存当前页面，并看到 ingest、build、trace ready 或 degraded 状态。
- 后端服务状态感知：V2 前端必须让用户清楚感知当前后端链路状态，至少区分 Navia Runtime 离线 / 在线、V2 Adapter / Governance 未就绪或降级、候选 data_service 未配置 / 鉴权失败 / 不可达 / 版本不兼容、单个 source 的 ingest / build / trace / forget 状态；不得只显示一个泛化的“后端正常”。
- 知识空间：用户能在 Knowledge Workspace 中切换 workspace，查看 source 数量、构建状态和 trace 覆盖度。
- Source Library：用户能筛选网页、本地显式授权资料、笔记和待处理 source，并打开 source detail。
- Ask with Sources：跨来源问答必须展示 evidence refs；无证据回答不得显示为成功。
- Evidence Trace：用户能看到 located、fallback_shown、blocked 的一致状态和来源解释。
- Knowledge Graph：图谱节点必须来自服务侧 source / unit / relation 数据，不能由前端凭空生成事实。
- Permission Root：默认不读取本地文件；只有用户显式授权的目录才能作为 source root。
- Forget Source：删除 / 遗忘必须有二次确认，并通过 before / after query 证明删除生效。

`/mnt/c/workspace/data_service` 可作为 V2 候选后端基线进行文档评估。它当前提供 workspace、source registry、distill、GraphRAG、Source Trace、quality、HTTP、MCP、CLI 和 Knowledge Console 等能力；但 Navia 不得直接读写它的内部 workspace，也不得把它的 console 当作 Navia 产品 UI。Navia 只能通过 V2 Adapter / Governance 层，以受控 HTTP / MCP / CLI 合同接入。

V2 不得声明：

```text
V2 implemented。
V2 Memory / RAG ready。
完整个人知识库产品完成。
默认本地文件读取。
data_service console 已等同 Navia 产品 UI。
Web Research / PPT / Deep Research ready。
多 Agent、产品浏览器自动操作、语音、桌宠或媒体理解 ready。
```

V2 文档与实现基线同步出门条件：

- PRD、目标架构、开发计划、验收计划、stage gate、gap companion 和 drawio 使用同一阶段名：`V2 Memory / Personal Knowledge Base`。
- drawio 不超过 8 页，必须包含目标体验、当前架构与目标架构差异、分层代码实体、data_service 候选边界、前端组件、权限 / 删除 / 证据链、开发及验收计划、出门条件和 No-Go。
- drawio 必须明确 P0-P7 架构平面：Browser Host、Extension Shell、Side Panel UI、Runtime Client、Local Runtime API、V2 Adapter / Governance、data_service Candidate、Evidence。
- drawio 必须列出当前真实实现实体和剩余目标文件，至少包括 `contentBridge.ts`、`sidepanel/main.tsx`、`runtimeClient.ts` 的 V2 knowledge section、`knowledge_workspace/`、`app.py`、`modules/memory/`、V2 e2e / validator 和 V2 evidence package。
- 文档必须明确 `data_service` 是候选 Local Knowledge Governance Service，不是当前 Navia 已集成能力。
- 文档必须明确 V2 Adapter / Governance 是唯一跨项目接入层，禁止前端 B 直接调用 A/C/D 或直接读写 data_service workspace。
- 文档必须明确前端页面在开发和未来实现阶段的服务状态 UX：Side Panel header、SaveToKnowledgeCard、Knowledge Workspace、Source detail、Debug / Settings 必须能展示 Runtime、V2 Adapter、data_service 和 source build / trace 的不同状态与用户下一步动作。
- 文档必须明确本地文件导入默认关闭，只有显式授权 root 才能进入 source ingest。
- 文档必须明确删除 / 遗忘的验收必须包含再次查询验证，不能只删除 UI 卡片。
- 文档必须引用 V2-1..V2-6 子阶段 evidence，并引用 V2-7 独立证据包作为 planning-aligned local knowledge acceptance 通过依据；`v2-7-acceptance-blocked-audit.md` 仅作为过期阻塞记录保留。

V2 当前门禁口径：

```text
Go for V2 Memory / Personal Knowledge Base documentation and implementation-baseline synchronization.
V2-1..V2-6 mock-first / controlled-boundary baseline recorded.
V2-7 evidence passed; the active allowed claim is V2 planning-aligned local knowledge acceptance only. No-Go for V2 ready / RAG ready claims.
```

V2-0 P0 产物当前作为实现基线输入，后续任何真实 data_service 产品化前仍必须重新复核：

- 权威合同包：`v2_memory_contracts.schema.json`、`v2_knowledge_status.schema.json`、`v2_knowledge_api.openapi.yaml`、`v2_knowledge_error_codes.md`。
- 验收合同包：`v2_memory_sample_manifest.schema.json`、`v2_memory_report.schema.json`、semantic validator 规格和未来固定验证命令。
- data_service 锁定与 Adapter spike：仓库路径、commit / version、license、auth mode、API snapshot、capability matrix、Navia mapping、unsupported list、fallback route。
- 原型同步：补齐 ServiceStatusBanner、DataServiceStatusCard、KnowledgeBuildStatus；保存流程改为单次点击后异步轮询 / 状态订阅；移除过期的“尚无 stage gate / drawio / 验收门槛”文案。
- Workspace 承载形态：冻结 Side Panel 与独立 Knowledge Workspace 的职责边界和路由形态。
- 生命周期 ADR：冻结 source revision、dedup / idempotency、operation_id、用户主动 retry、当前不支持 cancel / resume、permission revoke、forget cascade、credential redaction、audit log。

V2-7 真实数据验收已经补齐并通过，冻结证据包括：

```text
docs/active/project/evidence/v2_memory_personal_knowledge_base/sample-manifest.json
docs/active/project/evidence/v2_memory_personal_knowledge_base/report.json
docs/active/project/evidence/v2_memory_personal_knowledge_base/acceptance-report.html
docs/active/project/evidence/v2_memory_personal_knowledge_base/screenshots/
```

V2-7 已通过，当前仅允许声明：

```text
V2 Memory / Personal Knowledge Base passed planning-aligned local knowledge acceptance.
```

V2 Workspace 承载形态的当前规划：

```text
Side Panel:
  SaveToKnowledgeCard
  ServiceStatusBanner
  当前 source build / trace 状态
  Ask current workspace 快捷入口
  Trace 快捷入口

Extension Workspace Page:
  WorkspaceSwitcher
  SourceLibrary
  SourceDetail
  Ask with Sources
  KnowledgeGraph
  PermissionRoot
  ForgetSource
  DataServiceStatusCard
```

V2-PX 当前已选择路线 A：`Extension Workspace Page`。`localhost Web Workspace` 仅保留为路线 A 在 PX-1 entrypoint spike 中被技术事实阻塞后的回退路线；切换前必须打回 PX-0，并同步 PRD、架构、drawio、原型、合同和验收计划。权威决策见 `design/v2-external-brain-workspace-hosting-adr.md`。

### 17.1 V2-PX 外脑双容器产品化

V2-7 已证明 planning-aligned local knowledge acceptance，但当前完整 Knowledge 管理面仍主要承载在窄 Side Panel 中，尚未形成用户可从网页伴读入口自然进入的独立宽屏管理工作台。下一阶段固定为 `V2-PX External Brain Productization`，只补齐 Side Panel 快捷面、Extension Workspace Page、入口、路由、跨容器状态恢复和真实 Chrome 产品化证据，不改写已通过的 V2-7 合同与后端能力结论。

阶段目标体验：

```text
普通网页
-> Navia Launcher / Side Panel
-> 读取并由用户主动保存当前页
-> trace_ready 后点击“查看来源”
-> Extension Workspace Page 新标签页打开对应 Source Detail
-> 用户在宽屏 Workspace 管理 Sources / Ask / Graph / Permissions / Forget
-> 原网页与 Side Panel 保留，用户可继续伴读
```

用户入口必须至少包含：

- `查看来源`：当前 source 达到 `trace_ready` 后出现，打开对应 `workspaceId + sourceId` 的 Source Detail。
- `打开工作台`：Side Panel 快捷动作，打开当前 Workspace 的 Source Library。
- `在工作台中打开`：Side Panel Knowledge 视图顶部入口，打开与当前上下文一致的 Workspace route。

双容器职责：

| 容器 | 承担 | 不承担 |
|---|---|---|
| Side Panel Quick Surface | 保存当前页、服务状态摘要、当前 source build / trace、Ask current workspace 快捷入口、Trace 和 Workspace 入口 | 长期来源管理、宽图谱、权限和删除审计主界面 |
| Extension Workspace Page | Workspace 切换、Source Library / Detail、Ask with Sources、Knowledge Graph、PermissionRoot、Forget、服务诊断 | 自动读取宿主网页、直接控制宿主 DOM、绕过 Runtime 生成知识事实 |

两个容器只能传递和恢复稳定标识：`workspaceId`、`sourceId`、`operationId`、route intent。不得通过 URL、Chrome message 或前端缓存复制大块网页正文、答案或图谱事实；Workspace Page 打开后必须通过共享 `runtimeClient.ts` 重新读取 Runtime 权威状态。

目标路由语义：

```text
workspace.html#/knowledge/sources?workspaceId=:workspaceId
workspace.html#/knowledge/sources/:sourceId?workspaceId=:workspaceId
workspace.html#/knowledge/ask?workspaceId=:workspaceId
workspace.html#/knowledge/graph?workspaceId=:workspaceId
workspace.html#/knowledge/settings/permissions?workspaceId=:workspaceId
```

`Source Library` 与 `Source Detail` 是两个独立 route intent；前者只要求 `workspaceId`，后者必须同时具备 `workspaceId + sourceId`。Route A 的公开产物名冻结为 `workspace.html`，WXT entrypoint 配置必须生成该文件；若 PX-1 spike 证明无法在不扩大权限或破坏 CSP 的前提下生成，必须停止并返回 PX-0 评审，不得在实现中临时改名。route intent、直接打开、刷新、重开、Back、无效 ID 恢复和同一 Workspace / Source 身份不得改变。重复点击入口应优先聚焦已存在的 Workspace 标签页；无法复用时才创建新标签页，且不得触发 source 重复导入。

路线 A 的 PX-1 spike 只有在以下条件同时成立时才通过：构建产物中存在可由 `chrome.runtime.getURL` 解析的 Workspace 页面；生产入口可打开或聚焦它；直接打开、刷新、Back 和重开不丢失 route；CSP / extension permission 不要求扩大到远端脚本或宽泛 host permission；Runtime offline 时页面仍能打开并显示本地推导的诊断状态。任一条件被不可修复的 WXT / Manifest V3 / CSP 技术事实阻塞时，PX-1 必须停止并回到 PX-0 评审路线 B，不能在实现中静默切换宿主形态。

阶段拆分：

```text
PX-0 文档、原型、合同和审计门禁
PX-0.1 外部挑战审计闭环：同步 V2-7 完成态；修复 canonical route、direct-open/reload/Back、可恢复错误、Forget 四面状态；收紧合同、截图 metadata、生命周期决策和负向夹具
PX-0.1b 可执行合同与审计包闭环：统一 Manifest v5 / Report v12 / Screenshot Metadata v6 / Execution Observation v6 / Human Review v3 / Validation Contracts 合同、63 条 RuleId、109 个 RFC 6902 正负夹具、G1-G7 推导算法、自包含原型审计件和哈希清单
PX-0.2 验收工具实现：只有 PX-0.1b 外部或等价独立复审无 fatal / major 后，才允许实现 semantic validator 和负向测试；不含产品功能
PX-1 Extension Workspace entrypoint 与 router
PX-2 Side Panel Quick Surface 与三个生产入口
PX-3 Background OpenWorkspaceAction、稳定 ID 交接、poll / reconnect
PX-4 Workspace 组件产品化拆分与宽屏 UX
PX-5 真实 Chrome E2E、报告和截图证据
PX-6 PRD / 架构 / false-green / 人工产品体验出门审计
```

PX-5 修复执行在 2026-09-14 的当前状态：T01、T02 系列、T03 和 T04 均已取得各自限定 PASS；T02.5 是唯一 production-positive R2 输入。T03 以 T02.5 单一 sealed run 重算生产候选，T04 再用 R4-P/R4-E 两条隔离泳道完成确定性重放和全新真实 Chrome 复验。上述限定结论仍不等于 PX-5、PX-6 或 V2 通过。

T03/R3 的产品责任不是新增用户功能，而是从 T02.5 原始事件重算既有体验是否真实发生。它采用以下单向证据链：

```text
T02.5 sealed raw / artifacts / Git snapshot
-> ArtifactReader
-> DerivedFacts（逐字段 eventId / artifact / Git blob provenance）
-> shared Schema / semantic / TypeScript AST validation
-> ProductionValidation
-> pending Human Review
-> pure Report JSON / HTML
-> ProductionPackage
-> InvocationRecord
```

T03 已把保存后查看来源、三个入口、五类 route 的 direct-open/reload/Back/reopen、无效 route 回库、Durable Forget、四类故障和四视口可访问性映射到原始证据；缺观察时仍只能输出失败 diagnostic 并退出非零，不得补写事实、跨 run 拼接、复制合同结果或自动签署 Human Review。T04.1 已用新全量 run 关闭 artifactRoot Minor 并取得 LIMITED PASS；PX6-0..5 只读该候选生成 machine-only review package 后必须停止。只有真实人类完成 H01..H07、提交有效 ReviewSubmission，且两步独立终审握手完成合同冻结后，PX6-7 才能重算 G7/final。

V2-PX 出门后最多允许声明：

```text
V2-PX External Brain Productization passed dual-container real-Chrome acceptance.
```

该声明只表示 Side Panel 与 Extension Workspace 的入口、路由、生命周期、共享状态和真实浏览器路径通过；不得扩大为 `V2 ready`、完整外脑产品、最终 Monica-like UX、自动化知识维护或 RAG ready。

V2-PX 不包含：

- 自动遗忘、后台“做梦”、自动文件整理或自动摘要刷新。
- 默认读取或移动本地文件。
- data_service Console 作为 Navia UI。
- Web Research、PPT、Deep Research、多 Agent、产品浏览器自动操作、语音、桌宠或媒体内容理解。

V2-PX 文档门禁入口：

```text
docs/active/project/stage-gates/v2-external-brain-productization.md
docs/active/project/design/v2-external-brain-productization-development-acceptance-plan.md
docs/active/project/design/v2-external-brain-productization-readiness-audit.md
docs/active/project/design/v2-external-brain-workspace-hosting-adr.md
docs/active/project/design/v2-external-brain-productization-prototype-review/index.html
docs/active/project/design/v2-external-brain-productization-prototype-review/AUDIT_PACKAGE.md
docs/active/project/design/v2-external-brain-productization-prototype-review/audit-package-manifest.json
docs/active/project/design/v2-memory-personal-knowledge-base-gap.md
docs/active/project/design/v2-memory-personal-knowledge-base-gap.drawio
docs/active/project/contracts/v2_external_brain_workspace_contracts.schema.json
docs/active/project/contracts/v2_external_brain_acceptance_manifest.schema.json
docs/active/project/contracts/v2_external_brain_report.schema.json
docs/active/project/contracts/v2_external_brain_screenshot_metadata.schema.json
docs/active/project/contracts/v2_external_brain_execution_observation.schema.json
docs/active/project/contracts/v2_external_brain_human_review.schema.json
docs/active/project/contracts/v2_external_brain_validation_contracts.schema.json
docs/active/project/contracts/fixtures/v2_external_brain/px-0.1b-positive-evidence-payload.json
docs/active/project/contracts/fixtures/v2_external_brain/px-0.1b-positive-instances.json
docs/active/project/contracts/fixtures/v2_external_brain/px-0.1-contract-fixtures.json
docs/active/project/design/v2-external-brain-productization-semantic-validator.md
```

PX-0.1 冻结的 route/action 语义：

- `open_workspace -> source_library`，不得携带 `sourceId`。
- `view_source -> source_detail`，必须携带刚保存或当前选中的真实 `sourceId`。
- `open_in_workspace` 保留当前 Knowledge route intent；当前上下文无有效 route 时回到 Source Library。
- Route A 成功 URL 必须是 extension origin；localhost/http(s) 只能在路线 B 重新通过 PX-0 后出现。
- direct-open、reload、Back、invalid/forbidden ID 必须在 Router 与真实 Chrome 中分别验证。

PX-0.1b 冻结的证据语义：

- 每一层 ID observation 必须显式标记 `observed / not_applicable / unavailable`；direct route 不得伪造 Side Panel / Background 参与，Runtime timeout / connection refused 不得伪造 response fingerprint。
- `open_in_workspace` 必须记录进入前的 Knowledge route；有效上下文保持原 route，无效上下文回到 Source Library。
- Forget 后，既有 source 在 direct-open、reload、Back 和 reopen 时均必须保持 `SOURCE_NOT_FOUND`；每个验收场景必须对同一 `workspaceId + sourceId` 记录 Forget 前 `trace_ready`、Forget 后 `forgotten` 和四次有序恢复结果。审查原型允许用 `localStorage` tombstone 模拟跨重载效果，但生产 Workspace 必须重新查询 Runtime 权威状态，严禁把前端 tombstone 当作真实删除证明。
- tab reuse 必须在一次 observation 中记录至少两次有序 attempt：首次创建、再次聚焦同一 tab，且 ingest counter 不增加。
- G4 使用 dependency-boundary 与 forbidden-call scan 两类结构化零违规结果；每个结果必须绑定验收 commit、source tree、`entrypoints/sidepanel`、`entrypoints/workspace`、`src/modules/knowledge_workspace` 三项 scan root、tracked path index、ruleset 和 allowlist hash。Contract fixture 从 Architecture Scan Manifest v2 的 `trackedPaths[].inlineSource` 读取源码，production 从冻结 commit 的 Git blob 读取源码；两种路径都必须由 validator 执行 AST import 与 Call/New/endpoint normalization 扫描。只记录 scannedFiles/violations 或信任 `violations=0` 不构成通过证据。
- G6 使用 axe、keyboard 和 420/360/1280/768 四视口结构化结果；`viewport_sidepanel_360/420` 必须是 Side Panel 单面，`viewport_workspace_768/1280` 必须是 Workspace 单面，Manifest、Screenshot Metadata 与图片实际解码尺寸三方一致；`composite_review_only` 不计入产品证据。G7 的 Human Review 证据必须带 path + SHA-256。
- semantic-positive 合同夹具必须由至少 29 个场景满足冻结的 G1-G7 算法；schema-positive 只能证明 shape，不得冒充产品 pass。Validation Contracts 固定 63 条 RuleId、41 条 semantic RuleId，以及 109 条带 `requirementId + requirementKey + rule/layer/primaryFailure` 的 mandatory requirement；109 个负例只允许完整根实例和 RFC 6902 patch，registry 与 case 必须逐字段相等。SemanticResult 必须绑定 semantic spec、实际 validator implementation（PX-0.2）和排除自引用 Report 的 positive raw payload 原始文件 hash。
- 五类 Knowledge route 的成功恢复矩阵必须同时覆盖 direct-open、reload、Browser Back 和 reopen；Forget 后的失败恢复链不能替代一般成功 route 的 Back/reopen 证据。所有恢复都必须保持 canonical route、`workspaceId` 与可选 `sourceId` 一致。
- Contract fixture 的虚拟 artifact 必须逐路径绑定一次解析的 UTF-8 或冻结 canonical JSON 原始字节及 SHA-256，不得对 `\\n` 等字符串进行第二次反转义。每个 passed scenario 的 Report `screenshotPaths[i]` 必须与 paired Screenshot Metadata `imagePath` 完全相同并解析到同一图片字节。Human Review 必须携带与 Report 相同的 evidenceClass；contract fixture 只能签署“非产品验收”的 fixture 声明。
- G4 必须由 `Architecture Scan Manifest v2` 冻结 repository commit、tracked path/mode/blob、三项 scan root、排序与行格式、source tree/path index、ruleset/allowlist artifact 和封闭排除项；排除项不得覆盖目标源码目录。
- 合同夹具必须标记 `evidenceClass=contract_fixture`，使用真实解码尺寸的虚拟 PNG 和不同 source 原始字节；PX-5 产品证据必须使用 `production_acceptance + real_chrome_dual_container`，不得引用 `virtual/*`、审查原型或合同夹具。
- requestId 相等、valid/invalid prior context 因果、route event 身份、attempt 顺序/时间、durable Forget 同 workspace/source 等跨对象要求属于 semantic rule，不能因为各对象分别通过 JSON Schema 就判定通过。
- `sourceSampleId` 与 Runtime `sourceId` 属于不同命名空间；真实截图必须验证 magic、可解码性和实际像素尺寸，不能用文本文件改名 `.png` 或只靠 SHA-256 冒充截图。

PX-0.1 / PX-0.1b 只修订文档合同、审计包和原型，不是生产实现或 PX 完成证据。旧原型 `qa-summary.json` 的 54/54 仅为修订前视觉基线，不得支持当前 route、Forget 或 accessibility PASS。PX-0.1b 未经完整包独立复审前，PX-0.2 和 PX-1 均为 No-Go。

### 17.2 V2.x 自动化知识维护、遗忘与“做梦”机制探索

当前 V2 Forget Source 的权威基线仍是**用户主动发起**：用户选择 source，查看影响范围，完成二次确认，再由系统通过 Source Library、Ask with Sources、Knowledge Graph 和 Source Trace 的 before / after 结果证明遗忘生效。该基线不得被后台任务、模型判断或“做梦”机制绕过。

当前机制仍有较大优化空间。后续 V2.x 可研究一种低优先级、可暂停、可审计的后台知识维护循环，暂称 `Knowledge Dream Cycle`。这里的“做梦”是产品与工程隐喻，指系统在空闲、用户预约或用户手动触发时，对**用户已经保存的 source、主动创建的笔记和显式授权目录中的资料**进行反思、整理、去重和总结刷新；它不代表自主意识，也不授权系统联网搜索、自动浏览网页或扫描未授权本地文件。

未来探索目标：

- 自动化文件与知识整理：识别重复 source、旧 revision、标签缺失、workspace 归类不合理、低价值内容和相互矛盾的摘要，生成标签、虚拟目录、workspace 调整、合并或归档建议。
- 高质量总结刷新：基于原始 source revision 和 `EvidenceRef` 重新生成或修订摘要，保留冲突观点、不确定性和 degraded reason，避免“摘要再总结”造成事实漂移。
- 自动化遗忘辅助：根据用户配置的保留期限、访问频率、来源状态、重复度和证据价值生成 archive / forget candidate，但默认只提出建议，不直接永久删除。
- 知识压缩与反思：把多条相近事实合并为有来源支持的高层总结，同时保留原始 source、revision、证据和可回溯关系，不能用压缩结果替换或伪造原始证据。
- 安静运行：维护任务默认后台运行，不抢占浏览器焦点、不发出声音；用户可暂停、取消、查看进度和审计记录。

建议生命周期：

```text
active
-> stale_candidate
-> consolidate_candidate
-> archived
-> forget_candidate
-> quarantine
-> forgotten
```

状态语义：

- `consolidate_candidate` 只表示建议去重或生成 canonical summary，不删除原始 source。
- `archived` 只降低默认展示和检索优先级，仍允许恢复和显式查询。
- `forget_candidate` 只表示待用户审查的遗忘建议，不得写成已删除。
- `quarantine` 是可撤销隔离期；系统必须记录恢复截止时间、受影响的 KnowledgeItem / graph edge / trace 和回滚信息。
- `forgotten` 才是最终遗忘终态。默认仍要求用户确认；未来即使提供自动遗忘，也必须是用户显式开启的策略，并受 scope、retention window、confidence threshold、quarantine window、审计日志和 before / after 验证约束。
- 共享 `KnowledgeItem` 仍被其他 source 支撑时，只允许移除目标 source 的贡献并重新计算派生关系，不得把共享事实一并静默删除。

`Knowledge Dream Cycle` 候选流程：

```text
空闲 / 定时 / 用户手动触发
-> 快照 workspace、source revision、PermissionRoot 和当前策略
-> 检测重复、陈旧、低价值、冲突摘要、标签缺失和弱证据
-> 生成整理、摘要刷新、归档和遗忘候选
-> 用原始 source revision 与 EvidenceRef 做 grounding 校验
-> 写入 Knowledge Maintenance Inbox
-> 用户接受 / 拒绝 / 编辑，或按已授权的可逆策略自动应用
-> 记录 MaintenanceRun、变更前后状态、证据、回滚和审计结果
```

目标前端体验应新增 `Knowledge Maintenance Inbox`（名称可在后续原型阶段调整）：

- 每张建议卡展示建议动作、原因、置信度、受影响 source / evidence、可逆性和预计影响。
- 用户可接受、拒绝、编辑、批量处理或选择“以后不再建议此类动作”。
- 自动整理只允许优先修改 Navia metadata、标签、虚拟目录和 workspace membership；默认不得移动、重命名或删除宿主文件。
- 未来如允许物理文件移动或重命名，必须按 PermissionRoot 单独授权，提供执行预览、冲突处理、回滚和路径脱敏审计；永久删除仍属于高风险动作。
- 服务状态必须区分 `idle / running / paused / degraded / review_required / failed`，并能定位到具体 `MaintenanceRun`，不得合并成泛化“后端正常”。

未来实现前应冻结的候选合同包括：

```text
KnowledgeMaintenancePolicy
MaintenanceRun
OrganizationProposal
SummaryRevision
ForgetCandidate
QuarantineRecord
MaintenanceAuditRecord
```

这些名称当前只用于规划，不是已发布 Runtime public contract。任何字段、枚举、状态迁移、幂等、并发、回滚和错误码必须在独立 V2.x stage gate 中冻结后才能进入实现。

开源方案与研究候选仅作为技术调研输入，不代表已经选型或集成：

| 候选 | 可借鉴能力 | Navia 需要额外治理的部分 |
|---|---|---|
| [Letta](https://github.com/letta-ai/letta) / memory blocks 与 archival memory | 分层记忆、可附加 / 分离的记忆块、后台 memory learning；其相关项目也把 sleep-time compute 描述为 dreaming | 不直接替代 Navia `KnowledgeSource` / `EvidenceRef` / Forget cascade；必须评估本地部署、数据边界、成本、并发覆盖和删除语义 |
| [Generative Agents](https://arxiv.org/abs/2304.03442) | 从经历记录中周期性形成高层 reflection，可作为“做梦 / 反思”循环的概念参考 | 论文目标不是个人知识治理；Navia 必须增加来源 grounding、权限、可撤销和 false-forget 防线 |
| [Paperless-ngx](https://docs.paperless-ngx.com/advanced_usage/) | 基于内容匹配自动分配标签、文档类型和 storage path，可参考文件整理与规则 / 模型结合方式 | Navia 默认只做虚拟整理；不得未经授权移动宿主文件，且需要处理 source revision、EvidenceRef 和 workspace 语义 |
| [Mem0](https://github.com/mem0ai/mem0) | 可参考记忆抽取、实体关联、多信号检索和时间语义 | 当前新算法强调累积式 ADD，不等同于可验证遗忘；Navia 仍需独立设计 archive、quarantine、forget cascade 和恢复验证 |
| [Memory Sandbox](https://arxiv.org/abs/2308.01542) | 把 memory 作为用户可查看、编辑、总结和共享的数据对象，可参考维护收件箱与用户控制体验 | 需要进一步落到 Navia source / graph / trace 四面的权限与删除一致性 |

未来验收必须同时覆盖质量、可逆性和安全性，至少记录：

```text
groundedClaimRate
summaryRevisionAcceptanceRate
duplicateReductionRate
organizationProposalAcceptanceRate
forgetCandidateFalsePositiveRate
quarantineRestoreSuccessRate
forgetCascadeVerificationRate
unauthorizedFileOperationCount
```

其中 `unauthorizedFileOperationCount` 必须为 `0`；其他指标的 numerator、denominator、operator 和 threshold 必须由后续 stage gate 基于真实数据冻结，不能在当前规划中用未经验证的阈值制造 false-green。

本规划的门禁边界：

- 当前 V2-7 通过结论不包含自动化遗忘、自动文件整理、后台“做梦”或高质量总结刷新完成声明。
- 当前不得声明 `automated memory governance complete`、`autonomous forgetting complete`、`file organizer complete` 或 `dreaming mechanism implemented`。
- 实质开发前必须新增独立 PRD / 目标架构 / stage gate / 合同 schema / 语义校验器 / 真实数据验收矩阵 / 隐私与安全审计。
- `suggest-only` 必须是默认模式；自动应用只能覆盖用户明确授权且可逆的整理动作。
- 永久自动遗忘默认关闭。若未来开放，必须作为高风险流程单独审计，并保留隔离期、撤销入口、审计记录和用户可见解释。
- 不得借该规划引入默认本地文件读取、产品级浏览器自动操作、Web Research、多 Agent、语音、桌宠、PPT 或 Deep Research。
- 本路线不属于 `V2-PX External Brain Productization` 的开发或出门范围；PX 报告不得把整理建议卡、自动摘要或自动遗忘写成已实现。

### 17.3 V2-RKM 真实知识库与可逆记忆维护

2026-09-10 `DOC-Closure` 门禁口径：当前只允许修订 D01..D09 的需求、合同设计与验收义务，不表示 T05/RKM-0 已开始。唯一实施顺序为 `T01 -> T02 -> T03 -> T04/PX-6 -> T05 -> T06 -> T07 -> T08 -> T09 -> T10`；T05 只有在 T01..T04/PX-6 通过、用户再次明确批准代码且 T05 实施前审计为 Fatal=0/Major=0 后才能开始。RKM 顶层验收分母固定为 39 条：S01..S14、S-01..S-16、RC-01a/RC-01b/RC-02a/RC-02b/RC-03/RC-04、IR-01..IR-03；`failed/pending/deferred` 均不得缩小分母或转写为通过。

本轮独立审查补充：同scope/provider/purpose重授权须显式替代旧决定，不被历史拒绝永久锁死；更广workspace许可仍不覆盖source拒绝。普通维护暂停区分本地pending与DS run级ack，不影响无关Ask；策略范围/授权改变后旧run对账终结再建新run。见RKM合同3.7/3.9、验收8.1。新增详细实施工作包见开发6、逐阶段验收执行卡见验收9，当前均非已执行交付。

2026-09-10风险再核查：维护默认关闭时不生成新建议/应用，开启suggest_only后才生成；运行完成和建议待审分开，重启暂停、不补跑错过日程。指定会话只提取开启后开始且完成的turn，完成消息与内部outbox同事务，关闭重开不回填。服务离线仍保留已认证的本地关闭/撤销入口，确认状态不得伪成功；永久Forget优先于旧建议/备份恢复，并清除相关派生快照。完整行为见RKM合同3.5..3.8、验收8；均为文档设计，未实现。

2026-09-10复审补强：RKM新数据路由不因文件功能关闭而免认证；Runtime缺凭据拒绝访问，DS使用独立X-API-Key。撤销中RKM operation区分aborting/aborted（非旧build取消）；共享支持贡献与云外发权限分开。用量、截图、gold、图谱及宿主保护的可观测要求见验收第6节；S-1..S-16处置见[修订记录](evidence/v2_real_knowledge_maintenance/rkm-doc-review-remediation-2026-09-10.md)。原PX必须先出门，随后才实施RKM；仍仅文档，不放行代码。

本节将已认可目标落为独立文档阶段，不把17.1的PX范围扩大，也不将17.2研究方案写成已实现。旧17.2关于后台“不联网”的约束，在RKM中仅放宽为用户明确授权scope/purpose/provider后的云模型调用；网络搜索、网页自动采集和未授权资料外发仍禁止。

当前事实：独立workspace.html、入口和组件已存在，不能继续描述为未开发；R1后端F-1..6限定修复通过，PX-5 FAIL / REOPENED、PX-6 BLOCKED。默认 Runtime 仍保持 Mock 供合同测试；2026-09-15 已新增显式 `NAVIA_KNOWLEDGE_ADAPTER=data_service` 的 H01-RDS 实现候选，并用真实 `data_service` 完成 Runtime 级 source import/build/trace、重复保存和重启读取。该候选不等于 H01 真实 Chrome 三入口通过，也不等于 Query/Graph/Forget、完整 RAG 或 RKM 已集成。

| 需求ID | 用户可见目标与约束 |
|---|---|
| RKM-REQ-01 | 三入口与双容器独立认证保持；403不冒充离线，token不共享或持久存储 |
| RKM-REQ-02 | 真实网页/授权md、txt/笔记单次保存；跨双服务重启保留同source/版本/内容，幂等不重复 |
| RKM-REQ-03 | 旧五route和维护/任务详情/知识策略新route支持direct/reload/Back/reopen，稳定ID由Runtime重读 |
| RKM-REQ-04 | 明确显示Runtime、Adapter、data_service、source状态与下一步；真实服务失败不静默换Mock |
| RKM-REQ-05 | 真实跨来源问答展示可回读证据、拒答无证据问题、保留冲突，fallback不算生成质量通过 |
| RKM-REQ-06 | 知识图谱来自服务source/unit/relation；不可前端造事实或混用workspace |
| RKM-REQ-07 | 引用精确跳回原文或诚实fallback/blocked；本地原件变化不更改已导入快照 |
| RKM-REQ-08 | 文件读取、云处理、对话记忆分别授权；本地撤销立即阻止新操作/应用，远程以DS持久屏障ack为完成点；未确认显示revoking，明确已出站不可撤回范围 |
| RKM-REQ-09 | 人工永久Forget覆盖知识副本及派生贡献，四面/重开/重启不复活；原始聊天和宿主原件不在删除范围 |
| RKM-REQ-10 | 指定会话默认关闭；只提取开启后开始且完成的turn，记忆带消息出处且可遗忘；已提交事件可靠交接，不自动回填历史 |
| RKM-REQ-11 | 默认关闭且mode=suggest_only；明确开启后可逆摘要/标签/虚拟归档；Inbox可接受/拒绝/恢复，旧revision不覆盖新内容、永久Forget不被restore撤销 |
| RKM-REQ-12 | 云调用无金额硬上限；按真实调用量/usage估算费用，未知为null；安全暂停与服务限流仍生效 |
| RKM-REQ-13 | 真实Side Panel360/420与Workspace768/1280可操作，焦点/键盘/截图/状态一致，维护不抢占焦点 |
| RKM-REQ-14 | 双仓隔离源码与证据可追溯；机器/独立复审通过后人工签署，文档/原型不能代替产品验收 |

部署主线为本机Runtime + data_service，扩展独立加载；Docker、外部Agent公共接口、站点自动采集、物理文件整理、自动永久删除、V3不计本轮目标。可逆维护仅修改产品自有知识记录。data_service只经Navia治理HTTP边界接入，必要公共API修复需独立分支及复审，不接管其现有私人workspace。

执行顺序：原R1(T01)->R2(T02)->R3(T03)->R4/PX-6(T04)，之后RKM-0合同/原型冻结(T05)->RKM-1真实API适配(T06)->RKM-2持久知识与问答(T07)->RKM-3对话记忆(T08)->RKM-4可逆维护(T09)->RKM-5全量人工出门(T10)。代码批准和逐阶段预审计仍是硬前置，不存在从文档阶段直接分叉进入RKM实现的第二条实施线。

权威文件：[架构](design/v2-real-knowledge-maintenance-architecture.md)、[合同](design/v2-real-knowledge-maintenance-contracts.md)、[开发](design/v2-real-knowledge-maintenance-development-plan.md)、[验收](design/v2-real-knowledge-maintenance-acceptance-plan.md)、[ADR](design/v2-real-knowledge-maintenance-risk-adr.md)、[八页图纸索引](design/v2-real-knowledge-maintenance-gap.md)、[Stage Gate](stage-gates/v2-real-knowledge-maintenance.md)。所有需求到实体/任务/场景的映射见图纸索引。

这些是目标而非结果。当前不得声明RKM、RAG、完整外脑或自动维护已完成；将来通过也只允许冻结语料和授权范围内的有限声明，具体指标见S01..14。RKM-0机器合同与RKM-1真实spike尚未完成，当前不声称全部自动化开发输入完备。

本轮验收细化不新增产品范围：REQ05有答案题必须核验gold必要结论完整覆盖，完整回答率>=0.9，固定六道跨来源题6/6实质使用双方必要证据，不只验证检索命中；REQ13增加用户输入时后台维护完成/失败不抢焦点S13-A。阶段必需分母事前冻结，deferred不能缩分母放行。维护重启只保证恢复后本地零新提交、DS pauseAck后旧epoch零新发送/发布；通知到达前已出站如实记录，不承诺远程瞬时停机。

## 18. V3 Media Companion 规划目标

> 权威性说明（2026-09-15）：本节中早期的 YouTube+B站并行、24 页联合出门以及“ASR 全部延后到 V3.x”描述仅保留为历史规划背景。当前可执行范围以 §18.1 为准：B站优先、12 页固定分母、字幕优先，并仅在用户显式授权当前标签页音频后使用本地 ASR fallback。YouTube 在 B站出门后复用同一合同；VLM、OCR、视频帧语义理解和云端媒体理解仍属于 V3.x。

`V3 Media Companion` 是 V1 当前网页伴读和 V2 个人知识资产之后的媒体伴随体验阶段。长期目标覆盖 B站、YouTube 等视频网站；当前可执行首批范围只面向 B站视频详情页，把 Navia 从“读网页正文”扩展到“陪用户看视频、理解字幕 / 本地转录 / 时间轴、生成视频概览和可反跳证据”。YouTube 只能在 B站固定矩阵出门后复用同一合同。本阶段当前只做文档开发和目标体验规划，不进入 V3 媒体代码开发，也不改写 V1 complete 或 post-V1 hardening 基线。

V3 目标体验应接近 Monica 在 YouTube 的视频伴随体验，并参考 B站 AI 视频总结生态中用户已经熟悉的能力：视频省流总结、章节大纲、视频导图、字幕搜索、继续追问、时间戳跳转、截图证据和可复制 / 分享摘要。参考竞品包括 Monica Video Summarizer、AI课代表、BibiGPT、NoteGPT Bilibili Summarizer、Eightify、HARPA、YouTube conversational AI，以及 Gemini Video Understanding 的真实多模态能力路线。

V3 分层规划：

```text
V3.0 Transcript-first Video Companion
  基于标题、简介、字幕 / 转录、章节、评论、弹幕 / 互动文本、页面 metadata、当前播放时间和浏览器截图证据。

V3.x Multimodal Media Understanding
  规划通用/云端 ASR、VLM、OCR、video frame sampling、Gemini Video / Live API、直播 rolling transcript 和多模态证据治理；不包含 §18.1 已限定的“显式当前标签页音频 -> 本地 ASR”路径。
```

V3.0 目标用户路径：

```text
用户打开 YouTube 或 B站视频页
-> Navia 贴边 launcher / sidebar 识别当前页为 video page
-> 用户点击读取 / 总结视频
-> Navia 读取标题、简介、作者、时长、字幕 / 转录、章节、评论 / 弹幕摘要、当前播放时间
-> 生成视频概览：一句话结论、关键看点、章节时间轴、可疑低信号提示
-> 生成 Media Mindmap / 视频概览图：主题、事件、论点、示例、结论按时间线组织
-> 每个关键节点绑定 transcript segment、timestamp、source text、视频截图证据或 fallback reason
-> 用户点击节点 / 证据卡
-> 视频播放器跳转到对应时间点，或展示 timestamp fallback / blocked reason
-> 用户可围绕“这个片段讲了什么 / 总结 10:30-15:00 / 提炼观点 / 找证据”继续追问
```

V3.0 必须规划的用户可见能力：

- 视频概览卡：标题、作者 / 频道、时长、发布时间或页面可见 metadata、摘要、低信号状态。
- 章节时间轴：按时间戳展示主题段落、关键事件、知识点、论点和结论。
- Media Mindmap / 视频概览图：类似 B站 AI 视频总结账号提供的结构化概览，节点短、准、可追溯。
- 截图证据卡：在目标时间点展示视频可见帧截图或截图占位，并说明它只证明“该时间点可见画面”，不等同于 VLM 已理解画面。
- 视频反跳：点击节点或证据卡后 seek 到视频时间点；无法 seek、播放器被限制、字幕缺失或登录墙时必须显示 fallback / blocked。
- 字幕 / 转录问答：答案必须 grounding 到 transcript segment、简介、评论 / 弹幕文本或明确 degraded。
- B站 / YouTube 平台差异：B站可能依赖登录、字幕可用性、弹幕和评论；YouTube 可能依赖 transcript availability、章节和语言设置。

V3.0 不得声明：

```text
完整 Monica-like YouTube parity complete。
真实视频画面 / 音频已被理解。
直播实时理解 ready。
通用/云端 ASR、VLM、OCR、Gemini Video ready；§18.1 限定的本地 ASR fallback 除外。
跨视频知识库 / RAG ready。
自动下载、提取或处理受版权保护的视频流。
默认本地文件读取。
```

V3.x 多模态路线必须先冻结：

- 用户授权和隐私边界：何时读取字幕、截图、音频、视频帧；是否上传到模型；如何提示用户。
- 采样策略：截图 / frame sampling 的频率、触发条件、缓存、删除和脱敏。
- 延迟和成本预算：短视频、长视频、直播的最大处理时长、token、模型调用和失败降级。
- 证据模型：ASR transcript、VLM frame caption、OCR block、timeline event、confidence 和 source provenance。
- EventStore / Trace：实时输出不能只存在 EventStream，必须可按时间轴和 session trace 回放。
- 法务 / 平台风险：不得自动下载视频，不得绕过平台访问限制，不得把登录态自动化扩展为产品浏览器自动操作。

V3 文档开发出门条件：

- PRD、目标架构、开发计划、验收计划、stage gate、gap companion 和 drawio 使用同一阶段名：`V3 Media Companion`。
- drawio 不超过 8 页，必须包含目标体验、当前架构与目标架构差异、B站字幕/本地 ASR 双输入链路、YouTube 后续映射边界、视频概览图 / Media Mindmap、截图证据 / 视频反跳、多模态 V3.x 路线、开发及验收计划、出门条件和 No-Go。
- 文档必须明确 V3.0 和 V3.x 的交付边界，避免把多模态未来路线写成本阶段承诺。
- 文档必须明确视频截图证据在 V3.0 只表示时间点可见帧证据；理解截图内容必须进入 V3.x。
- 文档必须明确无字幕 / 无转录 / 无可见文本的视频必须 degraded 或 blocked，不得伪装成内容理解成功。

### 18.1 2026-09-15 B站优先修订

V3 的平台顺序调整为：先完成 B站视频详情页，再扩展 YouTube。首个锚点样本固定为：

```text
https://www.bilibili.com/video/BV1ZpYd66ELP
```

该样本在 2026-09-15 的公开能力探测中为单 P、约 792 秒且无公开字幕。它暴露了原 `Transcript-first` 规划的关键缺口：如果 ASR 完全延后，V3.0 对该样本只能正确降级，不能达成用户期望的图文大纲。因此 V3.0 改为：

```text
B站页内 / 公开字幕优先
-> 字幕缺失时提示用户显式启动当前标签页音频采集
-> 音频只进入本机 Runtime 的 LocalAsrAdapter
-> 生成带时间戳和来源 hash 的 MediaTranscript
-> 同一 VideoOutline 派生图文大纲、章节时间轴和 Media Mindmap
```

V3.0 的本地 ASR 是限定 fallback，不代表通用音频理解、云端语音服务或 VLM 已就绪。必须满足：

- 只在用户点击后使用 Chrome 当前标签页音频捕获，不自动下载 B站媒体流。
- 不在后台复用 cookie 获取音视频 URL，不绕过登录、地区、会员或风控限制。
- 原始音频默认不持久化、不上传；取消、页面关闭或撤销后必须停止并清理临时数据。
- 字幕和 ASR 都不可用时返回 `degraded/blocked`，不能由标题、简介、评论或模型常识生成伪大纲。
- 图文笔记与 Media Mindmap 必须由同一个强类型 `VideoOutline` 派生，不能用模型 marker 正则作为事实权威。

目标 B站用户路径：

```text
打开 BV1ZpYd66ELP
-> Navia 识别 bvid/cid/单P/时长并显示“无公开字幕”
-> 用户点击“开始本地转写”并确认只处理当前标签页音频
-> UI 显示 capturing / transcribing / summarizing 进度，可取消
-> 完成后展示图文大纲、章节时间轴、Media Mindmap 和证据覆盖
-> 点击章节跳转播放器时间点
-> 用户主动保存后，结果经 Runtime 写入真实 data_service
```

V3 实施前置增加 `H01-RDS`：真实 `data_service` 必须 connected，真实页面来源可持久化并在 Runtime 重启后重读。2026-09-15 Runtime 级候选已实现并用指定 B站页面元数据快照复验；H01 的 Side Panel、Workspace Library、Source Detail 三入口真实 Chrome 证据仍待执行，故 H01/PX-6 不得声明通过。BiliNote 路线研究与采纳/拒绝决定见 `design/v3-bilinote-bilibili-route-study.md`。
