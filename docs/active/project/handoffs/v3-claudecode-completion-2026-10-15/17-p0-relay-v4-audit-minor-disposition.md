# P0 Relay v4 外审 Minor 处置

日期：2026-10-15。历史状态：`SUPERSEDED BY V5 REPLAN`。输入：`stage-b-b5-3-background-capture-relay-independent-document-audit-v4-2026-10-15.md`。该 Claude 外审结论为 `DOCUMENT PASS / Fatal=0 / Major=0 / Minor=3`，但另一独立 reviewer 随后发现 v4 Fatal=0/Major=3/Minor=2；因此本处置不能授权 v4 实现，当前闭环见 `18-p0-relay-v5-replan-closure.md`。

## 处置

| Minor | 处置 | 实施约束 |
|---|---|---|
| W1 | “30 项 FailureCode 唯一映射”统一解释为“RLY4-N01..N30 三十个负例到预期 FailureCode 的固定映射”；不是 30 个不同错误码。 | R0 必须保持 30 个 case ID、顺序和 mapping 精确一致；不得增加第 31 例冒充闭集。 |
| W2 | 所有当前实现引用均使用 internal relay schema/restart marker **v4**；文档中的“v3 六字段”是历史笔误。 | 禁止实现 v1-v3；marker 仍只有 schemaVersion/captureSessionId/taskId/startedAt/phase/expiresAt 六字段。 |
| C1 | schema 的 FailureCode 闭集为 20 项；relay 的 30 个负例直接覆盖其中 10 项。其余 10 项由其所有者边界验证。 | `AUDIO_SHAPE_INVALID/BYTE_LIMIT/DURATION_LIMIT/EMPTY` 在 Runtime capture 流验证；`TICKET_INVALID/TICKET_EXPIRED/TICKET_REPLAYED/BINDING_MISMATCH/ALREADY_ACTIVE/FINALIZE_FAILED` 在 ticket/session/finalize 集成与 R4/R6 故障矩阵验证。不得为了“relay 全覆盖”复制上游逻辑。 |

## 出门要求

1. R0 TypeScript tests 必须证明 9 类消息闭集、20 项 FailureCode enum 和 RLY4-N01..N30 固定映射。
2. R4/R6 structured verification 必须逐项记录上述其余 10 项的 owner、测试命令、退出码和真实/隔离边界，不得只写总数。
3. 若实现发现任一错误码所有权与上表不符，停止实施并回文档；不得静默改变公共合同。
4. 该处置不把文档 PASS 扩大为实现授权、P0 PASS、P1 或 V3 PASS。
