# WP0 R3 Controller Integration 开发与验收计划

日期：2026-10-17  
前置门禁：`60-codex-r2-final-checkpoint.md` 已判定 `R2 PASS`  
授权边界：**仅 R3；不得进入 R4，不运行 Chrome、Provider 或六视频**

## 1. 目标与非目标

R3 只完成 Controller/router/client 的生产接线与生命周期编排：

```text
可信 grant/ticket
  -> Background RuntimeCaptureTransport.start
  -> Runtime started
  -> Controller.sendStart(one-shot streamId)
  -> producer ready / credit / chunks
  -> quiesce
  -> drain
  -> Offscreen stopped
  -> Runtime finalize
  -> terminal + marker cleanup
  -> disconnect Port + close Offscreen document
```

唯一编排者必须是 `MediaCaptureController`。Offscreen 不新增控制面、Runtime 网络、ticket、
binding 或持久状态；Background 不新增第二个 start/stop 编排入口。

本阶段不做 Runtime/Uvicorn 真实回归（R4）、可见静音 Chrome canary（R5）、真实故障矩阵
（R6）或 immutable candidate/独立出门（R7）。公共 API、v10 schema/fixture、FailureCode、
固定阈值、权限、Origin、ticket TTL 均不得改变。

## 2. 开发工作包

### R3-1 单一编排入口

- 追踪 background message router/client 到 `MediaCaptureController` 的 start/status/stop 路径。
- 删除或拒绝任何绕过 Controller 的 producer start、Runtime finalize 或 Offscreen close 路径。
- 同一 grant/capture 只能有一个 active controller owner；重复 start 返回冻结错误，不创建第二
  socket、Port 或 Offscreen document。

### R3-2 启动顺序

- Runtime `started` 之前不得获取/下发 streamId，不得发送 producer `start`，不得接收 chunk。
- Runtime start 失败、streamId 失败、Port 未连接、producer start 失败均 fail-closed，并关闭
  本轮可证明 ownership 的 socket、Port、marker 和 Offscreen document。

### R3-3 两阶段停止

- 固定 stop reason 后才发 `quiesce`。
- producer 停止新增音频，已有队列按单信用 drain；backlog/in-flight 为零后才接受
  `stopped` 并向 Runtime 发送 finalize。
- Runtime stop/finalize 后拒绝任何新 chunk；terminal settle 后清 marker、断 Port、关闭
  Offscreen document。
- navigation/tab_closed/cancelled 不得被改写为 completed。

### R3-4 idle/error 清理与双轮隔离

- 所有 start 失败、capture_error、disconnect、timeout、abort、stop terminal 和无 active stop
  都必须使 Controller 回到可解释的 idle/error 状态并关闭 Offscreen。
- 新增至少一个双轮 production composition：第一轮失败并 abort 一次、完成清理；第二轮建立
  新 captureSessionId/new Port，仍只 abort 一次，且旧 session ready/chunk/stopped 全被拒绝。
- 明确选择并锁定：`每 capture 新 Port accept`；若实现改为复用 Port，必须在 start 边界显式
  重置 capture-local once/credit/readiness，并增加旧 session 对抗测试。

### R3-5 phase marker 与可观测主链

- 用生产类驱动 v10 fixture 的 24 步 positive trace，逐步证明五阶段 marker、顺序、credit、
  stop/finalize 和三项 cleanup，而不是只比较固定 JSON。
- terminal 后不得重新发布 marker；phase 更新不得刷新 expiry；新 worker 不续传旧 PCM、ticket、
  sequence 或 bearer token。

## 3. 必须新增或补强的测试

至少覆盖以下行为 oracle：

1. Runtime started 前 producer start/chunk 均为 `0`。
2. 正常链顺序严格为 start Runtime -> start producer -> quiesce -> drain -> stopped -> finalize。
3. 重复 start 不产生第二 owner；重复 stop/迟到事件幂等。
4. start 的每个失败点都关闭本轮 socket/Port/Offscreen，marker 最多清一次。
5. cancel/navigation/tab_closed 保留原 stop reason。
6. Runtime finalize 之前 backlog 和 in-flight 必须为零。
7. Runtime stop 后的新 chunk 被拒绝且不污染 sequence/counters。
8. 双轮 capture 隔离：新 session/new Port；旧 session 事件不能进入第二轮；每轮 abort 恰好一次。
9. 24 步主链由生产 Controller、Transport、Port owner 和 router/client composition 驱动。
10. 静态补充门禁证明 Offscreen 仍零网络、无 ticket/Runtime URL，Background 只有一个
    Controller/Transport/Port owner 装配点。

浏览器、网络原语可 mock；被验收的 Controller、router/client、Transport、Port owner 和状态机
不可用替身替代。测试不得播放声音。

## 4. 验收与回归预算

实现内循环只跑受影响测试。R3 工作包完成后集中运行一次：

1. extension typecheck；
2. R3 新增 composition 与现有 media companion 子树；
3. extension 全量单元回归，资源不足时限并发并如实记录；
4. extension build；
5. relay 静态合同；
6. Runtime focused capture/transcript/outline/fault/product；
7. v10 baseline `50/50` 与 mutation `15/15`。

固定出门条件：全部 exit `0`；公共合同 `none`；Fatal `0`、Major `0`；24 步生产
composition 全绿；双轮隔离全绿；secret scan 无 Cookie/key/token/ticket/streamId/PCM/私有路径；
本轮 owned 进程和临时资源为零。

## 5. 停止条件

出现以下任一项立即停止并写 handoff：需要改变公共合同、安全边界或固定分母；生产调用链
无法满足单一 Controller owner；需要可见 Chrome/原生弹窗/焦点；测试需要播放声音；发现
Fatal/Major；v10 verifier 退化且不能归类；需要进入 R4。

完成状态必须写：`R3 AWAITING CODEX CHECKPOINT`。不得自行宣布 R3 PASS，不得进入 R4，
不得进行独立文档外审或阶段 closeout。

## 6. 交给 ClaudeCode CLI 的提示词

```text
你在 /mnt/c/workspace/navia 执行 WP0 R3，仅限 R3，不进入 R4。

先读 AGENTS.md、docs/active/project/design/project-stage-workflow.md，随后读取：
1. docs/active/project/evidence/v3_media_companion/v3-completion/wp0/
   wp0-r2-final-correction-2026-10-17/60-codex-r2-final-checkpoint.md
2. 同目录 61-codex-r3-development-and-acceptance.md
3. docs/active/project/handoffs/v3-claudecode-completion-2026-10-15/
   04-development-and-acceptance-plan.md 的 P0 v10/R3 段
4. 当前 v10 schema、fixture、verifier，以及 R1/R2 最新实现与测试。

R2 已正式 PASS，不重复 R2 文档外审或全量验收。按 61 文件一次性完成 R3-1..R3-5：
Controller/router/client 单一编排、Runtime started 后 producer start、quiesce->drain->stopped
->finalize->cleanup、所有 idle/error 关闭 Offscreen、24 步生产 composition，以及双轮 capture
隔离。特别验证 #abortNotified 的每 capture 语义：优先保持每 capture 新 Port accept；第二轮
必须使用新 captureSessionId/new Port，旧 session 事件被拒绝且每轮 producer abort 恰好一次。

不得改公共 API/schema/fixture/FailureCode/阈值/权限/Origin/ticket TTL；不得运行 Chrome、
Provider、六视频或播放声音；不得 commit/push/reset/clean/checkout/revert，不得覆盖 dirty
worktree。实现内循环仅跑定向测试，结束时按 61 §4 只做一次集中回归。

落盘 R3 receipt、test-results、PRD review、handoff 和 payload manifest。报告 changed files、
合同变化、全部命令/退出码、真实 run 计数、PRD 覆盖、secret/cleanup、Fatal/Major/Minor、
证据路径和停止原因。最终状态写 R3 AWAITING CODEX CHECKPOINT，然后停止；不得进入 R4，
不得自行宣布 R3 PASS。
```

