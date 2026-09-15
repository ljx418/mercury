# T04-5 比较器与负向矩阵实施前审计

日期：2026-09-14  
结论：`GO ONLY AFTER T04-4 PASS`

## 正例前置

R4-P 必须先通过 10 个逐字节比较、InvocationRecord 仅 `/recordedAt` 的单指针归一化及 8 个 stdout/stderr 比较；R4-E 必须先通过完整 fresh lane profile。所有负例都从对应 valid base 单独变异。

## 固定负例

机器 registry 与执行集合必须精确等于 `T04-N-001..025`。每例必须记录 requirementId、requirementKey、mutation、expectedPrimaryFailure、observedPrimaryFailure 和 passed；不得只改结果布尔值。G4 负例必须改变 tracked source 原始内容并重新计算 blob/source-tree 数据，同时保持原零违规自报，以证明 AST 扫描真实执行。

## 停止条件

缺 case、重复 case、错误失败码、多个未隔离变异、positive base 先失败、旧 candidate 被接受、跨泳道拼接、公开秘密未拒绝、Human/G7/final 假绿未拒绝时，T04-5 失败。
