# Stage B B-5-3 Phase 0 主干 handoff（2026-10-15，Codex 检视后修订）

日期：2026-10-15（Codex 独立检视后修订）。本 handoff 给独立 Claude Code
CLI 审查代理（`docs/active/project/handoffs/v3-claudecode-completion-2026-10-15/07-independent-review-prompt.md`）
执行 Phase 0 出门审查使用。本会话不替独立审查作最终 PASS。

## 1. immutable candidate ID

`navia-b5-3-phase0-immutable-candidate-2026-10-15`

## 2. 本次会话新增 / 修改文件清单

### 新增（untracked）

```
scripts/stage_b_b5_3/lib/contracts.mjs
scripts/stage_b_b5_3/test/contracts.node-test.mjs
scripts/stage_b_b5_3/test/sequencer.node-test.mjs
scripts/stage_b_b5_3/test/real_branches.node-test.mjs
scripts/stage_b_b5_3/test/integration_runtime_api.node-test.mjs
scripts/stage_b_b5_3/test/canary_bvid1.node-test.mjs
scripts/stage_b_b5_3/test/_fixtures/stub_runner.mjs
scripts/stage_b_b5_3/test/_fixtures/sequencer_alt.mjs

docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-phase0-detailed-plan-2026-10-15.md
docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-phase0-acceptance-criteria-2026-10-15.md
docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-phase0-preimplementation-audit-2026-10-15.md
docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-phase0-root-cause-2026-10-15.md
docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-phase0-test-results-2026-10-15.md
docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-phase0-prd-review-2026-10-15.md
docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-phase0-handoff-2026-10-15.md
```

### 修改

```
scripts/stage_b_b5_3/run_one_bvid.mjs
scripts/stage_b_b5_3/sequencer.mjs
```

### 文件 SHA-256（PH0 immutable candidate）

```
2c65ca43bc0667308235c4380265bdb11b1a33218db7b3c229e6b4dd6386bef0  scripts/stage_b_b5_3/run_one_bvid.mjs
3cf53d40308e71ccbd8d18ec381cecb19ed70b3511556d1de85858f56d032828  scripts/stage_b_b5_3/sequencer.mjs
9aa2c45115688f2adb2c9fc27173a82ff7c91ffc2d47f6cfe0d029cd56423de0  scripts/stage_b_b5_3/lib/contracts.mjs
ac6849f48d6be816db5b0ac1f144300f282514d7f6a8ce5726661f6eb5d5f8f9  scripts/stage_b_b5_3/test/contracts.node-test.mjs
ebb1b3736a37ab5758aca2fd56ad7253df420fef13a2b6e1b909b831bddf1725  scripts/stage_b_b5_3/test/sequencer.node-test.mjs
7ebd489d9c6df1356358b3f42068ee18b25467fe7867137af7cc128b22f366da  scripts/stage_b_b5_3/test/real_branches.node-test.mjs
b375c11f4d7f83791c5afe0ee4c9c9a14bf390e9ea2d779ddb35e68a9f79a6c8  scripts/stage_b_b5_3/test/integration_runtime_api.node-test.mjs
ff99a18a38aa5bfa7dc6d0c53219b7221c50f484b2a3b01fc6f5c90cc3593017  scripts/stage_b_b5_3/test/canary_bvid1.node-test.mjs
46fefd19065097260f77e1c5d297441938391a220df7a74327a68d716ffaff15  scripts/stage_b_b5_3/test/_fixtures/stub_runner.mjs
6af8769fce40bd4b30b15c9223b589daa557fc844a1727ac4f81096178f12dfd  scripts/stage_b_b5_3/test/_fixtures/sequencer_alt.mjs
```

### 未修改

- `services/local-runtime/`、`apps/chrome-extension/`、`docs/active/project/contracts/`、
  `tests/`、`schemas/`、`stage-b-six-video-registry.json` v1
- 6 BVID 固定分母、`derivedTextScope`、secret scan 白名单、隐私边界

## 3. 复算命令（独立审查代理出门前必跑）

```bash
cd /mnt/c/workSpace/navia

# (a) Syntax
node --check scripts/stage_b_b5_3/run_one_bvid.mjs && echo RUNNER_OK
node --check scripts/stage_b_b5_3/sequencer.mjs && echo SEQUENCER_OK

# (b) Tests (74 / 74 expected)
node --test scripts/stage_b_b5_3/test/contracts.node-test.mjs \
       scripts/stage_b_b5_3/test/sequencer.node-test.mjs \
       scripts/stage_b_b5_3/test/real_branches.node-test.mjs
node --test scripts/stage_b_b5_3/test/integration_runtime_api.node-test.mjs
node --test scripts/stage_b_b5_3/test/canary_bvid1.node-test.mjs

# (c) SHA-256 复算
sha256sum \
  scripts/stage_b_b5_3/run_one_bvid.mjs \
  scripts/stage_b_b5_3/sequencer.mjs \
  scripts/stage_b_b5_3/lib/contracts.mjs \
  scripts/stage_b_b5_3/test/contracts.node-test.mjs \
  scripts/stage_b_b5_3/test/sequencer.node-test.mjs \
  scripts/stage_b_b5_3/test/real_branches.node-test.mjs \
  scripts/stage_b_b5_3/test/integration_runtime_api.node-test.mjs \
  scripts/stage_b_b5_3/test/canary_bvid1.node-test.mjs

# (d) product code / schema / 合同 / fixtures 不变
sha256sum \
  services/local-runtime/navia_runtime/modules/media_companion/comprehension/quality.py \
  services/local-runtime/navia_runtime/modules/media_companion/comprehension/service.py \
  services/local-runtime/navia_runtime/modules/media_companion/comprehension/synthesis.py \
  docs/active/project/contracts/v3_media_grounded_comprehension_v2.schema.json \
  docs/active/project/contracts/v3_media_grounded_comprehension_v2_1.schema.json \
  docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-route-2-contract-fixtures.json \
  docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-route-2-contract-fixtures.py \
  docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-route-2-contract-addendum.md
# 期望：与 B-5-2 验收 §2 一致

# (e) 不启动真实 fresh run
ps aux | grep -E "uvicorn|navia_runtime\.app" | grep -v grep | wc -l
# 期望：1（integration test 启动的临时 Runtime，已在 test.after 关闭）

# (f) 不 commit / push
git -C /mnt/c/workSpace/navia log --oneline -5 scripts/stage_b_b5_3/
git -C /mnt/c/workSpace/navia status scripts/stage_b_b5_3/ \
                                   docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-phase0-*.md
# 期望：所有新增 / 修改文件 untracked
```

## 4. Codex 6 项 Major 缺陷关闭验证

| 缺陷 | 修复 | 测试 |
|---|---|---|
| M-1 状态机矛盾 | runner 内三阶段信号（authority pending → outline-task POST → media_tasks ready/degraded） | real_branches + integration PH0-AR-11 |
| M-2 未定义变量 | runner 改用 `convergence.taskId` / `convergence.revision`；删除 `projections.*` | real_branches 头部 + node --check |
| M-3 outline-task 缺失 | runner 调 `POST /v1/media/outline-tasks`；integration 验证 | integration PH0-AR-7 + PH0-AR-11 |
| M-4 启用动作 + 权限 | runner launcher → frameLocator → enable click；permissionDenied 信号 | canary_bvid1 |
| M-5 非零失败退出 | runner catch `process.exitCode = 1`（非 blocked）；sequencer 缺失 FD / partial / ≥2 blocked → exitCode = 1 | real_branches 多项 |
| M-6 真实故障 branch | 真实 runner 在 Chrome 不可用 / silent stub / exit 7 路径 | real_branches |

## 5. Phase 0 关键事实摘要

1. **6 项 Major 缺陷**：5 项完全关闭 + 1 项（sequencer-level SIGTERM）以
   spawn 重构记录为 Phase 1 启动前置；
2. **测试**：74 / 74 PASS（48 contracts + 11 sequencer + 9 real-branch +
   5 integration + 1 canary）；
3. **Chrome canary**：真实 Chrome 启动 + 强制 `--mute-audio`（pgrep 校验）
   + 单 BVID `BV1pohR6rEEh` 导航 + launcher + enable click 全链路通过；
4. **真实 Runtime API 集成**：5 / 5 PASS，POST `/v1/media/outline-tasks`
   真实创建 `media_tasks` 行（mode 0o600），synthesize 端点不再 404；
5. **本会话未启动真实六视频 fresh run**；runner / sequencer 通过单元 + 集成
   + canary 真实分支覆盖验证；
7. **不 commit / push**；本会话不替独立审查作最终 PASS。

## 6. Phase 0 出门后（独立审查允许）→ Phase 1 启动前置

1. 复用 `v3-media-experience-stage-a-fresh.mjs:340-372` 的
   `media-companion-enable` 点击 + X11 ctypes fake-click native prompt
   处理；
3. 序列化 `spawnSync → spawn` sequencer 重构以解决 SIGTERM 真实路径；
4. runner 调 synthesize 前再次校验 `media_tasks.state ∈ {ready, degraded}`
   且 outline-task POST 落库原子性（已被 PH0-AR-7 / PH0-AR-11 覆盖）；
5. 完成后才允许创建全新 run ID + 6 个 BVID 各自 fresh Runtime/database/
   profile/task；
6. Phase 1 跑通 → B-5-4 → B-5-5 → B-5-6 → B-5-7 → B-6/B-7 → Stage C/D/E →
   V3-6/V3-7。

## 7. 独立审查焦点（FATAL / Major / Minor 复算）

### FATAL（任何 1 项非 0 → Phase 0 不得继续）

- 任意测试 fail → FATAL
- `node --check scripts/stage_b_b5_3/run_one_bvid.mjs` 非 0 → FATAL
- `media_source_authority` 与 `media_tasks` 状态机错误残留 → FATAL
- runner 仍引用 `projections.taskId` / `projections.revision` → FATAL
- product code / schema SHA 与 B-5-2 验收不一致 → FATAL
- 6 upload counters / secret scan 白名单 / `derivedTextScope` 变更 → FATAL
- canary 中 Chrome 缺 `--mute-audio` → FATAL
- 任何 fresh run 被启动 → FATAL

### MAJOR（任何 1 项非 0 → Phase 0 不得继续）

- 任意 real-branch 测试 fail → MAJOR
- 任意 integration 测试 fail → MAJOR
- sequencer 在 silent stub 下仍 exit 0 → MAJOR（M-5 假绿）
- canary 测试 fail / skip 不当 → MAJOR

### Minor

- sequencer-level SIGTERM 真实路径未覆盖 → 落盘为 Phase 1 启动前置

## 8. 出门结论（独立审查代理产出）

请独立审查代理产出
`independent-b5-3-phase0-audit-2026-10-15.md`，内容：

- Fatal / Major / Minor 计数（Phase 0 期望 0 / 0 / ≤1）；
- 逐项证据（测试输出 / 文件 SHA / git diff 范围 / canary 实际启动 trace）；
- 残余风险（sequencer SIGTERM 真实路径 / Chrome native prompt / fresh run
  启动前置）；
- 明确 GO / NO-GO。

本会话不替独立审查作最终 PASS。

## 9. 衔接链

- Phase 0 GO → Phase 1（B-5-3 真实六视频 fresh run，启动前必须先解决
  sequencer SIGTERM + Chrome native prompt）；
- Phase 1 跑通后 → B-5-4 → B-5-5 → B-5-6 → B-5-7 → B-6 / B-7 → Stage C / D
  / E / V3-6 / V3-7；
- 本会话不 commit / push；用户决定提交窗口；
- 主干进展同步按 `sync-project-progress` skill 由用户在独立审查允许后触发。

## 10. 2026-10-15 恢复 checkpoint 纠偏

§4-§8 是较早候选自报，不能继续作为 Phase 0 出门结论。权威恢复点如下：

- 当前状态：`P0 IMPLEMENTATION IN PROGRESS / NO-GO`。
- 已关闭候选：真实扩展 ID、固定端口、iframe 观测、合法 Cookie permission/最低注入、sameSite 归一化、创建前 cleanup barrier、source authority/outline task 原子复用。
- 最新 run：`/tmp/navia-b5-3-canary-1792053808072`，exit 1；resolve/authority/outline 201；同 task ID；cleanup 全绿；Cookie value leak 0。
- 直接下一项：修复 camelCase `taskId` 解析并加合同测试；随后核对 `materializeCurrentMediaTask` 的真实触发时序。
- 未关闭 Major：真实 terminal canary、Runtime crash、worker missing、permission missing、cleanup failure、immutable candidate independent audit。
- 禁止：启动六视频、启动独立审查、引用旧“74/74 PASS”或“5 项完全关闭”作为 GO。

下一安全命令必须在代码修复和 focused tests 后执行；不改变条件不得再次调用真实 B站/Provider。

## 11. 2026-10-15 17:10 最新恢复点

- 当前状态：`P0 IMPLEMENTATION IN PROGRESS / NO-GO`。
- 已形成候选：task ID helper、trace collection 初始化、Route A authority 复用；focused `27/27`、离线 `116/116`、Runtime API `6/6`、Python focused `15 passed`。
- 最新真实 run：`/tmp/navia-b5-3-canary-1792055036947`，约 195 秒，exit 1，`stage-a-not-terminal`；同一 task 停在 `created`，cleanup failure 0、Cookie leak 0、静音成立。
- 根因：固定视频等待 trusted tab capture；runner 手工 outline create 形成第二编排路径，却未触发产品 materialize。
- 架构决定：Side Panel effect 是唯一成功路径 materialize 编排者。runner 只驱动 `media-capture-start/finish` 等用户可达动作和观测。
- 下一安全动作：修改 canary 用户路径与观测合同，先离线复验，再只跑一次条件已改变的 muted canary。
- 未关闭：真实 terminal canary、crash/worker/permission/cleanup/SIGTERM 边界、immutable candidate、独立 Fatal=0/Major=0。
- 禁止：六视频、审查窗口提前启动、runner 直接 materialize/写库、条件不变重跑、播放声音。

## 12. 2026-10-15 17:36 接续点

- 当前候选数字更新为：permission `4/4`、P0 Node `125/125`、Runtime API `6/6`、Python `15/15`、typecheck/build exit 0。
- 最新 run：`/tmp/navia-b5-3-canary-1792056987913`；`capture-command-not-observed`；resolve 201、authority/arm 已完成，Background action count `0 -> 0`。
- 根因边界：Headless Playwright 键盘输入没有形成 Chrome extension action/command 用户调用；这不是 Runtime、Cookie、source authority 或 Side Panel materialize 的通过证据。
- 下一安全动作：主干实现固定双快捷键/action 观测与失败诊断；如 Headless 仍不触发，准备 Windows UIAutomation 的静音、单次真实 action 门槛。后者执行前必须通知用户可能的窗口/焦点影响。
- 禁止：直接调用 `startArmed`、伪造 grant、绕过 tabCapture、安全策略降级、启动六视频、提交 P0 独立 PASS。

## 13. 2026-10-15 18:15 主干恢复交接（最新）

- §1 的早期 immutable candidate 名称已撤回，当前没有可审 candidate；该旧字符串不得交给 `navia-审查`。
- changed files：`canary_bvid1.node-test.mjs` 与 `canary_purity_contract.node-test.mjs`，只调整测试入口观测和静态合同；公共 API/schema/产品权限变化为 `none`。
- tests：node check PASS；purity `8/8`；P0 Node offline + Runtime API combined `131/131`。
- real run：`/tmp/navia-b5-3-canary-1792058113774`，`capture-command-not-observed`，exit 1。两个 Headless 入口均未触发 action 或 durable capture。
- privacy/cleanup：leak hit 0、cleanup failure 0；owned Chrome/Runtime/fixture/scratch/port 已归零。
- nextSafeAction：复用既有 `v3-acquisition-orchestration-e2e.mjs` 的 Windows UIAutomation helper，形成 P0 单次 visible Chrome action adapter；不得复制 capture controller。运行前先告知用户会显示窗口/抢占焦点；始终 `--mute-audio`。
- remaining Major：真实 terminal canary；Runtime crash/worker missing/permission missing/cleanup failure/SIGTERM 真实边界；immutable candidate 与独立审查。
- status：`P0 IMPLEMENTATION IN PROGRESS / NO-GO`；P1 blocked。

## 14. 2026-10-15 19:04 文档阶段交接（最新）

- visible action gap 已关闭；最新失败是 Offscreen `V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED`，而 Background 与 Windows 到同一 Runtime WS 均可达。
- 本轮新增四份 Background Capture Relay 文档和 Archify JSON/HTML；公共 API/schema 变化 `none`，代码实施尚未授权。
- 架构方向：Background 唯一 WS owner；Offscreen 只采集/降采样并经 exact-sender Port 发送有序 PCM；disconnect/restart/backpressure 全部 fail-closed。
- nextSafeAction：使用 `handoffs/.../15-claudecode-p0-relay-review-prompt.md` 执行独立文档审查。Fatal=0/Major=0 后等待用户明确授权 R0-R7；再使用 `14-claudecode-p0-relay-goal-prompt.md`。
- P0、P1 和六视频保持 NO-GO；不得继续 Offscreen WS 微调或条件未改变的 canary。
