# ClaudeCode CLI 持续 Goal：WP0 R4-R7

```text
你在 /mnt/c/workspace/navia 继续 Navia V3 WP0/P0 Background Capture Relay v10。
持续目标是依次完成 R4、R5、R6、R7，但当前只授权 R4。每个 R-stage 完成后必须写
AWAITING CODEX CHECKPOINT 并停止；没有新的 Codex `R(n+1) MAY START` 文件不得进入下一阶段。

一、启动必读

1. AGENTS.md
2. docs/active/project/design/project-stage-workflow.md，特别是 §5.1 验收分层和防重复返工
3. docs/active/project/evidence/v3_media_companion/v3-completion/wp0/
   wp0-r3-2026-10-17/60-codex-r3-checkpoint.md
4. 同目录 61-codex-r4-development-and-acceptance.md
5. docs/active/project/handoffs/v3-claudecode-completion-2026-10-15/
   04-development-and-acceptance-plan.md 的 P0 v10/R4-R7 段
6. 同目录 14-claudecode-p0-relay-goal-prompt.md 与 16-claudecode-v3-completion-goal-v2.md
7. 当前 v10 schema、fixture、baseline/mutation verifier 和 R0-R3 最新实现/测试。

先核验当前门禁应为 R0/R1/R2/R3 PASS、R4 MAY START，并确认 baseline 50/50、mutations
15/15。输出 HEAD、范围内 dirty 状态、R4 计划修改文件、公共合同影响、验证命令和停止条件。
保护整个 dirty worktree，不得 reset/clean/checkout/revert，不得删除或改写历史失败证据。

二、当前只执行 R4

严格按 61 文件一次性完成 R4-1..R4-5：

- 使用本轮 owned 临时根、随机端口和真实独立 Uvicorn 进程验证
  /v1/media/capture-stream；TestClient 或 Mock WebSocket 不得替代真实进程边界。
- 覆盖真实 session/ticket/start/non-empty PCM/ACK/stop/finalize、Origin/CSP、ticket replay、
  binding、sequence、length、backpressure、WS loss、Runtime rejection、SIGTERM 与 cleanup。
- 完整执行六个注入点：after_sink_finalize、transcript_create、before_stage、
  after_stage_before_worker、handoff_completed_frame_send、
  commit_then_runtime_restart_before_background_observe。
- after_stage hard kill 必须发生在 owner manifest parent-directory fsync 和 SQLite FULL receipt
  commit 后、worker 前；不得假定 finally。重启只凭 authoritativeTaskId 发现 manifest/receipt。
- 八类 manifest/receipt 损坏全部 fail-closed；existing recover composite cleanup 后
  acquisition/ASR/unpublished-product/active-sink 四项残留全零，fresh begin 保持单 sink。
- connecting 使用新进程 session 的 authenticated DELETE+GET；runtime-alive phase 由唯一 owner
  finally+GET；GET 404 停轮询并显示/记录 recovery pending；marker expiry 只清 marker。
- completed frame 只是 handoff；只有 SQLite ready/degraded 是 durable published，否则
  abandoned+cleanup+fresh analysis。新 worker 不写旧 task，不恢复旧 PCM/ticket/sequence/token。

公共 endpoint、API、Origin、ticket TTL、v10 schema/fixture、FailureCode、40/20 inventory、
阈值、SourceAuthority 和产品 terminal 定义不得改变。不得启动 Chrome、Provider、六视频，
不得播放声音；不得 commit/push。只能终止本轮能证明 ownership 的 PID、端口和临时资源。

实现内循环只跑受影响测试；结束时按 61 §4 做一次集中回归，不重复 R3 审计。落盘 R4 的
receipt、test-results、PRD review、handoff、payload manifest，并报告 changed files、合同变化、
每条命令/退出码、真实 Uvicorn run/PID/port 的脱敏证据、六注入点、八负例、四残留、
secret/cleanup、Fatal/Major/Minor 和停止原因。

最终状态必须是 R4 AWAITING CODEX CHECKPOINT，然后停止。不得自行宣布 R4 PASS，不得进入
R5。若需要改公共合同/固定分母/安全边界，或需要 Chrome/外部 Provider/真实视频/非 owned
kill，立即停止并交回 Codex。

三、持续 goal 的后续方向（仅保存上下文，当前不授权）

- R5：固定单视频的 fresh visible Chrome canary；必须先获得 Codex 放行，并在显示窗口、抢
  焦点前通知用户；Chrome 强制 --mute-audio。证明非空 PCM -> SenseVoice -> acquisition ->
  materialize -> ready|degraded，taskId/sourceIdentity/revision/fence 一致，UI 退出 busy。
- R6：真实关闭 permission/ticket/sender/Port/sequence/length/backpressure/restart/crash/
  navigation/cancel/SIGTERM/cleanup 边界；stub/summary 不算。
- R7：封存 immutable candidate、test-results、PRD review、false-green audit、seal、secret/
  cleanup receipts 和 hashes；Fatal=0/Major=0 后才允许 P0 closeout。
```

