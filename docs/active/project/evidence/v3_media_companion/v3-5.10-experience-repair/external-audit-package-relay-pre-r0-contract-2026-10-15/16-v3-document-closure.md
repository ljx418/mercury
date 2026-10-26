# V3 完成阶段文档开发闭环

日期：2026-10-15。性质：架构、体验、开发与验收的统一索引；不代替 PRD、Stage Gate 或阶段授权，不把 P0-P9 一次性授权为可编码。

## 1. 文档目标与权威顺序

本轮不推倒既有 V3 设计，而是在原计划上补齐跨会话执行和最终收口。出现冲突时，按以下顺序判断：最新用户明确授权 > 当前 Stage Gate/独立审查 > `01-prd.md` > `02-architecture.md` > `03-development-plan.md` / `04-acceptance-plan.md` > 本交接包。历史失败 run、旧 seal 和 LIMITED PASS 保留，不能由新摘要覆盖。

当前唯一可继续实施范围是 P0 已授权修复。P1-P3 由 P0 独立出门解锁；P4-P7 现在只允许继续文档细化，分别完成 schema、fixture、开发计划、验收计划和独立文档审查后仍需明确实施授权；P8-P9 依赖前序同一 production candidate。

## 2. 完成态零层架构

```text
用户与页面
  -> PortalAdapter：识别页面、sourceIdentity、窄域权限、seek
  -> Side Panel：一个主动作、任务状态、Chat、KnowledgeDraft
  -> Workspace：概览 / 大纲 / 时间线 / 概念图 / 导出

本机 Runtime
  -> Secure Session：exact Origin、短期会话、系统凭据库
  -> SourceAuthority：sourceIdentity -> 唯一 taskId/revision
  -> Task FSM：获取、转写、grounding、发布、取消、恢复
  -> Acquisition：字幕 / 下载 / tabCapture / SenseVoice / OCR / 选帧
  -> Evidence Catalog：时间范围、哈希、私有原件、本机清理
  -> Comprehension：单 Provider、结构化候选、确定性降级、质量门
  -> Materializer：同 revision 原子发布 Derived Projection
  -> Knowledge Transaction：Draft 确认后才产生 Item
```

关键边界：UI、runner、renderer、Provider 均不是事实源；它们不得写成功状态或 KnowledgeItem。Runtime 保存任务和 projection 权威，Side Panel 是当前日常成功路径唯一 materialize 编排者。门户、Provider、ASR 和 renderer 均通过 adapter 扩展；B站验收结果不得外推到 YouTube 或小红书。

## 3. 架构实体、状态与剩余开发

| 实体/合同 | 当前状态 | 完成态职责 | 下一门槛 |
|---|---|---|---|
| `MediaPortalAdapter` / B站 adapter | LIMITED 基础 | 页面身份、窄域授权、seek receipt；其他门户独立 adapter | P0/P1 真实页面与权限证据 |
| Runtime secure session / vault | 实现候选 | exact-Origin、安全会话、MiniMax 默认、DeepSeek 手动选择、密钥前端明文 0 | P7/P8 同 build 复验 |
| `SourceAuthority` / `task_store.py` | Stage A LIMITED PASS | 同源唯一 task/revision、原子替换、旧 revision 隔离 | P0 terminal + 重启/故障证据 |
| Acquisition / SenseVoice / OCR / Vision | V3-2/3 LIMITED PASS | 单任务媒体获取、时间化证据、私有临时件 cleanup | P1 六视频 fresh run |
| Grounded Comprehension / QualityGate | B-5 候选 | <=100 字 brief、全片章节、claim/evidence、concept relation | P1-P3 内容与人类质量门 |
| Side Panel task effect | P0 当前重点 | 唯一 materialize 编排、状态/计时/取消/恢复 | 可信捕获到 terminal 的真实 canary |
| Workspace views | 基础候选 | 差异化概览、大纲、时间线、概念图、导出 | P4/P5 分工作包冻结与实现 |
| Knowledge Draft/Item | 候选，未正式出门 | 显式确认、幂等、冲突、CRUD、来源反跳 | P6 真实事务分母 |
| Collector / verifier / audit | 局部候选 | 同 build、fresh run、seal、secret/raw-media/path/cleanup | P7-P9 综合收口 |

## 4. 目标用户体验

首次使用只做一次扩展/本机伴侣安装、一次本机启动、一次 B站窄域授权和按需 Provider 凭据保存。日常打开页面与 Navia 后，只保留一个主动作“分析当前页/视频”；系统自动恢复权限、会话和同源权威任务。Chrome 安全边界要求的 tabCapture 用户调用可以收敛为一次明确动作，但不能被自动化或产品静默绕过。

处理过程中，顶部只展示当前任务、真实步骤、计时器、最近进展和取消/恢复动作；内部诊断折叠。超过 10 秒无变化显示“仍在处理”和最后进展时间，不伪造百分比。Runtime 到达 `ready|degraded|blocked|failed|cancelled` 后，Side Panel 与 Workspace 必须同步终态，黄色 busy 状态停止。

最终内容职责固定为：概览提供 <=100 字 VIDEO BRIEF、全片结构与主要论点；大纲按章节组织并绑定真实帧；时间线使用视频秒数并支持 wheel/drag/keyboard/seek；概念图展示有证据的概念/实体/论点关系并允许保存布局；导出提供至少五种结构和提示词真正不同的 artifact。Chat 实时反馈并可生成 KnowledgeDraft；Know 只管理用户确认后的真实 Item。V4 Query/Graph/Durable Forget 和 V5 Agent 不伪装为 V3 已实现能力。

## 5. 剩余阶段与开发/验收矩阵

| 阶段 | 开发目标 | 真实验收分母 | 当前许可 |
|---|---|---|---|
| P0 | 可信化单视频 runner，完成 trusted capture -> acquisition -> product materialize -> terminal；真实故障矩阵 | 固定 `BV1pohR6rEEh`、fresh Runtime/db/profile/task、`--mute-audio`、同 task/revision、secret/cleanup 0；crash/worker/permission/cleanup/SIGTERM 真实边界 | 实施中，出门 NO-GO |
| P1 | B-5.3 六视频 fresh 单序列质量 run | 六固定 BVID；每视频 fresh 隔离、单任务单 Provider；两个 blocked 立即失败 | P0 外审后 |
| P2 | B-5-4..7 cleanup、closure package、handoff、外审包 | 无秘密/原始媒体/绝对路径；seal 与 payload hash 可复算 | P1 后 |
| P3 | B-6 宿主 LLM 内容审查 + B-7 人类价值签署 | 事实、相关、概括、全片覆盖、章节平衡、截图/seek；人类不做听写 | P2 后 |
| P4 | Stage C 权威状态、计时、取消、重试、刷新与重启恢复 | 三视频 + Runtime kill/restart + 停滞 + cancel/retry；UI/Runtime terminal 一致 100% | 仅文档细化 |
| P5 | D1 brief/章节；D2 图文大纲/时间线；D3 概念图；D4 五种导出 | 每包至少三视频，D 总出门六视频；真实帧、相对时间、seek、布局、导出 artifact | 分包冻结后另授权 |
| P6 | V3-4.1 Chat/Know 事务闭环 | 取消 0 写入、重复确认 1 Item、revision 冲突、重启、删除、来源失效、Mock success 0 | 仅文档细化 |
| P7 | Stage E 同 production build 综合交互 | 六视频 + 普通网页 + Chat/Know + 四视口 + 键盘/滚动/Axe/性能/恢复/清理 | P4-P6 后 |
| P8 | V3-6 单一 12 页 production run | 原 `6+3+1+1+1` 分母 + Runtime 生命周期 + Chat/Know + 五导出；不可跨 run 拼接 | P7 后 |
| P9 | V3-7 独立复算、人类 H/CX、架构同步、报告、Git 收口 | Fatal=0/Major=0；H01..H10、B-7、CX-H01..CX-H06 人类签署 | P8 后 |

## 6. 每个子阶段的强制文档与证据

每个阶段或冻结工作包必须分别落盘：`development-plan.md`、`acceptance-plan.md`、`preimplementation-audit.md`、实现结果、结构化 verification、`prd-review.md`、`handoff.md` 和引用 immutable candidate 的独立审查。计划必须写明输入基线、所有权、合同变化、用户操作、正负例、FailureCode、固定分母、停止条件和回滚点。测试数量不能代替功能事实，headless fixture 不能代签原生权限或人类体验。

浏览器测试全部显式 `--mute-audio`。任何 visible Chrome/UIAutomation 会弹窗或抢占焦点时，先通知用户；测试结束清理由本轮创建且可证明所有权的 Chrome、Runtime、profile、端口和临时件。Cookie、API key、原始音视频、帧和私有绝对路径不得进入公开日志、证据包或聊天。

## 7. Claude Code 高 token 调度

`navia-主干开发` 优先承担跨目录调用链、长 diff、runner/collector、Node/Python 矩阵、真实 Chrome/Runtime、六视频/12 页运行、日志定位、evidence/seal/package。每次只接一个已经冻结且获授权的子阶段，并在阶段开始、实现完成、测试完成、真实 run 完成和外审提交前更新 checkpoint。

`navia-审查` 只在主干生成 immutable candidate ID 后启动，承担逐文件哈希、schema/fixture、日志/payload、分母、隐私、cleanup 和实现边界的独立复算；除独立审查报告外不得修改实现。Codex 维护 PRD/架构/计划权威，抽查关键事实并做出门判断，不接受 Claude 自报 PASS 直接放行。

Claude 429/529 时停止重复长请求并记录最后完整动作、diff、命令退出码、run/PID/端口、cleanup 和 `nextSafeAction`；恢复后先做无私有数据 capability probe，再从 checkpoint 继续。Claude/工具 422 先缩短或修正工具输入；产品 Provider 422 记录脱敏 request hash/schema/error 后返回 adapter/合同。任何部分 run 不得跨重置拼接为验收结果。

## 8. 当前 P0 精确恢复点

最新 run `/tmp/navia-b5-3-canary-1792058113774` 已完成日常授权恢复、resolve、authority、capture card 和 arm，并读取/尝试 `open-navia-sidepanel` 与 `_execute_action`；二者均未触发 action count 增量或 durable capture，最终 `capture-command-not-observed`、exit 1、cleanup/secret 0。P0 combined Node suite 为 `131/131`。

Headless 路线已按冻结计划穷尽，禁止继续重跑。下一次真实 canary 必须使用既有 Windows UIAutomation helper 的 visible Chrome 单次 extension action，执行前先通知用户窗口/焦点影响并保持静音。MV3 测试计数可能因 worker 重启清零，因此真实 capture started 是更强证明。controller 直调、API 伪造 grant/transcript、runner 请求 materialize 或数据库写入均为假绿。

## 9. 文档准备度与结论

P0 文档可直接支撑下一实现切片；P1-P3 的顺序和分母完整，但要在 P0 出门后冻结 build/run/tool hash；P4 约 75%、P5 约 65%-72%、P6 约 70%、P7 约 70% 的文档准备度只代表方向可继续细化，不代表可编码。P8-P9 流程与固定分母清楚，但输入尚不存在。

结论：V3 仍有大量未实现或未出门内容，不能声明阶段完成。当前可持续 goal 是先关闭 P0；之后严格 P1 -> P9。每个阶段若文档不足、缺授权、真实验收失败、Fatal/Major 未关闭或出现假绿风险，应停止实现并返回文档/风险闭环，而不是跳到下一阶段。
