# WP0 R4 Runtime / Worker Recovery 开发与验收计划

日期：2026-10-17  
前置：`60-codex-r3-checkpoint.md` 已判定 `R3 PASS`  
当前授权：**仅 R4；不得进入 R5，不启动 Chrome，不播放声音**

## 1. 目标

R4 使用真实独立 Uvicorn 进程和真实 WebSocket/HTTP 客户端，关闭 Runtime capture handoff、
worker 恢复、持久 authority、故障注入和安全边界。TestClient、Mock WebSocket、固定 JSON
或历史 run 不能替代真实进程边界。

保持公共 endpoint、Origin、ticket TTL、v10 schema/fixture、FailureCode、40/20 inventory、
SourceAuthority 和产品 terminal 定义不变。唯一 durable 产品成功仍是现有 SQLite
`ready|degraded`；capture `completed` frame 只表示 handoff，不表示产品成功。

## 2. 工作包

### R4-1 真实 Uvicorn capture integration

- 在本轮临时根、随机空闲端口启动 owned Uvicorn；使用真实 WebSocket 连接
  `/v1/media/capture-stream`，走 bootstrap/session、ticket、start、非空 PCM、ACK、stop/finalize。
- 证明 ticket 一次性、Origin/CSP 边界、绑定、sequence/length/backpressure、WS loss 和 Runtime
  rejection 返回固定错误码；TestClient 只能作单测补充。
- 所有进程、socket、数据库、staging 与 acquisition sandbox 都属于本轮并在结束时清理。

### R4-2 六个 handoff / product 注入点

逐点注入：

1. `after_sink_finalize`
2. `transcript_create`
3. `before_stage`
4. `after_stage_before_worker`
5. `handoff_completed_frame_send`
6. `commit_then_runtime_restart_before_background_observe`

前 1-3 点由 Runtime capture handler 独占 cleanup；第 4 点在 owner manifest parent-directory
fsync 与 SQLite FULL receipt commit 后、worker start 前执行真实 hard kill；第 5 点只保留
handoff，不产生产品成功；第 6 点只有 SQLite `ready|degraded` 才恢复为 published，否则
abandoned + cleanup + fresh analysis。

### R4-3 owner manifest / receipt / hard-crash recovery

- manifest 发布顺序必须为 temp `O_EXCL` -> file fsync -> atomic replace -> parent-directory fsync
  -> SQLite `BEGIN IMMEDIATE` + `synchronous=FULL` receipt commit -> worker start。
- hard kill 后不假定 finally；新进程只能凭 validated authoritativeTaskId 定位
  `private_asr_staging_root/<taskId>/owner.json`，不得依赖旧进程内存。
- missing、torn、corrupt、uncommitted、identity/hash/length/WAV shape/state/path、symlink/path
  escape 八类损坏全部 fail-closed 为 cleanup incomplete。
- existing recover composite cleanup 后 acquisition、ASR staging、unpublished product、active sink
  四项残留为零，才允许 fresh begin；fresh begin 仍为单 sink。

### R4-4 restart phase owner

- `connecting` 且 valid start 未成立：新 session -> authenticated DELETE -> GET。
- runtime-alive 其他 phase：由唯一 artifact owner/finally 收口，再 GET，不重复清理。
- hard crash/SIGTERM：走 existing recover，不伪造 finally。
- GET 404：停止轮询并进入 recovery pending；不得无限轮询或宣称成功。
- marker expiry：只清 marker，不凭 expiry 宣称 acquisition/product 已清理。
- 新 worker 不写旧 task，不恢复旧 PCM、ticket、sequence、bearer token。

### R4-5 安全与回归

- 覆盖 CSP/Origin、ticket replay/binding、secret scan、私有路径、cleanup ownership、SIGTERM、
  hard kill 和重复 recover 幂等。
- taskId/sourceIdentity 跨层一致；consent/transcript/product revision 域各自单调，只有
  outline/workspace 共享 product revision/fence。

## 3. 强制行为 oracle

1. 真实 Uvicorn 进程收到非空 PCM，ACK 与 sequence/length 精确对应。
2. Runtime started 前 0 chunk；Runtime stop 后 0 新 chunk。
3. 六注入点逐项产生冻结 disposition、failure/terminal 和唯一 cleanup owner。
4. hard kill 发生在 durable receipt 后、worker 前；不执行 finally 仍可恢复。
5. 八类 manifest/receipt 损坏全部拒绝且不删除非 owned 路径。
6. composite cleanup 四项残留均为 `0`，fresh begin 后 active sink 恰为 `1`。
7. completed frame 发送失败不能被解释成 durable success。
8. SQLite `ready|degraded` 存在才 published；否则 abandoned。
9. GET 404 停轮询，marker expiry 只清 marker。
10. secret/raw PCM/ticket/私有路径不进入公开 evidence。

## 4. 验证预算

实现内循环只跑受影响 Python/Node 测试。工作包结束集中运行一次：

1. Runtime capture/recovery 定向 pytest；
2. 真实 Uvicorn WebSocket integration 与六注入点 runner；
3. 八类 manifest negative matrix；
4. extension typecheck、media 子树、全量单测和 build；
5. Runtime focused `capture or transcript or outline or fault or product`；
6. relay 静态合同；
7. v10 baseline `50/50` 与 mutation `15/15`；
8. secret、cleanup、owned-process scan。

浏览器次数必须为 `0`，声音为 `0`。真实 Uvicorn/HTTP/WS 不算 Chrome；只能终止本轮拥有
PID/port/scratch 的进程和资源。

## 5. 出门与停止条件

全部命令 exit `0`；真实 Uvicorn 和六注入点分母完整；八类损坏全拒绝；四残留全零；
Fatal `0`、Major `0`；公共合同 `none`；证据可复算。

若需要改公共 API/schema/FailureCode/阈值、安全边界或固定分母，或者需要 Chrome、外部
Provider、真实视频、非 owned kill，立即停止。完成状态写 `R4 AWAITING CODEX CHECKPOINT`，
不得自行宣布 R4 PASS，不得进入 R5，不做独立文档外审或阶段 closeout。

## 6. 后续阶段连续性

R4-R7 的长期顺序已冻结，可以在同一个 ClaudeCode goal 中持续保留上下文，但每阶段必须停：

```text
R4 Runtime/recovery -> Codex checkpoint
R5 visible muted Chrome canary -> Codex checkpoint + 可见窗口前通知用户
R6 真实故障矩阵 -> Codex checkpoint
R7 immutable candidate/secret/cleanup/seal -> P0 closeout
```

本文件只放行 R4。R5-R7 的目标写入持续 goal 只用于恢复上下文，不等于提前授权。

