# T03 R3 共享语义校验与纯报告生成开发计划

日期：2026-09-14  
状态：`T03 LIMITED PASS / T03 FINAL NOT PASSED / T04 PLANNING ALLOWED`

2026-09-14 独立实现出门审查已完成，文件为 `independent-implementation-exit-audit.md`，SHA-256 为 `1d6d5cbf82e90410497601c0e0eb30fc66e2c3e88624bbaf0b1911e241f7ad71`，结论 `Fatal=0 / Major=0 / Minor=5`。T03 仅在 R3 production-candidate evidence pipeline 范围 LIMITED PASS；Human Review、G7 与 final 仍 pending/false。五项 Minor 的处置见 `independent-implementation-audit-disposition.md`。

## 1. 目标与边界

T03 将合格的 sealed real-Chrome raw evidence 转换成带原始 event provenance 的派生事实，复用同一套 Schema、semantic 和 TypeScript AST 核心完成 contract regression 与 production validation，再从已验证结果纯渲染机器报告。T02.5 已在 T02.4 offline authority 基础上封存 T01 36 个唯一 assertion，现为唯一正基线；T02.3/T02.4 保留为负回归。T03 不采集 Chrome、不修改 Runtime/前端产品行为、不签署 Human Review、不宣布 PX-5、PX-6 或 V2 通过。

禁止继续把以下旧链作为 production 入口：

```text
chrome-v2-px-workspace-router.mjs
-> generate-v2-external-brain-productization-report.mjs
-> validate-v2-external-brain-production-evidence.mjs
```

旧 contract-fixture 入口只作为回归输入保留；旧 production 入口必须 fail closed。

## 2. 唯一冻结输入

```text
T02.5 runId: t02-r2-t01-structured-production-input-20260914T125700
snapshotCommit: 430cddcb7ff618978851af1f3b9a3c48f2370d36
raw/raw-run.json sha256: ce272df479499e10092bc5d6a24610ebcd91782c87d4be34dceb09f296a5f0c3
raw seal contentSha256: fed6155ace6c0132c70c86bd3daccef987bd7c441df8960811e734274ea1b70f
T02.5 status: limited PASS by user-authorized self-audit; organizational independence not claimed
adapterMode: mock
contract rules: 63 total / 41 semantic / 22 schema
mandatory contract fixtures: 109
production mutations: 42
```

T02.4 只用于证明缺少 sealed T01 assertion artifact 时 `T03-IN-11` 能 fail closed；旧 T02.1 只用于证明 `T03-IN-09`；旧 T02.2 只用于证明七条非法 `userAction=retry` 会被 Status Schema 拒绝。任何跨 run corpus、route、Forget、Axe、Keyboard、fault、screenshot 或 T01 结果拼接均为 Major。

## 3. 当前与目标实体

| 实体 | 当前状态 | T03 目标 |
|---|---|---|
| T02.3 sealed raw/artifacts/build/Git snapshot | 已实现、只读保留 | offline authority 负回归，不得作为正输入 |
| T02.4 sealed raw/artifacts/build/Git snapshot | 已实现、只读保留 | 缺 sealed T01 assertion 的 `T03-IN-11` 负回归 |
| T02.5 sealed raw/artifacts/build/Git snapshot | 已实现，verifier 37/37 PASS | 唯一正输入，从 T03-1 全量重放 |
| `audit-t03-input-readiness.py` | 已实现；T02.5 gaps=[] | 保持 fail-closed 输入前置 |
| PX-0.2 contract validator/109 fixtures | 已实现、contract profile 已通过 | 提取并复用 Schema/semantic/AST core |
| 五份 T03 P7 machine contract | T03-0/T03-6 已实现并通过 | DerivedFacts、ProductionValidation、CollectionDiagnostic、ProductionPackage、InvocationRecord 保持冻结 |
| `v2PxArtifactReader.mjs` | T03-1 T02.5 replay PASS | 已完成 |
| `v2PxDerivedFacts.mjs` | T03-2 T02.5 replay PASS | 已完成；T02.4 稳定产生 `T03-IN-11` |
| `v2PxSemanticValidation.mjs` | T03-3 已实现并通过 | 共享 63 RuleId、gate 重算和 AST scan |
| derive/validate/report CLI | T03-1..5 已实现；T02.5 正候选通过 | 已完成；旧输入 fail-closed 回归保留 |
| Package/Invocation/orchestrator | T03-6/T03-7 已实现 | 正路径固定四步；T02.4 负路径只生成 diagnostic 并退出 2 |
| T03 node tests / production mutations | 已覆盖 T03-0..7 | T02.5 正基线；T02.1/T02.2/T02.3/T02.4 fail-closed 回归 |

## 4. 实施顺序

| 顺序 | 工作包 | 完成条件 |
|---|---|---|
| T03-0 | 冻结五份 P7 JSON Schema 与正/负 shape fixtures | Draft 2020-12 元校验、根正例、缺必填负例全部通过 |
| T03-1 | ArtifactReader 与路径规范化 | 三种 cwd 等价；filesystem/Git blob 可重算；virtual/escape/symlink 拒绝 |
| T03-2 | DerivedFacts | 每个采用字段有同 run provenance；缺观察生成 diagnostic，不补默认值 |
| T03-3 | 共享 Schema/semantic/AST core | contract/production 导入同一实现；63 RuleId 集合精确一致 |
| T03-4 | ProductionValidation 与 42 mutations | 同一有效 positive base；每项隔离失败且主失败码确定 |
| T03-5 | pending HumanReview 与纯 Report renderer | G1-G6 可通过、G7 pending、Report G7=false、final=false |
| T03-6 | ProductionPackage 与 InvocationRecord | 无自引用；所有引用 path/hash/length 可重算 |
| T03-7 | 父编排、全量测试、PRD/架构/false-green 审计 | T03-A01..A14 无 N/A；实现后使用新的审计请求和 reviewer session 完成独立出门审查，Fatal 0/Major 0 |

固定写入顺序：

```text
sealed raw/artifacts/Git snapshot
-> derived-facts.json
-> contract-regression.json + production-mutation-results.json
-> production-validation.json
-> human-review.pending.json
-> report.json + acceptance-report.html
-> production-package.json
-> invocation-record.json
```

## 5. 用户体验与证据映射

T03 不新增界面，但必须证明用户已经体验到的行为没有被报告层改写：

| 用户场景 | 操作 | T03 必须重算的事实 |
|---|---|---|
| 保存后查看来源 | 网页保存至 trace_ready，点击“查看来源” | trusted action、Background 配对、真实 sourceId、Source Detail route、Runtime authority |
| 打开工作台并恢复上下文 | 点击两个 Workspace 入口；direct/reload/Back/reopen | 三入口计数、五 route 四恢复、workspace/source/operation 一致 |
| 遗忘来源 | 二次确认 Forget，再以四种方式打开同一来源 | 3 source × 4 mode 的 `SOURCE_NOT_FOUND`、可信回库、四面 absent |
| 服务异常 | 触发 adapter/data service/source/runtime 四类受控故障 | fault 区间、状态权威、可恢复文案和截图 |
| 键盘和多视口 | 360/420 Side Panel、768/1280 Workspace，键盘打开 Trace | 解码尺寸、surface、Axe 0/0、Keyboard 5/5 |

## 6. Profile 与固定分母

- `contract_fixture`：63 条规则全部执行，109 requirements 全覆盖，禁止产品声明。
- `production_candidate`：61 条机器规则必须 passed/failed；两条 Human 规则只能 pending；G1-G6 passed、G7 pending、`finalPassed=false`。
- `production_final`：63 条全部 passed/failed，真实 Human Review 必须存在；不属于 T03 自动化出门。
- 三种 profile 的 `not_applicable` 数量固定为 0。
- Production mutation 固定 42 项，必须修改 raw/artifact/Git blob/causality，不得只改 report 布尔值。

## 7. 停止条件

- T02.5 自审或 T03 恢复审计出现 Fatal/Major；组织独立性缺口必须明示，不得伪称外部独立通过。
- 用户对 T03-0..7 的授权被撤回或范围改变。
- 需要修改 Runtime/API、前端产品行为、63 RuleId、109 requirement、42 mutation 或 G1-G7 分母。
- T02.5 完整 R2 分母被撤回，或需要跨 run 拼接/修改任一 sealed 输入。
- Shared core 无法由 contract/production 同时调用。
- Renderer、Package 或 InvocationRecord 出现自引用或读取未验证结果。
- 相对路径依赖当前 cwd，或 T01 36 个 assertion 无法逐项验证。

任何停止条件命中时回到文档/审计，不生成 production candidate。
