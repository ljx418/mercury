# V3 全部剩余开发与验收计划

本计划给出完整顺序，但不自动授予尚未批准阶段的代码实施权限。每阶段均执行：详细计划 -> 验收标准 -> 实施前审计 -> 实现 -> 自动/真实验收 -> PRD 检视 -> 独立出门审查。

## P0：B-5.3 runner 可信化

实现：关闭 `01` 中六项缺陷；建立明确的 authority polling、outline task 创建、原子 publish、非零失败退出、SIGTERM cleanup 和 Chrome 启用/权限自动化。

验收：node contract tests；真实 Runtime API 集成；一个固定 BVID 的静音 Chrome canary；成功、blocked、两个 blocked、Runtime crash、worker 缺失、permission 缺失、cleanup failure。测试必须证明真实分支，不只验证 stub。

P0 的真实 Chrome canary 采用两层门槛：

1. 自动化层允许只在临时扩展副本中，把 B站合同要求的 `cookies` optional permission 与 optional host permission 提升为 required，证明日常已授权路径；产品 manifest 不得修改，也不得扩大到合同外权限。测试必须使用真实扩展 ID 绑定 Runtime，断言 Service Worker、permission state、Runtime 安全会话、`resolve`、source authority、outline task 和最终 `ready/degraded`，并保存失败诊断。
2. Chrome 原生权限弹窗不由 headless 预授权 fixture 证明。若当前宿主无法可靠驱动原生弹窗，必须明确标成未测并保留到后续真实 Chrome/人类权限门槛，不能写成自动化 PASS。

局部 test 数量不能替代分支事实。删除虚假的 Runtime crash/worker/permission/cleanup 测试是正确纠偏，但对应门槛仍须由真实子进程、真实 Runtime 或可复算的隔离故障实现关闭；否则 P0 保持 NO-GO。

预授权 fixture 还必须把 B站合同要求的合法 `cookies` optional permission 提升为 required；fresh profile 使用用户已授权的私有真实 cookie 注入，只能在测试进程内存和该 profile 内存在。公开证据仅允许保存名称集合哈希、permission bool、能力结果和 route，不得保存 cookie 值或私有来源路径。缺少真实 cookie 时 prerequisite fail，不得伪造登录态。

出门：Phase 0 独立报告 Fatal=0/Major=0；不产生六视频 PASS。

## P1：B-5.3 六视频 fresh run

固定 BVID：`BV1pohR6rEEh`、`BV1hMpE6FEXG`、`BV1VHHe6kEH3`、`BV1SDHy6aEiB`、`BV1vSHD6tEsM`、`BV1FCps68EGf`。

每个样本必须使用 fresh Runtime/database/profile/task，Chrome `--mute-audio`，单任务单 Provider。保存任务状态、route、receipt、派生文本哈希、evidence closure、quality checks、secret/raw-media/path scan 和 cleanup。两个及以上 blocked 立即 NO-GO。

## P2：B-5-4..B-5-7

- B-5-4：验证所有 Chrome/Runtime/profile/temp/media/cache/task 清理。
- B-5-5：生成不含秘密、原始媒体或绝对路径的 closure package。
- B-5-6：落盘 implementation handoff、PRD 覆盖、合同变化、测试与风险。
- B-5-7：清空并重建 <=20 文件外审包，逐项 SHA-256，独立实施出门。

## P3：B-6/B-7 质量门禁

B-6 由宿主 LLM 对六视频逐项复核：事实正确、相关、概括性、全片覆盖、章节平衡、claim-evidence、截图匹配、seek 可用。结构化 schema PASS 不能替代内容正确。

B-7 只让人类判断内容价值、视觉层级和操作负担，不要求听写 ASR 或复算机器合同。B-7 前 Stage B 不得 PASS。

## P4：Stage C 状态与恢复体验

先冻结 state/progress/recovery 合同，再修改 Side Panel/Workspace。固定场景：正常完成、>10 秒无进展、Provider 慢、Runtime 断开、取消、重试、浏览器刷新、Runtime 重启、旧任务晚到。顶层仅显示最新状态、计时器和动作；终态同步后停止 busy；详细步骤按需展开。

## P5：Stage D 内容工作台

分四个可独立出门工作包：

1. D1 概览与章节：<=100 字 brief、全片章节、主要论点/依据。
2. D2 图文大纲与时间线：真实帧、稳定预览、相对时间、wheel/drag/keyboard、seek receipt。
3. D3 概念关系图：证据化概念/关系、拖动、缩放、布局保存、旧任务兼容。
4. D4 导出：至少五种风格、范围/图片/密度配置、独立 artifact、取消和错误恢复。

每个工作包均使用六视频中的至少三个不同内容/时长样本做新鲜验证；D 总出门再覆盖六视频。

## P6：V3-4.1 Chat/Know 正式出门

实现并验证 `ContextEnvelope -> KnowledgeDraft -> explicit confirmation -> KnowledgeItem`。固定负例：取消不落库、重复确认幂等、revision 冲突、Runtime 重启、来源失效、删除确认、0 Mock success、未确认写库为 0。

## P7：Stage E 综合交互

同一 production candidate build 验证六视频、普通网页、Chat/Know、Side Panel/Workspace 同 taskId 与共享 product revision、四视口、Axe serious/critical=0、键盘、性能、恢复和清理。此阶段产生供人类审阅的中文 HTML，但不能代签 H/CX。

## P8：V3-6 单一生产 run

保留原 12 页 `6+3+1+1+1` 分母，不因平台 route 漂移伪报字幕快路径。包含真实 OCR、授权 VLM、ASR、截图、故障、资源、隐私、cleanup、seal；追加普通网页、Runtime 手动生命周期、Chat/Know 事务和五种导出，不替换任何原分母。

## P9：V3-7 与阶段收口

独立复算 V3-6、H01..H10、V3-5.1/B-7、CX-H01..CX-H06。同步 Draw.io 到实际实现，生成最终中文可视化报告和最小人工路径。Fatal=0/Major=0 且人类签署完成后，才可限定声明 V3 PASS；随后按范围 Git 提交并同步项目进展。

## 各阶段强制交付物

每个 `P*` 或其冻结子阶段必须生成以下独立材料，缺任一项不得进入下一阶段：

1. `development-plan.md`：输入基线、文件所有权、实现步骤、禁止范围与回滚点。
2. `acceptance-plan.md`：用户场景、操作步骤、固定分母、正负例、FailureCode 和出门条件。
3. `preimplementation-audit.md`：PRD/架构/合同偏差，Fatal/Major 必须为 0。
4. 实现结果：changed files、合同变化或 `none`、真实数据来源、Provider/隐私边界。
5. `verification.json` 或等价机器结果：命令、退出码、版本、build/run/task ID、每项断言。
6. `prd-review.md`：逐项映射 PRD，禁止用测试数代替功能事实。
7. `handoff.md`：进程归零、cleanup、secret/raw-media/path scan、剩余风险和下一门禁。
8. 独立审查：引用 immutable candidate ID 和 payload hashes；实施者不得自签 PASS。

## 测试层级与证据强度

| 层级 | 能证明 | 不能替代 |
|---|---|---|
| 单元/合同测试 | 局部 schema、状态转换、错误映射 | 浏览器、Runtime、真实 Provider 行为 |
| Runtime API 集成 | 事务、authority、幂等、重启 | 扩展权限和真实用户点击 |
| 隔离故障测试 | crash/signal/cleanup/fail-closed | 正常真实内容质量 |
| 静音 Chrome canary | 单视频实际入口、连接、任务和终态 | 六视频质量与原生权限弹窗 |
| 六视频 fresh run | 内容路线、覆盖与稳定性 | 人类价值判断 |
| 宿主 LLM 复核 | 事实、概括、结构、证据关系 | 人类视觉与操作体验 |
| 人工验收 | 可用性、价值和认知负担 | secret scan、schema、清理复算 |

## 停止与打回规则

- 同一重大故障在真实验收中重复出现，停止重复运行，回到开发计划定位根因。
- 任何 run 出现跨 run 拼接、秘密/原始媒体/绝对路径泄露、两个及以上 blocked、非 owned 进程清理或缺 seal，立即 NO-GO。
- UI 显示完成而 Runtime 非终态、或 Runtime 终态而 UI 长期 busy，视为状态合同 Major，不得降为视觉 Minor。
- 内容 schema 合法但事实错误、只覆盖首分钟、截图不匹配或章节严重失衡，视为 B-6 Major。
- 文档支撑度不足的 P4-P7 必须先补冻结文档和外审，不能凭总目标直接编码。

## 文档准备度

| 范围 | 当前支撑度 | 开发前动作 |
|---|---:|---|
| P0 | 85% | 修订 Phase 0 文档并独立复审 |
| P1-P3 | 80% | P0 出门后冻结当次 run/tool hashes |
| P4 | 70% | 补状态 schema、fixture、原型和实施授权 |
| P5 | 65% | D1-D4 分别冻结组件/数据/验收合同 |
| P6 | 65% | 核对现有候选与收敛 PRD，补真实事务分母 |
| P7 | 70% | 以上阶段出门后冻结同 build E2E |
| P8-P9 | 80% | 冻结 collector/verifier/build 与人工 submission |

比例是工程准备度，不是门禁结论。没有详细计划和 Fatal=0/Major=0 实施前审计的阶段，只能继续文档开发。

## P0 最新执行切片（不得跳过）

| 顺序 | 动作 | 验收 | 停止条件 |
|---|---|---|---|
| P0.1 | 提取 outline 响应 task ID 的单一 helper，兼容公共 camelCase 与历史内部 snake_case | 合同测试覆盖有/无/冲突字段；缺字段非零退出 | 不改公共 API |
| P0.2 | 审查 Side Panel `materializeCurrentMediaTask` effect 与 authority projection 依赖 | 写出真实调用时序和唯一编排所有者 | 发现 runner 需要私造状态则回文档 |
| P0.3 | 对齐 create -> materialize -> ready/degraded | Python/Node Runtime 集成真实迁移 | 两个编排者竞争、task 分裂 |
| P0.4 | 单次 muted Chrome canary | resolve、同 task、materialize、terminal、seal、cleanup、secret=0 | 条件未改变禁止重跑 |
| P0.5 | 真实故障边界 | crash/worker/permission/cleanup failure 均驱动真实子进程/边界 | 任一仅由 stub/summary 证明 |
| P0.6 | immutable candidate + 独立审查 | Fatal=0/Major=0 | 未审不得启动 P1 |

### P0 2026-10-15 编排纠偏后的执行计划

1. **P0.2a 文档冻结**：Side Panel effect 是唯一 materialize 编排者；runner 不再手工创建/物化成功路径。Runtime API 的 create/authority 幂等性保留独立集成验证。
2. **P0.3a runner 修复**：在 `awaiting_trusted_capture` 时等待并点击真实 `media-capture-start`，采集达到冻结最小时长后点击 `media-capture-finish`；不得通过 API 私造 grant、projection 或 transcript。
3. **P0.3b 请求与状态观测**：记录但不泄密地证明 acquisition projection `succeeded`、Side Panel 发出 `materialize-visual`，必要时发出同一 effect 的基础 `materialize` fallback，最终 task 与 authority ID 相同。
4. **P0.4 单次真实 canary**：固定 `BV1pohR6rEEh`，fresh Runtime/database/profile/task，产品端口 `17861`，显式 `--mute-audio`；验证 terminal、UI、seal、cleanup 和 secret=0。条件未改变不得重跑。
5. **P0.5 真实故障矩阵**：独立驱动 Runtime crash、worker missing、permission missing、cleanup failure 和 SIGTERM；每项要求真实子进程或真实边界、非零退出、typed diagnostic、owned PID/端口/profile/task 归零。
6. **P0.6 封存与外审**：更新 test results、PRD review、handoff、diff/build/run/payload hashes；生成 immutable candidate 后主干停止，审查窗口只读复算。

P0 canary 固定断言：

- 不允许 runner 的成功路径直接请求 `/materialize` 或直接写 `media_tasks`；网络证据必须显示请求来自产品 Side Panel。
- `awaiting_trusted_capture` 不算 blocked；runner 必须执行可达的可信点击并继续。若控件缺失、user activation 不成立或 capture 失败，按精确 FailureCode 非零退出。
- acquisition `succeeded` 之前不能创建“成功” outline；`created` 不能被接受为 terminal。
- visual 失败允许产品按冻结合同回落为基础 `degraded`，但不能隐式换 Provider、补造截图或把失败隐藏为 `ready`。
- 全程无声音；原始媒体、Cookie、密钥、私有路径公开命中均为 0；cleanup 任一失败即整 run 失败。

## P4 Stage C 详细冻结大纲

开发前必须新增版本化 `MediaTaskActivityProjection`，至少包含 `taskId`、`sourceIdentity`、`revision`、`state`、`currentStep`、`startedAt`、`lastProgressAt`、`finishedAt`、`terminalOutcome`、`recoverableActions`。开发拆为：

1. C0 合同/fixture：正常、慢、停滞、断连、取消、重试、刷新、重启、旧任务晚到。
2. C1 Runtime 投影：所有状态单调，terminal 后不再更新 busy；取消与重试经过 cleanup barrier。
3. C2 Side Panel：顶部一张状态面，只显示最新任务、计时、步骤、主动作；内部诊断折叠。
4. C3 Workspace：与 Side Panel 保持同 taskId 与共享 product revision，完成后自动刷新内容，不依赖切路由。
5. C4 恢复：刷新/重启先恢复 authority；旧任务晚到被 revision fence 拒绝。
6. C5 真实验收：至少三视频 + Runtime kill/restart + 10 秒停滞 + cancel/retry。

出门：UI 与 Runtime terminal 一致率 100%；完成后呼吸灯停止；用户 10 秒内始终能观察到状态或停滞说明；Fatal=0/Major=0。

## P5 Stage D 详细冻结大纲

### D1 概览与章节

- 输入：同 revision 的全片 transcript/OCR/caption/evidence catalog。
- 输出：<=100 中文字符 brief、全片结构、claims、grounds、章节边界、证据充分性。
- 质量：首分钟复制率、章节覆盖率、章节长度极端失衡、无证据 claim 均 fail-closed 或 degraded。

### D2 图文大纲与时间线

- 大纲按“综述 -> 章节 -> 关键依据”组织，真实帧带时间和 evidence ID。
- 时间线使用视频秒数；wheel/drag/keyboard/zoom/seek 均有自动化和真实浏览器证据。
- 多帧可堆叠，焦点/展开不引起明显闪跳；无帧显式披露而非补造。

### D3 概念关系图

- 内容 schema 为 concept/entity/claim/relation/evidence，不固定章节树。
- 推荐可逆引入 React Flow 或 Cytoscape；布局与视口只存 UI，事实节点/边由 Runtime projection 提供。
- 验证拖动、缩放、fit、折叠、布局保存、旧 schema fallback、证据反跳和无障碍。

### D4 导出

- 五种 prompt-distinct profile，用户选择范围、篇幅、图片和引用密度。
- 每次导出独立 artifact；支持取消、重试、下载；失败不污染 grounded projection。
- 云端策略仍是单任务单 Provider，只上传已授权派生文本；原始媒体、Cookie、密钥、本地路径为 0。

## P6 Chat/Know 详细冻结大纲

1. 版本化 Draft/Item schema 与 transaction API；Draft 和 Item 使用不同 ID/状态。
2. Chat 实时反馈、会话新建/单删/全清、Provider 配置持久与失败分类。
3. Draft 预览/编辑/取消/确认；确认使用 idempotency key 与 expected revision。
4. Know Item 列表、详情、编辑、排序、归档、删除、来源反跳与 Runtime 重启恢复。
5. 正例和负例均使用真实本地 Runtime；Mock success 计数必须为 0。

出门分母至少包括：取消 0 写入、重复确认 1 Item、并发冲突可见、重启一致、删除确认、来源失效、Provider 密钥前端明文 0、Chat/Know 同 source/revision。

## P7-P9 验收与收口细化

- P7 只接受同一 production build 的综合交互结果；四视口、键盘、滚动、Axe、恢复、普通网页和六视频缺一不可。
- P8 只接受一个完整 12 页 production run；缺 seal、跨 run 拼接、两个 blocked、secret/raw-media/path hit 或 cleanup 不完整立即 NO-GO。
- P9 先独立复算，再进行人类 H/CX。人类只判断体验和内容价值，不能补写机器测试结果。
- 最终 Draw.io/HTML 报告必须区分已验收、受限完成、规划中和 No-Go；只有实际代码和证据达成的实体可标绿。

## Claude Code 与 Codex 的工作量分配

| 工作 | 默认执行者 | 原因 |
|---|---|---|
| 跨目录调用链、长 diff、runner/collector 实现 | Claude 主干 | 高 token、适合持续源码上下文 |
| Node/Python 大测试矩阵、真实 Chrome/Runtime run | Claude 主干 | 日志长、需要即时修复 |
| 六视频与 12 页 evidence/seal/package | Claude 主干 | 长运行与大量证据 |
| 外审包逐文件 hash、fixture/schema/日志独立复算 | Claude 审查 | 高 token 且需独立上下文 |
| PRD/架构/阶段边界、计划纠偏 | Codex | 维护单一规格权威 |
| 关键事实抽查、假绿识别、出门判断 | Codex | 不采信实施者自报 |
| 人类 H/CX 操作和签署 | 用户 | 不可由 Agent 代签 |

Claude 每次只接一个冻结子阶段。P0 外审完成前，不向 Claude 提交 P1-P9 的实现请求；可以并行做后续文档审查，但不得改同一代码文件或提前生成通过证据。

## P0 v10 当前执行替换条款

本节替换上文 P0.1..P0.6 中“可直接继续 runner 修复”的旧执行入口，但不删除历史事实。v10 单次 Codex 独立文档审查 Fatal=0/Major=0 后，按用户既有实际开发授权执行 R0..R7：

| 子阶段 | 实施目标 | 自动验收 | 停止条件 |
|---|---|---|---|
| R0 | 落地 v10 TypeScript/Python 内部合同、ASR owner manifest 原子发布/父目录 fsync/SQLite FULL receipt/recover composite cleanup、11-scope 推导的 40 source/20 target 完备分类、中央 registry/semantic AST scan、四递归 root + non-relay allowlist、Chrome 116 manifest | 50/50、15/15；RLY10-N01..N30 + OM10-N01..N08；imported enum 与 receipt 破坏均结构化 exit 2 | 任一需改公共 API/schema |
| R1 | Background transport、同步 staging handoff 与最佳努力通知 | finalize/create/before-stage 由 handler 清理；stage 后由 transcript service 清理；completed 发送失败不宣称产品成功；SQLite 终态决定 published/abandoned | worker 在 stage 前启动；双 cleanup owner；内存成功冒充持久成功 |
| R2 | Offscreen 纯 producer、可信 Port、Base64/credit/bounded queue | 网络调用 0；sender/context、sequence、length、overflow 全覆盖 | 弱 sender 校验或无界缓存 |
| R3 | Controller 唯一编排、两阶段 stop、phase marker | 24 步主链逐步可观测；idle/error 关闭 offscreen | 第二编排者或旧 session 续传 |
| R4 | Runtime/worker 恢复与真实故障矩阵 | connecting DELETE+GET；alive finally+GET；hard crash recover；GET404 pending | owner 不可达或 marker 伪造成功 |
| R5 | 单视频真实 visible muted Chrome canary | 非空 PCM -> SenseVoice -> acquisition -> materialize -> ready/degraded；taskId/sourceIdentity 一致，各 revision 域单调且 product fence 一致 | 条件未改变重复 run；任何声音播放 |
| R6 | permission/ticket/sender/backpressure/restart/crash/cancel/SIGTERM/cleanup | 每项真实边界、typed code、owned resource 0 | stub/summary 替代真实事实 |
| R7 | immutable candidate、PRD review、seal、secret/cleanup、独立审查 | Fatal=0/Major=0，manifest/hash 可复算 | 未审或证据拼接 |

R7 之前 P1-P9 均保持阻塞。用户已批准实际开发；v10 单次 Codex 独立文档审查通过后即可实施 R0-R7。

