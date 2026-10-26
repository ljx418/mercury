# P0 日常授权与可信捕获检查点

日期：2026-10-15 17:36 CST。状态：`P0 IMPLEMENTATION IN PROGRESS / NO-GO`。本文件覆盖 10 中较早的 canary 位置，但不替代历史失败证据。

## 1. 架构分层

首次使用链：用户点击启用 -> Chrome 原生 permission -> Navia consent policy -> capability -> credential/acquisition。原生 permission UI 只能由真实用户调用验收，预授权 fixture 不可代签。

日常链：Chrome permission 已持久化 + Navia consent policy 已持久化 -> Side Panel 自动恢复 -> Runtime session -> resolve -> source authority -> acquisition。P0 自动 canary 验证这一链。

无字幕链：UI `media-capture-start` 只 arm -> Chrome action/registered command 的真实用户调用 -> Background `startArmed(tab)` -> Offscreen capture -> UI finish -> ASR/acquisition succeeded -> Side Panel `materializeCurrentMediaTask` -> visual materialize 或同 effect fallback -> ready/degraded。runner 只点击/输入/观察，不直接调用 controller、materialize 或数据库。

## 2. 当前真实证据

- permission client 幂等候选：已授权时不重复 request；Vitest 4/4。
- P0 Node 125/125；Runtime API 6/6；Python 15/15；typecheck/build exit 0。
- 最新 muted run `/tmp/navia-b5-3-canary-1792056987913`：两层日常授权恢复；resolve 201；authority 单 task；capture card 可见；arm 成功；Headless `Ctrl+Shift+Y` 未触发 Chrome command，action count 0 -> 0；非零退出；cleanup/secret 均为 0。

## 3. 用户体验边界

有字幕/可下载媒体时应继续自动完成，不暴露内部 create/materialize。无字幕且必须 tabCapture 时，Chrome 安全模型仍要求一次明确扩展 action。产品可把提示收敛为单一动作，但不能静默绕开浏览器用户调用。自动测试全程静音；需要可见 Chrome/UIAutomation 时必须提前告知用户窗口与焦点影响。

## 4. 下一开发与验收

1. 主干 Claude 深读 manifest command、Background action、既有 V3-2-4a UIAutomation 与 canary；形成最小 action invocation adapter，不能复制第二套 capture controller。
2. 同一次 canary 先尝试 `open-navia-sidepanel`，再尝试 `_execute_action`；每次记录 registered commands、action count、capture status 和 typed error。
3. Headless 两种均失败后立即停止 Headless 重跑；准备 Windows UIAutomation 单次 visible Chrome 门槛，明确 `--mute-audio`、固定 BVID、窗口影响、cleanup。
4. capture 真正开始后按冻结最小采集时长结束，观察 ASR/acquisition/materialize/terminal；不得上传原始音视频。
5. 成功后补 Runtime crash、worker missing、permission missing、cleanup failure、SIGTERM 真实边界。
6. 更新 P0 全部证据并生成 immutable candidate；独立 Fatal=0/Major=0 后才允许 P1。

## 5. 高 token 分工

Claude 主干：跨目录 action/capture 调用链、长 diff、真实 Chrome runner、故障矩阵、日志与 evidence seal。Claude 审查：candidate 的只读逐文件复算。Codex：文档冻结、PRD/架构纠偏、关键源码抽查、门禁与最终验收。429/529 时先 checkpoint；422 先缩小工具输入或回 Provider 合同，不重复原请求。

## 6. 停止条件

任何声音播放、secret/raw-media/path 泄漏、runner 直调 controller/materialize、条件未改变的重跑、公共合同未冻结变更、cleanup 不完整、P0 未审先跑六视频，均立即 NO-GO。

## 7. Claude 交接状态

P0 续跑任务已发送到 Orca `navia-主干开发`，但 Claude Code 仍返回 Token Plan `429` 并进入自动重试；Codex 已中断重试。恢复时不要重复发送不同版本提示词，直接读取本文件与 `08-goal-continuation-prompt.md` 后继续。`navia-审查` 尚未启动本候选审查。

## 8. 18:15 Headless 双入口最终结论

- P0 combined Node suite `131/131` PASS。
- fresh muted run `/tmp/navia-b5-3-canary-1792058113774`：`open-navia-sidepanel` 与 `_execute_action` 均未产生 action count 增量或 durable capture；exit 1，leak 0，cleanup failure 0，资源归零。
- Chrome `getAll()` 显示项目命令 `Ctrl+Shift+Y` 已注册，但 `_execute_action` 在该隔离环境 shortcut 为空。普通 Playwright 键盘输入不能证明原生 extension action。
- Headless 路线已经穷尽，禁止再次重跑。下一步只允许准备 visible Windows UIAutomation 单次 action 门槛；执行前通知用户，继续强制静音。
- Claude 主干仍受 429 限制，已中断自动重试；审查窗口继续保持未启动。

## 9. 2026-10-15 19:04 Offscreen WebSocket 根因边界与文档回退

- visible muted Chrome 已成功触发真实 extension action 并到达 Offscreen start；不再受 `capture-command-not-observed` 阻塞。
- 最新 `/tmp/navia-b5-3-canary-1792062210940`：Background Service Worker WebSocket probe=`opened`，Offscreen=`V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED`，Runtime capture diagnostics 空；exit 1，cleanup failure 0，secret leak 0。
- Windows `.NET ClientWebSocket` 可直连同一 Uvicorn endpoint；Runtime WebSocket 依赖存在。因此当前证据只把差异收敛到 Offscreen 网络上下文，不能宣称 CSP、Runtime 或 ticket 是根因。
- 因修复涉及内部 transport ownership，实施已停止并返回文档冻结。限定路线为 Background 持有 Runtime WS、Offscreen 经 exact-sender Port 发送有序 PCM；用户动作、30 秒 ticket、公共 API、SourceAuthority 和 materialize ownership 不变。
- 最新恢复点改为 `13-p0-background-capture-relay-document-freeze.md`；主干 goal 为 `14-claudecode-p0-relay-goal-prompt.md`。当前只允许审 v4 候选，v1-v3 不得实现；文档外审与明确授权前代码 NO-GO。
