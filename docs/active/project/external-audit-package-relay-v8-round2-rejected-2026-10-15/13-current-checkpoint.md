# Stage B B-5-3 Phase 0 Checkpoint（2026-10-15）

日期：2026-10-15。状态：P0 仍 NO-GO；最新 canary 已推进到 `capture-command-not-observed`；本轮增量任务：把 canary 从「runner 自己 POST outline + 等 terminal」改为「日常已授权自动恢复 + trusted capture + 等 Side Panel effect 触发 materialize」。

## 1. 当前事实基线

- Git 基线：`main` / `a303551a5bf89c26ff36b24ac06c7e30c334db27`；工作树 dirty（既有用户修改 + chrome-mv3-unpacked 删除 chunk）
- 既有候选：focused 27/27、P0 离线 116/116、Runtime API 6/6、Python focused 15 passed
- 最新 muted canary：`/tmp/navia-b5-3-canary-1792055036947`；`stage-a-not-terminal`；task 停在 `created`；authority `active`；sidepanel 最后状态停在「需要一次音频确认」；cleanup failures=0；cookie leak hits=0
- 上一轮已知真实失败：手动 outline / materialize 编排是 fake-green 路径；Side Panel effect 才是真实唯一成功路径

## 2. 本轮增量任务（来自 `06-main-development-prompt.md` 与 Codex 第三轮）

1. P0 checkpoint（本文件）
2. 最小修改 canary：移除成功路径中的手工 outline / materialize 编排；只观察真实 acquisition projection / Side Panel UI 状态
3. 当真实 UI 进入 `awaiting_trusted_capture` 时，在 Side Panel iframe 内对 `data-testid=media-capture-start` 执行真实可信点击；进入 `capturing` 后在合同允许的最小采集条件下点击 `data-testid=media-capture-finish`。**不** API 伪造 grant / user activation / transcript
4. 等 `acquisition succeeded`，观察 Side Panel 自己发出 `materialize-visual`；如 visual 失败，只允许同一产品 effect 发出基础 `materialize` fallback。**不** 由 canary 直接调用
5. 断言 `authority` / `acquisition` / `outline` 使用同一 taskId / revision；最终 `media_tasks.state ∈ {ready, degraded}`；UI 停止 busy
6. 增加不启动 Chrome 的合同测试：证明 runner 无 outline / materialize POST，trace 集合完整，失败非零
7. 运行 node --check + 全部离线 Node 测试 + Python focused + 真实 Runtime API integration
8. 仅当以上条件变化且离线全绿后才运行 1 次真实 Chrome canary；Cookie 来自用户已授权的私有来源；证据不含 Cookie / 路径
9. 核对 owned Runtime / Chrome / profile / scratch / private media 清零；secret / raw-media / path hit=0
10. 更新 test-results / prd-review / handoff / checkpoint
11. **不** reset / checkout / clean / commit / push；**不** 覆盖既有 dirty 改动；**不** 改公共 API / schema
12. 只报告：changed files、命令退出码、真实 run、cleanup / secret、Fatal / Major / Minor、证据路径、停止原因

## 3. 文件所有权

### 3.1 本轮新增（预期）

```
scripts/stage_b_b5_3/test/canary_purity_contract.node-test.mjs   (合同：runner 不可越权)
scripts/stage_b_b5_3/lib/sidepanel_capture.mjs              (UI selector helper)
```

### 3.2 本轮修改（预期）

```
scripts/stage_b_b5_3/test/canary_bvid1.node-test.mjs          (移除手工 outline / materialize；改 trusted-capture 编排)
docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-phase0-test-results-2026-10-15.md
docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-phase0-prd-review-2026-10-15.md
docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-phase0-handoff-2026-10-15.md
docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-phase0-checkpoint-2026-10-15.md   (本文件)
```

### 3.3 未修改（不变）

- `services/local-runtime/`、`apps/chrome-extension/src/`、`docs/active/project/contracts/`、`schemas/`、`fixtures/`、`stage-b-six-video-registry.json` v1
- 6 BVID 固定分母、`derivedTextScope`、secret scan 白名单、隐私边界

## 4. 上一轮 immutables（继续记录）

- `quality.py`, `service.py`, `synthesis.py` SHA 与 B-5-2 验收一致
- V2 / V2.1 schema / fixtures / verifier / addendum SHA 与 B-5-2 验收一致

## 5. 6 项 Major / Codex 第三轮结论（保留）

- M-1 状态机矛盾 — runner 三阶段信号
- M-2 未定义变量 — `convergence.taskId` / `convergence.revision`
- M-3 outline-task 缺失 — integration 验证
- M-4 启用动作 + 权限 — canary（NO_GO / 需 cookie source）
- M-5 非零失败退出 — runner catch `process.exitCode = 1`
- M-6 真实故障 branch — SIGTERM + Chrome unavail 已落地；Runtime crash / worker / cleanup failure NO-GO（Phase 1）

## 6. 真实编排者来源（深读结论）

产品编排由 Side Panel `entrypoints/sidepanel/main.tsx`、Background `entrypoints/background/index.ts` 与 Runtime acquisition/materializer 共同完成；`MediaCredentialWorkspacePage.tsx` 是另一产品表面，不是本 canary 的唯一编排者：

1. `enable` 按钮点击触发 `establish()` → `MediaAcquisitionClient.start()` → `/v1/media/acquisitions/resolve` 写 `media_source_authority`
2. `MediaAcquisitionClient.start()` 进一步调 `execute` (`acquisitions/{id}/execute`) → media_tasks 状态机由 Runtime 驱动
3. 当三条字幕路线均失败（`captureEligibility.captureFallbackEligible === true`）时，渲染 `<TrustedTabCaptureCard>` 含 `data-testid="media-capture-start"`
4. 用户点击 `media-capture-start` 只完成 arm；Background 必须在 `chrome.action.onClicked` 或注册 command 的真实用户调用上下文内执行 `startArmed(tab)`，成功后 UI 才进入 capturing
5. 用户点击 `media-capture-finish` → `captureMessages.stop("completed")` → `monitorTranscript(response.transcript.taskId)`
6. transcript/acquisition 完成 → Side Panel `materializeCurrentMediaTask` 先发 `materialize-visual`，失败时由同一 effect 发基础 `materialize` → `media_tasks.state` ∈ {ready, degraded}

**canary 必须仅观察上述 effect，绝不伪造 grant / userActivation / transcript，绝不直接 POST materialize**。

## 7. 任务分工（本轮）

1. 写 P0 checkpoint（本文件）
2. 改 canary：删除手工 outline / materialize 编排；改 trusted capture + UI 观察
3. 加 purity 合同测试：runner 不调用 POST outline-tasks / materialize 端点
4. node --check + 全部离线测试 + Python focused + 真实 Runtime API integration
5. 真实 Chrome canary 一次（条件：代码/条件变化且离线全绿；Cookie 来自指定文件；evidence 不含值/路径）
6. 更新 test-results / prd-review / handoff / checkpoint

## 8. 失败 / 关闭模式（写入 P0 NO-GO 路径）

- canary 未达 `ready|degraded`：`stage-a-not-terminal`，exit ≠ 0，给出 root cause + nextSafeAction
- product code / schema / fixture change needed：**停止代码 + 回文档冻结**
- six-video fresh run：**禁止**
- 任何 fresh dirty worktree 覆盖：**禁止**

## 9. immutable candidate ID（占位）

未生成；canary PASS 后再生成。

## 10. 下一动作（nextSafeAction）

→ 读 `canary_bvid1.node-test.mjs` 当前 outline / materialize 路径 → 替换为 trusted-capture 编排 → 加 purity 合同测试 → 离线全量 → 一次真实 Chrome canary。

## 11. 2026-10-15 17:36 最新恢复事实（覆盖本文件前述旧 next action）

### 11.1 自动验收

- PortalPermissionClient 幂等补强：先 `contains`；两类权限均已有时不重复调用 `request`。focused Vitest `4/4`。
- canary 移除成功路径手工 outline/materialize；purity/credential focused `27/27`。
- P0 离线 Node 全集 `125/125`；Runtime API integration `6/6`；Python outline/authority `15/15`；扩展 typecheck 与 E2E build 均 exit 0。
- 所有真实 Chrome 使用 Headless + `--mute-audio`，无声音播放。

### 11.2 两次新鲜 canary

1. `/tmp/navia-b5-3-canary-1792056845544`：`enable-not-committed`，exit 1。Chrome host permission 已有，但测试只预授予 Chrome permission、没有预置 Navia consent policy，错误混合了“首次授权”和“日常已授权”两条门槛。cleanup 0 failure，secret hit 0。
2. 修订 fixture 后，`/tmp/navia-b5-3-canary-1792056987913`：日常两层授权恢复成功；enable 不出现；resolve 201；authority task `media_task_998bc001bced441abce6946abc96b88a`；UI 到“需要一次音频确认”；capture card 可见；`media-capture-start` 真实点击成功。随后 Headless Playwright `Ctrl+Shift+Y` 未触发 Chrome extension command，Background action count `0 -> 0`，以 `capture-command-not-observed` 非零退出。cleanup 0 failure，Cookie leak 0，端口/PID/profile/scratch 清零。

### 11.3 冻结结论

- P0 自动日常路径已证明到 trusted capture arm，不等于 capture、ASR、materialize 或 terminal 通过。
- 普通 DOM 点击、controller 直调、Runtime API 私造 grant/stream/transcript 均不接受。
- 下一实现先在同一次 canary 内按固定顺序尝试注册 command 与 `_execute_action`，每次核对 Background action count；两者都不产生真实调用时，不得继续 Headless 重跑。
- 若 Chrome Headless 本身不转发扩展快捷键，转为既有 Windows UIAutomation/真实 Chrome extension action 门槛。该方式会弹出窗口或抢占焦点，执行前必须通知用户；仍必须 `--mute-audio`。
- canary 成功后仍需 crash/worker/permission/cleanup/SIGTERM 真实故障矩阵和 P0 immutable candidate 独立审查。P1 六视频仍 NO-GO。

## 12. 2026-10-15 18:15 Headless 双入口结论（最新，覆盖旧 nextSafeAction）

- 代码条件已改变：canary 读取 `chrome.commands.getAll()`，依次尝试 `open-navia-sidepanel` (`Ctrl+Shift+Y`) 与 `_execute_action` (`Alt+Shift+N`)，并同时观察 Background action count 与 `media-capture-finish` durable UI。
- 静态纯度合同更新后 focused `8/8`；P0 Node 离线/Runtime API 合并套件 `131/131`，全部 PASS。
- fresh muted canary：`/tmp/navia-b5-3-canary-1792058113774`，exit 1，`capture-command-not-observed`。Chrome 报告 `open-navia-sidepanel` 注册快捷键为 `Ctrl+Shift+Y`，`_execute_action` 快捷键为空；两次 Playwright 输入均为 action count `0 -> 0`，durable capture 为 false。
- 该 run 仍真实达到日常授权恢复、resolve、authority、capture card 与 arm。authority task 为 `media_task_2ff825e2e56946ff967d292022c9023b`。
- cleanup：Chrome closed、Runtime exited、fixture/scratch removed、cleanup failure `0`；Cookie value leak hit `0`；端口 `17861` 与 owned process 归零。
- Headless 路线已经按冻结计划穷尽，禁止继续重跑。下一安全动作是准备既有 Windows UIAutomation 的 visible Chrome 单次 extension action 门槛；执行会显示窗口或抢占焦点，必须先通知用户，且 Chrome 继续强制 `--mute-audio`。
- 当前状态保持 `P0 IMPLEMENTATION IN PROGRESS / NO-GO`；没有 immutable candidate，`navia-审查` 不得启动，P1 不得启动。
