# T04-1 PRD 与架构检视

日期：2026-09-14
结论：`PASS / 无 PRD 范围扩大 / 无产品代码变更`

## PRD 对账

T04-1 不创造用户功能，只冻结能够重建既有 V2-PX 真实体验的源码、工具、合同和环境。目标仍是复验三入口、五 route 四恢复、Permission、Durable Forget、四故障、四视口、Axe 与 Keyboard，不新增 RAG、长期记忆或 RKM 声明。

## 架构对账

数据流保持单向：

```text
T02.5 sealed raw + T03 accepted candidate + frozen contracts
-> dependency closure
-> detached base worktree
-> explicit T03/T04 overlay
-> local-only acceptance commit
-> importable Git bundle + source/build/environment indexes
-> SnapshotInputManifest
```

- 产品路径来自 `430cdd...0d36` Git blob，未从脏主工作树复制。
- T03 工具以 T03 独立审查 hash 作为来源，T04 工具以用户授权摘要 hash 作为来源。
- Node 使用 base lock 的 frozen install；Python 使用真实 wheel 原始字节和离线 hash lock。
- snapshot 构建只修改 `/tmp` detached worktree 与 T04 evidence run；主工作树 HEAD/index 状态不变。

## 风险结论

当前隔离边界实现路线足以支撑后续工具开发，但本次 acceptance commit 尚未包含 T04-2..7 的最终实现字节，已降级为 development checkpoint。全部工具冻结后必须重建唯一最终快照。下一阶段若十项 exact artifact 或 InvocationRecord 规范化出现差异，必须修复确定性来源或停止重规划，不得扩大忽略字段集合。
