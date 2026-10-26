# P0 Relay v6 重规划闭环

日期：2026-10-15。状态：`V6 DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO / P1 BLOCKED`。

## v5 拒绝事实

v5 的 Claude 审查曾报告 PASS，但严格 reviewer 复核为 Fatal=0/Major=5/Minor=2。按更严格结论，v5 不可实施：verifier 未冻结 Schema；sink finalize 被误作终态；connecting marker 无可达终结 owner；Runtime hard crash 后 GET 404 无恢复 owner；内部 relay 与公开 Runtime/UI FailureCode 未分层。

## v6 闭环

1. Schema 与 protocol canonical digest 均冻结，任何 Schema 放宽、port 回退或权威字段改写都必须失败。
2. 协议终态仅在权威 task 终态迁移和 terminal frame 发送成功后提交；sink finalize 不是 terminal。
3. `after_sink_finalize`、`transcript_create`、`transcript_start`、`before_completed_send`、`completed_send` 五个注入点全部要求 Runtime finally、同 task failed terminal 与 cleanup 0。
4. connecting-before-start 由既有认证 DELETE+GET 负责；valid-start/runtime-alive 由 Runtime finally+GET；graceful/hard crash 由持久 SourceAuthority 的既有 recover；GET 404 停轮询；marker expiry 只清 marker。
5. 20 项内部 relay FailureCode 通过冻结映射吸收既有边界码；公开 Runtime/UI 合同不变，不新增用户动作或公共 API。
6. v6 机器合同包含 24 步主链、8 步 restart、6 步 terminal failure、七类 phase recovery、五类 terminal failure 和 RLY6-N01..N30；当前 verifier 34/34 PASS。

## 门禁

34/34 仅证明当前静态候选自洽。必须重建平铺外审包，并由 Claude Code 与另一独立 reviewer 均给出 Fatal=0/Major=0；随后仍需用户明确批准 P0 R0-R7，主干才可进入代码实施。P1 六视频继续 BLOCKED。
