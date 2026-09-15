# T04.1 / PX-6 文档冻结内部审计 Round 2

日期：2026-09-14  
审计方式：在 Round 1 修订后重新从 PRD 目标、架构依赖、真实用户操作和 false-green 失败路径反向挑战。  
执行边界：仅文档、Schema、JSON 夹具和 Draw.io；未执行任何产品或验收实现。

## 1. PRD 与体验覆盖

| PRD 体验 | 未来实施路径 | 机器证据 | 人类操作 | 判定 |
|---|---|---|---|---|
| 三个入口可发现并打开正确 Workspace 上下文 | 既有 Side Panel/Background/Workspace，不新增产品代码 | PX6-A01/A05/A06 | H01 | 完整 |
| 五 route 可 direct-open/reload/Back/reopen | T04.1 全量 R4-E 后 PX-6 重算 | PX6-A06 | H02 | 完整 |
| 保存后来源稳定，不重复 ingest | T04.1 复用既有稳定 ID 与 Runtime 事实 | PX6-A05/A06 | H01/H02 | 完整 |
| Forget 对同一来源 durable，四面不复活 | 3 source x 4 recovery chain | PX6-A07 | H03 | 完整 |
| 前端不直连 data_service，Runtime 是事实权威 | G4 AST/manifest 与 artifact graph 重算 | PX6-A04/A10 | H04 | 完整 |
| 四类故障不冒充成功 | raw injection/observation 重算 | PX6-A08 | H05 | 完整 |
| 双容器四视口与键盘可用 | PNG/Axe/Keyboard 原始证据 | PX6-A09 | H06 | 完整 |
| 声明可追溯且不过界 | hash/index/claim/final audit | PX6-A11..A16 | H07 | 完整 |

T04.1/PX-6 不增加 RAG、自动维护、自动遗忘、默认文件扫描、真实 data_service 产品化或 RKM 能力，未偏离 V2-PX 有限产品化目标。

## 2. 架构闭环

单向目标链为：

```text
immutable T04.1 candidate + independent audit
  -> CandidateBinding
  -> raw-byte Reader / shared validation core
  -> MachineExitAudit(A01..A14)
  -> EvidenceIndex + ReviewRequest
  -> mandatory stop: waiting_for_human_review
  -> human-authored Human Review v3 + ReviewSubmission
  -> FinalDisposition(A15/A16 + G7/final)
  -> independent implementation exit audit
```

架构检查结果：

- P0-P6 产品调用链不在允许修改范围；本阶段只改 P7 Evidence Plane。
- CandidateBinding 禁止 newest-run 搜索，只接受授权摘要中的精确 path/raw hash。
- T04.1 不能只重跑 Replay 或补 JSON；必须重新执行 R4-P/R4-E/T02/T03/T04。
- MachineExitAudit 不读取 Report `passed` 作为事实，不调用旧 validator。
- ReviewSubmission 绑定 Human Review v3、候选、机器审计和人类授权原文 hash。
- FinalDisposition 不回写 T04.1，公开包排除人类身份、自身 manifest 和后续审计，避免自引用。

## 3. 固定分母与防缩减

```text
17 production scenario records
12 sources = 6 web + 3 local + 3 note
20 route cells = 5 intents x 4 recovery modes
12 durable Forget chains = 3 sources x 4 modes
4 fault classes
4 viewport classes
Axe serious/critical = 0/0
Keyboard = 5/5
63 rules = 61 machine passed + 2 human pending
109 contract fixtures
42 production mutations
T04 A01..A14 = 14
T04 N001..N025 = 25
PX6 A01..A16 = 16
PX6 H01..H07 = 7
PX6 N001..N020 = 20
```

17 scenario、20 route cell、12 Forget chain 是三个集合，禁止相加伪造场景数，也禁止用旧 `39+ scenarios` 替换。所有 machine passed 结果至少包含一个 ArtifactRef；pending A15/A16 不能从总集合删除。

## 4. 20 条 false-green 闭环

20 条 requirement 与 20 个 FailureCode、20 个 fixture case 一一相等，覆盖：T04 raw/content/audit hash、artifactRoot、旧管线、source/scenario、route、Forget、UX/fault、63/109/42、跨 run、候选不可变、文档/Draw.io、自动代签、授权原文、Human gate、失败 blocker、提前 promotion、G7/final 和过度声明。

夹具状态严格限定为 `contract_only`。当前只证明 Schema shape、registry 映射和变异指令完整，不宣称尚未实现的 PX-6 semantic runner 已经执行 20/20。未来 PX6-0 必须让每个 case 实际修改原始字节或结构化对象并验证 primary failure，不能读取 `expectedPrimaryFailure` 后直接回显。

## 5. 高风险流程边界

| 风险 | 关闭方式 | 当前状态 |
|---|---|---|
| 自动化代签 Human | `submittedByAutomation=false` + provenance semantic check + N014 | 文档关闭，待实现 |
| Human 原文/hash 被代理重写 | UTF-8 无 BOM原文 hash + N015 | 文档关闭，待实现 |
| 人工失败却无可执行 blocker | failed 至少一个 gate failed 且 blocker>=1 + N017 | 文档关闭，待实现 |
| Machine package 提前给成功声明 | waiting 状态只允许 machine-ready claim + N018 | 文档关闭，待实现 |
| 人审通过但 G7/final 不一致 | A15/A16 + N019 + 最终独立审计 | 文档关闭，待实现 |
| 审计组织独立性不足 | 外审 request 固定新 reviewer session，实施后再独立复审 | 过程门禁，不由代码伪造 |

## 6. 仍然存在但不属于文档缺口的风险

1. T04.1 尚未获授权和执行，不能预测真实全量重跑一定成功；失败必须回该阶段计划。
2. PX-6 runner 尚未实现，20 条 semantic case 尚未实跑；文档通过只允许后续请求代码授权。
3. 人类尚未在可见 Chrome 执行 H01..H07；机器结果不能替代。
4. Draw.io 已通过 XML/几何检查，但用户仍需通过桌面应用进行方向视觉核查。

这些风险均由明确阶段门禁控制，不需要降低 PRD、替代真实数据或引入备选产品路线。

## 7. Round 2 结论

```text
Fatal = 0
Major = 0
Minor = 0
PRD coverage = COMPLETE FOR T04.1 AND PX-6 DOCUMENT SCOPE
Architecture support = COMPLETE FOR FUTURE AUTOMATED IMPLEMENTATION
False-green specification = COMPLETE, NOT YET EXECUTED
External Claude Code CLI document audit = REQUIRED
Implementation authorization = NOT GRANTED
```

外部审查必须独立重算文件 hash、Schema/positive/registry 集合、Draw.io 结构与关键状态，并挑战自动代签、重复 A/G、旧 pipeline、缩小分母和跨 run 路径。只有外审 Fatal 0/Major 0 后，才能向用户请求 T04.1 实施授权；不得由本内部结论直接进入代码。
