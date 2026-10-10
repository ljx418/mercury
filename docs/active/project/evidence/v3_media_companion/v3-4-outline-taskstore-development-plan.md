# V3-4 MediaTaskStore、VideoOutline 与三视图开发计划

日期：2026-10-08。状态：`V2 CONTRACT FROZEN / IMPLEMENTATION NO-GO PENDING EXPLICIT AUTHORIZATION`。

## 1. 阶段目标与目标体验

V3-4 把同一 `MediaTask` 的 transcript、frame、OCR 和 vision evidence 持久化为可恢复的任务聚合，生成唯一语义权威 `VideoOutline`，再确定性派生 Timeline 与 `MediaMindmapProjection`。Runtime 重启、页面关闭或 UI 路由恢复后，用户看到的仍是同一 task/revision/evidence，而不是前端缓存重建的近似内容。

本阶段不实现最终双容器 UI、Ask、播放器 seek、人类验收或 V4 知识导入。`knowledgeImportStatus` 固定为 `deferred_to_v4`。

## 2. 前置与输入

1. V3-3 已取得独立限定 PASS；V3-2/V3-3 seal 只证明样本、工具和能力资格，不包含可供下游消费的正文。
2. `v3_media_outline_taskstore_v1.schema.json` 保持历史只读；实现基线改为 `v3_media_outline_taskstore_v2.schema.json`，支持真实 `ready/degraded/blocked` 终态。
3. 使用仓库现有 Python `sqlite3` 与 Runtime SQLite/EventStore 模式，不引入独立数据库服务。
4. Outline 合成冻结为本地确定性抽取：只消费当前 task 的 transcript/OCR/VLM caption，按时间窗口聚类、证据密度选标题与摘要；不新增云端文本调用，不把 fixture 当 production 输入。
5. V3-4 必须在全新单 run 内重新获取并持久化 12 页真实 evidence。最多 8 张 selected frame 的 MiniMax 调用仍需 V3-4 新 task-scope 授权；V3-3 授权不得继承。
6. 用户明确批准 V3-4 实施和上述 selected-frame 云视觉范围后才能执行 production run。

## 3. 代码实体与分层

| 实体 | 目标位置 | 职责 | 不得负责 |
|---|---|---|---|
| `MediaTaskStore` | `services/local-runtime/navia_runtime/modules/media_companion/task_store.py` | SQLite aggregate、revision、状态、evidence refs、transaction | 不读取门户 DOM/Cookie，不生成内容 |
| `MediaTaskRepository` | 同目录 | optimistic revision、事务读写、重启恢复 | 不静默覆盖新 revision |
| `MediaTaskStateMachine` | `state_machine.py` | closed-set transition、terminal/cancel barrier | 不允许 UI 任意写状态 |
| `MediaTaskOutbox` | Runtime SQLite | 与 aggregate/event 同事务提交待处理动作 | 不执行 Provider 请求 |
| `DeterministicExtractiveOutlineGenerator` | `services/local-runtime/navia_runtime/modules/media_companion/outline.py` | 按时间窗口从同 task transcript/OCR/VLM caption 抽取 typed candidate | 不联网、不补造事实、不直接发布 |
| `VideoOutlineValidator` | A | identity、时间、顺序、evidence closure、无证据章节拒绝 | 不补造 evidenceId |
| `TimelineProjector` | A/B shared domain | 从已发布 outline 确定性派生 timeline | 不重新总结媒体 |
| `MediaMindmapProjector` | C mindmap module | 从已发布 outline 派生节点与 source map | 不调用 ASR/VLM 或改写 outline |
| `MediaTaskApplicationService` | Runtime API | create/read/cancel/retry/recover/export-read boundary | 不绕过 repository transaction |

## 4. SQLite 模型与事务边界

目标数据库继续使用 `.navia/navia.sqlite3`，新增表须版本化迁移：

| 表 | 主键/唯一键 | 关键字段 |
|---|---|---|
| `media_tasks` | `task_id` | source_identity、state、revision、created_at、updated_at、knowledge_import_status |
| `media_evidence_refs` | `(task_id,evidence_id)` | kind、timestamp、content_sha256、relative_ref |
| `media_outlines` | `(task_id,revision)` | outline_id、canonical_json、content_sha256、published |
| `media_task_events` | `(task_id,sequence)` | event_type、payload、created_at |
| `media_task_outbox` | `outbox_id` | task_id、task_revision、action、status、attempt |

以下写入必须在一个 `BEGIN IMMEDIATE` 事务内完成：aggregate revision CAS、event append、outbox append、outline publish。任一失败整体 rollback。`expectedRevision + 1 = committedRevision`；同 idempotency key 重试返回原结果，不生成第二事件或第二 outbox。

## 5. 状态机

允许状态：

```text
created -> acquiring -> transcribing -> extracting_frames
-> analyzing_vision -> synthesizing -> ready | degraded | failed

任何非终态 -> cancelling -> cancelled
failed/degraded -> retry(new revision, same task identity)
```

- `ready/degraded/failed/cancelled` 是终态快照；重试创建新 revision，不覆盖旧版本。
- Runtime 重启时，未终结的 Provider side effect 不自动重放；先按 outbox/receipt 对账，不确定则 failed/degraded。
- 已提交 outline 不因旧 retry 完成而被覆盖。
- 取消 barrier 后禁止发布 outline、timeline 或 mindmap。

## 6. `VideoOutline` 生成与发布

1. 输入只来自同 task 当前 revision 的 evidence catalog。
2. Generator 输出 typed candidate；不得直接进入 UI。
3. Validator 拒绝无 evidence 的 section、跨 task evidence、时间逆序、超出媒体时长、重复 sectionId 和未知字段；提交回执必须固定 `unresolvedEvidenceReferenceCount=0`、`crossTaskEvidenceReferenceCount=0`、`projectionEvidenceClosurePassed=true`。
4. 发布后 canonical JSON 和 SHA-256 固定。
5. Timeline 仅映射 section 的时间/顺序/evidence。
6. Mindmap 根节点对应 outline；子节点必须对应 section；不自行增加事实节点。
7. 图文、时间线、Mindmap 的 `outlineId/taskId/revision` 必须一致。

## 7. 子阶段

### V3-4-0 合同、迁移和状态机冻结

冻结 Schema、migration、transition registry、FailureCode 和正负 fixture；迁移必须可在旧 V1/V2 数据库上执行且不改写旧表事实。

### V3-4-1 Repository 与事务

实现表、CAS revision、event/outbox 同事务、idempotency 和读取 API。用进程 kill/fault injection 验证原子性。

### V3-4-2 恢复与取消

实现 startup scan、outbox 对账、取消 barrier、orphan 标记和 retry 新 revision。不得自动重放已成功 VLM 上传。

### V3-4-3 Outline candidate 与 validator

实现本地确定性抽取 generator、证据闭合和时间校验。12 页使用 V3-4 新 run 重建的真实 evidence；无证据章节必须被拒绝，闭合计数和 projection closure 必须进入同事务 receipt。

### V3-4-4 Timeline 与 Mindmap projections

只从已发布 outline 派生。相同 outline bytes 必须生成相同 canonical projection hash。

### V3-4-5 Runtime API 与路由恢复

提供 task list/detail/status/artifacts/projections 的只读接口以及 cancel/retry 命令。direct/reload/Back/reopen 都从 Runtime 重读，不依赖 React state。

### V3-4-6 真实矩阵与回归

在一个全新 V3-4 production run 中处理冻结 12 页：10 页 `ready`、低信号页 `degraded`、受限页 `blocked` 且零投影。执行生成、重启、取消、冲突和恢复；封存 SQLite 快照 hash、事件/outbox 对账和三视图产物。V3-2/V3-3 seal 仅作为资格绑定，不得代替本 run 正文。

### V3-4-7 独立出门审计

独立复算 V401..V418、Schema、迁移、事务故障、12 页 identity、projection hash、secret/path scan。Fatal=0/Major=0 后只放行 V3-5 详细冻结。

## 8. FailureCode 闭集

`TASK_NOT_FOUND`、`TASK_IDENTITY_MISMATCH`、`TASK_REVISION_CONFLICT`、`TASK_TRANSITION_INVALID`、`TASK_TRANSACTION_FAILED`、`TASK_RECOVERY_UNCERTAIN`、`EVIDENCE_NOT_FOUND`、`EVIDENCE_TASK_MISMATCH`、`EVIDENCE_TIME_INVALID`、`MEDIA_ACCESS_RESTRICTED`、`LOW_SIGNAL_CONTENT`、`OUTLINE_RESPONSE_INVALID`、`OUTLINE_EVIDENCE_REQUIRED`、`OUTLINE_VALIDATION_FAILED`、`PROJECTION_DRIFT`、`OUTBOX_RECONCILIATION_FAILED`、`TASK_CANCELLED`。

## 9. 交付物与边界

- SQLite migration、repository/state machine/outbox、outline/validator/projectors 和 Runtime API。
- Schema/registry/fixtures、contract/integration/crash-recovery tests。
- 12 页真实结构化产物、数据库快照、事件/outbox 对账、PRD review 和独立审计。
- 不交付 Ask、seek、最终 renderer、Markdown ZIP/JSON 导出或知识库导入。

历史 v1 文档已由 `v3-3-7-independent-document-audit.md` 覆盖，审计 SHA-256 为 `050c5e21e866288fd99498069dec1a8ace3f1ef21701c0b6b2cdc2e57ae19eca`。V3-3 当前已有 sealed LIMITED PASS；v2 修订仍须完成独立文档复审并取得 V3-4 明确实施及 selected-frame 授权，因此代码实施保持 NO-GO。
