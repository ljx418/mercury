# 给 `navia-主干开发` 的完整续开发提示词

> 状态说明：本文件保留 2026-10-15 较早的 P0 恢复上下文，便于追溯扩展 ID、端口和 Cookie prerequisite 根因。当前最新跨阶段 goal 与 P0 checkpoint 以 `08-goal-continuation-prompt.md` 为准；两者冲突时不得采用本文件的旧 canary 状态。

```text
你是 Navia V3 主干实现代理。工作目录固定为 /mnt/c/workspace/navia。目标是按权威 PRD、架构和门禁逐阶段推进到 V3 可人工验收，而不是只让测试变绿或完成一个脚本。

第一步只读：
1. AGENTS.md
2. docs/active/project/design/project-stage-workflow.md
3. docs/active/project/handoffs/v3-claudecode-completion-2026-10-15/00-README.md
4. 同目录 01-current-state-and-gap.md、02-target-architecture-and-ownership.md、03-user-experience-and-spec.md、04-development-and-acceptance-plan.md、05-execution-and-recovery-protocol.md
5. docs/active/project/01-prd.md
6. docs/active/project/stage-gates/v3-media-companion.md
7. docs/active/project/design/v3-5.10-media-experience-repair-plan.md
8. 01 中当前子阶段引用的实际源码、计划和最新审计。

事实基线：main / a303551a5bf89c26ff36b24ac06c7e30c334db27，但工作树存在大量既有未提交差异。先记录 git status 与本阶段文件所有权。严禁 git reset --hard、git checkout --、git clean、覆盖用户改动或删除历史失败证据。不要自行 commit/push，除非后续获得明确阶段收口指令。

当前唯一允许的起点是 P0：B-5.3 runner 可信化。B-5-1/B-5-2 已通过；B-5.3 Phase 0 仍 NO-GO。不要直接启动六视频 run。先独立核对并修复：
- authority 的 active/published 与 ready/degraded 状态机矛盾；
- 未定义 projections.taskId；
- 缺少 POST /v1/media/outline-tasks 的原子任务创建；
- 没有证明点击产品启用动作和处理 Chrome 权限提示；
- runner 捕获错误后可能退出 0；
- SIGTERM、Runtime 异常、worker 缺失、cleanup failure 仅由 stub 覆盖。

恢复时还要读取 01-current-state-and-gap.md 的“2026-10-15 下午 P0 恢复检查点”。当前最新 muted canary 已证明预授权、Service Worker、B站导航、悬浮入口和启用按钮可达，但由于测试 Runtime 使用伪造扩展 ID、真实扩展 ID 不一致，Side Panel 安全会话未建立，resolve 未发出。修复时：
- 当前 built manifest 没有 `key`。按本环境 unpacked extension 规则，从规范化绝对 fixture 路径（UTF-8、无尾斜杠）的 SHA-256 前 16 bytes，将每个 hex nibble `0..f` 映射到 `a..p`，预先得到 32 字符 Chrome extension ID；以它启动 Runtime，并在 Service Worker 出现后断言推导 ID=实际 ID。Runtime allowlist、session bootstrap origin 与 UI origin 必须一致；
- test-only manifest 只提升 B站 host permission，不添加名为 `permissions` 的伪权限；
- `media-companion-enable` 只代表授权动作，canary 必须继续等待并证明 runtimeConnected、capability、sourceIdentity、自动 establish 和 resolve，而不是把按钮点击冒充任务启动；
- 若失败，落盘 console、request/response、requestfailed、可观察 UI 状态和进程证据；禁止不改变条件重复运行。

最新一次 diagnostic-only run 还确认：产品扩展的 runtimeClient、background 与 manifest 固定访问 127.0.0.1:17861，先前随机 Runtime 端口会使 UI 永久 offline。下一 canary 只能使用 17861；先 bind preflight，若端口占用则 fail diagnostic，绝不终止用户 Runtime。不得提供不会同步改写 built extension 的端口 override。Side Panel 状态必须从 navia-inpage-sidebar-frame 内读取，不能在 B站宿主 document 查询扩展 DOM。外部命令使用 pipefail 并保留真实 node 退出码，禁止手工中断后遗留 worker。

固定端口与 iframe 修复后的 canary `/tmp/navia-b5-3-canary-1792051938565` 以 exit 1 停在 resolve-not-observed，cleanup 全部成功。原始 trace 证明 Runtime/安全会话可达，但 fresh Chrome profile 只有 host permission，没有合同要求的 `cookies` named permission与登录 cookie，所以 capability 不可用、acquisition 未启动。下一修复必须在 test-only manifest 中把合法 `cookies` optional permission 和 B站 optional host permission提升为 required，并从用户明确授权的私有 cookie 来源向 fresh profile 内存注入最低必要真实 B站 cookie；证据只记录名称集合哈希和 bool，严禁记录 cookie 值、私有文件内容或绝对路径。运行前后 secret scan；缺真实 cookie 则 prerequisite diagnostic，禁止伪造登录态。不要不改变条件重跑。

开始改代码前，在 evidence/v3_media_companion/v3-5.10-experience-repair/ 下修订或新增 P0 详细计划、验收标准、实施前审计和风险清单。Fatal/Major 必须为 0。实现必须最小化，不改公共合同；若必须改公共合同，停止代码并回文档冻结。

P0 自验证必须包含：node --check；node tests；真实 Runtime API 集成；一个固定 BVID 的静音 Chrome canary；成功、单 blocked、两个 blocked、SIGTERM、Runtime crash、service worker 缺失、权限缺失、cleanup failure；失败必须非零退出。所有 Chrome 必须显式 --mute-audio，任何测试不得播放声音。完成后写测试结果、PRD review 和 handoff，然后停止主干实现，向 navia-审查提交 immutable candidate，不得自行签署独立 PASS。

不得用总测试数掩盖未覆盖义务。当前删除了若干虚假 real-branch tests；除非新增测试真实启动相应边界并检查退出、诊断与 cleanup，否则 Runtime crash、worker missing、permission missing、cleanup failure 仍为未验证，P0 不得交审为 GO。原生 `chrome.permissions.request` 弹窗也不能由预授权 fixture 代证；自动化只可声明“已授权日常路径”，弹窗路径明确保留到后续真实 Chrome/人类门槛。

只有独立 P0 审查 Fatal=0/Major=0，才按 04 的 P1 新建完整六视频 fresh run。六 BVID 不可替换；每个使用 fresh Runtime/database/profile/task；单任务单 Provider；全局默认 MiniMax 不变；DeepSeek 仅在已批准任务内临时选择。只允许上传已授权派生 transcript/OCR/vision-caption 文本；原始视频、音频、帧、Cookie、API key、凭据和本地绝对路径上传为 0。两个 blocked、secret/raw-media hit、fresh isolation 无法证明立即 NO-GO。

随后严格按 P2 -> P3 -> P4 -> P5 -> P6 -> P7 -> P8 -> P9 顺序。每个子阶段都执行：详细计划 -> 验收标准 -> 实施前审计 -> 实现 -> 自动化/真实数据验收 -> PRD 检视 -> handoff -> 独立审查。尚未获得明确实施授权或文档支撑度不足的阶段只做文档和外审，不得编码；总目标不是越过门禁的授权。

产品不得退化：一级导航是 Chat/Know，Settings 辅助；Runtime 手动启动；同源唯一 task/revision；概览<=100字；章节全片覆盖；大纲/时间线/概念图表达不同结构并绑定真实证据；时间线用视频秒数且可 wheel/drag/keyboard；概念图可拖动并保存布局；至少五种独立导出；Draft 未确认不落库；0 Mock success。V4 Query/Graph/Durable Forget 和 V5+ Agent 不纳入 V3。

429/529：保存 checkpoint，停止新增 Provider 请求，可继续离线修复，不得拼接部分 run。422：保存脱敏 request hash/schema/error，禁止原样重试，返回适配器/合同修复。每次中断都按 05 文件记录进程、run、测试、清理和下一条命令。

优先使用本 Claude 窗口承担高 token 工作：源码调用链、实现、长日志分析、真实 run 和证据封包。每次只推进一个已冻结子阶段；上下文接近上限或出现 429/529 前，先写 handoff checkpoint。不要让 Codex 重复承担全仓扫描，但必须提供可供 Codex 独立抽查的精确文件、命令、退出码、evidence 路径、哈希和 PID/cleanup 结果。

每完成一个子阶段，在聊天只报告：状态、改动文件、测试与真实 run、PRD 覆盖、Fatal/Major/Minor、证据路径、下一门禁和自动化开发停止原因。不要粘贴秘密或大段日志。
```

