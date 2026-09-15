# T04 R4 PRD 与架构边界

日期：2026-09-14  
状态：`FROZEN DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO`

## 1. 阶段目标

T04 不新增用户功能。它在一个与主工作树隔离、可重建的 Git 快照中，重放 T03 证据流水线，并从同一快照重新执行完整真实 Chrome 产品路径，证明当前双容器体验、原始证据、共享校验和候选报告属于同一份可复现实现。

用户体验仍严格来自 PRD 的既有 PX 范围：

- 网页侧 Launcher 打开 Side Panel；
- 保存当前页后查看 Source Detail；
- 从 Side Panel 打开独立 `workspace.html`；
- 五类 route 的 direct-open、reload、Back、reopen；
- 无效 route 的可信回库；
- Permission grant/scan/import/revoke；
- 三个来源 Forget 后四种重开均 `SOURCE_NOT_FOUND` 并回到 Source Library；
- Side Panel 360/420、Workspace 768/1280；
- 四类故障状态、Axe 和 Keyboard。

T04 不实现 RAG、真实 data_service 产品接入、对话长期记忆、自动维护、自动 Forget、网络搜索或 RKM。T04 不签署 Human Review；该动作只属于 PX-6。

## 2. 两条不可混合的复验泳道

### R4-P：冻结输入确定性重放

```text
T02.5 sealed raw + T03 candidate 134804 + T04 isolated implementation snapshot
-> 在新鲜空输出根实际执行 derive/validate/report/package
-> 与 134804 做逐字节或封闭归一化比较
```

该泳道证明 T03 pipeline 可重放，不重新采集用户行为。它只能使用 T02.5：

```text
sourceRunId=t02-r2-t01-structured-production-input-20260914T125700
rawSha256=ce272df479499e10092bc5d6a24610ebcd91782c87d4be34dceb09f296a5f0c3
sealSha256=fed6155ace6c0132c70c86bd3daccef987bd7c441df8960811e734274ea1b70f
baselineValidationRunId=t03-r3-production-exit-candidate-20260914T134804
```

旧候选 `...T132413` 只允许作为 stale-candidate 负例。

### R4-E：隔离快照真实 Chrome 全量复验

```text
同一 T04 isolated implementation/product snapshot
-> build/typecheck/tests/T01 real Chrome
-> 全新 R2 raw run、独立 seal
-> 对该新 run 完整执行 T03 pipeline
-> 形成 R4 唯一 production candidate
```

R4-E 不复用 R4-P 或 T02.5 的 scenario、source、截图、Axe、Keyboard、fault、DerivedFacts、Validation、Report 或 Package。它必须从零创建 run/profile/Runtime/database/build/output，满足完整 T02.5 分母和 T03-A01..A14。

## 3. 目标架构

```text
主工作树（只读、可脏）
  -> SnapshotBuilder
      -> productBaseCommit 430cdd...
      -> reviewed T03 dependency closure
      -> T04 implementation files
      -> local-only immutable acceptance commit
  -> SnapshotInputManifest v1
  -> IsolatedReplayController
      -> R4-P FrozenInputReplay
      -> R4-E FreshChromeRecollection
  -> Shared T03 Core
      -> ArtifactReader
      -> DerivedFacts
      -> Schema/Semantic/TypeScript AST
      -> ProductionValidation
      -> pending HumanReview
      -> pure JSON/Chinese HTML
      -> ProductionPackage
      -> InvocationRecord
  -> SnapshotComparator
  -> SnapshotRevalidation v1
  -> ExitManifest v1 (unsigned, human pending)
  -> independent implementation audit
  -> PX-6 human review（后续阶段）
```

### 3.1 代码实体与状态

| 实体 | 目标位置 | 当前状态 | T04 动作 |
|---|---|---|---|
| T03 ArtifactReader/Derived/Validation/Report/Package | `apps/chrome-extension/e2e/lib/v2Px*.mjs` | T03 LIMITED PASS | 不改算法；纳入依赖闭包并隔离重放 |
| T03 四步 CLI | `apps/chrome-extension/e2e/*v2-px-production*.mjs`、`run-v2-px-r3-validation.mjs` | T03 LIMITED PASS | 在隔离快照真实执行，不信旧日志 |
| R2 real-Chrome collector | `apps/chrome-extension/e2e/chrome-v2-px-r2-raw-evidence.mjs` | T02.5 限定通过 | R4-E 从零执行并生成新 run |
| SnapshotBuilder/closure index | `apps/chrome-extension/e2e/lib/v2PxSnapshotReplay.mjs` | 未开发 | T04 新增 |
| SnapshotComparator | `apps/chrome-extension/e2e/lib/v2PxSnapshotComparison.mjs` | 未开发 | T04 新增 |
| R4 orchestrator | `apps/chrome-extension/e2e/run-v2-px-r4-snapshot-revalidation.mjs` | 未开发 | T04 新增 |
| Snapshot contracts | `docs/active/project/contracts/v2_px_snapshot_*.schema.json` | 文档候选 | T04-0 冻结并实现 shape/negative tests |
| Chinese candidate report | R4 evidence run 内 `acceptance-report.zh-CN.html` | 未开发 | 只渲染已验证结果，保持 final=false |
| Drawio | `design/v2-memory-personal-knowledge-base-gap.drawio` | 8 页、方向已获用户认可 | 同步阶段事实与门禁，不改变产品方向 |
| Human Review signer | PX-6 | 未开始 | T04 禁止实现或调用 |

## 4. 快照边界

T02.5 的 `productBaseCommit=430cddcb7ff618978851af1f3b9a3c48f2370d36` 可由 Git object database 读取，但不包含全部 T03 新工具。T04 因此必须在隔离 worktree 中创建 local-only acceptance commit：

1. 以 `430cdd...` 物化 product base；
2. 只从已审计来源复制完整 T03/T04 实现依赖闭包和冻结合同；
3. 生成每个 path 的 mode、blob SHA-256、byteLength、来源审计 hash 与 import edge；
4. 解析所有相对 ESM import，确认闭包内无缺边；绑定 package lock、Node/npm/Python/Chrome 版本；
5. commit 仅存在隔离 worktree，不改变主工作树 index/HEAD，不 push；
6. R4-P 与 R4-E 都从该 commit 运行，禁止从主工作树动态读取实现或合同。

产品源码路径必须与 T02.5 build/source indexes 对应字节一致。`apps/chrome-extension/package.json` 与 `pnpm-lock.yaml` 也必须取自 `430cdd...` 并逐字节不变；T03/T04 入口通过 direct Node argv 执行，不通过修改 package scripts 注册。允许叠加的文件仅限已登记的 T03/T04 `e2e/**` 工具、三份 T04 Schema 及审计/规格材料，它们不能进入 WXT 产品 bundle。若 T04 需要修改产品行为、Runtime API、63 RuleId、109 requirement、42 mutation 或 T03 输出合同，立即停止并回到对应阶段重新规划，不允许在 R4 内静默修复。

## 5. PX-6 交接边界

T04 最多形成：

```text
R4 isolated snapshot revalidation candidate passed.
Human Review, G7, PX-5 final disposition and PX-6 remain pending.
```

T04 出门时必须仍为：

```text
machinePassed=true
humanReviewStatus=pending
G7=pending
finalPassed=false
exitManifest.signed=false
```

只有 PX-6 人类按 PRD 操作清单完成体验核查，并对 T04 ExitManifest 的精确 hash 签署后，才能重新计算 G7 和最终状态。
