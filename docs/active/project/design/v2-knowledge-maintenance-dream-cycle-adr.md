# ADR: V2.x Knowledge Maintenance And Dream Cycle

## Status

研究方向已纳入2026-09-09 V2-RKM文档规划；仍未批准实现，明确不属于V2-PX。RKM细化决策以 [RKM风险ADR](v2-real-knowledge-maintenance-risk-adr.md) 为准。模型/框架研究候选不等于已选型集成。

## Context

当前 Forget 由用户主动发起，安全但维护成本较高。随着 source、revision、摘要和 workspace 数量增长，系统需要帮助用户识别重复、陈旧、低价值和组织不良的知识，同时不能让模型在缺乏证据、权限或恢复路径时自动删除资料。

## Decision

未来若启动 V2.x Knowledge Maintenance，采用治理优先的 proposal pipeline：

```text
policy + authorized scope
-> maintenance analysis
-> evidence grounding
-> proposal inbox
-> user review or reversible opt-in apply
-> quarantine / restore / verified forget
-> audit record
```

默认决策：

- `suggest-only`。
- metadata、标签、虚拟目录和 workspace membership 可作为首批可逆动作。
- 原始 source、EvidenceRef 和 revision 始终保留到用户确认或高风险策略通过审计。
- 永久自动遗忘、物理文件移动 / 重命名 / 删除默认关闭。
- 原研究基线不允许后台联网；RKM唯一放宽是经过独立cloud consent授权的指定provider/purpose模型调用，费用仅统计估算、不设金额硬限。仍不网络搜索、不自动浏览、不扫描未授权路径、不抢占焦点、不发声。

## Options

| 路线 | 优点 | 缺点 | 当前判断 |
|---|---|---|---|
| A 纯人工 Forget | 风险最低、语义明确 | 大规模知识维护成本高 | 保持当前基线 |
| B suggest-only maintenance inbox | 可解释、可审查、可逐步学习用户偏好 | 需要 proposal UX 和人工处理 | 推荐首期路线 |
| C 可逆自动整理 + quarantine | 降低操作成本，仍可恢复 | 状态机、并发和回滚复杂 | B 稳定后评估 |
| D 自动永久遗忘 / 物理文件操作 | 自动化程度最高 | false-forget、数据损失、权限与合规风险最高 | 当前 No-Go |

## Consequences

- 需要独立合同、状态机、proposal store、Maintenance Inbox、semantic validator 和真实数据验收。
- 开源项目只作为 spike 输入，不能直接替代 Navia EvidenceRef、PermissionRoot、Forget cascade 和审计语义。
- V2-PX 不承担该 ADR 的实现，也不得把未来卡片或自动维护写入完成声明。

## Exit To Implementation

只有完成开源方案 spike、威胁模型、用户研究、合同 schema、指标方向、quarantine / restore 证明和高风险人工批准后，才能从 Proposed 改为 Accepted。
