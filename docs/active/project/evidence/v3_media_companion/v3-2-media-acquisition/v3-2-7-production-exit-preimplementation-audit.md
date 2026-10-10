# V3-2-7 单 run 出门实施前审计

日期：2026-10-08（基于 2026-10-06 冻结候选恢复审计）。

决定：`IMPLEMENTATION GO FOR V3-2-7-0..7`。

- Fatal：0。
- Major：0。
- Minor：1。最终候选必须由不同 reviewer session 独立复算；当前实施前恢复审计不能代替出门独立审查。

## Major 关闭证据

1. V3-2.6 已完成 F01..F14、A01..A12、真实 Chrome 双容器故障 UX 与全量回归，结论 `LIMITED PASS`。
2. production runner/collector/verifier/package 的职责、路径、单 run 边界和停止条件已在开发/验收/威胁文档冻结；工具实现属于 V3-2-7-0..7 本身，不再被错误地作为开始实现前置。
3. `v3-2-5-7-independent-document-audit.md` 已对 ExitCandidate、12 页 `6+3+1+1+1`、A01..A20、pending/false 和外审边界独立复算，Fatal=0/Major=0/Minor=0。

固定分母、single-run、public/private、seal、候选 pending/false、允许声明和 H01..H10 延后到 V3-5 的边界保持不变。允许开始 tooling 和全新生产 run；任何平台分类漂移、Cookie 失效、真实 ASR/capture 失败、跨 run 拼接或 secret/residual 命中均须作废整个 run。
