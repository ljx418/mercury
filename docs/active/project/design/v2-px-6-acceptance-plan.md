# V2-PX-6 人工出门与最终声明验收计划

日期：2026-09-14  
状态：`FROZEN / A01..A14 LOCAL PASS / EXTERNAL AUDIT AND A15..A16 PENDING`

> 2026-09-15 实施注记：固定机器审计候选 `px6-machine-exit-20260914t164500z` 已获 PX6-0..5 `LIMITED PASS`（独立审计 Fatal 0 / Major 0 / Minor 0）；A01..A14 与 20/20 negative passed。A15/A16 和 H01..H07 均未执行。PX6-7 在独立终审 ArtifactRef 未纳入合同前不得执行 production finalization。

## 1. 权威分母

PX-6 不使用旧 `39+ scenarios` 生成器口径。当前生产分母由 T04.1 重新执行并独立审计，固定为相互独立的集合：

```text
production scenario records = 17
source corpus = 12 = 6 web + 3 local + 3 note
route matrix = 5 intents x 4 recovery modes = 20 cells
durable Forget = 3 sources x 4 modes = 12 trigger/click/recovery chains
fault classes = 4
viewports = Side Panel 360/420 + Workspace 768/1280
axe serious/critical = 0/0
keyboard = 5/5
validation rules = 63 = 61 machine passed + 2 human pending
contract fixtures = 109/109
production mutations = 42/42
T04 acceptance = 14/14
T04 negatives = 25/25
```

17 是场景记录数量，20 route cells、12 Forget chains 等不得折算或重复计入 scenario 数。任何集合缩小、跨 run 拼接或用历史 39 条替代都失败。

## 2. 机器验收 A01..A16

| ID | 操作 | 出门阈值 |
|---|---|---|
| PX6-A01 | 校验 T04.1 binding | runId 与 ExitManifest/public archive/外审 path+raw hash 精确匹配 |
| PX6-A02 | 重算 ExitManifest | raw SHA、canonical content SHA、所有 ArtifactRef 和 archive policy 通过 |
| PX6-A03 | 重算 R4-P | 原始 invocation 保持 T03 `validation_run` 且只忽略 `/recordedAt`；10 exact、1 normalized、8 logs；resolved invocation 全部 root=`replay_validation` |
| PX6-A04 | 重算 R4-E 身份 | 新 raw/seal/profile/Runtime/database；0 跨 run 引用 |
| PX6-A05 | 重算 source/scenario | 12 source、17 scenario，唯一 ID 和来源分布正确 |
| PX6-A06 | 重算 route | 5x4=20 cells，invalid recovery>=2 |
| PX6-A07 | 重算 lifecycle | 3x4 Forget trigger/trusted click/recovery 全部同源有序 |
| PX6-A08 | 重算状态 | 四 fault 均有独立 injection/observation，offline authority 合法 |
| PX6-A09 | 重算 UX | 四视口图片可解码且 surface 正确；Axe 0/0；Keyboard 5/5 |
| PX6-A10 | 重算 validation | 63 rules、109 fixtures、42 mutations，无失败或 N/A |
| PX6-A11 | 重算文档与 Draw.io | active 状态一致；8 页、0 重 ID、0 越界、0 引用断裂 |
| PX6-A12 | 执行 PX6 negatives | PX6-N-001..020 全部命中 expected primary failure |
| PX6-A13 | 检查 machine boundary | 无 reviewer/reviewedAt；Human/G7/final=pending/pending/false |
| PX6-A14 | 生成 machine package | path/hash/index 可重算，公开包 0 credential/private hit |
| PX6-A15 | 验证 Human Review | H01..H07 全部有人工状态和证据；失败时 blocker>=1 |
| PX6-A16 | 最终独立审计 | Human passed 才允许 G7/final passed；Fatal=0/Major=0 |

PX6-0..5 只允许 A01..A14 passed、A15/A16 pending；不得删除 pending 项或缩小总数。PX6-7 最终出门必须 A01..A16 全部 passed。

## 3. 人工体验 H01..H07

| ID | 前置 | 人类操作 | 必须观察 | 失败处置 |
|---|---|---|---|---|
| H01 入口 | Runtime online、`dataServiceStatus=connected`、真实 data_service 中已保存 trace-ready 来源 | 在 Side Panel 分别点击“打开工作台”“查看来源”“在工作台中打开” | 新建或聚焦同一 Workspace；Library/Detail/当前上下文正确；无重复 ingest；Runtime 重启后来源仍存在 | G1 failed |
| H02 路由 | Workspace 已打开 | 依次访问 Library、Detail、Ask、Graph、Permissions，并执行 direct-open/reload/Back/reopen | route、workspaceId/sourceId 与上下文保持；invalid ID 可回库 | G2 failed |
| H03 生命周期 | 三个可丢弃真实 source | 对每个 source 执行 Forget 确认，再 direct-open/reload/Back/reopen | Library/Ask/Graph/Trace 均不存在；四次均 SOURCE_NOT_FOUND 并可回库 | G3 failed |
| H04 架构解释 | 打开 evidence index | 核对两个容器的数据来源、G4 扫描范围和 Runtime 权威说明 | UI 没有要求用户信任 data_service Console 或前端缓存事实 | G4 failed |
| H05 状态 | 四类故障证据可访问 | 查看 Runtime offline、Adapter blocked、DS unreachable、source failed/degraded | 四域文案和下一步动作不同，不把故障显示为成功 | G5 failed |
| H06 UX | 可见 Chrome | 在 360/420 Side Panel、768/1280 Workspace 操作 drawer/dialog/keyboard/Escape | 无遮挡/截断/横滚阻塞；焦点可见并返回；危险操作不误触 | G6 failed |
| H07 证据与声明 | A01..A14 已通过 | 打开最终审查页，抽查 hash/截图/日志并阅读声明 | 证据可访问；声明仅限 dual-container real-Chrome acceptance | G7 failed |

人类必须逐项填写 notes 和至少一个 ArtifactRef。任一 failed 时 `blockingIssues` 至少一项，finalPassed=false，不生成成功 claim。

2026-09-15 H01 增补：用户明确拒绝以 Mock-only 状态完成本地人工验收。若状态卡出现 `MockKnowledgeServiceAdapter` 或 `data_service unchecked`，H01 必须停止并按 `design/v2-px-6-h01-real-data-service-unblock-plan.md` 执行 RDS-01..07。该增补不会改写旧机器 candidate；需生成新的 real-service H01 evidence。

## 4. 20 个强制负例

```text
PX6-N-001 ExitManifest raw hash mismatch
PX6-N-002 ExitManifest content hash mismatch
PX6-N-003 independent audit hash mismatch
PX6-N-004 T04 artifactRoot Minor unresolved
PX6-N-005 legacy validator or generator invoked
PX6-N-006 scenario/source denominator reduced
PX6-N-007 route matrix partial
PX6-N-008 Forget chain cross-source or partial
PX6-N-009 fault/viewport/Axe/keyboard partial
PX6-N-010 63/109/42 denominator mismatch
PX6-N-011 cross-run evidence mixed
PX6-N-012 T04 evidence mutated after audit
PX6-N-013 document or Draw.io status stale
PX6-N-014 automation writes reviewer/reviewedAt
PX6-N-015 review authorization text/hash mismatch
PX6-N-016 Human passed with pending/failed gate
PX6-N-017 Human failed without blocking issue
PX6-N-018 Report promoted before Human Review
PX6-N-019 G7 pending while finalPassed=true
PX6-N-020 success claim or final audit overreach
```

Requirement、case、expected failure code 集合必须一一相等；不能用相近 case 替代。

## 5. 人工提交与最终门禁

Human Review 不使用自动按钮代签。人类明确提交包含 reviewer、reviewedAt、逐 Gate evidence、确认文本和其 UTF-8 SHA-256 的 JSON；validator 只验证，不补写。

最终通过同时要求：A01..A16 passed、H01..H07 passed、blockingIssues=[]、两个 human pending rules 转为 passed、G7=passed、finalPassed=true、独立审计 Fatal=0/Major=0。

文档审查通过不构成 PX-6 代码授权；机器包通过不构成人工通过；人工通过但最终独立审计未完成也不得声明 PX-6 PASS。
