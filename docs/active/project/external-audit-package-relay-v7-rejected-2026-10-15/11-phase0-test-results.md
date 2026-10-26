# Stage B B-5-3 Phase 0 测试结果（2026-10-15，Codex 第二轮复算修订）

日期：2026-10-15。本文件记录 Phase 0 全部 5 份 node:test 真实结果 +
显式清单与不可接受项。Codex 第二轮复算后，本轮淘汰了 4 个虚假覆盖（Runtime
crash / worker missing / permission denied / cleanup failure），保留 7 项真实
覆盖 + 1 项 canary（hard FAIL，X11 fake-click 受宿主限制不可达）。

## 1. 测试命令与原始输出

### 1.1 单元/契约测试（既有 PH0-AR-2）

```bash
$ node --test scripts/stage_b_b5_3/test/contracts.node-test.mjs
1..48
# tests 48 / # pass 48 / # fail 0
```

### 1.2 Sequencer 集成测试（既有 PH0-AR-2）

```bash
$ node --test scripts/stage_b_b5_3/test/sequencer.node-test.mjs
1..11
# tests 11 / # pass 11 / # fail 0
```

### 1.3 Real-branch 测试（本轮修订，淘汰虚假覆盖后）

```bash
$ node --test --test-timeout=120000 scripts/stage_b_b5_3/test/real_branches.node-test.mjs
1..7
# tests 7 / # pass 7 / # fail 0
```

剩余覆盖：
- PH0-AR-6: node --check runner + sequencer (2 tests)
- PH0-AR-6: runner 不引用 `projections.taskId` / `projections.revision`
- PH0-AR-9: real sequencer silent → exit non-zero + missing FD
- PH0-AR-9: real sequencer 6/6 complete → exit 0 + 6 BVIDs complete + 0 leaked
- PH0-AR-10: real SIGTERM 传播 + child kill + processAudit 0 leaked
- PH0-AR-10: real Chrome unavailable → FD + cleanup + failure-diagnostic + exit non-zero

### 1.4 真实 Runtime API 集成（PH0-AR-7 / PH0-AR-11 / M-3）

```bash
$ node --test scripts/stage_b_b5_3/test/integration_runtime_api.node-test.mjs
1..5
# tests 5 / # pass 5 / # fail 0
```

### 1.5 静音 Chrome canary（PH0-AR-12 / M-4）

```bash
$ node --test --test-timeout=60000 scripts/stage_b_b5_3/test/canary_bvid1.node-test.mjs
1..1
# tests 1 / # pass 0 / # fail 1 (already) / # skipped 0
not ok 1 - PH0-AR-12: ... canary NO-GO (Xvfb ctypes unavailable)
```

canary **不**使用 `t.skip`；Xvfb / ctypes / X11 fake-click 任何一步失败立刻
`assert.fail()` 并落盘 `canary-failure.json`。本宿主环境 X11/Xvfb 通过
ctypes 不可达，canary 落盘 NO-GO 诊断后 FAIL。**禁止任何"伪装绿色"**。

### 1.6 综合

合计 **72 项测试**（48 contracts + 11 sequencer + 7 real-branch + 5
integration + 1 canary）：
- **Pass**：48 + 11 + 7 + 5 = **71 / 72**；
- **Fail**：1 canary（NO-GO，Xvfb 不可达）。
- **Skip**：**0**（canary 已剔除 skip 路径）。

## 2. 覆盖分支清单

| 缺陷 | 测试 | 状态 |
|---|---|---|
| M-1 状态机矛盾 | runner 三阶段 + integration PH0-AR-7/11 验证 outline-task 真创建 media_tasks | ✓ |
| M-2 未定义变量 | `real_branches` PH0-AR-6 引用校验 + node --check | ✓ |
| M-3 outline-task 创建 | `integration_runtime_api` PH0-AR-7/11 真实 Runtime 验证 | ✓ |
| M-4 启用动作 + 权限 | canary 真实路径 + chrome.permissions.contains；当前宿主 X11 不可达 → NO-GO 落盘 | △（canary NO-GO，宿主限制） |
| M-5 非零失败退出 | `real_branches` 真实 sequencer 多项；auditProcessGroup 用 run_one_bvid 字符串排除 sequencer 自身 | ✓ |
| M-6 真实故障 branch | SIGTERM（real）、Chrome unavailable（real）；其余 4 项 NO-GO 落盘 | △（仅 SIGTERM + Chrome unavail；其余 NO-GO） |

## 3. 显式已知 / NO-GO 项（落盘 P0 残余风险）

| 分支 | 状态 | 原因 | Phase 1 启动前置 |
|---|---|---|---|
| Runtime crash（real） | NO-GO | 当前 runner 用 `spawn` 同步等待 child，未注入 Runtime PID 跟踪 | runner 需加 Runtime PID 跟踪 + signal handler |
| Service worker missing | NO-GO | 需要真实生产 Chrome build + 部分安装扩展 | Phase 1 用 production build |
| Chrome permission denied | NO-GO | 需要 X11 ctypes + native prompt 交互；当前宿主 X11 不可达 | 在具有 X11 访问的会话中跑 canary |
| Cleanup failure | NO-GO | runner cleanup 仅记录 `runtimeScratchDeleted` / `profileRootDeleted`，未注入失败路径 | runner 需加 `cleanupErrors` 字段 + 注入 env-controlled `*_FAILURE_ON_RM` |
| Canari `stage_a_terminal_reached` | NO-GO | 宿主 X11/Xvfb 通过 ctypes 不可达 | 同上 |
| Sequencer-level SIGKILL（强杀） | NO-GO | SIGKILL 不能被 handler 捕获；Linux 把 child 留给 init | Phase 1 仅在有 init cleanup 时验证 |

**禁止**把上述 NO-GO 标记为 Minor；Phase 0 出门是 NO-GO，必须明确 Phase 1
启动前置。

## 4. 测试纯度

- 不启动 Chrome：除 `canary_bvid1.node-test.mjs` 外，所有测试不调用
  `chromium.launch*`；
- 不启动 Runtime：除 `integration_runtime_api.node-test.mjs` 外，所有测试
  不调用 `uvicorn` 或 `navia_runtime.app`；
- 不触发外部网络：除 `canary_bvid1.node-test.mjs`（仅 `bilibili.com` 单
  BVID 单次 GET）与 `integration_runtime_api.node-test.mjs`（仅
  127.0.0.1）外，无 `fetch` / `http.get` / `pgrep -af chrome` / `ps aux`
  跨网络调用；
- 不播放声音：canary Chrome 全部带 `--mute-audio`，无 PulseAudio /
  PipeWire 调用。

## 5. 测试沙箱清理

测试用 `os.tmpdir()` 沙箱；integration / canary 测试结束 `fs.rmSync`
清理；real-branch `test.after` 强制 `killLeaked()`。

最终进程清理状态：
```text
$ pgrep -af "run_one_bvid|sequencer_rb|running_sleep|navia-b5-3"
（empty = clean）
```
**0 leaked processes**。

## 6. 测试运行原始输出（部分）

```text
contracts.node-test.mjs     1..48  pass 48  fail 0
sequencer.node-test.mjs     1..11  pass 11  fail 0
real_branches.node-test.mjs 1..7   pass 7   fail 0
integration_runtime_api     1..5   pass 5   fail 0
canary_bvid1               1..1   pass 0   fail 1 (NO-GO Xvfb ctypes unavailable)
```

## 7. 复算命令

```bash
cd /mnt/c/workSpace/navia

# (a) node --check
node --check scripts/stage_b_b5_3/run_one_bvid.mjs && echo RUNNER_OK
node --check scripts/stage_b_b5_3/sequencer.mjs && echo SEQUENCER_OK

# (b) Tests (74 / 74 except canary)
node --test scripts/stage_b_b5_3/test/contracts.node-test.mjs
node --test scripts/stage_b_b5_3/test/sequencer.node-test.mjs
node --test --test-timeout=120000 scripts/stage_b_b5_3/test/real_branches.node-test.mjs
node --test scripts/stage_b_b5_3/test/integration_runtime_api.node-test.mjs
node --test --test-timeout=60000 scripts/stage_b_b5_3/test/canary_bvid1.node-test.mjs

# (c) Final process audit
pgrep -af "run_one_bvid|sequencer_rb|running_sleep|navia-b5-3"
# 期望：empty
```

## 8. 已知覆盖不足（落盘为 Phase 0 残余风险 + Phase 1 NO-GO）

- canary 仅在具有 X11 / Xvfb / ctypes 访问的会话中才能通过；当前宿主
  不可达 → NO-GO；
- 4 项 fake 覆盖（Runtime crash / worker missing / permission denied /
  cleanup failure）已删除；Phase 1 必须真实补齐后再做 PGO 全量审计；
- sequencer-level SIGKILL 强杀路径暂未覆盖（Sonar / SIGKILL）；Phase 1 在
  spawn-based sequencer 中加 worker SIGKILL 测试。

## 9. 2026-10-15 最新测试事实（覆盖旧摘要）

旧文中的 74/74、Xvfb 不可达和 canary 仅停在 UI 启用阶段，均已被后续运行替代；不得继续引用为当前状态。

当前可声明：

- Cookie focused contract tests：42/42 候选通过。
- P0 本地 Node suite：在 Route A 修改前最近一次完整候选为 110/110；Route A 与后续 canary 解析修改后必须重新全量运行，旧数字不能代替新候选。
- Python authority/outline focused tests：2 passed，13 deselected。
- 真实 Runtime Node API integration：6/6 passed。
- 最新 muted Chrome canary：`/tmp/navia-b5-3-canary-1792053808072`，exit 1，`outline-task-failed`；实际 outline HTTP 201 且 task 使用 camelCase `taskId`，说明失败是 canary parser 缺陷，不是 Runtime outline 失败。
- 最新 run cleanup：Chrome closed、Runtime exited、fixture/scratch removed、cleanup failures 0、Cookie value leak hits 0。

当前不能声明：canary PASS、P0 PASS、真实故障矩阵关闭、六视频开始或独立出门。下一次全量数字只能在 task ID parser、materialize 时序和真实边界补强完成后重新生成。

## 10. 2026-10-15 17:10 最新测试切片

- `extractMediaTaskId` + Cookie/trace focused：`27/27`。
- P0 离线 Node 集：`116/116`。
- 真实 Runtime API：`6/6`。
- Python outline/authority focused：`15 passed`（首次遗漏 `PYTHONPATH` 的 collection failure 已纠正，不计为产品失败）。
- canary `/tmp/navia-b5-3-canary-1792054898429`：trace 数组未初始化导致脚本异常，diagnostic-only；缺陷已补静态合同。
- canary `/tmp/navia-b5-3-canary-1792055036947`：真实运行约 195 秒，`stage-a-not-terminal`、exit 1；task 保持 `created`；cleanup failure 0、Cookie leak 0；所有 Chrome 命令含 `--mute-audio`。
- 运行后 `canary_bvid1`、owned Runtime `17861` 与临时 Chrome/profile 进程为 0。

当前 NO-GO 原因：trusted capture 尚未由 runner 驱动，产品 Side Panel materialize 尚未在真实 canary 中发生；真实故障矩阵与 immutable candidate 外审也未完成。

## 11. 2026-10-15 17:36 当前候选

- Portal permission focused Vitest：`4/4`。
- canary purity + Cookie contract：`27/27`。
- P0 离线 Node 全集：`125/125`。
- Runtime API integration：`6/6`。
- Python `test_v3_media_outline_task_store.py`：`15/15`。
- Extension `pnpm typecheck` 与 `pnpm build:e2e`：exit 0。
- 最新 real muted canary：`/tmp/navia-b5-3-canary-1792056987913`，exit 1，`capture-command-not-observed`。该 run 已证明日常授权恢复、resolve 201、authority、awaiting capture 与真实 arm；未证明 capture started、ASR、materialize 或 terminal。
- cleanup：Chrome closed、Runtime exited、fixture/scratch removed、failure 0；Cookie value leak 0；端口 `17861` 和 owned process 均归零。

结论：`P0 IMPLEMENTATION IN PROGRESS / NO-GO`。条件未改变前禁止再次真实运行；下一候选必须改变扩展 action/command 的用户调用机制，并继续保持静音。

## 12. 2026-10-15 18:15 双入口测试结果（最新）

```text
node --check canary_bvid1.node-test.mjs                  exit 0
canary_purity_contract.node-test.mjs                     8/8 PASS
P0 Node offline + Runtime API combined suite             131/131 PASS
real muted canary /tmp/navia-b5-3-canary-1792058113774  0/1, exit 1
```

真实 canary FailureCode 为 `capture-command-not-observed`。注册命令与尝试结果：

```text
open-navia-sidepanel  registered Ctrl+Shift+Y  count 0 -> 0  capturing=false
_execute_action       registered shortcut empty count 0 -> 0  capturing=false
```

测试全程使用 `--mute-audio`，未播放声音。run fail-closed；`leakHitCount=0`、`cleanupFailures=[]`，Chrome/Runtime/fixture/scratch 已清理，产品端口无监听。该结果证明 Headless Playwright 输入不能代替 Chrome extension action 的真实用户调用，不证明 capture、ASR、materialize 或 terminal。条件不再允许 Headless 重跑；下一验收必须使用提前告知用户的静音 visible Windows UIAutomation 单次门槛。

## 2026-10-15 19:04 增量结果

- visible muted Chrome 已触发真实 extension action 并达到 Offscreen start；旧 capture-command-not-observed 已被后续证据替代。
- 最新 run：/tmp/navia-b5-3-canary-1792062210940，非零失败 V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED；Background Service Worker WS probe=opened，Runtime capture diagnostics=[]。
- 独立 Windows ClientWebSocket 可连接同一 Uvicorn endpoint；因此 Runtime/Windows/Background 可达，但 Offscreen 请求未抵达 Runtime。
- P0 Node 138/138、Runtime capture pytest 13/13、typecheck/build PASS。首个 pytest 命令因缺 PYTHONPATH=. collection 失败，修正环境后 13/13；不得隐藏该环境修正，也不得把离线测试扩大为真实 capture PASS。
- 所有 Chrome 继续 --mute-audio；cleanup failure=0，secret leak hit=0。尚无真实 PCM/SenseVoice/materialize terminal，P0 NO-GO。
