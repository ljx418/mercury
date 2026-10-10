# V3-2-6 故障、清理与回归验收计划

日期：2026-10-06。固定分母 `V3-2-6-A01..A12` 与 `V3-2-6-F01..F14`。

| ID | 操作 | 必须结果 |
|---|---|---|
| A01 | 校验 Schema/positive/negative | meta PASS；FaultMatrix 正例通过；缩分母、残留、双终态、secret 命中均拒绝 |
| A02 | 运行 F01..F06 | 各自独立 task；唯一 failed/blocked；零残留 |
| A03 | 运行 F07/F08/F14 | native child 回收；无僵尸；restart 只清 owner root |
| A04 | 运行 F09/F10 | Runtime/socket 断开立即终止 capture；旧 ticket 不重连 |
| A05 | 运行 F11/F12 | 到期/撤销后无新下载；进行中停止并清理 |
| A06 | 运行 F13 取消竞态 | 恰一 cancelled；终态后 observation/artifact 不增长 |
| A07 | 五终态 cleanup | cookiefile/raw media/audio/video/capture/process/private path 全为 0 |
| A08 | restart orphan recovery | 只删除有效 owner manifest task root；其他目录 hash 不变 |
| A09 | test-only 边界 | 未签名 profile、生产构建、Extension 消息和 API 均不能选 faultClass |
| A10 | 双容器故障 UX | 显示真实机器原因、cleaning 和最终状态；不伪恢复 |
| A11 | 全量回归 | V3-1.1/1.2/1.3、V3-2-1..5、前端与 Runtime 全量通过 |
| A12 | PRD、隐私和独立审计 | 14/14、secret=0、residual=0；Fatal=0/Major=0 |

每个 F receipt 必须包含 `terminalCount=1`、`postTerminalWriteCount=0`、`residualCount=0`、`secretHitCount=0`。任何汇总值不得替代逐故障 receipt。
