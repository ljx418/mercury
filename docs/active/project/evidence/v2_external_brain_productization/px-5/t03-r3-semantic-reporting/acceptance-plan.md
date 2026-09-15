# T03 R3 开发与验收计划

日期：2026-09-14  
状态：`T03 LIMITED PASS / T03-A14 INDEPENDENT AUDIT PASS / FINAL HUMAN PENDING`

独立实现出门审查：`independent-implementation-exit-audit.md`，SHA-256 `1d6d5cbf82e90410497601c0e0eb30fc66e2c3e88624bbaf0b1911e241f7ad71`，`Fatal=0 / Major=0 / Minor=5`。T03-A14 在“R3 production-candidate evidence pipeline”限定范围通过；它不改变 `G7=pending`、`humanReviewStatus=pending`、`finalPassed=false`。

## 1. 固定验收分母

| ID | 必须结果 |
|---|---|
| T03-A01 | 当前获批正基线 raw Schema、seal、artifact path/hash/length、snapshot/build index 全部只读重算通过；不写 sealed input |
| T03-A02 | raw→derived 覆盖全部采用事件；每个 Scenario/Execution/Screenshot/Command 字段回到同 run eventId，不按时间最近、数组位置或输入布尔猜测 |
| T03-A03 | sourceSampleId 只由预登记 raw bytes hash 与成功 import response 建立；与 Runtime sourceId 分命名空间；精确满足 6 web + 3 local + 3 note |
| T03-A04 | 三 profile 的 RuleId 集合精确等于 63；candidate 仅两条 Human 规则 pending；N/A 固定为 0 |
| T03-A05 | 109 个 contract fixtures 使用共享 core 全部通过；实际 case IDs、结果和 validator implementation hash 进入 validation |
| T03-A06 | production positive base 只来自冻结 T02.5 run，满足三入口、五 route×四恢复、两类普通错误恢复、ID、Permission、三条 durable Forget、四 fault、四视口、Axe/Keyboard、Status Schema、Runtime offline authority 与 T01 36 个唯一 assertion 全部合法 |
| T03-A07 | 固定 42 个 production raw/byte/causality mutations 从 A06 有效基线逐项隔离失败；不得只改 report 字段 |
| T03-A08 | G4 从 snapshotCommit 的 Git blob 重建三个 scan root、path index、source tree，并执行与 contract 相同的 TypeScript AST scanner；不信任 `violations=0` |
| T03-A09 | 缺观察时只生成 CollectionDiagnostic，列出 requirement、分子/分母、event kinds/IDs，`passed=false` 且 exit 2；不得继续生成成功 package |
| T03-A10 | production candidate 即使机器通过也保持 Human Review pending、G7 pending、Report G7=false、`finalPassed=false` 和 not-passed claim |
| T03-A11 | 同一输入字节与 implementation 生成 canonical derived facts 和等价 validation；除显式时间外 hash 稳定，时间不参与事实判断 |
| T03-A12 | Renderer 只读取已验证 facts/validation/pending human；Package 后生成并绑定报告；删除 event、改 provenance/hash 或缺命令时不能渲染成功 |
| T03-A13 | 新 node tests、109 contract regression、42 production mutations、frontend full/typecheck、Runtime V2 regression 全通过；T01 raw 中 36 个唯一 assertion 逐项 passed，不能只看 exitCode |
| T03-A14 | PRD、架构、Draw.io、false-green 检视无范围扩大；Mock/controlled fault/human pending 明示；实施前内部两轮与外部文档审查均 Fatal 0/Major 0，且审查请求与实施授权摘要 hash 不同；实现完成后还须由新的独立 reviewer 对实际产物执行出门审计并达到 Fatal 0/Major 0 |

固定分母 14，无 N/A。任一 failed、pending 或 deferred 阻止 T03 PASS。实施前外部文档审查只放行代码开发，不提前满足 A14 或 T03 出门；A14 的最终 PASS 必须引用实现后新生成的独立审计文件、reviewer session identity 和审计请求 SHA-256。

## 2. 上游输入预检

```text
accepted runId: t02-r2-t01-structured-production-input-20260914T125700
snapshotCommit: 430cddcb7ff618978851af1f3b9a3c48f2370d36
rawSha256: ce272df479499e10092bc5d6a24610ebcd91782c87d4be34dceb09f296a5f0c3
sealSha256: fed6155ace6c0132c70c86bd3daccef987bd7c441df8960811e734274ea1b70f
input readiness: fatal=0 / major=0 / gaps=[] / ready=true
durable Forget: 12 triggers / 12 trusted clicks / 12 recoveries
Knowledge Status: 203 successful Runtime responses / 0 raw-response errors; DerivedFacts adds 1 event-backed frontend offline inference, so production validation checks 204 observations / 0 errors
Runtime offline authority: PASS (15 requests / 15 transport failures / 0 responses)
T01 structured evidence: 36 unique assertion IDs / 36 passed
T02.5 verifier: 37/37 PASS
```

T02.5 是唯一 production-positive 输入。T02.4 必须因缺少 sealed T01 assertion artifact 产生 `T03-IN-11`；旧 T02.1 必须继续因 `T03-IN-09` 退出 2；旧 T02.2 必须继续产生 7 个 Status enum errors；T02.3 必须继续因 offline interval 内一个成功 response 被拒绝。203 个 Runtime response 与 1 个 `frontend_transport_inference` 必须分开计数，禁止把离线推断伪装成 Runtime response。

## 3. 用户场景验收步骤

| 场景 | 用户操作 | 观察步骤 | 机器出门阈值 |
|---|---|---|---|
| S1 保存并查看来源 | 在网页主动保存，完成后点击“查看来源” | action→Background→Runtime→Source Detail 按 sequence 检查 | `view_source>=3`；同 workspace/source；0 orphan |
| S2 打开工作台 | 点击“打开工作台”和“在工作台中打开” | 检查新建/聚焦标签页、prior context 与最终 route | 三入口各达分母；0 duplicate ingest |
| S3 路由恢复 | 对五类 route 分别 direct-open/reload/Back/reopen | 比较 canonical path、routeIntent、workspace/source | 5×4 全覆盖，ID mismatch=0 |
| S4 无效路由恢复 | 打开 INVALID_ROUTE/WORKSPACE_NOT_FOUND | 点击真实“返回来源库”并观察 recovery route | 至少两类错误，trusted recovery=100% |
| S5 Durable Forget | 对三个来源确认 Forget，再执行四种重开 | DOM 错误码→trusted click→Source Library authority | 12/12 `SOURCE_NOT_FOUND`，12/12 回库，同源同 workspace，四面 absent |
| S6 状态故障 | 依次触发 adapter、data service、source、runtime 故障 | 核对 fault interval、状态、截图和恢复 | 四区间不重叠；无伪 Runtime response |
| S7 可访问性 | 四视口操作 Side Panel/Workspace，键盘打开 Trace | 解码截图、运行 Axe 和 5 项键盘断言 | 360/420/768/1280；serious=0、critical=0；5/5 |

## 4. 防假绿与路径验收

- 禁止跨 T02.1/T02.2/T02.3/T02.4 拼接任何分母。
- Production reader 必须读取真实 filesystem/Git blob，拒绝 `virtual/*`、绝对 ArtifactRef、遍历和 symlink escape。
- 所有 CLI 输入在父进程转换为绝对路径；从 repo root、脚本目录、随机临时 cwd 执行，除输出根外结果字节等价。
- 109 contract fixtures 不能替代 42 production mutations；后者必须改变原始字节或事件因果。
- Candidate 与 final 分开；自动化不能签署 Human Review。
- 旧 production generator/validator 的输出不得作为 baseline 或 fallback。

## 5. 开发完成后的出门证据

```text
runs/<validationRunId>/
  derived-facts.json
  contract-regression.json
  production-mutation-results.json
  production-validation.json
  collection-diagnostic.json（仅失败路径）
  human-review.pending.json
  report.json
  acceptance-report.html
  production-package.json
  invocation-record.json
  logs/**
changed-files.md
contract-changes.md
test-results.md
prd-review.md
architecture-review.md
false-green-audit.md
acceptance-result.md
independent-audit.md
handoff.md
```

T03 自动化出门最多允许声明“R3 production candidate evidence pipeline passed”；不得声明 PX-5、PX-6、V2、RAG 或 RKM 完成。

## 6. 当前候选与审计边界

以下候选因 Architecture Scan Manifest 根实例不符合冻结 Schema 已作废，只保留为失败回归：

```text
validationRunId: t03-r3-production-exit-candidate-20260914T132413
sourceRunId: t02-r2-t01-structured-production-input-20260914T125700
machine rules: 61 passed / 2 human pending / 0 failed / 0 not_applicable
gates: G1-G6 passed / G7 pending
contract regression: 109/109
production mutations: 42/42
status observations: 204 checked / 0 errors
Report/Package final passed: false
```

本地 verifier 首次重算发现 `production_acceptance` manifest 错误携带 `inlineSource` 且 `symlinkPolicy` 使用旧值，因此该候选不是实施出门候选。修复必须从空目录生成新 validation run；`T03-A14` 在新候选本地重算通过且新的独立 reviewer 给出 `Fatal=0 / Major=0` 前保持 pending，因此 T03、T04、PX-6 和 RKM 均不得升级门禁。

修复后新的唯一出门候选为：

```text
validationRunId: t03-r3-production-exit-candidate-20260914T134804
derivedFactsSha256: 5c538f3e1a6fd0047659484e0b66d04af7b81a1071fee6f8131e0c2aef2d9eef
productionValidationSha256: 26272fc1837e866d39049d083ff7b7f4511f06f00459827d62a989b452ef123e
architectureManifestSha256: 731ef89d38ba2ec009449e75ba0dcfff1a8f6cdd2cdb4fc6bbae0d186209e4c6
reportSha256: 2c72446c7598d7dda6fa529ade42eeb4b1d02dc1df9547baabf29bd94297a38d
packageSha256: 625a322b0dd4642cc1564e1189ded872933cd0b2c51bf38be5930de7c03ff410
invocationSha256: 473159174cef49a575b40fbeed937df276e6a6c9c1641c5e17cc8a28ea3a16da
local verifier: 16/16, Fatal=0, Major=0
```

只有上述新候选可作为 T04 replay baseline；旧 `132413` 候选继续保留为 manifest Schema 失败回归，并固定满足以下隔离规则：

- `audits/132413/` 或任何同名归档只能作为 negative/historical 输入；
- production-positive reader 必须只接受显式 manifest 绑定的 `134804`，不得扫描目录后选择“任一通过候选”；
- 两个候选不得合并 scenario、rule、mutation、artifact 或 hash 分母；
- T04 必须提供 stale-candidate 负例，证明引用 `132413` 时 fail closed。

独立审查已完成并给出 T03 LIMITED PASS。T04 只获准进入实施前规划与审计；其代码实现仍须通过独立文档审查并取得用户另行授权。
