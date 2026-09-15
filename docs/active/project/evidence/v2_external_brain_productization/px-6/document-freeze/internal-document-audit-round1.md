# T04.1 / PX-6 文档冻结内部审计 Round 1

日期：2026-09-14  
范围：active PRD、目标架构、开发/验收计划、stage gate、8 页 Draw.io、T04.1 修复包、PX-6 合同与夹具。  
执行边界：只读静态检查与文档/Schema/夹具修订；未修改或运行产品代码、Runtime、Chrome、T04 runner、PX-6 runner 或 Human Review。

## 1. 审计目标

1. 判断 T04 LIMITED PASS、Minor 1、PX-5 FAIL/REOPENED、PX-6 BLOCKED 是否在 active 文档一致。
2. 判断 T04.1 是否可在未来授权后无歧义关闭 `artifactRoot` Minor。
3. 判断 PX-6 是否具备机器阶段、人类阶段和最终阶段的完整输入、输出、状态机和失败闭环。
4. 判断 Draw.io 是否完整呈现目标体验、代码实体、状态、里程碑、验收操作和出门条件。

## 2. Round 1 发现与修复

| ID | 初始发现 | 处置 | 复核 |
|---|---|---|---|
| R1-01 | `AcceptanceResult` 只限制数组长度，可能用 16 个重复 A01 冒充 A01..A16 | Schema 使用 `contains + minContains/maxContains` 冻结 A01..A16 精确集合，并区分机器 waiting 与 final passed 状态 | PASS |
| R1-02 | ReviewRequest/Submission 只限制 7 项，可能用重复 G1 冒充 G1..G7 | 两个数组均冻结 G1..G7 精确集合；passed submission 强制七项 passed | PASS |
| R1-03 | MachineExitAudit blocked 分支可能继续使用 ready-for-human claim | claim 改为二值封闭枚举；waiting 与 blocked 条件分别绑定唯一 claim | PASS |
| R1-04 | ReviewSubmission 与既有 Human Review v3 的关系不够强 | 新增 Human Review v3 ArtifactRef；外层字段和值必须由 semantic core 与原始 v3 字节逐项对照 | PASS |
| R1-05 | active 文档仍有 T04 待实现、22 negatives 和旧 PX-6 流程 | PRD、架构、计划、stage gate、Gap companion 与 Draw.io 同步为 T04 LIMITED PASS -> T04.1 -> PX-6 | PASS |

## 3. 机器检查结果

```text
Draft 2020-12 Schema meta-validation: PASS
PX-6 root positive instances: 7/7 PASS
failure code registry: 20
requirement registry: 20
fixture cases: 20
requirementId/key/layer/failureCode mapping: 20/20 exact
T04.1 acceptance IDs: 14
T04.1 negative IDs: 8
PX-6 acceptance IDs: 16
PX-6 human scenario IDs: 7
PX-6 negative IDs: 20
```

定向 false-green probe：

```text
duplicate PX6 acceptanceId: rejected
duplicate ReviewRequest gateId: rejected
duplicate ReviewSubmission gateId: rejected
submittedByAutomation=true: rejected
final passed with G7 failed: rejected
machine waiting with finalPassed=true: rejected
```

## 4. Draw.io 结构

```text
pages = 8
vertices = 112
edges = 42
duplicate cell IDs = 0
out-of-page vertices = 0
broken edge references = 0
page bound = 1600 x 900
```

八页职责分别为：目标体验、当前/目标架构差异、入口/路由、保存/Forget 生命周期、双容器/服务边界、开发里程碑、自动化/人工验收、出门条件/No-Go。页面没有增加第九页；P0-P6 产品代码实体与 P7 Evidence Plane 的已实现/待新增状态分离。

## 5. 权威状态复核

```text
T03: LIMITED PASS
T04: LIMITED PASS, Fatal 0 / Major 0 / Minor 1
T04.1: DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO
PX-5: FAIL / REOPENED
PX-6: DOCUMENT CANDIDATE / IMPLEMENTATION BLOCKED
Human Review / G7 / final: pending / pending / false
RKM: NOT IMPLEMENTED
```

没有文档把 contract fixture、machine package 或 T04 LIMITED PASS 提升为产品最终通过。

## 6. Round 1 结论

```text
Fatal = 0
Major = 0
Minor = 0
Document consistency = PASS
Implementation authorization = NOT GRANTED
External independent document audit = REQUIRED
```

该结论只说明当前文档候选可进入第二轮内部风险审计；不批准 T04.1/PX-6 代码，不替代 Claude Code CLI 外审，也不替代用户 Draw.io 方向核查。
