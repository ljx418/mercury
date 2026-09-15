# T03-4 ProductionValidation 验收结果

日期：2026-09-13。状态：FAIL / BLOCKED。Fatal=0，Major=1。

## 已通过

- 42/42 production mutations 被对应唯一 RuleId/FailureCode 检出。
- frozen Git snapshot 三个 scan roots 可重算，当前 AST boundary violations=0。
- 179 个状态观察均保留 Runtime response 或 frontend transport inference 的 event provenance。
- ProductionValidation 能 fail-closed 输出机器失败，而不是渲染成功报告。

## Major

T02.2 sealed raw 中 7 条受控故障 `runtime_response` 的 Knowledge Status 使用 `userAction="retry"`。冻结 `v2_knowledge_status.schema.json` 不允许该值，只允许 `none/start_runtime/configure_adapter/configure_data_service/reconnect/upgrade_data_service/retry_source_build/open_debug`。

独立重算结果：`statusChecked=179`、`statusErrors=7`；失败场景为 adapter_blocked 2 条、data_service_unreachable 3 条、source_failed 2 条。ProductionValidation 当前正确输出：

```text
machinePassed=false
G5=failed
PX_RULE_STATUS_COVERAGE_FAILED:PX_STATUS_COVERAGE_FAILED
finalPassed=false
```

因此 T03-4 不通过，T03-5..7 不得进入验收或封包。
