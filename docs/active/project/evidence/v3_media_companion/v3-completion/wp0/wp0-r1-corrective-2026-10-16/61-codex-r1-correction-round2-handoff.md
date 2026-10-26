# WP0 R1 第二轮纠偏交接（交给 ClaudeCode 实现终端）

## 目标与边界

继续 WP0/R1，关闭
`60-codex-refreeze-gate-review.md` 的 M-R1-C2-01..04 与 m-R1-C2-01。
**不得进入 R2，不得修改冻结 schema/fixture/FailureCode registry/验收阈值，不得跑六视频
或发送 Provider 请求。**

## 实施顺序

### R1-C2-1：修复真实 Port bootstrap

1. Offscreen 文档初始化后主动 `runtime.connect` 固定 Port；listener 必须先注册。
2. 消除“收到 start 才 connect / connect 后才能 start”的循环。
3. 只使用冻结 9 消息，不新增协议类型。
4. 固定并测试 session 绑定顺序，保证所有 Port message 使用同一 captureSessionId。
5. 为真实 entrypoint composition 抽出最小可注入 bootstrap，测试不得手工跳过连接阶段。

### R1-C2-2：删除旧控制面

1. `MediaCaptureControllerDependencies.relay` 改为必需。
2. 删除 Controller 的 start/stop `sendOffscreenMessage` fallback。
3. 删除/改写依赖旧 fallback 的测试；默认测试也必须注入 relay fake。
4. Offscreen `runtime.onMessage` 只保留 ping；Background 可保留 ping 预热，但与 capture
   start/stop 完全隔离。

### R1-C2-3：实现 worker restart reconciliation

1. 新建独立、可测试 reconciler，输入为 session store、当前时间、Runtime authenticated
   GET/DELETE/recover adapter 与 cleanup grace timer。
2. Background 初始化时设置 `chrome.storage.session.setAccessLevel({
   accessLevel: "TRUSTED_CONTEXTS" })`，随后读取并验证 marker。
3. 严格按 v10 `restartBehavior` 和 `restartTermination.newWorkerRole` 分派，不恢复旧
   PCM/ticket/sequence。
4. 非法/过期 marker fail closed；terminal + cleanup grace 后仅清匹配 session marker。
5. 覆盖五阶段、Runtime 暂不可用、重复 worker 启动、他 session marker、cleanup 幂等。

### R1-C2-4：闭合 producer error 边界

1. START handler 捕获 getUserMedia / AudioContext / shape / already-active 等失败。
2. 完成 tracks/context/node 清理。
3. 发恰好一个带匹配 captureSessionId 的 `capture_error`。
4. Background 归一化为固定 20-code；异常文本不得进入公开响应、日志或证据。

### R1-C2-5：测试与证据

新增或扩展：

- entrypoint composition harness：真实 bootstrap 次序；
- restart reconciler harness：新实例读取旧 store；
- Controller “relay required / no legacy fallback” 静态与行为测试；
- producer START error → capture_error → Background normalization；
- 原有双端、credit、stop、sender、barrier 回归。

必须重跑：

```bash
cd /mnt/c/workspace/navia/apps/chrome-extension
npm run typecheck
npx vitest run src/modules/media_companion/tests/ --maxWorkers=2
npx vitest run --maxWorkers=2
npm run build

cd /mnt/c/workspace/navia
node --test scripts/stage_b_b5_3/test/relay_ownership_contract.node-test.mjs

cd /mnt/c/workspace/navia/services/local-runtime
PYTHONPATH=. ./.venv/bin/python -m pytest tests/test_wp0_r1_relay_barrier.py -q
PYTHONPATH=. ./.venv/bin/python -m pytest tests/ -k "capture or transcript or outline or fault or product" -q

cd /mnt/c/workspace/navia
python3 docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v10-contract.py
python3 docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v10-mutations.py
```

最后两项在 Codex 重冻结前仍可因 hash/scope 返回非零；必须逐项证明剩余失败只来自冻结
证据漂移，不得自行修改冻结文件。

## 禁止事项

- 不 reset/clean/checkout/revert 现有 dirty worktree；
- 不恢复 Offscreen WebSocket 或直连 Runtime fallback；
- 不新增第二 capture control plane；
- 不修改公共 API、Runtime endpoint、Origin、ticket TTL、Cookie/provider、BVID 分母、
  grounded comprehension、SourceAuthority 或 Side Panel materialize ownership；
- 不启动 R2、R5、六视频、Provider、真实 Chrome；如确需 Chrome 必须先通知用户且
  `--mute-audio`；
- 不播放声音；
- 不宣称 R1 PASS。

## 交付格式

在新证据目录（不得覆盖当前目录）落盘 phase receipt、测试结果、PRD/架构复核、handoff、
payload manifest，并报告：

- 精确状态 `R1 AWAITING CODEX REFREEZE`；
- changed files；
- 内部/公共合同变化；
- 全部命令与退出码；
- entrypoint composition 与 restart reconciliation 的用例计数；
- Chrome/Provider/六视频/声音均为 0；
- secret/raw-media/private-path scan；
- Fatal/Major/Minor；
- 自动化停止原因。

完成后停在 R1，等待 Codex 复核和重冻结。
