# V3-2-0b-5.3 内部假绿与规格偏移审查第二轮

日期：2026-09-22  
审查性质：从缩分母、跨 run、状态误标、门户污染、隐私与体验回退角度独立重读；未运行产品代码。

## 1. 攻击性检查

| 攻击 | 文档/机器拒绝点 | 结果 |
|---|---|---|
| 只修 sample03/bin2 | FW03/FW04/FW14 要求三样本全部从 chunk 0 新 attempt | REJECT |
| 把 5.2 诊断混入生产 | parent/read-only lineage 与新 run namespace | REJECT |
| 空 chunk 标为静音/N/A | 冻结 24 个真实语音 bin；FW11 无 N/A | REJECT |
| 复制相邻 chunk 文本 | text policy + FW10 + output hash/static audit | REJECT |
| 并发 8 进程降低延迟 | maxConcurrency=1 + FW08 | REJECT |
| 只报平均延迟 | FW17 三样本逐项上限 | REJECT |
| 复用旧 reviewer 或复制身份 | 新 bundle hash、两个不同 reviewer、48 唯一判断 | REJECT |
| 安装成功即 qualified | machine -> human -> independent 三门，Settings 继续失败 | REJECT |
| 清理失败仍 completed | cleanup barrier 是终态前置 | REJECT |
| B站权限进入通用 ASR | `TaskAudioRef` 边界；orchestrator portal-neutral | REJECT |
| 新门户继承 B站 PASS | 每门户独立 adapter/permission/credential/production matrix | REJECT |
| 对外宣称 V3-2/V3 完成 | ADR、PRD、Stage Gate 均限定 provider route | REJECT |

## 2. PRD 与架构一致性

- 不改变 V3-2 的 12 URL、3 ASR 样本、24 bin 或双 reviewer 分母。
- 不新增用户功能、不改变 Side Panel/Workspace 路由、不修改 Cookie transport。
- 不调用 V4 Knowledge、Query、Graph 或 Durable Forget。
- 继续满足本地推理、8 cores/8 GiB/no-GPU、隐私清理和公开证据最小化。
- Draw.io 仍为 8 页，状态色块明确区分 LIMITED PASS、FAIL/REPLAN、DOCUMENT CANDIDATE 和 BLOCKED。

## 3. 实现可指导性

开发计划把实现拆为 5.3-0..7；每段有代码实体、输入、输出、验收与停止条件。合同明确了切片边界、timestamp 算法、attempt 生命周期、公开字段、FailureCode、资源/延迟和 portal-neutral 依赖方向。自动化实施无需自行发明窗口、重试、合并或质量阈值。

## 4. 残余风险

| ID | 级别 | 风险 | 处理 |
|---|---|---|---|
| R2-m1 | Minor | 真实 8 次进程启动能否满足 <=2x 尚未知 | 只能在 5.3-5 真实测量；失败即回到 ADR，不降低门槛 |
| R2-m2 | Minor | 15 秒边界可能损失跨边界词义 | 由 48 项双人判断验证；禁止文本补写 |
| R2-m3 | Minor | 本 session 的内部审查不具组织独立性 | 必须由 Claude Code CLI 独立文档审查，实施后再换 session 出门审查 |

这些风险是实施期必须实测的开放事实，不是缺失规格；均有 fail-closed 条件。

## 5. 结论

本轮 Fatal=0、Major=0、Minor=3。文档在 PRD 范围、目标架构、低资源体验、门户开放性、隐私和假绿拒绝方面可提交外部独立文档审查。`V3-2-0b-5.3 implementation` 仍 NO-GO。
