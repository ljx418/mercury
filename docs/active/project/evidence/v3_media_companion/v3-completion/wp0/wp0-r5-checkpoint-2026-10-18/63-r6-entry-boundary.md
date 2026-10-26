# R6 入口边界（未授权实施）

R6 只有在 Codex 接受 R5-B checkpoint 并另行写出 `R5 PASS / R6 MAY START` 后才能开始。

R6 不创建新的 20-case 分母。权威分母保持：

- `RLY10-N01..RLY10-N30`
- `OM10-N01..OM10-N08`
- permission、ticket/binding、sender/context、Port、sequence/length/credit/backpressure、restart、
  Runtime crash/WS loss、tab close/navigation、cancel、SIGTERM、cleanup failure 的真实边界补充项

正式 R6 计划必须提供逐项映射：

```text
execution group
-> RLY10-Nxx / OM10-Nxx / supplement ID
-> production owner entity
-> real driver type
-> exact expected FailureCode/state
-> fresh or reused-authoritative evidence
-> command/exit code/residual/hash
```

`secret scan`、`cleanup scan` 和汇总回归是横向门槛，不得伪装成冻结负例。R4 证据只有在风险、
生产实体和 oracle 同等或更强且 hash 可复算时才能标记 `reused-authoritative-evidence`；其余必须
本轮执行。正式 R6 提示词在 R5-B 通过后由 Codex 生成，当前不得使用历史或已删除的 R6 prompt。
