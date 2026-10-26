# Navia V3 完成目标续跑提示词

以下代码块可直接作为后续对话的 goal，或交给负责统筹 Claude Code CLI 的 Agent。它表达完整目标，但不会越过阶段门禁自动授权未来高风险动作。

```text
目标：在 /mnt/c/workspace/navia 按 Navia V3 权威 PRD、架构、开发计划和阶段门禁，持续完成从当前 P0 到 V3 最终可人工验收的全部工作。必须保留历史失败证据和现有 dirty worktree，不得通过缩分母、拼接 run、伪造真实数据或把 LIMITED PASS 扩大为 V3 PASS。

一、角色与执行方式

1. Codex 是规格与门禁统筹者：负责 PRD/架构/计划落盘、纠偏、关键事实抽查、独立功能验收和出门判断。
2. 同工作目录 Claude Code CLI 的“navia-主干开发”承担高 token 工作：跨目录调用链检视、代码实现、长 diff、自验证、真实 Chrome/Runtime runner、六视频/12 页 run、证据封包和 checkpoint。
3. “navia-审查”承担高 token 独立外审：只读复算 diff、schema/fixture、测试、真实证据、hash、seal、隐私和 cleanup；除一份 independent audit 外不得改实现。
4. 用户只处理高风险授权和最终人类 H/CX 体验签署。Agent 不得代签人工项。
5. 每次只推进一个已冻结子阶段。主干生成 immutable candidate 后才启动审查；审查通过后才冻结下一阶段。

二、必读事实基线

先读取：
- AGENTS.md
- docs/active/project/design/project-stage-workflow.md
- docs/active/project/handoffs/v3-claudecode-completion-2026-10-15/00-README.md
- 同目录 01..12 全部文件与 HANDOFF_MANIFEST.md
- docs/active/project/01-prd.md
- docs/active/project/02-architecture.md
- docs/active/project/03-development-plan.md
- docs/active/project/04-acceptance-plan.md
- docs/active/project/stage-gates/v3-media-companion.md
- docs/active/project/design/v3-5.10-media-experience-repair-plan.md
- 当前子阶段最新 plan/acceptance/preimplementation audit/handoff/test results。

分支为 main，提交基线 a303551a5bf89c26ff36b24ac06c7e30c334db27，但工作树包含大量既有未提交代码、文档、构建和证据。禁止 git reset --hard、git checkout --、git clean、覆盖用户差异、删除旧失败 run 或擅自 commit/push。任何 Chrome 自动化必须显式 --mute-audio，测试不得播放声音。

三、当前唯一实施起点：P0 B-5.3 runner 可信化

当前状态固定为 P0 IMPLEMENTATION IN PROGRESS / NO-GO。不得启动六视频 run，不得启动独立审查窗口，直到 P0 immutable candidate 完成。

已确认事实：
- Cookie permission、B站 host permission、最低必要真实 Cookie 测试注入、真实扩展 ID、产品端口 17861、Side Panel iframe 观测和 cleanup/secret barrier 已形成候选；公开证据不得包含 Cookie 值、私有文件内容或绝对路径。
- Runtime POST /v1/media/outline-tasks 已形成复用 source authority task_id 的候选；Python focused tests 2 passed，真实 Runtime Node API 6/6。
- 最新 muted canary /tmp/navia-b5-3-canary-1792053808072 已真实得到 resolve 201、authority active、outline 201，且 outline taskId 与 authority 相同；run 仍 exit 1、cleanup 全绿、Cookie leak 0。
- `extractMediaTaskId` helper 已形成候选，兼容 `taskId`/`task_id` 并拒绝冲突、缺失和非法格式；focused `27/27`、P0 离线 `116/116`、Runtime API `6/6`、Python focused `15 passed`。
- run `/tmp/navia-b5-3-canary-1792054898429` 因 trace 数组未初始化而异常退出；该脚本缺陷已补静态合同，不是产品失败。
- 最新 muted canary `/tmp/navia-b5-3-canary-1792055036947` 真实运行约 195 秒，最终 `stage-a-not-terminal`、exit 1、cleanup failure 0、Cookie leak 0；authority 与 outline 为同一 task，但 task 始终为 `created`。
- 根因：runner 在 acquisition 尚未 `succeeded` 时手工创建 outline，却没有触发产品 materialize。固定视频处于 `awaiting_trusted_capture`。Side Panel effect 只在 projection `succeeded` 后调用 visual materialize，并在失败时调用基础 materialize。
- 架构决定：Side Panel effect 是日常成功路径唯一 materialize 编排者。runner 只做产品用户动作和观测，不得调用 materialize、写库或伪造终态。`POST /outline-tasks` authority 复用只由独立 Runtime API 集成证明。
- 2026-10-15 最新候选：permission focused 4/4、P0 Node 125/125、Runtime API 6/6、Python 15/15、typecheck/build exit 0。run `/tmp/navia-b5-3-canary-1792056987913` 已证明两层日常授权恢复、resolve 201、authority、awaiting capture 与真实 arm，但 Headless `Ctrl+Shift+Y` 未触发 Chrome command，action count 0 -> 0，最终 `capture-command-not-observed`、exit 1、cleanup/secret 0。
- 首次授权与日常路径必须分层：P0 自动 canary 预置 Chrome permission + Navia consent policy，验证日常恢复；原生首次授权 prompt 只能由独立真实 Chrome/人类门槛验收。两者不得互相代证。
- 最新 fresh muted run `/tmp/navia-b5-3-canary-1792058113774` 已依次尝试 `open-navia-sidepanel` 与 `_execute_action`；二者均未增加 action count 或启动 durable capture，exit 1、leak 0、cleanup failure 0。P0 combined Node suite `131/131`。Headless 路线已穷尽，禁止再跑。

P0 顺序：
1. 保留已通过 helper 和 trace 修复，不重复改公共 API；先把最新事实写入 P0 checkpoint。
2. 从 canary 成功路径移除手工 outline/materialize 编排。保留 Runtime create/authority 的独立 API 集成测试。
3. runner 观察 acquisition projection；当状态为 `awaiting_trusted_capture` 时，在 Side Panel iframe 对 `media-capture-start` 执行真实可信点击完成 arm。随后必须由 Chrome extension action 或注册 command 的真实用户调用让 Background `startArmed(tab)`；不得 API/worker evaluate 直调 controller 或伪造 grant/user activation/transcript。
4. 复用既有 Windows UIAutomation helper 准备 visible Chrome 单次 extension action 门槛；不得再次尝试 Headless 快捷键。执行前通知用户窗口/焦点影响，Chrome 仍必须 `--mute-audio`。
5. capture started 后达到冻结最小时长再点击 `media-capture-finish`；等待 acquisition `succeeded`，观察产品 Side Panel 发出 `materialize-visual`，并在视觉失败时由同一 effect 发出基础 `materialize`。runner 只观察，不直接发出这些请求。
6. 运行 node --check、P0 全部 Node tests、Python focused tests 和真实 Runtime API integration。不能用总测试数替代分支事实。
7. 只有代码/条件改变后执行固定 BV1pohR6rEEh 的单次真实 muted Chrome canary。验证真实页面、扩展 ID、Runtime 17861、安全会话、permission/policy、resolve、可信捕获、acquisition succeeded、同 task authority、产品 materialize、ready/degraded、UI terminal、seal、secret=0 和 cleanup。
8. 真实关闭 Runtime crash、service worker missing、permission missing、cleanup failure 和 SIGTERM。每项必须驱动真实子进程/边界并检查非零退出、typed diagnostic 和资源归零；纯 stub 或 summary 不算。
9. 修订 P0 test results、PRD review、handoff，生成 immutable candidate ID 和 payload hashes，然后停止主干实现。
10. 让 navia-审查按 07-independent-review-prompt.md 复算。Fatal=0/Major=0 才允许 P1；否则返回 P0。

四、P1-P9 严格顺序

P1：六固定 BVID 的全新单序列 run。每视频 fresh Runtime/database/profile/task，单任务单 Provider，--mute-audio；两个 blocked、跨 run 拼接、secret/raw-media/path hit 或 cleanup 不完整立即 NO-GO。

P2：B-5-4..B-5-7，完成清理、无秘密 closure package、implementation handoff、<=20 文件外审包与独立实施出门。

P3：B-6 宿主 LLM 独立内容复核和 B-7 人类最小质量签署。复核事实、相关性、概括性、全片覆盖、章节平衡、claim-evidence、截图和 seek；schema PASS 不能替代内容正确。

P4：Stage C 状态/计时/恢复。先冻结 MediaTaskActivityProjection、fixtures、原型、计划、验收和 preaudit；再实现 Runtime 权威状态、Side Panel 顶层状态面、Workspace 同步、取消/重试/刷新/Runtime 重启/revision fence。UI terminal 与 Runtime 一致率 100%。

P5：Stage D 分四个独立工作包：D1 <=100 字 brief/全片章节/claims；D2 真实帧图文大纲和视频秒数时间线（wheel/drag/keyboard/seek）；D3 可拖动概念关系图和布局保存；D4 五种 prompt-distinct 导出、范围/图片/密度选择、取消重试。每包先文档冻结与外审，再授权编码。

P6：V3-4.1 Chat/Know。实现 ContextEnvelope -> KnowledgeDraft -> 显式确认 -> KnowledgeItem；验证 Chat 实时反馈、新聊天/单删/全清、Provider 凭据持久、取消 0 写入、重复确认幂等、冲突、重启、删除、来源反跳和 0 Mock success。V4 Query/Graph/Durable Forget 不纳入。

P7：Stage E 同一 production build 综合交互，覆盖六视频、普通网页、Chat/Know、Side Panel/Workspace 同 revision、四视口、键盘、滚动、Axe、性能、恢复和清理，生成中文 HTML 候选报告。

P8：V3-6 单一 12 页 production run，保留 6+3+1+1+1 原分母，并追加普通网页、Runtime 手动生命周期、Chat/Know 和五种导出。缺 seal 或跨 run 立即失败。

P9：V3-7 最终独立复算、H01..H10、V3-5.1/B-7、CX-H01..CX-H06、Draw.io/HTML 与实际实现同步、中文可视化报告、最小人工路径、限定 V3 PASS。Fatal=0/Major=0 且人类签署完成后才允许阶段收口和范围内 Git 提交；随后运行 sync-project-progress skill。

五、每个子阶段的强制循环

详细 development-plan -> acceptance-plan -> preimplementation-audit（Fatal=0/Major=0）-> 明确授权 -> 实现 -> 自动/真实数据验收 -> PRD review -> cleanup/secret scan/handoff -> immutable candidate -> 独立审查。

文档必须写明输入基线、代码所有权、合同变化、用户场景、操作步骤、固定分母、正负例、FailureCode、停止条件和出门门槛。没有详细文档或授权的阶段只能继续文档开发，不能编码。

六、产品和架构不变量

- 一级产品域为 Chat/Know，Settings 辅助；Agent 后置。
- Runtime 由桌面本机伴侣手动启动，扩展不静默拉进程。
- 同一 sourceIdentity 在页签、Side Panel、Workspace、刷新和重启后只有一个权威 task/revision。
- UI 只渲染 Runtime projection；runner、renderer、Provider 不直接写成功状态或 KnowledgeItem。
- MiniMax 默认；DeepSeek 仅手动选择或已批准研究。首次使用不诱导单一供应商。
- 单任务锁定单 Provider；401/403/refusal 不得冒充模型成功，只有冻结 allowlist 的结构失败可进入确定性 composer。
- 云端只允许已授权派生 transcript/OCR/caption 文本；原始视频、音频、帧、Cookie、密钥和绝对路径上传为 0。
- brief <=100 中文字符；章节覆盖全片；大纲、时间线、概念图表达不同结构且绑定真实证据；时间线使用视频秒数；概念图可拖动并保存布局；至少五种真正不同的导出。
- Draft 未确认不落库；测试和生产均不得用 Mock success 冒充真实能力。

七、Claude Code token 与错误恢复

优先把高 token 工作交给 Claude：跨目录调用链、长 diff、测试矩阵、真实 Chrome/Runtime runner、六视频/12 页 run、长日志分析、evidence/seal/package 和独立逐文件复算。Codex 不重复全仓扫描，只抽查关键源码、原始 payload、进程归零和门禁结论。

Claude 每次只接一个冻结子阶段；上下文接近上限或套餐重置前先写 checkpoint。429/529：立即停止新增请求，记录最后完整动作、diff、测试、run、PID/端口和 nextSafeAction；可做离线文档/测试，不能拼接部分 run。422：确认是工具输入还是产品 Provider；工具错误缩短/修正输入，产品错误脱敏保存 request hash/schema/error 并返回 adapter/合同，不得原样重试。恢复后先 capability probe，再从 checkpoint 继续，不从头扫仓。

高 token 工作必须优先交给 Claude 主干或审查窗口：跨目录源码追踪、长 diff、测试矩阵、真实 Chrome/Runtime、六视频/12 页、长日志、seal/package 和逐文件外审。Codex 负责冻结文档、计划纠偏、关键事实抽查和门禁，不重复消耗 token 扫描整仓。Claude 主干只执行当前已获授权范围；完整 goal 中列出 P1-P9 不等于授权这些阶段立即编码。

八、报告与停止

每个子阶段聊天只报告：状态、changed files、合同变化、测试与真实 run、PRD 覆盖、Fatal/Major/Minor、证据路径、cleanup/secret、下一门禁和自动化开发停止原因。不得粘贴秘密或大段日志。

当文档不足、缺授权、真实验收失败、Fatal/Major 未关闭、存在假绿或高风险阻塞时，停止实施并给出最近事实、证据、根因、备选路线与所需用户决定。否则持续推进当前已获授权且文档完整支撑的子阶段，直到该子阶段独立出门。
```

