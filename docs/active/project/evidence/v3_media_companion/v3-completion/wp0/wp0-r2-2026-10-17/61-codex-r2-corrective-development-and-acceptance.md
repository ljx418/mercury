# WP0 R2 限定纠偏开发与验收交接

日期：2026-10-17  
前置状态：`R2 NO-GO`  
授权边界：仅关闭 `M-R2-01`、`M-R2-02`，不得进入 R3

## 1. 纠偏目标

### C1：主动采集 deadline

由 Background capture owner 持有独立的总时长 deadline。deadline 到达时，即使没有新
chunk，也必须：

1. 仅一次产生 `V3_MEDIA_CAPTURE_DURATION_LIMIT`；
2. 通知 Offscreen producer abort；
3. 关闭 Runtime WebSocket；
4. settle 失败 terminal；
5. 清理 restart marker；
6. 清除 deadline、ACK、start、finalize timer，不留异步回调。

deadline 起点和 exact boundary 必须只有一个定义，并与 `startedAt`、marker 和测试一致。
不得依赖“超时后的下一块音频”触发。

### C2：累计字节真实边界

使用低资源、确定性测试证明：

- `current + next == maxCaptureBytes`：允许；
- `current + next > maxCaptureBytes`：`BYTE_LIMIT`；
- 拒绝发生在 enqueue、sequence 递增和 counter 累加之前；
- 失败后 producer/Runtime/terminal/marker 完成与 C1 相同的 fail-closed 收口。

不得通过分配或编码 512 MiB 原始数据制造测试。允许提取纯边界判定函数，或注入仅用于
内部测试的 limits seam；production 默认值必须仍唯一来自 `RELAY_V10`，且不得暴露给 UI、
消息或公共 API。

### C3：修正证据

替换当前只撞到 32-chunk backpressure 的伪 byte-cap 用例。receipt、test results、PRD
review 和 handoff 必须明确区分：

- outstanding queue byte/chunk cap；
- whole-capture cumulative byte cap；
- whole-capture wall-clock deadline。

## 2. 推荐最小实现

1. 在 `RuntimeCaptureTransport` 内增加单 owner deadline handle，并在 start/reset、abort、
   close、finalize、terminal settle 路径上做幂等 arm/clear。
2. 增加受控的 producer-abort hook，或复用已有 Background facade，使 timer 自主触发时能
   同时终止 Offscreen 与 Runtime；不得形成第二 control plane。
3. 将累计字节/时长边界判定提取为无副作用函数，Transport 在 enqueue 前调用；测试直接
   使用小对象验证 512 MiB 数值边界，不做大内存循环。
4. 保留 Port 路径失败归一化，保证 report、abort 和 terminal 均至多一次。

若实现者选择其他方案，必须仍满足“单一 Background owner、无第二 control plane、无
公共合同变化、低资源测试”四项约束。

## 3. 必须新增的测试

1. fake clock 无任何后续 chunk：到 deadline 前 active，到 deadline 时主动 aborted。
2. deadline 与用户 stop / Runtime disconnect 竞争：failure、terminal、marker clear 均一次。
3. cumulative byte exact boundary 与 one-sample-over，断言 counters/sequence/backlog 不污染。
4. 通过真实 `OffscreenAudioPort + RuntimeCaptureTransport` composition 证明 producer 收到
   abort，Runtime socket close，terminal 为对应固定 code。
5. timer 在成功 finalize、cancel、abort、start failure 后均清除；推进 fake clock不产生二次
   failure。
6. 保留 32/33 chunks 与 outstanding raw-byte backpressure 测试，禁止用它代替 cumulative
   capture-byte 测试。

## 4. 固定回归

至少执行并记录：

```text
npm run typecheck
npx vitest run src/modules/media_companion/tests/ --maxWorkers=2
npx vitest run --maxWorkers=2
npm run build
node --test scripts/stage_b_b5_3/test/relay_ownership_contract.node-test.mjs
pytest tests/test_wp0_r1_relay_barrier.py -q
pytest -k "capture or transcript or outline or fault or product" -q
python3 -B .../verify-stage-b-b5-3-background-capture-relay-v10-contract.py
python3 -B .../verify-stage-b-b5-3-background-capture-relay-v10-mutations.py
```

门槛：所有命令 exit 0，v10 baseline `50/50`，mutation `15/15`。

## 5. 运行约束

- 不启动真实 Chrome、Provider 或六视频；本纠偏不需要浏览器。
- 不播放声音；若意外发现必须用 Chrome，先停下通知用户并强制 `--mute-audio`。
- 不修改公共 API、Runtime endpoint、Origin、ticket、Cookie/provider、inventory、固定阈值。
- 不 commit/push/reset/clean，不覆盖 dirty worktree，不删除历史失败证据。
- 公开证据不得包含 Cookie、API key、token、原始媒体或绝对私有路径。

## 6. 交付与停止点

新建独立证据目录，不覆盖本轮证据：

```text
docs/active/project/evidence/v3_media_companion/v3-completion/wp0/
  wp0-r2-corrective-2026-10-17/
```

至少包含 correction receipt、test results、PRD review、handoff、payload manifest。完成后
状态写 `R2 CORRECTIVE AWAITING CODEX CHECKPOINT`，停止等待 Codex；不得进入 R3，不得
自行宣布 R2 PASS。

## 7. ClaudeCode 交接提示词

```text
在 /mnt/c/workspace/navia 执行 WP0 R2 限定纠偏，只关闭 M-R2-01 与 M-R2-02，
不得进入 R3。

先阅读 AGENTS.md、project-stage-workflow.md、05-wp0-relay-acceptance.md，以及：
docs/active/project/evidence/v3_media_companion/v3-completion/wp0/
wp0-r2-2026-10-17/60-codex-r2-checkpoint-review.md
docs/active/project/evidence/v3_media_companion/v3-completion/wp0/
wp0-r2-2026-10-17/61-codex-r2-corrective-development-and-acceptance.md

实现 Background owner 主动 maxCaptureMs deadline：无后续 chunk 也必须按时通知
producer abort、关闭 Runtime socket、settle 固定失败 terminal、清理 marker 和全部 timer。
替换当前 false-green byte-cap 测试：用低资源确定性方法证明累计 maxCaptureBytes 的
exact-boundary/one-sample-over，并证明拒绝发生在 enqueue/sequence/counter 变化前；再用
OffscreenAudioPort + RuntimeCaptureTransport composition 证明 producer/Runtime/terminal/
marker 完整收口。保留 32/33 queue backpressure 测试，但不得把它当累计字节证明。

不得修改固定阈值、公共 API、消息集合或 inventory；若必须改冻结材料立即停止。不得启动
Chrome/Provider/六视频，不得播放声音，不得 commit/push/reset/clean。完成固定回归和
v10 50/50 + 15/15 后，在新的 wp0-r2-corrective-2026-10-17 目录落盘证据，状态写
R2 CORRECTIVE AWAITING CODEX CHECKPOINT，然后停止，不得进入 R3。
```

