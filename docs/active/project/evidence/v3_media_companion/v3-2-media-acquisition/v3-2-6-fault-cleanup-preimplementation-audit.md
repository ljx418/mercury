# V3-2-6 故障与清理实施前审计

日期：2026-10-08（基于 2026-10-06 冻结候选恢复审计）。

决定：`IMPLEMENTATION GO FOR V3-2-6-0..7`。

- Fatal：0。
- Major：0。
- Minor：1：V3-2.6 实现后必须由不同 reviewer session 完成独立出门复核；当前连续代理审计不具备组织独立性。

## Major 关闭证据

1. V3-2.5 已以 `v3-2-5-ui-20261007T155715Z` 完成 A01..A14，结论为 `LIMITED PASS`；实现验收、PRD 检视和出门审计已落盘。
2. `v3-2-5-7-independent-document-audit.md` 已独立确认 FaultMatrix/test-only injection 边界，结论 Fatal=0/Major=0/Minor=0。该审查明确要求生产入口不可选择 fault profile，并逐项复算 F01..F14 与 A01..A12。

## 实施约束

F01..F14、A01..A12、独立 task、唯一终态、终态后零写、五终态清理、owner-root recovery、双层 secret scan 与全量回归保持冻结。允许新增隔离 fault runner、测试 profile 与 observation recorder；禁止新增任何生产 API、Extension UI、环境变量或用户输入可达的 fault selector。若无法证明生产不可达，立即停止并返回文档阶段。
