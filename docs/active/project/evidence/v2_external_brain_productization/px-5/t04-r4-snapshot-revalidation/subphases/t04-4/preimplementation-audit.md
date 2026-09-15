# T04-4 新鲜 Production Candidate 实施前审计

日期：2026-09-14  
结论：`GO ONLY AFTER T04-3 PASS`

## 唯一输入

只允许读取同一最终 T04 run 的 `fresh/source-run/raw/raw-run.json`。禁止读取 T02.5 raw、R4-P replay output 或旧 T03 candidate 补齐任何分母。

## 固定执行

1. 在同一 detached snapshot 中按 `derive -> validate -> report -> package` 实际执行四步。
2. 新 validationRunId 必须匹配 `t04-r4-fresh-validation-*`，InvocationRecord 四步 exitCode 全 0。
3. 精确得到 63 RuleId：61 machine passed、2 human pending、0 failed、0 N/A。
4. 精确执行 109 contract cases、42 production mutations，并从新 raw 对应 Git blob 重做 G4 AST。
5. G1-G6 passed；Human Review、G7、final 分别保持 `pending / pending / false`。

## 停止条件

身份错配、读取旧泳道、分母缩小、架构扫描信任 Report 自报、旧 validator/generator 被调用或任何完成声明升级，均立即停止。
