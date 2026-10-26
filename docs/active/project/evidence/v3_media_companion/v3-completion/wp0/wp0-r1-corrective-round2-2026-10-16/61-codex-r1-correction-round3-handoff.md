# WP0 R1 第三轮纠偏交接

日期：2026-10-16  
目标执行者：ClaudeCode 主干开发会话  
当前门禁：`R1 NO-GO / AWAITING THIRD CORRECTION`  
权威审查：`60-codex-refreeze-gate-review-round3.md`

## 1. 唯一开发目标

修复生产 Background restart adapter，使 `RelayRestartReconciler` 真实调用 authenticated
Runtime，并按 `MediaAcquisitionTask` 的 state vocabulary 收口 marker。

不要重做已经通过的 Offscreen producer、Port/credit、owner barrier、marker 六字段与
`TRUSTED_CONTEXTS` 实现。

## 2. 允许修改范围

优先限制在：

```text
apps/chrome-extension/entrypoints/background/index.ts
apps/chrome-extension/src/modules/media_companion/capture/RelayRestartReconciler.ts
apps/chrome-extension/src/modules/media_companion/capture/RuntimeRelayRecoveryAdapter.ts（可新增，名称可调整）
apps/chrome-extension/src/modules/media_companion/capture/index.ts
apps/chrome-extension/src/modules/media_companion/tests/*Restart*test.ts
apps/chrome-extension/src/modules/media_companion/tests/*RecoveryAdapter*test.ts（可新增）
必要的 build 产物
本轮证据目录
```

仅当测试需要注入现有 Runtime client 时，允许对
`apps/chrome-extension/src/runtimeClient.ts` 做最小、向后兼容的导出或工厂调整。

## 3. 禁止事项

- 不改公共 Runtime endpoint、Origin、ticket TTL、Cookie/provider、BVID 分母；
- 不改 v10 schema、fixture、FailureCode registry、固定分母或验收阈值；
- 不给 marker 增加 token、sourceIdentity、ticket、grant、PCM、路径或凭据；
- 不持久化本机 Runtime Bearer token；
- 不恢复旧 PCM、ticket、sequence、credit；
- 不通过 `chrome.runtime.sendMessage` 给 Background 自己伪装 Runtime 调用；
- 不启动 R2、Chrome、Provider 或六视频；
- 不播放声音；
- 不 reset/clean/revert 用户或其他会话改动；
- 不 commit/push。

## 4. 实施要求

1. 抽出可注入的生产 recovery adapter。
2. adapter 使用现有 `bootstrapLocalRuntimeSession()`、`cancelMediaAcquisition()`、
   `getMediaAcquisition()`，或语义完全等价的真实 authenticated Runtime client。
3. service worker 重启后必须建立新的进程内 session；旧 token 不得持久化或恢复。
4. `connecting` 顺序固定为 bootstrap → DELETE acquisition → GET acquisition。
5. 其余四 phase 顺序固定为 bootstrap → GET acquisition。
6. 同一次 reconcile 不要无意义重复 bootstrap；并发 reconcile 若可能发生，需要单飞或幂等。
7. adapter 必须传播 401/403/offline/transport/API error；reconciler 保留 marker 并输出固定
   `V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED`（除非现有冻结合同指定更精确固定码）。
8. acquisition 终态严格为
   `succeeded/degraded/blocked/failed/cancelled`；其他状态不清 marker。
9. 删除或停止宣称不可调用的 `recover(sourceIdentity)`。严格六字段 marker 没有
   sourceIdentity，不得扩大 marker 规避该约束。
10. 生产代码不得用 `Boolean(response)` 判定业务成功。

## 5. 必须新增的测试

至少覆盖：

1. production adapter 真实调用注入的 bootstrap/DELETE/GET，而不是 extension message；
2. `connecting` 调用顺序与参数精确；
3. 四个 Runtime-owned phase 只观察 GET；
4. bootstrap 在一个 reconcile 内最多一次；
5. `succeeded/degraded/blocked/failed/cancelled` + grace 清 marker；
6. `created/acquiring/capturing/transcribing/cleaning` 保留 marker；
7. 401、403、offline、transport error、API error 保留 marker并报告固定码；
8. `{ok:false}` 或无 state 不得变成成功；
9. 新 worker 实例读取旧 store 的组合测试使用生产 adapter 类；
10. marker 仍严格六字段，禁止字段仍全部拒绝。

## 6. 必跑命令

在资源允许时顺序执行，记录原命令、退出码与计数：

```bash
cd /mnt/c/workspace/navia/apps/chrome-extension
npm run typecheck
npx vitest run src/modules/media_companion/tests/ --maxWorkers=2
npx vitest run --maxWorkers=2
npm run build

cd /mnt/c/workspace/navia
node --test scripts/stage_b_b5_3/test/relay_ownership_contract.node-test.mjs
cd services/local-runtime
.venv/bin/pytest tests/test_wp0_r1_relay_barrier.py -q
.venv/bin/pytest -k "capture or transcript or outline or fault or product" -q
```

v10 verifier 仍预计因未重冻结而失败。必须运行并如实记录，不得自行修改冻结材料：

```bash
python <v10-contract-verifier>
python <v10-mutations-verifier>
```

## 7. 证据要求

新建独立目录，例如：

```text
docs/active/project/evidence/v3_media_companion/v3-completion/wp0/
  wp0-r1-corrective-round3-2026-10-16/
```

至少落盘：

```text
10-round3-receipt.md
20-round3-test-results.md
30-round3-prd-review.md
40-round3-handoff.md
50-round3-payload-manifest.sha256
```

必须报告 changed files、内部/公共合同变化、全部命令和退出码、测试计数、Chrome/Provider/
六视频/声音次数、secret scan、Fatal/Major/Minor、停止原因。

## 8. 停止点

完成实施和自验证后状态写：

```text
R1 AWAITING CODEX REFREEZE
```

停止并把结果交 Codex。不得自行更新冻结 scope/hash，不得进入 R2，不得宣布 R1 PASS。

## 9. 可直接交给 ClaudeCode 的提示词

```text
你在 /mnt/c/workspace/navia 执行 WP0 R1 第三轮纠偏。先完整阅读：
1. AGENTS.md
2. docs/active/project/design/project-stage-workflow.md
3. docs/active/project/handoffs/v3-claudecode-implementation-2026-10-15/02-target-architecture-and-boundaries.md
4. docs/active/project/handoffs/v3-claudecode-implementation-2026-10-15/05-wp0-relay-acceptance.md
5. docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r1-corrective-round2-2026-10-16/60-codex-refreeze-gate-review-round3.md
6. docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r1-corrective-round2-2026-10-16/61-codex-r1-correction-round3-handoff.md

只执行该 handoff 规定的第三轮 R1 产品代码纠偏、测试和证据落盘。核心目标是：把 Background 的
relayRecoveryAdapter 从无效的 chrome.runtime.sendMessage 自发消息改成真实 authenticated Runtime
client，并修正 acquisition 终态闭集。不要修改冻结 schema/fixture/FailureCode/阈值，不要进入 R2，
不要运行 Chrome/Provider/六视频，不要播放声音，不要 commit/push/reset/clean。工作树很 dirty，保留
所有既有改动。完成后状态必须是 R1 AWAITING CODEX REFREEZE，并停止等待 Codex。
```

