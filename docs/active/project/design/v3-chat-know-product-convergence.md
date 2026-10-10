# Navia V3 Chat + Know 产品收敛规格

状态：`DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO`  
日期：2026-10-07  
权威范围：V3 当前产品目标、一级信息架构、本机服务生命周期、后续阶段边界。历史章节与本文件冲突时，以本文件为准；历史证据不得删除或改写。

保留声明：本文件是既有 `V3-0..V3-7` 的增量产品规格，不是替代计划。原 B站媒体、SenseVoice、tabCapture、OCR/VLM、VideoOutline、MediaTaskStore、Ask/seek/export、12 页单 run、H01-H10 和最终独立审计继续作为实现与验收主干。

## 1. 产品结论

Navia V3 是一个由用户显式启动本机服务、在浏览器中完成当前页面理解并把有价值内容保存为本地知识的工具。V3 只有两个一级产品域：

- **Chat**：只处理当前网页或当前视频，提供识读、伴读问答、摘要、结构化提纯、来源定位和知识草稿确认。
- **Know**：只管理用户已经显式保存的本地知识，提供查看、编辑、标签、自定义字段、排序、归档和人工老化状态。

`Settings` 是辅助入口，承载 Runtime、站点授权、模型与资源状态。`Debug` 只在开发构建出现。`Agent` 不属于 V3 一级导航、实现范围或出门验收，整体进入 V5+ 远期规划。

视频理解不再是独立产品岛。B站是 V3 的首个 `MediaPortalAdapter`，其字幕、媒体获取、SenseVoice、帧证据和时间跳转能力统一服务于 Chat 当前上下文。

## 2. 目标体验

### 2.1 首次配置

1. 用户安装一次 Chrome 扩展和“Navia 本机伴侣”。
2. 用户通过桌面图标手动启动本机服务。
3. 扩展检测 `127.0.0.1` 服务后完成一次配对；设置页保存非秘密授权状态和配对句柄。
4. 用户首次访问支持的站点时确认一次窄域站点权限；B站登录沿用浏览器现有登录态。
5. 用户选择本地模型。V3 默认提供低资源基线，并明确下载大小、磁盘、内存和推理影响。

### 2.2 日常使用

1. 用户按需通过桌面图标启动本机服务；服务不随点击 Navia 自动拉起，也不绑定浏览器生命周期。
2. 用户打开 Navia。扩展只显示 `已连接 / 未运行 / 需配对 / 需授权 / 错误` 之一，不显示 Mock 就绪冒充真实服务。
3. 用户进入 Chat，点击“读取当前页面”或“分析当前视频”。
4. Chat 展示来源、进度、结构化内容和可追溯回答；失败时显示真实原因和恢复动作。
5. 用户点击“提取知识”，预览 `KnowledgeDraft`，可修改标题、摘要、标签和来源范围。
6. 只有用户点击“保存到 Know”后，草稿才写入本地知识存储。
7. 用户在 Know 查看、编辑、排序、标签化或归档已保存内容。

### 2.3 本机服务控制

- **启动权威**：桌面“Navia 本机伴侣”图标。浏览器扩展不得后台自动启动 Runtime。
- **界面启动入口**：设置页可以提供“启动本机服务”，但只能由可信点击调用已安装伴侣的显式启动桥；不存在处理器时必须展示桌面图标和手动步骤。
- **停止入口**：Runtime 在线且会话已认证时，设置页可请求优雅停止；停止前显示正在运行的任务与影响。
- **生命周期**：由用户控制。浏览器关闭不强制结束服务；Runtime 可在空闲后按用户策略自动退出，但默认值、时长和提示必须可见。
- **配对**：一次配置后，每次 Runtime 启动签发短时会话；扩展不得长期保存 Runtime 管理密钥或 Cookie 真值。

## 3. V3 范围

### 3.1 Chat 必须交付

- 当前普通网页正文提取、清洗、来源定位和状态反馈。
- 当前 B站视频页面识别；字幕优先、任务期媒体 + SenseVoice 回退、可信 tabCapture 最后回退。
- 基于当前上下文的问答、摘要和结构化提纯。
- 网页来源锚点或视频时间点反跳。
- `KnowledgeDraft` 预览、编辑、取消和显式保存。
- 未启动 Runtime、未授权、无正文、无字幕、ASR 失败、清理中和取消等真实状态。

### 3.2 Know 必须交付

- 本地来源和知识条目列表、详情与来源证据。
- 标题、摘要、标签、自定义字段和备注编辑。
- 按创建时间、更新时间、标题和人工优先级排序。
- `active / aging / archived` 人工生命周期状态；V3 不承诺自动老化或自动维护。
- 从 Know 回到原网页锚点或视频时间点。
- 删除采用普通显式确认；跨副本 Durable Forget 属于 V4。

### 3.3 Settings 必须交付

- Runtime 在线、版本、配对、任务和停止状态。
- 站点权限与撤销状态。
- ASR provider、模型安装进度、磁盘占用、预计内存和当前 effective model。
- 下载失败后的手动安装路径和校验结果。
- 开发构建可以进入 Debug；生产导航不提供同级 Debug/Agent 入口。

### 3.4 明确不属于 V3

- 自动拉起 Runtime、强制随浏览器退出、无感获取系统权限。
- 全网视频门户适配完成；V3 只验收 B站，实现接口必须可扩展到 YouTube、小红书等。
- 跨库语义 RAG、知识图谱生产查询、自动老化、自动维护和跨副本 Durable Forget。
- 长短时任务、多 Agent 编排、基于知识库自动生成长文档或图文成品。
- 无来源回答、后台自动保存、自动扫描全部本地文件或自动替用户签署授权。

## 4. 零层架构

权威图：`design/v3-chat-know-l0-architecture.html`；机器源：`design/v3-chat-know-l0-architecture.json`。

```text
用户
  ├─显式启动/停止─> 本机伴侣启动器 ─一次配对/短时会话─> Local Runtime API
  └─打开扩展─────> Chat / Know / Settings

Chat -> WebPageAdapter | MediaPortalAdapter
     -> 页面与媒体感知
     -> 来源证据
     -> KnowledgeDraft
     -> 用户确认
     -> LocalKnowledgeStore

Know -> LocalKnowledgeStore 的显式查看、编辑、排序与归档
Agent -> V5+，只能未来通过受治理接口读取，不得反向定义 V3 合同
```

### 4.1 实体状态

| 实体 | 当前事实 | V3 目标 | 状态 |
|---|---|---|---|
| Chrome 扩展壳 | Chat/Know/Agent/Debug/Set 并列 | Chat/Know 一级；Settings 辅助 | 需修改 |
| Chat 页面识读 | 已有网页识读和部分媒体链 | 统一网页/视频上下文与草稿 | 部分实现 |
| Know UI | 已有多个面板和 Mock/候选边界 | 接入真实本地存储基线 | 需修改 |
| Agent UI | 仅占位 | 从 V3 产品导航移除 | V5+ |
| 本机 Runtime | Python loopback 服务，需手工 token/命令 | 桌面启动器、一次配对、可见状态 | 待新增/修改 |
| MediaPortalAdapter | B站路径已大量实现 | 作为 Chat 上下文适配器完成闭环 | 部分实现 |
| SenseVoice | development baseline | V3 本地 ASR 基线 | 已有候选，待产品闭环 |
| KnowledgeDraft | 无统一权威合同 | 证据到保存之间的用户确认对象 | 待新增 |
| LocalKnowledgeStore | V2 候选/Mock 混杂 | V3 最小真实 CRUD 与来源证据 | 需收敛 |

## 5. 核心合同

### 5.1 RuntimeStatus

最少字段：`processState`、`pairingState`、`sessionState`、`version`、`activeTaskCount`、`effectiveModel`、`lastErrorCode`。任何未知状态必须 fail closed，禁止显示 `Adapter ready` 代表真实服务可用。

### 5.2 ContextEnvelope

统一承载普通网页和视频上下文：`contextType`、`adapterId`、`canonicalUrl`、`title`、`contentHash`、`evidence[]`、`capabilities[]`。平台专用字段只能放在 adapter namespaced metadata 中。

### 5.3 KnowledgeDraft

最少字段：`draftId`、`sourceRefs[]`、`title`、`summary`、`body`、`tags[]`、`customFields`、`provenance`、`createdFromContextHash`。Draft 不是已保存知识，只有显式确认后生成 `KnowledgeItem`。

### 5.4 KnowledgeItem

最少字段：`itemId`、`sourceRefs[]`、`title`、`summary`、`body`、`tags[]`、`customFields`、`priority`、`lifecycleState`、`createdAt`、`updatedAt`。V3 的删除只保证本地单存储删除，不得命名为 Durable Forget。

## 6. 阶段路线

本轮不废弃或替换既有 `V3-0..V3-7`。新增目标按以下方式嵌入原计划：

| 阶段 | 保留的原计划 | 新增内容 | 出门条件 |
|---|---|---|---|
| V3-0X | V3-0 文档、合同、原型、Draw.io 均保留 | Chat/Know 权威规格与 L0 | 用户批准方向 |
| V3-1.4 | 复用 V3-1.1..1.3，尤其 credential transport PASS | 手动启动器、状态、配对句柄与设置页 | 真实安装/重启/停止 E2E |
| V3-2.4a..2.7 | 原媒体获取、SenseVoice、capture、12 页门槛 | 修复当前 TC13 并完成原 V3-2 | 原固定分母全部通过 |
| V3-3 | 原 Frame/OCR/VLM 计划 | 无范围替换 | 原 A01..A16 通过 |
| V3-4 | 原 TaskStore/Outline/Timeline/Mindmap 计划 | 无范围替换 | 原 V401..V418 通过 |
| V3-4.1 | 复用 PageContext、VideoOutline 和 MediaTaskStore | ContextEnvelope、KnowledgeDraft、Know 最小真实投影 | 不确认不落库；重启一致；0 Mock |
| V3-5 | 保留 renderer/Ask/evidence/seek/export 与 H01-H10 | Chat/Know 一级导航和 CX-H01..06 | 原门槛与新增门槛均通过 |
| V3-6 | 保留 12 页 B站单 run、故障、隐私和 seal | 追加普通网页/知识闭环绑定，不替换样本 | 自动化 Fatal=0/Major=0 |
| V3-7 | 保留最终独立审计 | 同时复算新增整合证据 | 人类签署后才可声明 V3 PASS |

开发顺序不可跳跃：`V3-1.4 -> V3-2.4a..2.7 -> V3-3 -> V3-4 -> V3-4.1 -> V3-5 -> V3-6 -> V3-7`。每个未完成阶段先落盘详细开发计划、验收计划和实施前审计；已通过阶段只做兼容回归，不重复开发；自动化验收失败必须回到计划，不得缩小原分母。

## 7. 后续目标

- **V4 Knowledge Intelligence**：真实语义 Query、Graph、跨来源问答、自动老化/维护、对话记忆、跨副本 Durable Forget、ASR 质量回退优化。
- **V5 Agent Workspace**：长短时任务、多 Agent、受治理工具、本地知识驱动的文档/图文输出。Agent 只有在 V4 数据与治理合同通过后才可进入一级导航。
- **V6 Portal Expansion**：YouTube、小红书等新 adapter 的独立权限、会话、样本和验收；不得继承 B站 PASS。

## 8. 防规格漂移门槛

以下任一项出现即停止开发并回到文档：

- 扩展自动启动 Runtime，或把 Runtime 生命周期绑定浏览器。
- Agent 再次成为 V3 一级入口或验收目标。
- Know 仍显示 Mock 数据却被声明为真实知识管理。
- Chat 自动保存提取结果，或 Draft/Item 状态无法区分。
- 视频能力建立独立于 Chat 的第二套产品域、证据模型或存储。
- Query/Graph/Durable Forget 被当作 V3 已完成。
- 自动验收使用合成页面替代全部真实网页/B站数据。
