# V3 当前状态与 PRD 缺口

## 1. 恢复基线

- Git 分支：`main`；提交基线：`a303551a5bf89c26ff36b24ac06c7e30c334db27`。
- 实际开发候选包含大量未提交产品代码、测试、证据、构建输出和未跟踪文件。接手 Agent 必须逐项盘点，不得 `reset --hard`、`checkout --`、`clean` 或覆盖用户差异。
- 2026-10-15 盘点时没有遗留 B-5 runner、sequencer、隔离 Runtime 或其 Chrome 验收进程。
- 所有自动化浏览器必须包含 `--mute-audio`，任何测试不得播放声音。

## 2. 已有受限成果

| 范围 | 当前可信状态 | 不允许扩大为 |
|---|---|---|
| V3-1.4 页面/会话/本机伴侣 | LIMITED PASS | 自动拉起 Runtime 或 V3 PASS |
| V3-2 媒体获取与 SenseVoice | LIMITED PASS | 所有视频均有平台字幕 |
| V3-3 OCR/选帧/授权 VLM | LIMITED PASS | 任意原始媒体可上传 |
| V3-4 TaskStore/Outline | LIMITED PASS | 目标内容质量已完成 |
| V3-5 基础产品流 | 已实现候选 | H01..H10 已签署 |
| V3-5.1 | MACHINE CANDIDATE PASS | 人类质量 PASS |
| V3-5.9 登录/媒体缓存 | 实现候选 | 最终人工 PASS |
| V3-5.10 Stage A | LIMITED PASS | Stage B-E PASS |
| Stage B B-5-1/B-5-2 | PASS | B-5 六视频通过 |
| Route 2 composer / DeepSeek strict adapter | LIMITED PASS | 内容正确或 Provider 可自由 fallback |

全局 Chat Provider 默认保持 MiniMax。DeepSeek 已安全导入系统凭据库，但只在用户手动选择或已批准的任务级研究中使用；保存不等于选择，首次使用不得诱导单一供应商。

## 3. 当前 B-5.3 Phase 0 未关闭问题

当前脚本为 `scripts/stage_b_b5_3/run_one_bvid.mjs` 与 `sequencer.mjs`。既有 59/59 node tests 只能证明局部合同，不能证明真实成功路径。正式修复必须覆盖：

1. `media_source_authority` 的 `active/published` 处理与后续 `ready/degraded` 判断矛盾，成功状态机不可达。
2. 成功路径引用未定义的 `projections.taskId`，应统一使用经验证的 projection/task authority。
3. Runtime 合成要求先创建 `/v1/media/outline-tasks`，runner 尚未证明完成该原子步骤。
4. runner 只打开悬浮入口，未证明点击产品启用动作及处理 Chrome 原生权限提示。
5. runner 捕获错误后可能仍返回进程退出码 0，sequencer 可能把失败看成正常执行。
6. SIGTERM、Runtime 异常、service worker 缺失、cleanup 失败等测试主要依赖 stub，没有证明真实边界。

修复前状态固定为 `B-5.3 PHASE 0 NO-GO`。旧诊断 run `...132500Z` 与 `...133200Z` 均不可作验收输入或拼接。

## 3.1 2026-10-15 下午 P0 恢复检查点

- `sequencer.mjs` 已形成异步子进程与 SIGINT/SIGTERM 转发候选；早期真实信号测试曾泄漏子进程，已被识别为失败并清理，不能用早期日志证明通过。
- 当前局部自测候选为 contracts `48/48`、sequencer `11/11`、real branches `7/7`、Runtime API integration `5/5`。其中 7 个 real-branch tests 不再伪称覆盖 Runtime crash、worker missing、permission missing 和 cleanup failure；这些义务没有真实证据时仍是未关闭项。
- 最新静音 Chrome canary 证据目录为 `/tmp/navia-b5-3-canary-1792050516202`。它证明 Chrome 命令含 `--mute-audio`、预授权 `https://*.bilibili.com/*` 为真、Service Worker 存在、B站导航/悬浮入口/启用按钮可达；它在 `resolve-not-observed` 失败，不能用于通过声明。
- 该失败的直接编排根因是测试把 Runtime 的 `NAVIA_LOCAL_FILES_EXTENSION_ID` 固定为 `abcdefghijklmnopabcdefghijklmnop`，真实加载扩展 ID 为 `aohpjomapiblphgagpngphocdcjggdjg`。Side Panel 因 Origin/扩展 ID 不匹配无法建立 Runtime 安全会话，自动启动条件不成立。
- 当前 built manifest 没有 `key`。下一候选必须按本环境 unpacked extension 规则，从规范化绝对 fixture 路径（UTF-8、无尾斜杠）的 SHA-256 前 16 bytes，把每个十六进制 nibble `0..f` 映射为 `a..p`，得到 32 字符扩展 ID；再以该 ID 启动 Runtime，并在 Service Worker 出现后逐字断言实际 ID 一致。Runtime session origin 与 UI origin 必须一致。test-only manifest 只提升 host permission，不得添加不存在的 `permissions` 权限名。
- 当前没有遗留 canary Chrome/Runtime/runner 进程；尚未启动任何六视频 fresh run，也没有发生新的 Provider 调用。

后续一次诊断 run 又确认了第二个测试编排根因：产品扩展的 `runtimeClient`、background 与 manifest host permission 固定访问 `127.0.0.1:17861`，而 canary 曾把隔离 Runtime 启动到随机端口，因此即使扩展 ID 正确也不可能连通。该 run 已人工中止并完成 owned worker、fixture 与 scratch 清理，只保留 diagnostic evidence，不得记为 PASS。下一候选必须同时满足：

- 只使用产品端口 `17861`，启动前 bind preflight；端口被占用即输出 `runtime-port-occupied` 并停止，绝不终止用户已有 Runtime。
- 不提供“随机端口 override”；除非重建扩展并证明所有调用方共同切换，否则 override 会制造新的端口漂移。
- Side Panel 状态必须从嵌入 iframe 内读取，不能在 B站宿主 document 查询扩展 DOM。
- 外部中断不得只终止 node test parent 而遗留 runner worker；正式命令保存真实 node 退出码，并由 runner 自身完成 signal cleanup。

固定端口与 iframe 观测修复后的 muted canary `/tmp/navia-b5-3-canary-1792051938565` 仍以 exit `1` 在 `resolve-not-observed` 结束，并已证明 cleanup fail-closed：Chrome/Runtime 退出、fixture/scratch 删除、无残留。trace 同时证明 extension ID、Runtime `17861`、安全会话、B站 host permission 和启用按钮均正常；真正剩余条件是 fresh Chrome profile 没有 `cookies` named permission 和登录 cookie，capability 始终不可用，因此 acquisition 合理地没有启动。下一候选必须：

- 在 test-only manifest 中把合法的 `cookies` 从 optional permission 提升为 required，同时提升 B站 optional host permission；禁止再次加入名为 `permissions` 的伪权限。
- 从用户已授权的私有 cookie 来源向 fresh profile 内存注入最低必要 B站 cookie，只记录 cookie 名称集合的冻结哈希和“已注入/未注入”，不得记录 cookie 值、私有文件内容或绝对路径。
- 运行前后对 evidence/log/public tar 做 secret scan；任何 cookie 值命中立即 NO-GO 并清理。
- 没有可用私有 cookie 时以明确 prerequisite diagnostic 停止，不能使用伪造 cookie 冒充真实日常路径。

因此当前权威结论仍为 `P0 IMPLEMENTATION IN PROGRESS / NO-GO`。只有修复 canary、真实关闭固定故障分支、文档与代码声明一致，并经独立只读复审 Fatal=0/Major=0 后，才允许 P1。

## 3.2 2026-10-15 最新 P0 事实纠偏

本节优先于 §3.1 中已经被后续诊断替代的直接根因，但不删除旧失败历史。

- 临时测试扩展现只把合同内 `cookies` 与 B站 host permission 提升为 required；私有 Cookie 来源仅以用户授权文件为输入，公开证据不得保存值、文件内容或绝对路径。安全预检确认 JSON 可读、最低必要 `SESSDATA` 唯一选中，其余 Cookie 被忽略。
- Cookie validator 已冻结 `COOKIE_PREREQ_SAMESITE_INVALID`，支持 Chromium `unspecified`（省略 Playwright SameSite）和 `no_restriction`（映射 `None`）。失败前创建的 scratch/profile 已纳入 cleanup barrier；缺 env 与畸形输入使用真实 child process 验证非零退出和 `/tmp` 集合不变。
- Runtime `POST /v1/media/outline-tasks` 已形成“存在 source authority 时复用其 task ID”的实现候选，解决第一次 Cookie canary 暴露的两个权威 task 冲突。对应 Python focused test 为 2 passed，真实 Runtime Node API suite 为 6/6。
- 四次后续 muted canary 均未产生 PASS：先后暴露旧启用按钮不存在、原生 `details` 被 React 重渲染关闭、以及 camelCase `taskId` 解析缺失。每次均 exit 1、cleanup fail-closed、Cookie 值泄漏 0。
- 最新 run `/tmp/navia-b5-3-canary-1792053808072` 已达到：真实扩展 ID、Runtime `17861`、真实 B站页面、启用点击、resolve 201、authority active、outline 201；outline 返回与 authority 相同的 `taskId`，但 canary 只读取 `task_id` 后错误报告 `outline-task-failed`。

下一安全动作固定为：

1. 用单一 helper 兼容公共 camelCase `taskId` 与历史内部 snake_case，并增加响应解析合同测试。
2. 审查 `sidepanel/main.tsx` 的 `materializeCurrentMediaTask` effect 是否在 outline task 创建后会真实触发 `/materialize`；若不会，先修订 P0 时序合同，不能通过 runner 私造 ready 状态。
3. 只在以上条件改变后执行一次新的静音单视频 canary；禁止不改变条件重跑。
4. canary 成功仍不等于 P0 出门；还要真实关闭 crash/worker/permission/cleanup 四类故障边界并提交 immutable candidate 外审。

当前没有六视频 run、P1 授权或 P0 PASS。

## 3.4 2026-10-15 17:36 日常授权与可信捕获检查点

- 当前候选已通过 permission focused 4/4、P0 Node 125/125、Runtime API 6/6、Python 15/15、typecheck/build。
- 自动 canary 已明确拆分首次授权与日常恢复。最新 run `/tmp/navia-b5-3-canary-1792056987913` 在隔离 profile 预置 Chrome permission 与 Navia consent policy 后，自动完成 resolve 201、同源 authority、进入 awaiting capture 并真实点击 arm。
- Headless Playwright `Ctrl+Shift+Y` 未形成 Chrome extension command 用户调用；Background action count 保持 0，run 以 `capture-command-not-observed` 非零退出，cleanup/secret 0。
- 当前 gap 不是 Provider 或内容质量，而是 Chrome tabCapture 的真实 user invocation。controller 直调、API 伪造 grant 或跳过安全边界均不接受。
- 下一步由 Claude 主干完成双入口尝试和 native invocation 方案；需要 visible Windows UIAutomation 时先通知用户，且必须静音。P1 仍阻塞。

## 3.3 2026-10-15 17:00 P0 编排事实与最新真实 canary

本节替代 §3.2 的“下一安全动作”，但保留此前失败链用于追溯。

- 已新增单一 `extractMediaTaskId` helper，兼容公共 `taskId` 与历史 `task_id`；两字段冲突、缺失或格式错误均 fail-closed。helper 与 Cookie/trace focused suite 为 `27/27`，P0 离线全集为 `116/116`，真实 Runtime API 集成为 `6/6`，Python outline/authority focused 为 `15 passed`。
- 第一轮修复后 canary `/tmp/navia-b5-3-canary-1792054898429` 暴露测试脚本自身遗漏：`trace.mediaTasksPolls` 未初始化，轮询第一步抛错。该 run 为 diagnostic-only；cleanup 全绿、secret hit `0`。
- 初始化修复和静态合同断言通过后，新 muted canary `/tmp/navia-b5-3-canary-1792055036947` 真实运行约 195 秒，最终以 `stage-a-not-terminal` 非零退出。它证明 resolve、同源 authority、outline `201` 与同一 `taskId` 均成立，但 `media_tasks.state` 始终为 `created`；cleanup failure `0`，Cookie leak `0`。
- 根因已从“字段解析”收敛为“runner 编排越界”：runner 在 acquisition projection 尚未 `succeeded` 时自行 `POST /v1/media/outline-tasks`，随后只轮询产品 task，却没有触发 materialize。Side Panel 产品代码只在 acquisition projection 为 `succeeded` 时调用 `materialize-visual`，失败再调用基础 `materialize`。因此 `created` 是符合当前合同的结果，不是 Runtime 随机卡死。
- 固定 BVID 在本轮进入 `awaiting_trusted_capture`，界面显示需要一次音频确认。P0 成功 canary 必须通过真实 `media-capture-start` / `media-capture-finish` 用户动作完成本地静音捕获，让 acquisition 到达 `succeeded`，再观察 Side Panel 自动 materialize。runner 不得自行调用 materialize、改数据库或伪造终态。

当前决策：Side Panel `materializeCurrentMediaTask` effect 是日常成功路径唯一编排者；Runtime 保持任务、authority、projection 与幂等写入权威；runner 只驱动用户可达动作并观察 HTTP/数据库/UI。`POST /outline-tasks` 的 authority 复用由独立 API 集成测试证明，不再作为真实 UI canary 的人工编排步骤。

因此 P0 仍为 `IMPLEMENTATION IN PROGRESS / NO-GO`。下一代码动作是删除 canary 的手工 outline 创建/轮询编排，改为可信音频捕获与产品请求观测；随后只允许一次条件已改变的 muted canary。成功后仍须关闭 crash/worker/permission/cleanup/SIGTERM 真实故障边界并生成 immutable candidate。

## 3.4 2026-10-15 v10 收敛后的当前门禁

上段是 relay 重设计前的实现检查点。真实网络诊断证明 Offscreen WebSocket 未到达 Runtime，而 Background 可达；因此 P0 增加 Background-owned capture relay。v1-v9 文档候选均已拒绝，当前唯一合同为 v10：同步 staging/fsync/hash/shape、manifest 原子发布/父目录 fsync、SQLite FULL ownership receipt 与 manifest hash 绑定、唯一 cleanup owner、40/20 错误码完备分类、三个 revision 域和 Chrome 116 身份边界。

当前权威状态为 `V10 DOCUMENT CANDIDATE / SINGLE CODEX REVIEW IN PROGRESS / P1 BLOCKED`。baseline 50/50、mutation 15/15 已通过；用户已批准实际开发，并要求文档只由 Codex 独立 Agent 外审。该单次审查 Fatal=0/Major=0 后直接进入 R0-R7；P0 单视频 canary、故障矩阵和实施外审完成前仍不得启动六视频 run。

## 4. PRD 仍未完成

- B-5 六固定视频的 fresh 单序列内容质量验证。
- B-5-4..B-5-7 清理、封包、handoff 与独立实施审查。
- B-6 宿主 LLM 独立语义复核和 B-7 人类质量签署。
- Stage C 的权威状态、计时器、卡片堆叠、超时/错误/取消/重启恢复体验。
- Stage D 的 100 字 brief、全片章节、图文大纲、视频秒数时间线、可拖动概念关系图和五种导出风格。
- V3-4.1 Chat/Know 的正式出门：Draft 预览/编辑/取消/确认保存，Item 真实 CRUD、排序、归档、来源反跳和重启一致性。
- Stage E 的六视频交互、普通网页、Chat/Know、四视口、键盘、Axe、性能、恢复和一致性验收。
- V3-6 同一 production build 的 12 页单 run、故障/隐私/资源/清理矩阵。
- V3-7 最终独立审计、H01..H10、CX-H01..CX-H06、人类体验和阶段收口。

V4 的 Query/Graph/Durable Forget/自动老化/长期记忆与 V5+ Agent 不属于 V3，不得因未实现阻塞 V3，也不得计入 V3 PASS。

## 3.5 2026-10-15 18:15 Headless 路线关闭

- canary 已在单次 fresh muted run 中读取并尝试两个产品入口；`open-navia-sidepanel` 注册为 `Ctrl+Shift+Y`，`_execute_action` 在隔离环境未分配 shortcut。
- `/tmp/navia-b5-3-canary-1792058113774` 中两次输入均未增加 action count，也未出现 durable capture；run 非零退出、leak 0、cleanup failure 0、资源归零。
- P0 combined Node suite 更新为 `131/131`。Headless 条件已经穷尽，禁止再次重跑。
- 下一安全门槛是 visible Windows UIAutomation 的单次 extension action；执行前必须通知用户窗口/焦点影响，Chrome 必须静音。P0、P1 状态不变。

