# P0 Background Capture Relay 第五轮独立审查与 v4 修订记录

日期：2026-10-15。状态：`V1-V3 REJECTED / V4 DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO`。

第四轮后的 v3 固定包经新只读 subagent 复算 18/18 hashes、verifier 24/24，但仍发现 Major=3、Minor=2：未知 FailureCode/第十消息可通过；decoded length 关系只验证正例；trace/marker/restart 字段可被变异而 verifier 仍绿；历史 Phase 0 计数 70 与分项 72 不一致。

v4 闭环：

- `$defs.failureCode` 改为完整 enum；messageExamples 固定 min=max=9 且 unique。
- 新增 unknown code、第十消息、decoded-length mismatch、non-canonical padding 四个主动反例探针。
- 主 trace 扩展到 24 步，补齐 capturing/draining/cleanup_pending phase、quiesced outstanding、stopped tracks/context、独立 runtime_stop_sent 和 cleanup 三项 0。
- 新增 7 步 restartRecoveryTrace，覆盖 old task fail、Runtime finally 三项 0、grace、marker clear、fresh begin 单 sink前置和 fresh started。
- 新增五个实际 marker instance，逐个用 date-time schema 校验；verifier 复算 expiresAt-startedAt=1080 秒且所有 phase 不刷新 expiry。
- verifier 对主 trace、restart trace、negative suite 使用固定 canonical JSON digest；任一字段变化即失败，并显式核 forwarding/ACK sequence、credit、停止边界和完整 30 映射。
- 历史 Phase 0 报告计数修正为总计 72、通过 71/72、失败 1。

v4 verifier 当前 24/24 PASS。该结果仍不证明实现；必须重建 immutable v4 外审包，经 ClaudeCode CLI Fatal=0/Major=0 后再请求用户明确实施授权。
