# V3 完成态架构与代码所有权

## 1. 架构不变量

```text
MediaPageContext
  -> canonical sourceIdentity
  -> Source Authority（同源唯一权威 task/revision）
  -> Acquisition（字幕 / 媒体 / SenseVoice / OCR / 选帧）
  -> Evidence Catalog（原始证据仅留本机）
  -> Grounded Comprehension（brief / chapter / claim / concept）
  -> 原子发布 Derived Projection
  -> Side Panel + Workspace 同 revision 展示
  -> 用户确认 KnowledgeDraft
  -> KnowledgeItem
```

同一来源在不同网页、页签、Side Panel 与 Workspace 必须解析到同一个权威任务。刷新、重开和 Runtime 重启只能恢复或明确创建新 revision，不得制造并行权威、跨任务拼接或把旧结果自动附着到新授权。

## 2. 分层与代码实体

| 层 | 当前实体 | 后续职责 | 状态 |
|---|---|---|---|
| Portal | `MediaPortalAdapter`、`BilibiliMediaPortalAdapter`、session/credential modules | 页面身份、窄域权限、播放定位、seek；未来门户只扩展 adapter | 已有限定基础 |
| Side Panel | `entrypoints/sidepanel/main.tsx`、acquisition hooks/cards | 一键分析、状态披露、Chat、Draft 确认；减少内部卡片噪声 | Stage C/D 待改 |
| Workspace | `MediaWorkspaceShell/Router/ComprehensionViews` | 概览、大纲、时间线、概念图、Ask、导出 | Stage C/D 待改 |
| Runtime API | `navia_runtime/app.py` | exact-Origin 会话、source authority、task、materialize、ask、export、knowledge API | 已实现候选 |
| Authority | `task_store.py`、projection/source authority API | `sourceIdentity -> taskId/revision/state` 原子、幂等、单调 | Stage A LIMITED PASS |
| Acquisition | `acquisition/coordinator.py`、ASR、vision、media cache | 单任务获取、临时件权限、cleanup barrier、真实 route 记录 | V3-2/3 LIMITED PASS |
| Comprehension | `comprehension/service.py`、`quality.py`、`synthesis.py` | 单 Provider 结构化生成、确定性降级、证据闭合、质量 receipt | B-5 当前重点 |
| Product services | `product_materializer.py`、`product_services.py` | materialize、Ask、exports、evidence return | 已实现候选，待质量出门 |
| Knowledge | Runtime knowledge API + `knowledge_workspace` | Draft 与 Item 分离、显式确认、本地 CRUD | 待正式出门 |
| QA tooling | `scripts/stage_b_b5_3/*`、V3-6 collector/verifier | fresh isolation、静音 Chrome、seal、secret/raw-media scan | Phase 0 NO-GO |

## 3. 权威状态机

最少状态为：

```text
absent -> created -> acquiring -> transcribing -> grounding -> publishing
       -> ready | degraded | blocked | cancelled | failed
```

- `published` 是发布动作或事件，不应与 `ready/degraded` 产品终态混用。
- `active` 只能表示仍在运行，不能被 runner 当成成功终态。
- 状态必须携带 `taskId`、`revision`、`currentStep`、`lastProgressAt` 和明确 terminal outcome。
- UI 计时器基于 elapsed time；超过阈值只显示“长时间无进展”，不能臆造百分比或失败。
- cancel/retry/restart 必须经过 cleanup barrier，旧 task 不得在完成后覆盖新 task。

## 4. Provider 边界

- 每个任务开始时锁定单一 Provider 和能力合同，任务内禁止跨 Provider 拼接、最佳 N 选一或隐式 fallback。
- MiniMax 是默认产品选择；DeepSeek 是手动选择和结构化能力研究对象。
- 401/403/refusal 不得进入确定性 composer 冒充模型成功；只有冻结 allowlist 中的结构失败可进入确定性 brief composer。
- 云端只允许任务授权范围内的派生 transcript/OCR/vision-caption 文本；原始视频、音频、帧、Cookie、密钥和本地路径上传必须为 0。

## 5. 兼容与扩展

- V3 只验收 B站，但 portal 接口必须保持 `MediaPortalAdapter` 开放性；YouTube、小红书需独立权限、样本和验收，不能继承 B站 PASS。
- 新 projection/schema 必须版本化，旧任务继续可读；不得原地改写已封存 schema/run。
- Draw.io/React Flow/vis-timeline 是呈现层，不得成为第二事实源。布局可保存，内容与证据仍来自同一 task/revision。

## 6. 端到端调用时序

```text
用户打开受支持页面
  -> PortalAdapter.resolvePageContext()
  -> Runtime POST /media/acquisitions/resolve(sourceIdentity, policyRevision)
  -> SourceAuthority 原子返回 attached | created | conflict
  -> AcquisitionCoordinator 获取字幕/音频/截图并写入任务私有目录
  -> Transcript/OCR/Vision 生成带时间范围的派生事实
  -> ComprehensionService 锁定单一 Provider 合同并生成结构化候选
  -> QualityGate 校验 schema、全片覆盖、证据闭合和内容风险
  -> ProductMaterializer 原子发布同一 task/revision 的 projections
  -> Side Panel 与 Workspace 读取同一 projection revision
  -> 用户点击证据 -> PortalAdapter.seek() -> seek receipt
  -> 用户确认 KnowledgeDraft -> KnowledgeItem 事务提交
```

任何一步失败都必须落在同一任务的明确 terminal/blocked 状态。UI 不得自行补写成功状态，Provider 也不得直接写 projection 或 KnowledgeItem。

## 7. 数据所有权与一致性

| 数据 | 唯一写入者 | 消费者 | 一致性要求 |
|---|---|---|---|
| `sourceIdentity -> task/revision` | SourceAuthority/TaskStore | Side Panel、Workspace、runner | 原子、幂等、同源唯一 |
| 原始/临时媒体 | Acquisition sandbox | ASR/OCR/Vision | 私有权限、任务结束清理、禁止入公开包 |
| transcript/OCR/caption | 对应派生服务 | Comprehension、审计 | 带来源时间范围和哈希，不跨 run 拼接 |
| structured comprehension | ComprehensionService | QualityGate/Materializer | 单 Provider、schema 版本锁定 |
| published projections | ProductMaterializer | UI、Ask、Export | 同 task/revision 原子可见 |
| KnowledgeDraft | Chat/Runtime draft API | 用户确认界面 | 未确认不得进入 Item |
| KnowledgeItem | Knowledge transaction service | Know | 幂等、冲突可见、可追溯来源 |
| Provider secret | 系统凭据库 | Runtime provider adapter | 扩展不可读明文，日志/证据 0 hit |

## 8. 组件失败边界

- Portal 失败：保留页面上下文，提示权限/门户不支持，不创建伪 task。
- Runtime 失败：UI 显示断开和重试；已发布 revision 仍可只读，未完成任务不得冒充完成。
- Acquisition 失败：按 route 记录 blocked/degraded；清理屏障完成前不得重试同 source authority。
- Provider 失败：401/403/422/refusal/timeout 分类处理；只有冻结 allowlist 的结构失败可进入确定性 composer。
- Materialize 失败：旧 revision 保持可读，新 revision 不可部分发布。
- UI/seek 失败：显示 receipt 错误，不修改 Runtime 事实，也不把跳转失败吞掉。
- Restart：先恢复 authority 和最后已发布 revision，再决定恢复、取消或新建 revision；不得产生并行权威。

## 9. 完成阶段的零层架构

```text
L0 用户体验
  Chat：识读当前页/视频、提问、提纯、生成 KnowledgeDraft
  Know：确认后的知识条目查看、编辑、排序、归档、来源反跳
  Media Workspace：概览、大纲、时间线、概念图、导出

L1 浏览器交互层
  PortalAdapter -> Side Panel -> Workspace Router -> Evidence Return

L2 本机编排层
  Runtime Session -> SourceAuthority -> Task FSM -> Materializer -> Knowledge Transaction

L3 媒体与理解层
  Subtitle/Download/tabCapture -> SenseVoice/OCR/Frames -> Grounded Synthesis -> Quality Gate

L4 数据与治理层
  Private Task Artifacts -> Versioned Projection -> Credential Vault -> Audit/Seal/Cleanup
```

依赖只能从 L0/L1 指向 L2/L3/L4 的公开合同；Provider、下载器、ASR、OCR 不得直接写 UI 或 KnowledgeItem。UI 只读取权威 projection，不根据局部转写自行推导“完成”。

## 10. P0-P9 架构演进与所有权

| 阶段 | 主要架构变化 | 权威写入者 | 不变量 |
|---|---|---|---|
| P0 | runner 与真实产品状态机对齐 | Runtime SourceAuthority/TaskStore | runner 不制造 task、state 或成功 |
| P1-P3 | 六视频质量证据与封包 | Comprehension/Materializer | 单 run、单 Provider、同 task/revision |
| P4 | 状态、计时、恢复投影 | Runtime task FSM；UI 只渲染 | UI busy 与 Runtime terminal 必须一致 |
| P5-D1 | brief、章节、claim projection | Grounded Comprehension | 全片覆盖、证据闭合 |
| P5-D2 | 图文大纲、时间线、seek receipt | Materializer + PortalAdapter | 视频秒数、真实帧、不伪造截图 |
| P5-D3 | 概念关系图与布局 | 内容由 Runtime，布局由 UI | renderer 不是事实源 |
| P5-D4 | 五类导出 artifact | Export service | 每次导出独立、可取消、可追踪 |
| P6 | Draft -> Item 事务 | Knowledge transaction service | 未确认写库为 0 |
| P7-P9 | 同 build 综合验证与收口 | Collector/Verifier/Audit | 证据可复算、人类项不代签 |

## 11. P0 任务创建与物化时序

P0 必须冻结并证明以下唯一时序：

```text
resolve(sourceIdentity)
  -> SourceAuthority 返回 authoritative taskId
  -> createOutlineTask(sourceIdentity) 复用 authoritative taskId
  -> acquisition/transcript projection 到达可物化条件
  -> Side Panel materializeCurrentMediaTask effect 调用 materialize-visual(taskId)
  -> visual 失败时同一 effect 调用 materialize(taskId) 生成受限结果
  -> TaskStore 单调迁移 created -> ... -> ready|degraded
  -> runner 只轮询并验证，不直接改库或伪造终态
```

P0 已选择 Side Panel effect 为成功路径唯一 materialize 编排者。Runtime 是任务状态、SourceAuthority、projection 和持久化的权威，但不在 acquisition 终态之外另启一个隐式编排循环。runner 只允许点击产品入口、授权、可信音频捕获开始/完成和取消/重试等用户可达动作，并观察 Side Panel 发出的请求；禁止 runner 自行调用 materialize、直接写库或与 UI 竞争。`POST /outline-tasks` 的 Route A 幂等复用由 Runtime API 集成测试独立验证。

固定无字幕视频的成功时序是：

```text
一次分析 -> resolve/execute -> awaiting_trusted_capture
  -> 用户可信点击 media-capture-start（Chrome 全程 --mute-audio）
  -> 用户点击 media-capture-finish -> 本地 ASR/transcript projection succeeded
  -> Side Panel effect -> materialize-visual
  -> 视觉失败时同一 effect -> materialize
  -> ready|degraded -> UI 自动停止 busy 并发布同 task/revision
```

自动化可以模拟可信点击，但不得绕过 Chrome user activation 或直接伪造 capture grant。测试结束后原始音频、视频、临时帧和 profile 必须清零。

## 12. 架构出门判定

- 同源页面、多个页签、Side Panel、Workspace、刷新与 Runtime 重启只存在一个 active authority。
- 旧授权 revision 保留为隔离历史，不自动附着到新授权；用户确认后原子切换。
- 每个 terminal state 都完成私有临时件 cleanup；已发布 projection 与必要审计元数据按保留策略保存。
- Provider、门户、renderer 均通过 adapter 扩展；B站 PASS 不外推到 YouTube/小红书。
- 任何 schema/公共 API 变化必须版本化并回到文档冻结，不能在 P0 runner 修复中顺手修改。

