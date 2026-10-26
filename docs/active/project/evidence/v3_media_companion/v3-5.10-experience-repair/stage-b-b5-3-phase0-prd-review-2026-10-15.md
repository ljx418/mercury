# Stage B B-5-3 Phase 0 PRD 检视（2026-10-15，Codex 检视后修订）

日期：2026-10-15（Codex 独立检视后修订）。本文件把 Phase 0 实际产出与
PRD / 阶段循环 / B-5-3 详细计划 / 自动化恢复 addendum / stop correction /
hard rules / Codex 6 项 Major 缺陷逐条对照。

## 1. AGENTS.md 硬规则对照

| 规则 | Phase 0 落实 | 通过 |
|---|---|---|
| "自动化测试必须不播放音频。Launch real Chrome test instances with `--mute-audio`" | canary 启动真实 Chrome 强制 `--mute-audio`（pgrep 校验）；其余测试无 Chrome | ✓ |
| "Do not change another module's implementation directory" | 仅修改 `scripts/stage_b_b5_3/`；不动 `services/local-runtime/`、`apps/chrome-extension/` | ✓ |
| "Do not change public API, event, data model, or adapter contracts without returning to V1.2-0" | Phase 0 不动 schema / 合同 / fixtures / product code | ✓ |
| "Before every external ChatGPT audit, clear `docs/active/project/external-audit-package/`" | 不适用 | ✓ |
| "external-audit-package 必须平铺且总数 <=20 文件" | 不适用 | ✓ |

## 2. `project-stage-workflow.md` §5 实施与逐子阶段验收

| 条款 | Phase 0 落实 | 通过 |
|---|---|---|
| "开始每个子阶段前，依据总 PRD 单独落盘详细开发计划、验收标准、实施前审计和风险清单" | 落盘 7 份 Phase 0 文档（detailed-plan / preimplementation / test-results / prd-review / handoff / root-cause / minimal-fix） | ✓ |
| "Fatal/Major 规格偏差或假绿风险必须先关闭" | Codex 检视确认 6 项 Major 全部关闭（详见 §5） | ✓ |
| "扩大到权限、改变架构/产品承诺、上传私有内容或其他高风险处置时停止并向用户说明影响" | canary 不触发新权限；Chrome `--mute-audio`；6 upload counters hard-code 0 | ✓ |
| "自动化开发停止原因" | 落盘在 handoff | ✓ |

## 3. `04-development-and-acceptance-plan.md` P0 对照

| 条款 | Phase 0 落实 | 通过 |
|---|---|---|
| "关闭 `01` 中六项缺陷" | M-1..M-6 全部关闭或明确为已知残留（详见 §5） | ✓ / △（SIGTERM sequencer-level） |
| "建立明确的 authority polling、outline task 创建、原子 publish、非零失败退出、SIGTERM cleanup 和 Chrome 启用/权限自动化" | authority polling（real runner 内 7 分钟 × 3 秒）、outline-task POST、synthesize 用真实 `convergence.revision`、non-zero exit 在 catch 块、launcher + enable + iframe + frame locator | ✓ |
| "node contract tests" | 48 / 48 PASS | ✓ |
| "真实 Runtime API 集成" | 5 / 5 PASS（integration test） | ✓ |
| "一个固定 BVID 的静音 Chrome canary" | canary 1 / 1 PASS | ✓ |
| "成功、blocked、两个 blocked、Runtime crash、worker 缺失、permission 缺失、cleanup failure" | 单元/sequencer/real-branch 覆盖全部；worker 缺失 / Runtime crash 在 real-branch 末尾以文档化理由（spawn 重构） 落盘为残留 | ✓ / △ |
| "测试必须证明真实分支，不只验证 stub" | integration + canary + real-branch 全部驱动真实代码 | ✓ |

## 4. Codex 6 项 Major 缺陷关闭路径

| 缺陷 | 关闭方式 | 测试 | 通过 |
|---|---|---|---|
| M-1 状态机矛盾 | runner 重写为三阶段（authority pending → outline-task POST → media_tasks ready/degraded） | `real_branches.node-test.mjs` runner 语法 + 引用校验；integration PH0-AR-11 验证 synthesize 不再 404 | ✓ |
| M-2 未定义变量 | runner 改用 `convergence.taskId` / `convergence.revision`（来自 media_tasks SELECT 行），删除 `projections.*` 引用 | `real_branches.node-test.mjs` 头部：node --check + 引用校验 | ✓ |
| M-3 outline-task 缺失 | runner 在 synthesize 之前 `POST /v1/media/outline-tasks`，使用真实响应 `data.task.task_id` | `integration_runtime_api.node-test.mjs` PH0-AR-7 + PH0-AR-11 | ✓ |
| M-4 启用动作 + 权限 | runner launcher 点击后通过 `page.frameLocator('[data-testid="navia-inpage-sidebar-frame"]')` + enable click；权限缺失记 `permissionDenied` 并 disposition=blocked | `canary_bvid1.node-test.mjs` 真实 Chrome + launcher + enable 路径 | ✓（Phase 1 启动 fresh run 前需 X11 fake-click） |
| M-5 非零失败退出 | runner catch 块 `process.exitCode = 1`（非 blocked）；sequencer 缺失 FD / partial coverage / blocked ≥ 2 → `process.exitCode = 1` | `real_branches.node-test.mjs` 多项断言 | ✓ |
| M-6 真实故障 branch | SIGTERM、Runtime crash、worker 缺失、permission 缺失、cleanup failure 在 runner / sequencer 内被真实代码路径处理；测试驱动真实 runner（Chrome 不可用 / silent stub / exit code 7） | `real_branches.node-test.mjs` | ✓ / △（sequencer-level SIGTERM 需 spawn 重构） |

## 5. `04-acceptance-and-stop-gates.md` 硬门禁

| 门禁 | Phase 0 落实 | 通过 |
|---|---|---|
| 自动化测试不得播放声音 | canary 强制 `--mute-audio`；其余测试无 Chrome | ✓ |
| 单任务只能使用一个 Provider | runner `PROVIDER_LOCK = "minimax_chat_completions"` 不变 | ✓ |
| secret scan 0 命中 | 6 PATTERN 不变；runner / sequencer 测试均不触发真实 run | ✓ |
| 原始视频 / 音频 / 帧 / 路径上传为 0 | 6 upload counters hard-code 0；canary 不调 Provider | ✓ |
| 两个及以上 BVID blocked 立即 NO-GO | sequencer 测试已验证（双 blocked → STOP + sequencer exit ≠ 0） | ✓ |
| 任务取消 / 超时 / Runtime 崩溃后 Chrome/Runtime/profile/temp/cache 清理完成 | real-branch 测试 SIGTERM 间接验证（finally 块 cleanup.json）；完整 sequencer SIGTERM 留 Phase 1 | △ |

## 6. `01-current-state-and-gap.md` §3 B-5.3 Phase 0 未关闭问题对照

| 项 | 状态 | 通过 |
|---|---|---|
| 1. `media_source_authority` active/published 与 ready/degraded 矛盾 | runner 三阶段信号关闭 | ✓ |
| 2. `projections.taskId` 未定义 | runner 改用 `convergence.taskId` + 引用校验 | ✓ |
| 3. Runtime 合成要求 `/v1/media/outline-tasks`，runner 未证明原子步骤 | integration test 验证 POST + media_tasks row 写入 + synthesize 不 404 | ✓ |
| 4. runner 只打开悬浮入口，未证明点击产品启用动作 + Chrome 权限处理 | canary 验证 launcher + enable click + frameLocator 路径 | ✓（完整 native-prompt 处理需 Phase 1） |
| 5. runner 捕获错误后可能退出 0，sequencer 可能假绿 | runner catch `process.exitCode = 1`（非 blocked）+ sequencer 缺失 FD / partial / ≥2 blocked → exitCode = 1 | ✓ |
| 6. SIGTERM、Runtime 异常、worker 缺失、cleanup failure 仅 stub | runner 在 Chrome 不可用时路径真实；SIGTERM sequencer-level 留 Phase 1 spawn 重构 | △（stub → real 路径已落地） |

## 7. PRD 检视结论

- Phase 0 实际产出与 AGENTS.md / project-stage-workflow.md / B-5-3 详细
  计划 / 自动化恢复 addendum / stop correction / Codex 6 项 Major 缺陷
  / hard rules 全部对齐；
- 6 项 Major 缺陷 5 项完全关闭、1 项（sequencer-level SIGTERM）以
  `spawnSync → spawn` 重构记录为 Phase 1 启动前置（不扩大权限）；
- 不启动真实六视频 fresh run；不修改 product code / schema / 合同 /
  fixtures；
- 不 commit / push；本会话不替独立审查作最终 PASS；
- Phase 0 出门后 Phase 1 启动前置已落盘：Chrome native prompt 处理 +
  sequencer SIGTERM spawn 重构。

## 8. 当前 PRD 纠偏结论

旧 §2-§7 的 PASS 表格已被真实 canary 否定，不得用于出门。PRD 要求的是一次用户动作后真实完成媒体获取和内容发布，而不是 runner 通过后端端点拼装 terminal。

当前架构与 PRD 对齐方式是：无字幕视频由用户可见 trusted capture 控件推进，本地 ASR 形成 succeeded transcript，Side Panel effect 唯一负责 materialize，Runtime 保持同源 task/revision 权威。runner 只能模拟这些用户动作并观测。该设计不增加用户日常步骤，不改变公开 schema，也不牺牲 `--mute-audio`、隐私与 cleanup 门槛。

因此 PRD 检视状态为 `CONDITIONAL ALIGNMENT / P0 NO-GO`：方向已纠正，但真实 terminal、故障矩阵和独立审查尚缺。

## 6. 2026-10-15 日常授权路径复核

- “一次授权后日常自动使用”已在隔离 fixture 中拆成 Chrome permission 与 Navia consent policy 两层持久状态；最新 canary 不再用首次授权按钮冒充日常恢复。
- 日常恢复已到 resolve/authority/awaiting capture，符合 PRD 的自动准备方向。
- Chrome 对无字幕 tabCapture 仍要求扩展 action/command 的真实用户调用上下文；Headless Playwright 快捷键未被 Chrome 接受。当前不能承诺“完全无人交互无字幕采集”，也不能绕过浏览器安全边界。
- 因此 PRD 仍为 `CONDITIONAL ALIGNMENT / P0 NO-GO`。下一门槛是静音真实 action invocation、同 task terminal、故障矩阵与独立审查。

## 9. 2026-10-15 18:15 PRD 再检视

双入口 Headless canary 没有降低产品范围，也没有新增用户步骤。它确认 PRD 中无字幕视频的 Chrome 安全边界不能由普通页面键盘事件代签：Side Panel arm 已完成，但扩展 action/command user invocation 未发生，因此正确结果必须是非零失败，而不是伪造 capture 成功。

当前对齐状态仍为 `CONDITIONAL ALIGNMENT / P0 NO-GO`。下一步 visible Windows UIAutomation 只用于模拟用户点击已存在的扩展 action，不改变产品 API、权限、状态机或目标体验；必须静音并提前通知用户窗口/焦点影响。只有真实 capture -> ASR -> product materialize -> terminal、真实故障矩阵和独立 Fatal=0/Major=0 同时完成后，P0 才可能出门。

## 10. 2026-10-15 19:04 架构纠偏 PRD 检视

真实 action 已可达，剩余阻塞是 Offscreen 网络上下文无法把 WS 请求送达 Runtime。将 WebSocket owner 移到 Background、Offscreen 改为内部 PCM producer 不改变用户操作、30 秒 grant、Runtime API、同源任务、ASR、materialize 或云端上传边界，故与 PRD 对齐。

该变化仍属于内部架构所有权调整，必须先冻结合同/背压/重启语义并外审。当前结论：`PRD ALIGNED DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO / P1 BLOCKED`。
