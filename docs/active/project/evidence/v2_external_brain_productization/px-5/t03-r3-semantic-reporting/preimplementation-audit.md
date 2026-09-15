# T03 R3 T02.3 恢复实施前审计

日期：2026-09-14  
状态：`SUPERSEDED BY T03-4 MAJOR / IMPLEMENTATION STOPPED`

> 后续 T03-4 replay 检出 T02.3 offline interval 内存在成功 Runtime response。本文件保留当时的放行审计，但现行门禁由 `t03-implementation-risk-stop-runtime-offline-boundary-2026-09-14.md` 覆盖。

## 1. 审计对象与历史边界

本审计对照总 PRD、目标架构、PX-5 修复执行合同、T02.3 用户授权自审、T03 开发计划、验收计划、Validation Profile 和 Evidence Pipeline ADR。历史 `independent-preimplementation-audit.md` 基于 T02.1，历史 `independent-resumption-preimplementation-audit.md` 基于 T02.2；二者只保留追踪价值，不能替代当前 T02.3 基线。

T02.3 只读自审不修改产品代码、Runtime、Chrome、旧 production generator/validator。用户已明确要求在自审后继续既有 T03-0..7 授权；本审计只放行 T03 顺序实施，不提前生成 PASS。

## 2. 冻结输入

```text
runId: t02-r2-status-contract-production-input-20260914T001017
snapshotCommit: 98d3a8be12cd168d10993e996a95e1e11e59c184
rawSha256: 7fd641697f508c9e9fb81ab2d3af8a1248b1df61e90c83346617f9b2596266a1
sealSha256: 430207668675497c9a9d5b22f8539ae66537c72a172ed35d18fafe8e28ba8270
adapterMode: mock
T02.3 user-authorized self-audit sha256: 96236592a356693075592ccd48f6290d4d6de0337c3271b67b277baf9c8884fc
```

Readiness 结果为 Fatal 0、Major 0、gaps 空、ready true；durable Forget 为 12 trigger、12 trusted click、12 recovery；Knowledge Status 为 203 checked / 0 errors。旧 T02.1 只允许作为 `T03-IN-09` 负向回归，旧 T02.2 只允许作为 7 条非法 Status 动作的负向回归。

## 3. 架构与实现可行性审计

| 检查 | 结论 | 依据 |
|---|---|---|
| 单向无环数据流 | PASS | raw→facts→regression/mutations→validation→pending human→report→package→invocation |
| 权威边界 | PASS | raw/artifact/Git blob 为事实；Report 不作为 validator 输入 |
| Shared core | PASS | contract/production 共用 Schema、semantic、gate、TypeScript AST；reader/profile 分离 |
| Profile 防自动签署 | PASS | candidate 61 machine + 2 human pending；G7 pending；Report/final false |
| 路径可移植性 | PASS（设计） | CLI 参数绝对化；ArtifactRef 保持相对；三种 cwd 纳入验收 |
| 旧链隔离 | PASS（设计） | 旧 contract regression 可保留；旧 production entry 必须 hard block |
| 自引用 | PASS | Renderer 不读 Package；Package 无自身 hash；Invocation 最后写 |
| 公共产品合同 | 无变化 | 不修改 Runtime API、Workspace route、63 RuleId、109 requirement 或 G1-G7 |

## 4. PRD 与用户体验覆盖

T03 不创造新体验，只验证以下已实现体验的原始证据：三入口、保存后查看来源、五 route 四恢复、无效 route 回库、三来源 durable Forget 四恢复、Permission、四故障、四视口、Axe 与 Keyboard。验收计划已为每个场景给出用户操作、观察步骤和机器阈值，不存在无场景、无操作、无门槛的验收项。

## 5. T02.3 自审风险处置

| 风险 | 处置结果 |
|---|---|
| 自审不具备组织独立性 | 文件名和结论均写明 self-audit；只放行 T03 实施，不满足 T03-A14 最终独立出门审计 |
| readiness 非 T03 PASS | T03-A01..A14 全量重跑；当前只认可上游输入 |
| T01 36 项由 T02.3 verifier 复算 | T03-A13 再解析 36 个唯一 assertion；T04 仍须完整真实 Chrome 复验 |
| 旧 T02.2 Status 非法 | 保持原始字节不变并作为 fail-closed 回归，禁止在 reader/derived 层归一化 |

## 6. False-Green 审计

- Production reader 重开真实 filesystem/Git blob，拒绝 virtual、绝对 ArtifactRef、遍历和 symlink escape。
- 每个 derived fact 绑定同 run eventId，不按最近时间、数组位置或输入布尔推断。
- 42 个 mutation 从同一 T02.3 positive base 逐项变异；不得只改 report 自报结果。
- G4 从 snapshot commit 重读三个 scan root 并执行共享 AST scanner，不信任 `violations=0`。
- 缺观察只生成 diagnostic 并 exit 2；generator 不补事实、不写 raw、不代签 Human。
- Candidate 的 Report v12 G7=false、Human pending、final=false；不得提升 PX-5。
- 旧 T02.1 继续被同版 checker 以 `T03-IN-09` 拒绝；旧 T02.2 继续被 Status Schema 以 7 个 enum errors 拒绝，证明阈值未放宽。

## 7. 本地结论

```text
Fatal: 0
Major: 0
Minor: 1（当前代理兼任 T02.3 实施与自审；不具备组织独立性）

T02.3 limited PASS: user-authorized production-positive upstream input
T03 documentation and preimplementation direction: PASS FOR RESUMPTION
T03 implementation: STOPPED AT T03-4 / T02.4 INPUT REQUIRED
T04 / PX-6 / RKM: BLOCKED
PX-5: FAIL / REOPENED
```

本地结论不具备组织独立性，且已被后续机器规则发现推翻。它不能继续关闭实施阻塞，也不能满足 T03-A14 或用于 PX-5/PX-6/V2 完成声明。
