# V3 完成阶段文档准备度审计

日期：2026-10-15。范围：交接包、V3 PRD/架构/开发与验收计划、Stage Gate、V3-5.10 计划及 P0 最新实现事实。性质：内部文档审查，不是代码实施审查，不授权 P1-P9。

## 1. 结论

当前文档已能完整指导 P0 的下一轮最小修复与独立出门；P0 的唯一 materialize 编排者已从模糊选项收敛为 Side Panel effect。P1-P3 可在 P0 通过后冻结 run/tool/build hash 并执行。P4-P7 已具备明确的架构、体验、工作包和固定验收方向，但仍需在每个子阶段编码前补版本化 schema、fixtures、详细计划、验收计划和独立文档审查。P8-P9 的固定分母和收口流程明确，但输入必须来自前序同一 production candidate。

因此：

- `P0 documentation: GO`，`P0 implementation: IN PROGRESS`，`P0 exit: NO-GO`。
- `P1-P3 implementation: BLOCKED BY P0 INDEPENDENT EXIT`。
- `P4-P7 documentation elaboration: GO`，`implementation: REQUIRES STAGE-SPECIFIC FREEZE/AUTHORIZATION`。
- `P8-P9: BLOCKED BY P1-P7`。

## 2. PRD 与架构覆盖

| 能力 | 文档覆盖 | 当前实现/证据 | 缺口 |
|---|---:|---|---|
| 同源唯一 authority/task/revision | 95% | Stage A LIMITED PASS + Route A 候选 | P0 canary terminal 与真实故障外审 |
| B站媒体获取/ASR/OCR/VLM | 90% | V3-2/3 LIMITED PASS | 六视频同 run 质量与清理 |
| grounded brief/章节/claim | 85% | B-5-1/B-5-2/Route 2 候选 | B-5.3 六视频、B-6 内容判断 |
| 状态、计时、恢复 | 75% | 部分实现候选 | schema/fixtures/同 build 真实验收 |
| 图文大纲/时间线 | 72% | 基础组件候选 | 全片、真实帧、交互与 seek 稳定性 |
| 概念关系图 | 68% | 旧导图候选 | 概念 schema、关系证据、布局保存 |
| 五种导出 | 65% | 局部服务候选 | prompt 区分、配置、取消与 artifact |
| Chat/Know 事务 | 70% | 页面/Runtime 候选 | Draft/Item 正负例与正式出门 |
| 综合 E2E/V3-6/V3-7 | 80%（流程） | 未执行 | 同 build fresh evidence 与人类签署 |

百分比表示“文档可指导程度”，不是功能完成度或门禁 PASS。

## 3. 已关闭的文档风险

1. 明确 V2/PX-6/RKM 暂停且不阻塞 V3；V4 Query/Graph/Durable Forget 与 V5 Agent 不混入 V3。
2. 明确 MiniMax 默认、DeepSeek 手动选择、单任务单 Provider 和结构失败 allowlist。
3. 明确 Runtime 手动启动，不再承诺扩展静默拉起或浏览器生命周期托管。
4. 明确大纲、时间线、概念图、导出的不同职责，避免同一转写列表换皮。
5. 明确同源 authority、old revision 隔离、取消/重启 cleanup barrier 和 late-result fence。
6. 明确真实数据、静音 Chrome、secret/raw-media/path 0 hit、fresh run 与人类不代签。
7. 明确 Claude 主干/审查/Codex 的职责和 429/422/529 恢复。

## 4. 仍需在实现前关闭的风险

### P0 Major 门槛

- camelCase/snake_case `taskId` helper 已形成候选并通过 focused tests，但尚未进入 immutable candidate 外审。
- materialize 唯一所有者已冻结为 Side Panel effect；真实 canary 尚未完成 trusted capture -> acquisition succeeded -> product materialize -> terminal 的整链证明。
- Runtime crash、worker missing、permission missing、cleanup failure 仍缺真实边界证据。
- 尚无 P0 immutable candidate 与独立 Fatal=0/Major=0 报告。

### P4-P7 文档门槛

- `MediaTaskActivityProjection`、concept graph、export profile、KnowledgeDraft/Item 的最终版本化 schema 尚未逐阶段冻结。
- 三视频/六视频的内容质量 rubric 需要在每个工作包中明确阈值和 FailureCode。
- 开源 renderer 的版本、许可、bundle 成本、无障碍与 fallback 必须在 D2/D3 spike 后冻结。
- Chat/Know 的数据迁移、并发冲突、删除语义和重启一致性要有真实 fixture。

这些风险可通过阶段文档迭代消减，不需要现在选择新架构路线。

## 5. 外部审查判断

有必要继续使用 Claude Code CLI 外审，原因是 P0、六视频 run、Stage D 内容证据和 V3-6 均包含长调用链、大量 payload/hash 与假绿风险。外审顺序固定为：

1. P0 immutable candidate 独立实施出门审查。
2. P1-P3 B-5/B-6 closure package 审查。
3. P4、D1-D4、P6 每个文档候选的独立文档审查，以及实现后的独立出门审查。
4. P7 同 build 综合体验审查。
5. P8 production run 与 P9 最终阶段审查。

外审不得与主干同时修改同一事实源；不得因为 Claude 报告 PASS 自动放行。

## 6. 可交付给 Claude 的文件集合

当前交接只需本目录 00..09、`HANDOFF_MANIFEST.md`、项目 PRD/架构/开发/验收、V3 Stage Gate、V3-5.10 主计划及当前 P0 六份材料。每轮外审包仍须按 `EXTERNAL_AUDIT_PACKAGE_PROCESS.md` 清空重建并保持平铺 <=20 文件，不能把整个 handoff/evidence 目录直接混入。

2026-10-15 文档闭环更新：恢复执行时应读取本目录 `00..12`。`11-p0-daily-use-capture-checkpoint.md` 已把首次授权、日常恢复和无字幕 trusted capture 三条链分开，并冻结 Headless 失败后的 native invocation 门槛；`12-document-development-closure.md` 统一映射架构实体、目标体验、P0-P9 开发/验收分母和 Claude 高 token 调度边界。该补充使 P0 下一实现切片的文档覆盖保持 GO，但 P0 出门仍 NO-GO。

## 7. 最终判断

文档方向无须推倒重做；之前 V3 路线保留并在其上扩展。当前应从 P0 的字段解析与 materialize 时序继续，不应返回早期路线设计，也不应提前开发 P4-P7。`08-goal-continuation-prompt.md` 已能作为跨会话完整 goal；每个未来子阶段仍需自己的详细冻结和外审。

## 2026-10-15 v9 重新审计说明

上述 `P0 implementation: IN PROGRESS` 与“从字段解析继续”已被更晚的真实网络诊断和 relay 文档审查替换。v8 第二轮严格复核仍发现两个 Major；v9 增加 owner manifest 原子发布/父目录 fsync/八类损坏拒绝、11-scope semantic AST、40-source inventory 与四递归 discovery-root 闭包。当前 readiness 结论是：v9 候选机器 verifier 50/50，但代码实施仍 NO-GO；必须重建审计包并从零完成双重独立文档审查。P1-P3 的文档覆盖约 80%，P4 约 75%，P5 约 65%-72%，P6/P7 约 70%；这些百分比只表示方向与分母已定义，未来每阶段仍须冻结版本化 schema/fixture 和单独审计。

