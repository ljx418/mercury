# V3-4 授权后执行计划

日期：2026-10-08。授权：`v3-4-implementation-authorization.json`。

| 子阶段 | 实施 | 阶段验收与 PRD 检视 |
|---|---|---|
| V3-4-0 | 冻结 v2 Schema、迁移、状态机、FailureCode | v1 字节不变；v2 meta/正负合同 PASS；不缩小 12 页 |
| V3-4-1 | SQLite repository、CAS、event/outbox 同事务、idempotency | fault injection 全有或全无；重试 0 重复 |
| V3-4-2 | startup recovery、cancel barrier、retry revision | 崩溃不重放不确定副作用；取消后 0 发布 |
| V3-4-3 | 本地确定性 extractive outline + validator | 同 evidence 同 hash；无证据/跨 task/时间错误拒绝 |
| V3-4-4 | Timeline 与 Mindmap 纯投影 | 同 outline 同 canonical bytes；0 二次模型调用 |
| V3-4-5 | Runtime task/detail/projection/cancel/retry API | direct/reload/reopen 从 SQLite 恢复，不依赖 React state |
| V3-4-6 | 冻结 12 页真实单 run | 10 ready + 1 degraded + 1 blocked；最多 8 帧云调用；临时媒体/帧/截图 0 残留 |
| V3-4-7 | 独立出门审计 | V401..V418 全绿，Fatal=0/Major=0，才放行 V3-5 文档恢复 |

每个子阶段先执行针对性测试，再执行 Runtime 全量回归和 PRD 边界检查。任何真实分母失败都回到计划/实现，不补写 seal、不拼接旧 run。
