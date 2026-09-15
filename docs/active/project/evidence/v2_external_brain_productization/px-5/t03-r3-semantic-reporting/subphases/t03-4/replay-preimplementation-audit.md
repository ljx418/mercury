# T03-4 T02.3 ProductionValidation 重放实施前审计

日期：2026-09-14。决定：`CONDITIONAL GO AFTER T03-1..3 REPLAY PASS`。

## 历史缺陷与新正基线

历史 T03-4 对 T02.2 的失败结论保持有效：178 条 Status 中 7 条 `userAction=retry` 不符合冻结合同。新正基线 T02.3 为 203 checked / 0 errors，不能在 reader、derived 或 validator 中做字段替换来取得该结果。

## 固定门槛

1. Contract regression 109/109。
2. 42 个 raw/byte/causality mutation 从同一 T02.3 正基线逐项隔离失败，0 个只改 report 布尔值。
3. 63 条规则精确为 61 machine passed + 2 human-only pending；failed=0、N/A=0。
4. G1-G6 passed，G7 pending；`machinePassed=true`、`finalPassed=false`。
5. Status diagnostic 为 203/0；旧 T02.2 回归仍为 178/7 且 G5 failed。
6. G4 从 T02.3 snapshot Git blob 重算，不信任结果字段。

任何失败均停止在 T03-4，不进入报告或封包。
