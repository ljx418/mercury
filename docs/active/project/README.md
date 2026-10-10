# Navia V1 Active Project Documentation

> 当前 V3 产品收敛入口：`design/v3-chat-know-product-convergence.md`。目标原型：`design/v3-chat-know-target-review.html`。L0 架构：`design/v3-chat-know-l0-architecture.html`。V3 只以 Chat/Know 为一级产品域，Runtime 手动启动，Agent 延至 V5+。

本目录只保留当前仍然激活的项目级 V1 / V1.2 / V1.3 / A-V1.2 开发入口、公共合同、工作区说明和验收门禁。

模块级开发文档已统一移动到：

```text
docs/active/modules/
```

过期、已完成、未继续激活或仅作历史追溯的文档已移动到：

```text
docs/history/
```

## 当前阶段

当前项目焦点已完成 `V1.3 Evidence Card Mindmap`、`V1.4 Reading Map`、`V1 current interaction baseline` 与 `V1 Gemini Style Pass` 的自动化验证。当前阶段为 `V1 Launcher / Collapse / Resize Interaction`：在不改变 Runtime 合同、不新增 AI 能力的前提下，把 Gemini 原型中的 floating launcher、折叠、resize、拖拽和 push / overlay 状态机落到真实 content script 外层交互。`A-V1.2 Production Page Perception` 仍作为 A 模块长期质量门槛：

```text
真实网页
+ Chrome 原生右侧 Side Panel
+ A 高质量网页感知 / QualityReport / SourceRef
+ C digest-first Mindmap / nodeSourceMap / source fallback
+ D Artifact / Event / Trace 映射
+ B Evidence Card Mindmap 主渲染
+ source evidence panel
+ selected / hover / neighbor highlight
+ selector / domPath / textQuote 定位
+ 真实 Chrome 截图级 DOM highlight 或 fallback evidence
```

`V1.2-AC-Native`、`V1.2-AC-Quality`、`V1.2-AC-Jumpback MVP`、`V1.2-Closeout`、`V1.3`、`V1.4`、`V1 current interaction baseline` 与 `V1 Gemini Style Pass` 已形成阶段证据。当前阶段通过后只允许声明 `V1 launcher / collapse / resize interaction baseline complete`，不得声明完整 V1 complete、Canvas Knowledge Map complete、V2 Memory / RAG ready 或 V4 Web Research / PPT / Deep Research ready。`A-V1.2-1+` 若继续推进，仍必须遵守 `A-V1.2-0` 合同冻结门槛。

## 激活文档

| 文件 | 用途 |
|---|---|
| `01-prd.md` | 当前 PRD：产品定位、V1/V1.2/A-V1.2 目标和边界 |
| `02-architecture.md` | 当前目标架构：Runtime、Chrome Extension、A/B/C/D 模块和 A-V1.2 感知层架构 |
| `03-development-plan.md` | 当前开发计划：V1.2 模块化开发和 A-V1.2 子阶段计划 |
| `04-acceptance-plan.md` | 当前验收计划：V1/V1.2/A-V1.2 验收门槛和 No-Go |
| `05-codex-alignment-checklist.md` | Codex 开工、PR、验收前的对齐清单 |
| `06-api-contract.md` | V1 API 与事件合同 |
| `07-data-models.md` | V1 / V1.2 核心数据模型 |
| `10-v1-stage-gate-execution-protocol.md` | 阶段门禁执行协议 |
| `12-interaction-prd-authority-and-revised-plan.md` | 前端交互 PRD 权威口径 |
| `interaction-prd/` | 当前前端交互 PRD 包：窗口、输入框、设置、思维导图 |
| `AGENT_ONBOARDING.md` | 外部 Agent 上手指南 |
| `V1_2_AGENT_WORKPACKS.md` | V1.2 A/B/C/D/Integration 工作包 |
| `MODULE_VERSIONING.md` | 模块内部编号规则，当前 A 模块阶段为 `A-V1.2` |
| `MODULE_HANDOFF_TEMPLATE.md` | 模块交接模板 |
| `HANDOFF_2026-06-22_CROSS_MACHINE_RECOVERY.md` | 跨机器恢复手册：远端仓、最小恢复步骤、当前阶段上下文和新 Codex 接手提示词 |

## 当前合同

| 文件 | 用途 |
|---|---|
| `contracts/v1_2_adapter_contracts.md` | V1.2 Adapter、结构化上下文、A-V1.2 公共输出合同 |
| `contracts/a_v1_2_page_perception.schema.json` | A-V1.2 网页感知 JSON Schema |
| `contracts/a_v1_1_high_signal.schema.json` | 仍被当前 runtime/tests 使用的 A 高信号兼容合同；不要归档或删除 |
| `contracts/agent-event.schema.json` | AgentEvent Schema |
| `contracts/api-response.schema.json` | API response envelope Schema |
| `contracts/page-context.schema.json` | PageContext Schema |
| `contracts/tool-result.schema.json` | ToolResult Schema |
| `contracts/v1_2_closeout_report.schema.json` | V1.2-Closeout 最终验收报告 Schema |
| `contracts/samples/` | 当前合同样例 |

## 当前设计文档

| 文件 | 用途 |
|---|---|
| `design/v1.2-ai-reading-modular-architecture.md` | V1.2 AI 伴读 A/B/C/D 模块目标架构 |
| `design/v1.2-ai-reading-workspace-partition.md` | V1.2 工作区划分与跨模块变更规则 |
| `design/v1.2-module-local-design-package.md` | 模块内深度设计文档包索引 |
| `design/v1.2-automation-readiness-gap.md` | V1.2 自动化开发就绪度 Gap |
| `design/v1.2-prd-coverage-matrix.md` | V1.2 PRD 覆盖矩阵 |
| `design/v1.2-integration-contract-matrix.md` | V1.2 Integration 合同矩阵 |
| `design/v1.2-ai-reading-automation-gap.md` | V1.2 项目级 drawio companion：当前实现、目标架构、目标功能形态、阶段划分和最终用户体验路径 |
| `design/v1.2-ai-reading-automation-gap.drawio` | V1.2 项目级目标架构总图：A/B/C/D、Runtime、Side Panel、最终网页内体验，以及 Memory Plane、Tool / Skill / MCP Plane、Cloud Plane 预留位置 |
| `design/v1.2-a-page-perception-gap.md` | A-V1.2 Draw.io companion |
| `design/v1.2-a-page-perception-gap.drawio` | A-V1.2 专属 gap 图谱 |
| `design/v1.2-ac-native-sidepanel-gap.md` | V1.2-AC-Native 原生 Side Panel gap 图谱说明 |
| `design/v1.2-ac-native-sidepanel-gap.drawio` | V1.2-AC-Native 目标架构、差异、计划和验收图谱 |
| `design/v1.2-ac-native-sidepanel-readiness-audit.md` | V1.2-AC-Native 开发前 readiness 审计 |
| `design/v1.2-ac-quality-hardening-gap.md` | V1.2-AC-Quality A/C 质量深化 drawio 说明 |
| `design/v1.2-ac-quality-hardening-gap.drawio` | V1.2-AC-Quality 目标架构、差异、计划和出门门槛图谱 |
| `design/v1.2-ac-jumpback-mvp-gap.md` | V1.2-AC-Jumpback MVP 来源反跳 drawio 说明 |
| `design/v1.2-ac-jumpback-mvp-gap.drawio` | V1.2-AC-Jumpback MVP 目标架构、差异、计划和出门门槛图谱 |
| `design/v1.2-closeout-gap.md` | V1.2-Closeout 收关 drawio 说明 |
| `design/v1.3-evidence-card-mindmap-gap.md` | V1.3 Evidence Card Mindmap drawio 说明 |
| `design/v1.3-evidence-card-mindmap-gap.drawio` | V1.3 Evidence Card Mindmap 目标架构、差异、开发计划、验收门槛、长期规划图谱 |
| `design/v1.3-evidence-card-mindmap-development-acceptance-plan.md` | V1.3 Evidence Card Mindmap 详细开发与验收执行计划 |
| `design/v1.3-evidence-card-mindmap-readiness-audit.md` | V1.3 Evidence Card Mindmap 开发前 readiness 审计 |
| `design/v1-current-component-baseline.md` | V1 当前组件开发前基线：组件清单、实现状态、Gemini UX 回流边界 |
| `design/v1-gemini-style-pass-gap.md` | V1 Gemini Style Pass gap companion：当前/目标架构、开发计划、验收门槛和出门条件 |
| `design/v1-launcher-resize-interaction-gap.md` | V1 launcher / collapse / resize 交互架构 gap companion |
| `design/v1-gemini-style-pass-gap.drawio` | V1 Gemini Style Pass 中文 drawio：目标体验、架构差异、计划、里程碑、验收门槛、No-Go |
| `design/gemini-v1-frontend-prototype/` | Gemini V1 前端原型审查包与 UX review HTML |
| `design/a-v1.2-contract-freeze-readiness-audit.md` | A-V1.2-0 合同冻结 readiness 审计 |
| `design/v1.2-readiness-closure-audit.md` | V1.2 readiness 收口审计 |
| `design/adr-v1.2-agent-core-provider-piagent.md` | D 模块 CoreProvider / piAgent ADR |

## 当前 Stage Gates

| 文件 | 用途 |
|---|---|
| `stage-gates/v1.2-0-ai-reading-contract-and-workspace-freeze.md` | V1.2-0 合同与工作区冻结 |
| `stage-gates/v1.2-a-page-reading.md` | A 模块工作区门禁 |
| `stage-gates/v1.2-a-v1.2-production-page-perception.md` | A-V1.2 高质量网页感知层门禁 |
| `stage-gates/v1.2-ac-page-perception-mindmap-bridge.md` | V1.2-AC A 高信号主链路与 C Mindmap 联动门禁 |
| `stage-gates/v1.2-ac-native-sidepanel.md` | V1.2-AC-Native 原生 Side Panel 体验稳定化门禁 |
| `stage-gates/v1.2-ac-quality-hardening.md` | V1.2-AC-Quality A/C 质量深化与真实网页扩展门禁 |
| `stage-gates/v1.2-ac-jumpback-mvp.md` | V1.2-AC-Jumpback MVP 来源反跳最小闭环门禁 |
| `stage-gates/v1.2-closeout.md` | V1.2-Closeout 收关与生产级完成声明门禁 |
| `stage-gates/v1.3-evidence-card-mindmap.md` | V1.3 Evidence Card Mindmap 体验升级门禁 |
| `stage-gates/v1.4-reading-map.md` | V1.4 Reading Map 体验升级门禁 |
| `stage-gates/v1-current-baseline-closeout.md` | V1 当前交互基线收口门禁 |
| `stage-gates/v1-component-baseline.md` | V1 组件开发前基线门禁 |
| `stage-gates/v1-gemini-style-pass.md` | V1 Gemini Style Pass 样式、按钮、状态反馈落地门禁 |
| `stage-gates/v1-launcher-resize-interaction.md` | V1 launcher / collapse / resize 真实 content script 交互门禁 |
| `stage-gates/v1.2-b-chat-renderer.md` | B Renderer 门禁 |
| `stage-gates/v1.2-c-mindmap.md` | C Mindmap 门禁 |
| `stage-gates/v1.2-d-agentic-loop.md` | D CoreProvider / Adapter 门禁 |
| `stage-gates/v1.2-e-integration.md` | Integration 门禁 |

## 当前 Evidence / Fixtures

| 路径 | 用途 |
|---|---|
| `fixtures/real_pages/` | V1 / A 模块真实页面 fixture |
| `evidence/v1.2-e-chrome-inpage-e2e.json` | V1.2 Integration 历史 E2E evidence，当前仅作参考 |
| `evidence/v1_2_ac/native-sidepanel-ux/report.json` | V1.2-AC-Native 原生 Side Panel 自动化验收 JSON |
| `evidence/v1_2_ac/native-sidepanel-ux/acceptance-report.html` | V1.2-AC-Native 人类可读验收报告 |
| `evidence/v1_2_ac/native-sidepanel-ux/false-green-audit.md` | V1.2-AC-Native false-green 审计 |
| `evidence/v1_2_ac/native-sidepanel-ux/chatgpt-audit-closure.md` | V1.2-AC-Native ChatGPT 审计意见闭环与阶段声明边界 |

V1.3 验收证据目标路径：

```text
docs/active/project/evidence/v1_3_evidence_card_mindmap/report.json
docs/active/project/evidence/v1_3_evidence_card_mindmap/acceptance-report.html
docs/active/project/evidence/v1_3_evidence_card_mindmap/prd-review.md
docs/active/project/evidence/v1_3_evidence_card_mindmap/false-green-audit.md
docs/active/project/evidence/v1_3_evidence_card_mindmap/screenshots/
```

## 独立审查归档（按阶段）

只读静态审查、隔离诊断复现、文档方向复审的输出按其所属阶段归档在 evidence 目录下。审查者匿名 ID、审查日期、结论均在文首自报；本节仅作为索引，不重复结论。

| 阶段 | 路径 | 性质 |
|---|---|---|
| V2-PX / R1 实现期 | `evidence/v2_external_brain_productization/px-5/r0-independent-review.md` | 方案级独立只读审查（R0；2 名审查者） |
| V2-PX / R1 实现期 | `evidence/v2_external_brain_productization/px-5/r1-implementation-risk-stop-2026-09-09.md` | 主代理实现期风险与停止记录（含 R1-M1/M2/M3） |
| V2-PX / R1 实现期 | `evidence/v2_external_brain_productization/px-5/r1-independent-audit-2026-09-09.md` | 主代理独立只读审查 + 隔离诊断（F-1..F-10；六项 Major） |
| V2-PX / R1 实现期 | `evidence/v2_external_brain_productization/px-5/r1-backend-closure-audit-2026-09-09.md` | 用户授权"仅后端风险闭环"后的限定独立复审（103 passed；F-1..F-6 关闭） |
| V2-PX / R1 实现期 | `evidence/v2_external_brain_productization/px-5/resumption-evidence-audit-2026-09-09.md` | PX-5 中断恢复证据复核（5 组 Major） |
| V2-PX / T02.1 | `evidence/v2_external_brain_productization/px-5/t02.1-r2-production-input-recollection/independent-audit.md` | R2 重采的 raw/schema/collection 历史限定 PASS；T03 positive-base 资格已由后续实施期 Major 重开 |
| V2-PX / T03 风险停止 | `evidence/v2_external_brain_productization/px-5/t03-r3-semantic-reporting/t03-implementation-risk-stop-durable-forget-2026-09-12.md` | 12/12 条 Forget 重开缺少 `SOURCE_NOT_FOUND` 与 Source Library recovery；T03 停止并等待 T02.2 决策 |
| V2-PX / T02.2 | `evidence/v2_external_brain_productization/px-5/t02.2-durable-forget-recovery/independent-audit.md` | Durable Forget production-positive R2 input 限定 PASS；Fatal 0 / Major 0 / Minor 4；只允许更新 T03 实施前审计 |
| V2-PX / T03 Status 风险停止 | `evidence/v2_external_brain_productization/px-5/t03-r3-semantic-reporting/t03-implementation-risk-stop-status-contract-2026-09-13.md` | T03-4 拒绝旧 T02.2 的 7 条非法 `userAction=retry`；T03-0..3 限定 PASS，后续停止 |
| V2-PX / T02.3 自审 | `evidence/v2_external_brain_productization/px-5/t02.3-status-contract-recollection/self-audit-2026-09-14.md` | 用户授权同一代理自审；新 run 203 Status / 0 error、本地及公开包 34/34、Fatal 0 / Major 0 / Minor 1；仅放行 T03 恢复，不构成组织独立或产品签署 |
| V2-PX / T03 offline authority 停止 | `evidence/v2_external_brain_productization/px-5/t03-r3-semantic-reporting/t03-implementation-risk-stop-runtime-offline-boundary-2026-09-14.md` | T03-4 检出 T02.3 offline interval 内 1 个成功 Runtime response；撤回其正基线资格，T02.4 待批准 |
| V2-PX / T03 实现出门 | `evidence/v2_external_brain_productization/px-5/t03-r3-semantic-reporting/independent-implementation-exit-audit.md` | R3 production-candidate pipeline LIMITED PASS；Fatal 0 / Major 0 / Minor 5；Human/G7/final 仍 pending/false，只允许 T04 规划审计 |
| V2-PX / T04 实现出门 | `evidence/v2_external_brain_productization/px-5/t04-r4-snapshot-revalidation/independent-implementation-exit-audit.md` | R4-P 确定性重放 + R4-E 全新真实 Chrome LIMITED PASS；Fatal 0 / Major 0 / Minor 1；Human/G7/final 仍 pending/false，PX-6 前须关闭 `artifactRoot` 命名 Minor |
| V2-PX / T04.1 与 PX-6 文档冻结 | `evidence/v2_external_brain_productization/px-6/document-freeze/` | T04.1 全量重跑修复、PX-6 机器/人类/最终状态机、Schema、负例和两轮内部文档审计；代码实施仍 NO-GO |
| V2-PX / PX6-0..5 机器出门 | `evidence/v2_external_brain_productization/px-6/implementation/independent-implementation-exit-audit.md` | 候选 `px6-machine-exit-20260914t164500z` LIMITED PASS；Fatal 0 / Major 0 / Minor 0；A15/A16、H01..H07、Human/G7/final 仍 pending，PX6-7 fail-closed |
| V2-PX / H01-RDS 解阻 | `evidence/v2_external_brain_productization/px-6/implementation/h01-real-data-service-implementation-candidate-2026-09-15.md` | 真实 DS Runtime 候选与 B站锚点服务级复验；RDS-03/04 真实 Chrome 三入口仍 pending，不构成 H01/PX-6 PASS |
| V2-RKM 文档方向 | `evidence/v2_real_knowledge_maintenance/rkm-doc-readiness-review-2026-09-10.md` | 外部审计包第二轮独立复审（19 项哈希、Draw.io 结构、双仓协议、阶段依赖、假绿、过度承诺） |
| V2-RKM 文档修订 | `evidence/v2_real_knowledge_maintenance/rkm-doc-review-remediation-2026-09-10.md` | S-1..S-16逐项设计处置与保留验证义务；不改写原独立结论，不放行产品开发 |
| V2-RKM 分阶段审查 | `evidence/v2_real_knowledge_maintenance/rkm-staged-implementation-review-2026-09-10.md` | 两组独立多轮复核、详细工作包/验收卡、未交付机器合同与剩余门槛；19文件平铺包待ClaudeCode CLI复审 |
| V2-RKM round2原审查 | `evidence/v2_real_knowledge_maintenance/rkm-doc-readiness-review-round2-2026-09-10.md` | G-1..G-7发现与历史结论原文；错误的36项/阶段措辞由后续处置supersede |
| V2-RKM DOC-Closure处置 | `evidence/v2_real_knowledge_maintenance/rkm-doc-readiness-round2-remediation-2026-09-10.md` | 39项封闭注册表、唯一T01..10、G-1..G-7字段闭环及三组限定范围0/0/0复核；待外部CLI审查 |
| V2-RKM 风险再核查 | 同上文件第6节 | RC-01..04状态/调度、turn事务交接、离线撤销、Forget与恢复；图纸同步，新增修订仍待独立复审 |
| V3 Media Companion 文档冻结 | `evidence/v3_media_companion/document-freeze/` | B站受控 Cookie 主路径、公开字幕/tabCapture 回退、PRD/架构/合同 v2/确定性原型/8 页 Draw.io/clean-commit allowlist；V3-0 文档已通过，后续按子阶段实施门禁推进 |
| V3 Media Companion / V3-1.1 | `evidence/v3_media_companion/v3-1-page-session-baseline/independent-v3-1.1-implementation-audit.md` | B站页面 adapter、通用门户接口与窄域入口外部 LIMITED PASS；12/12 真实 Chrome、15/15 verifier；Fatal=0/Major=0/Minor=0，Cookie/session 与 V3-2+ 未实现 |
| V3 Media Companion / V3-1.2 文档 | `evidence/v3_media_companion/v3-1-page-session-baseline/independent-v3-1.2-document-audit.md` | 通用 PortalSession 接口、B站独立 Cookie 策略、optional permission 与真实登录/匿名验收文档 PASS；Fatal=0/Major=0/Minor=3；高风险实施已获用户明确授权 |
| V3 Media Companion / V3-1.2 历史会话阻塞 | `evidence/v3_media_companion/v3-1-page-session-baseline/v3-1.2-server-session-risk-stop-20260917.md` | 历史 `code=-101` 阻塞已由有效新会话 run 关闭；保留为失败证据，不再是当前门禁 |
| V3 Media Companion / V3-1.2 历史停止 | `evidence/v3_media_companion/v3-1-page-session-baseline/v3-1.2-v3-1.1-sample-drift-risk-stop-20260917.md` | 历史匿名字幕漂移风险保留；当前由 V3-1R 独立登录态证据类关闭候选，不再作为现行状态 |
| V3 Media Companion / V3-1R 本地候选 | `evidence/v3_media_companion/v3-1-page-session-baseline/v3-1r-authenticated-regression-acceptance-result.md` | 当前 12/12、18/18 verifier、顶部隐私裁剪、秘密零命中；已由独立出门审计复核 |
| V3 Media Companion / V3-1R 独立出门 | `evidence/v3_media_companion/v3-1-page-session-baseline/independent-v3-1r-implementation-exit-audit.md` | Fatal=0/Major=0；V3-1.2 QUALIFIED PASS；统计口径 Minor 已关闭；只允许进入 V3-1.3 文档阶段 |
| V3 Media Companion / V3-1.3 文档外审 | `evidence/v3_media_companion/v3-1-page-session-baseline/independent-v3-1.3-document-audit.md` | Fatal=0/Major=0/Minor=2；DOCUMENT CONDITIONAL GO；等待 V3-1.3-0..7 用户高风险实施授权 |
| V3 Media Companion / V3-1.3 实施候选 | `evidence/v3_media_companion/v3-1-page-session-baseline/v3-1.3-7-acceptance-result.md` | 真实 Chrome/Runtime 28/28、A01-A20 20/20、四视口、Axe/键盘、撤销/过期/重启、12 页当前 build 回归与 raw-value 0 hit；已由后续独立实施出门审查复核 |
| V3 Media Companion / V3-1.3 外审请求 | `evidence/v3_media_companion/v3-1-page-session-baseline/v3-1.3-independent-implementation-audit-request.md` | 当前平铺 20 文件包的审查边界、唯一候选与输出路径；V3-2 implementation 仍 NO-GO |
| V3 Media Companion / V3-1.3 独立实施出门 | `evidence/v3_media_companion/v3-1-page-session-baseline/v3-1.3-independent-implementation-exit-audit.md` | Browser-to-Runtime credential transport PASS；Fatal=0/Major=0/Minor=3；仅放行 V3-2 详细文档与威胁建模，V3-2 implementation 仍 NO-GO |
| V3 Media Companion / V3-2 当前状态 | `evidence/v3_media_companion/v3-2-media-acquisition/` | SenseVoice development baseline、Runtime acquisition core、V3-2-2 Route B3 与 V3-2-3 已限定通过；V3-2-4 grant/Background/Offscreen/WebSocket/WAV/UI 已形成实现候选，但真实生产任务编排缺失，自动验收 FAIL 并进入 V3-2-4a 重规划；V3-2-5..7 保持阻塞 |
| V3 Media Companion / V3-3..7 第三轮文档外审 | `evidence/v3_media_companion/v3-3-7-independent-document-audit.md` | 19/19 hash、5/5 Schema、6/6 positive、10/10 包内和 4/4 独立语义负例通过；文档 Fatal=0/Major=0/Minor=2；实现仍受 V3-2、RapidOCR/VLM、tooling/真实 build 前置阻塞 |
| V3 Media Companion / V3-5 产品文档恢复外审 | `evidence/v3_media_companion/v3-5-independent-document-audit.md` | product acceptance v2、真实 observed route、ASR 资源/取消/清理、8 条 Media route 与 H01..H10 复审；Fatal=0/Major=0/Minor=2；仅达到等待用户明确实施授权的 CONDITIONAL GO |
| V3 Media Companion / V3-5.1 三视频机器候选外审 | `evidence/v3_media_companion/v3-5.1-workspace-comprehension/production-candidate/independent-implementation-exit-audit.md` | 机器候选 PASS，Fatal=0/Major=0/Minor=1；Ask 生产者自报假绿已由独立 human submission 门禁 fail-closed；当前仍 HUMAN_REVIEW_PENDING，禁止进入 V3-6 |
| V3 Media Companion / V3-2-0a 独立实施出门 | `evidence/v3_media_companion/v3-2-media-acquisition/v3-2-0a-independent-implementation-exit-audit.md` | Provider/模型管理与低资源 fallback `LOCAL LIMITED PASS`；历史 A06 失败已由后续 SenseVoice development baseline 取代为 V3 当前路线，不改写旧失败证据 |
| V3 Media Companion / V3-2-0b-5.3 文档候选 | `evidence/v3_media_companion/v3-2-media-acquisition/v3-2-0b-provider-qualification/subphases/v3-2-0b-5.3/document-readiness-audit.md` | 原 0b 长窗质量 FAIL/REPLAN；固定 15 秒窗口、24 chunk、每样本 <=2x 延迟恢复路线；待外部独立文档审查，implementation NO-GO |
| V3 Media Companion / V3-2-0c 路线 C 与开发基线 | `evidence/v3_media_companion/v3-2-media-acquisition/v3-2-0c-sensevoice-spike/` | SenseVoiceSmall Q8 三窗口 spike 后已完成 V3-2-0c-1 真实安装/音频/Chrome 基线；状态为 `development_baseline`，不扩大为 production-qualified |

历史阶段（如 V1 / V1.1 / V1.2 / A-V1.2 / V1.2-AC-* / V1.3 / V1.4）的独立审计与 false-green 复审保留在各阶段 `evidence/<stage>/` 下，文件命名遵循 `<stage>-<scope>-audit.md` 或 `false-green-audit.md`。

## A 模块当前必读

进入 A-V1.2 开发或审计前，至少读取：

```text
docs/active/project/01-prd.md
docs/active/project/02-architecture.md
docs/active/project/03-development-plan.md
docs/active/project/04-acceptance-plan.md
docs/active/project/contracts/v1_2_adapter_contracts.md
docs/active/project/contracts/a_v1_2_page_perception.schema.json
docs/active/project/design/v1.2-a-page-perception-gap.md
docs/active/project/design/v1.2-a-page-perception-gap.drawio
docs/active/project/design/a-v1.2-contract-freeze-readiness-audit.md
docs/active/project/stage-gates/v1.2-a-page-reading.md
docs/active/project/stage-gates/v1.2-a-v1.2-production-page-perception.md
docs/active/modules/runtime/page_reading/docs/a-v1.2-executable-development-spec.md
docs/active/modules/runtime/page_reading/docs/a-v1.2-100-page-evaluation-plan.md
docs/active/modules/runtime/page_reading/docs/a-v1.2-extractor-dependency-audit.md
```

## 模块文档入口

| 模块 | 文档入口 |
|---|---|
| A Page Reading | `docs/active/modules/runtime/page_reading/README.md` |
| B Chat Renderer | `docs/active/modules/frontend/chat_renderer/README.md` |
| B Artifact Renderer | `docs/active/modules/frontend/artifact_renderer/README.md` |
| B Debug Renderer | `docs/active/modules/frontend/debug_renderer/README.md` |
| B Mindmap Renderer | `docs/active/modules/frontend/mindmap_renderer/README.md` |
| C Mindmap | `docs/active/modules/runtime/mindmap/README.md` |
| D AgentCore / Agent Loop | `docs/active/modules/runtime/agent_loop/README.md` |
| D Adapter Layer | `docs/active/modules/runtime/adapters/README.md` |

## 历史文档

历史文档按阶段归档在 `docs/history/`：

```text
docs/history/V1.0/
docs/history/V1.1/
docs/history/A-V1.1/
docs/history/V1.13-V1.16/
docs/history/remote-mercury/
docs/history/legacy/
docs/history/backups/
```

历史文档只用于追溯决策，不作为当前开发验收依据。若需要重新激活某个历史阶段，必须先把对应文档从 history 中升级回当前文档包，并完成新的规格审计。
