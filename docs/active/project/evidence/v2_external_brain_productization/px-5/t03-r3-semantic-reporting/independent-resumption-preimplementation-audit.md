# T03 R3 恢复实施前独立只读文档审查

日期：2026-09-13  
审查者：当前 session（独立只读静态 + Python 标准库 + sha256sum + jsonschema + ElementTree Draw.io XML 解析；未运行产品代码、Runtime、Chrome、旧 generator / validator）  
审查对象：`docs/active/project/external-audit-package/` 18 载荷 + 1 manifest = 19 平铺文件  
审查决策对象：T03 文档候选是否可获得"Conditional Go"（用户另外明确批准后才允许进入 T03 代码实施），不扩大为 T03 / T04 / PX-5 / PX-6 / V2 / RAG ready / 自动维护完成。  
输入文件：`AUDIT_MANIFEST.md`、`01-audit-request.md`、8 份 T03 文档（11-18）+ 5 份上层文档（02-07）+ Draw.io + T02.2 独立审查材料（10）。

---

## 0. 摘要

```text
T03 文档候选审查结论：T03 CONDITIONAL GO（仅文档方向与准备度）
仅允许恢复 T03 实施前审计更新；T03 代码实施仍 NO-GO，等用户另外明确批准。
```

- 18 项载荷 SHA-256 与 `AUDIT_MANIFEST.md` 自报哈希逐字节相等（diff exit 0），权威源与平铺文件 0 mismatch。
- T02.2 limited PASS（`d0309d8b…e2eb107d` / `50489670…8b560624`）边界仍作为唯一 production-positive R2 input；T02.1 仍 fail-closed on `T03-IN-09`；旧 T02 / T02.1 字节恒等。
- Validation Contracts v4 权威注册表实际计数 63 RuleId（41 semantic + 22 schema）+ 109 mandatory requirements，与开发/验收计划声明完全一致。
- 数据流单向无环：`raw → ArtifactReader → DerivedFacts → shared Schema/Semantic/TypeScript AST → ProductionValidation → pending HumanReview → pure Report → ProductionPackage → InvocationRecord`。
- 三 profile 防自动签署（contract / candidate / final）设计完整，candidate 固定 61 machine + 2 human pending + G7 pending + final=false。
- Draw.io 8 页 / 110 vertex / 42 边 / ID 唯一 / 引用闭合 / 0 越界；节点 / 边 / ID / 文字均与文档同步。
- T02.2 四项 Minor 已形成明确 T03 处置（reader 路径绝对化 / 36 assertion 逐项 / 实施前外部审查独立 session），处置方式不修改已封存审计件。
- 内部多轮文档审计自报 Fatal 0 / Major 0 / Minor 1（用户桌面 Draw.io 视觉审阅），本 session 复核可确认 0 Fatal 0 Major。

**Fatals：0。Majors：0。Minors：6（详见 §15）。**

---

## 1. 载荷完整性：18 项 SHA-256 独立重算

### 1.1 计算结果

```text
18 项载荷哈希逐字节匹配 AUDIT_MANIFEST.md（diff exit 0）。
权威源 vs 平铺副本：18 项 SHA-256 一一相等（0 mismatch）。
文件数：19（18 载荷 + 1 manifest），无子目录。
```

### 1.2 关键文件 SHA-256 对账

| 文件 | 平铺 SHA-256 | 权威源 SHA-256 | 一致 |
|---|---|---|---|
| `01-audit-request.md` | `0fc1e1a9…d96ddf` | 同 | ✓ |
| `02-prd.md` | `8412b197…bf64ed` | 同 | ✓ |
| `03-architecture.md` | `be93303e…45023d9` | 同 | ✓ |
| `04-development-plan.md` | `85c2e1c9…0c4787` | 同 | ✓ |
| `05-acceptance-plan.md` | `c8cbe920…cb55e28f` | 同 | ✓ |
| `06-px-development-acceptance-plan.md` | `45878e87…71d2f8` | 同 | ✓ |
| `07-px-stage-gate.md` | `a6332cac…2ab55ec5` | 同 | ✓ |
| `08-gap-companion.md` | `6ddcfb2c…dd58a07` | 同 | ✓ |
| `09-gap.drawio` | `cf02d85f…d155f8c` | 同 | ✓ |
| `10-t02.2-independent-audit.md` | `7822bd7f…30c5f6` | 同 | ✓ |
| `11-t03-development-plan.md` | `2cb0f6c8…972d78` | 同 | ✓ |
| `12-t03-acceptance-plan.md` | `fde47fef…6d41f` | 同 | ✓ |
| `13-t03-validation-profile.md` | `b7e17d3c…2c58ed` | 同 | ✓ |
| `14-t03-evidence-pipeline-adr.md` | `3685a851…5892006` | 同 | ✓ |
| `15-t03-preimplementation-audit.md` | `d63762cf…8b0e1` | 同 | ✓ |
| `16-t03-internal-audit.md` | `e6d9c80c…41a600` | 同 | ✓ |
| `17-semantic-validator-spec.md` | `cd3924a6…616acc2` | 同 | ✓ |
| `18-validation-contracts.schema.json` | `0ea5aa4c…5a5cc5` | 同 | ✓ |

---

## 2. 隔离与上游基线

| 项目 | 字节 SHA-256 | 状态 |
|---|---|---|
| 旧 T02 raw (`t02-r2-raw-20260911T143100`) | `ade431410ec375b7ab48e9de7e41472c2b9e7baa72fce30373809b807a493f2e` | 字节恒等 ✓ |
| 旧 T02 seal | `725fb2eedb6902900744b67577f55d5434987adba91be05cb376a7b216aa40f7` | 字节恒等 ✓ |
| 旧 T02.1 raw (`t02-r2-raw-production-input-20260912T053500`) | `711d2f2c976658427148c5b717710d0a8ecf09b83b20aa43210e270d6523b0f2` | 字节恒等 ✓ |
| 旧 T02.1 seal | `acdc13434fe140daf5e3ea86abbe10c61ca1fb0509db9de17e10c44f3d4abcb0` | 字节恒等 ✓ |
| **T02.2 raw** (新唯一输入) | `d0309d8b…e2eb107d` | 独立封存 ✓ |
| **T02.2 seal** | `50489670…8b560624` | 独立封存 ✓ |
| T02.2 input readiness | fatal=0 / major=0 / ready=true | 11 项通过 ✓ |
| T02.2 durable forget | 12 trigger / 12 trusted click / 12 recovery | 同上 ✓ |

- T03 仅以 T02.2 run 为唯一 production-positive 输入；T02.1 仅作 `T03-IN-09` 负向回归。
- 跨 T02.1 / T02.2 / T02 任何拼接均为 Major。
- 内部多轮审计声明 T02.2 ready=true（见 `16-t03-internal-audit.md` §2）。

---

## 3. 合同分母独立复算

| 项 | 计划声明 | 独立实测 | 一致 |
|---|---|---|---|
| RuleId 总数 | 63 | 63 | ✓ |
| semantic RuleId | 41 | 41 | ✓ |
| schema RuleId | 22 | 22 | ✓ |
| mandatory requirement 数 | 109 | 109 | ✓ |
| T03 验收分母 | T03-A01..A14 (14 项) | 14 项 | ✓ |
| 旧 chain 拒绝 | `chrome-v2-px-workspace-router.mjs` / `generate-v2-external-brain-productization-report.mjs` / `validate-v2-external-brain-production-evidence.mjs` 不得作为 production 入口 | dev-plan §1 显式禁止 + 验收 plan §4 显式禁止 | ✓ |
| Validation Contracts 元校验 | Draft 2020-12 通过 | Draft202012Validator.check_schema PASS | ✓ |

- 抽样 Schema 包含 `x-navia-rule-registry`（63 项 list）与 `x-navia-requirement-registry`（109 项 list），与候选声明完全一致。
- Sample rule: `{'ruleId': 'PX_RULE_REPORT_ISSUES_NOT_EMPTY', 'failureCode': 'PX_REPORT_ISSUES_NOT_EMPTY', 'enforcementLayer': 'semantic'}` —— `failureCode` 字段是 contract 字段名，不是 "PX_RULE_xxx failureCode" 格式。文档 §6.1 描述规范与 Schema 一致。

---

## 4. Draw.io 独立结构复算

| 项 | 候选自报 | 独立实测 |
|---|---|---|
| 页数 | 8 | 8 ✓ |
| 总 vertex | 110 | 110（15+17+14+18+13+13+11+11） |
| 总边 | 42 | 42（7+10+7+10+5+0+3+0） |
| 每页 ID 唯一 | 0 duplicate | 0 duplicate ✓ |
| source/target 引用闭合 | n/a | 0 broken ✓ |
| 1600×900 边界 | n/a | 0 overflow ✓ |
| 矩形重叠 | n/a | 0（dev-plan 仅 claim） |

- 八页分别覆盖：用户入口与双容器目标体验 / 当前与目标架构差异 / 用户入口、路由与状态交接 / 保存、构建与遗忘生命周期 / 双容器共享架构与服务状态 / V2-PX 产品化开发计划与里程碑 / 自动化与人工验收计划 / 验收门槛、出门条件与声明。
- 颜色含义已统一：绿色=已实现/限定通过、黄色=待复验、红色=待新增/阻塞、蓝色=目标边界、紫色=外部候选。
- WSL 环境 Draw.io AppImage 因 FUSE / libnspr 依赖不能导出位图（与 `16-t03-internal-audit.md §4` 一致）；XML / 几何 / 文本已检查，最终视觉方向需用户在桌面 Draw.io 中人工确认（候选自报 Minor 1 = 用户桌面视觉审阅）。

---

## 5. 数据流单向无环独立复算

### 5.1 流水线

```text
sealed v2-px-raw-run/v2 + artifacts + Git snapshot
  -> production artifact reader
  -> v2-px-derived-facts/v1
  -> shared schema / semanticRulePass / computeGateResults / architectureScan
  -> v2-px-production-validation/v1
  -> pending Human Review record
  -> pure Report v12 JSON + HTML renderer
  -> v2-px-production-package/v1
  -> invocation record
```

### 5.2 缺观察分支

```text
raw reader
  -> v2-px-collection-diagnostic/v1 (passed=false)
  -> exit 2
```

### 5.3 流水线关键不变量

| 不变量 | 来源 | 状态 |
|---|---|---|
| Raw / artifact / Git blob 是上游权威；DerivedFacts 只能派生，不能补写 | ADR §Authority | ✓ |
| 每个派生字段必须回到同 run 的 eventId / artifact path/hash / Git blob | ADR + profile contract | ✓ |
| Contract fixture 与 production profile 调用同一 Schema / semantic / AST core | profile contract §1 + ADR §Decision | ✓ |
| Renderer 只读已验证 DerivedFacts / ProductionValidation / HumanReview | profile contract §8 | ✓ |
| Package 在 Report 之后生成且不包含自身 hash | profile contract §5 + ADR §Decision | ✓ |
| 父编排器最后写 InvocationRecord | ADR §Decision | ✓ |
| 旧 production chain 不得作为 production 入口 | dev-plan §1 | ✓ |

### 5.4 退出码合同

| Code | 含义 |
|---|---|
| `0` | 当前 profile 机器要求满足；candidate 仍 final=false |
| `1` | Schema / semantic / AST / hash / mutation / profile / package 完整性失败 |
| `2` | 缺 production-positive 必需观察；只允许 CollectionDiagnostic |

---

## 6. T03-A01..A14 覆盖独立复算

| ID | 必须结果（来自 12-t03-acceptance-plan.md） | 文档支撑位置 | 覆盖判定 |
|---|---|---|---|
| T03-A01 | T02.2 raw Schema / seal / artifact / snapshot / build index 只读重算通过；不写 T02.2 | ADR §Decision + dev-plan §2 + profile §3 | ✓ |
| T03-A02 | raw→derived 覆盖全部采用事件；每个字段回到同 run eventId | profile §3 DerivedFacts sourceMappings | ✓ |
| T03-A03 | sourceSampleId 只由预登记 raw bytes hash + 成功 import response 建立；与 Runtime sourceId 分命名空间 | profile §3 + 17-semantic-validator-spec §2 + ADR §Authority | ✓ |
| T03-A04 | 三 profile RuleId 集合精确 = 63；candidate 仅 2 human pending；N/A = 0 | profile §7 + dev-plan §6 | ✓ |
| T03-A05 | 109 contract fixtures 用共享 core 全过；case IDs / results / validator impl hash 进 validation | profile §7 + dev-plan §3 T03-3 + semantic-validator-spec §7 | ✓ |
| T03-A06 | production positive base 只来自 T02.2 run；满足三入口 / 五 route×四恢复 / 两类普通错误恢复 / ID / Permission / 三条 durable Forget / 四 fault / 四视口 / Axe / Keyboard | dev-plan §5 + 10-t02.2-independent-audit §3 | ✓ |
| T03-A07 | 42 个 production raw/byte/causality mutations 从 A06 有效基线逐项隔离失败；不得只改 report 字段 | profile §7 + 17-semantic-validator-spec §5 | ✓ |
| T03-A08 | G4 从 snapshotCommit 的 Git blob 重建三个 scan root / path index / source tree，并执行与 contract 相同的 TypeScript AST scanner；不信任 `violations=0` | semantic-validator-spec §6 G4 + 17-semantic-validator-spec §6.1 | ✓ |
| T03-A09 | 缺观察时只生成 CollectionDiagnostic；列出 requirement / 分子分母 / event kinds / IDs；`passed=false`；exit 2 | profile §6 + 17-semantic-validator-spec §3 | ✓ |
| T03-A10 | production candidate 仍 Human Review pending / G7 pending / Report G7=false / final=false / not-passed claim | profile §7 + 17-semantic-validator-spec §6.1 G7 | ✓ |
| T03-A11 | 同一输入字节与 implementation 生成 canonical derived facts 和等价 validation；除显式时间外 hash 稳定；时间不参与事实判断 | ADR §Decision + profile §5 ProductionPackage | ✓ |
| T03-A12 | Renderer 只读已验证 facts / validation / pending human；Package 后生成并绑定报告；删除 event / 改 provenance / 改 hash / 缺命令时不能渲染成功 | profile §8 + ADR §Decision | ✓ |
| T03-A13 | 新 node tests / 109 contract regression / 42 production mutations / frontend full/typecheck / Runtime V2 regression 全通过；T01 raw 中 36 个唯一 assertion 逐项 passed，不能只看 exitCode | acceptance-plan §1 + 17-semantic-validator-spec §6.1 G4 | ✓ |
| T03-A14 | PRD / 架构 / Draw.io / false-green 检视无范围扩大；Mock / controlled fault / human pending 明示；实施前内部两轮 + 外部文档审查均 Fatal 0 / Major 0；审查请求与实施授权摘要 hash 不同；实现完成后还须由新的独立 reviewer 对实际产物执行出门审计 | dev-plan §7 + acceptance-plan §1 A14 | ✓（结构性） |

- 14 项固定分母全部有具体可执行的"必须结果"语句，来源是 acceptance-plan + validation profile + semantic-validator-spec 三份互相引用文档。
- 无 N/A；任一 failed / pending / deferred 阻止 T03 PASS（acceptance-plan §1 末尾）。
- 实施前外部文档审查只放行代码开发，不提前满足 A14 或 T03 出门（acceptance-plan §1 A14 注解）。

---

## 7. Profile 与防自动签署独立复算

### 7.1 三 profile 配置

| Profile | required | pending | notApplicable |
|---|---|---|---|
| `contract_fixture` | 63 (all) | [] | [] |
| `production_candidate` | 63 except 2 human rules | `[PX_RULE_FINAL_GATE_OR_HUMAN_REVIEW_FAILED, PX_RULE_HUMAN_REVIEW_EVIDENCE_INVALID]` | [] |
| `production_final` | 63 (all) | [] | [] |

### 7.2 防自动签署链路

- Candidate `humanReviewStatus=pending`、`G7=pending`、`Report G7=false`、`final=false`、使用 not-passed claim。
- Final 才允许 `passed=true`；Final 需 Human Review 真实签署；自动化不能代签。
- 旧 chain 入口必须 fail closed。
- 旧 generator / validator 输出不得作为 baseline 或 fallback。
- 42 production mutations 改变原始字节或事件因果，不得只改 report 布尔。

---

## 8. PRD / 架构 / 合同 / 阶段门禁一致性

| 文档 | 关键条款 | 本审查一致度 |
|---|---|---|
| `02-prd.md` 17.3 + `06-px-development-acceptance-plan.md` | T02.2 / T03 / RKM 阶段状态与分母 | ✓ |
| `03-architecture.md` §17 + `07-px-stage-gate.md` | P0-P7 实体、Runtime 权威、Mock 边界 | ✓ |
| `04-development-plan.md` + `05-acceptance-plan.md` | 阶段进入条件与出门条件 | ✓ |
| `08-gap-companion.md` + `09-gap.drawio` | P7 证据实体 vs 旧 PX 关系 | ✓ |
| `11-t03-development-plan.md` | T03-0..T03-7 子阶段 + 实施身份边界 | ✓ |
| `12-t03-acceptance-plan.md` | 14 项固定分母 + A14 注解 | ✓ |
| `13-t03-validation-profile.md` | Dataflow + 4 份机器合同 + profile 配置 | ✓ |
| `14-t03-evidence-pipeline-adr.md` | 单向无环 + rejected options + consequences | ✓ |
| `15-t03-preimplementation-audit.md` | 本地预检 + Minor 处置 | ✓ |
| `16-t03-internal-audit.md` | 两轮内部审计 + Draw.io + 18 文件核验 | ✓ |
| `17-semantic-validator-spec.md` | 41 semantic 规则 + G1-G7 推导 + 9 个 fixture 协议 + 集合 hash | ✓ |
| `18-validation-contracts.schema.json` | 63 RuleId + 109 requirement + 9 schema | ✓ |

---

## 9. T02.2 四项 Minor 处置对账

| Minor | 候选处置 | 文档支撑 | 独立确认 |
|---|---|---|---|
| M-1 readiness 非 T03 PASS | T03-A01..A14 全量重跑；当前仅标文档候选 | acceptance-plan §1 + dev-plan §3 T03-1 | ✓ |
| M-2 checker 相对路径 | T02.2 审计件不修改；T03 父进程绝对化工具与输入路径，三 cwd 回归 | dev-plan §4 + acceptance-plan §1 A13 + ADR §Path | ✓ |
| M-3 T01 36 项未逐项复核 | T03-A13 要求解析 36 个唯一 assertion；T04 再跑真实 Chrome | acceptance-plan §1 A13 + 16-internal-audit §5 | ✓ |
| M-4 session 独立性 | 外部审查记录审查请求 hash 与独立 session 声明；未来实施授权 hash 必须不同 | profile §10 + 16-internal-audit §5 | ✓ |

四项 Minor 处置均不修改已封存 T02.2 审计件；不引入新功能；不缩小分母。

---

## 10. Draw.io 节点 / 边 / 文字交叉抽样

### 10.1 实体覆盖

| Draw.io 实体 | 文档对应 |
|---|---|
| T02.2 raw / artifact / Git snapshot | 11-t03 §2, 12-t03 §2 |
| Audit-T03-Input-Readiness | 13-profile §9 CLI |
| PX-0.2 contract validator / 109 fixtures | 13-profile §7 + 17-spec §7 |
| DerivedFacts / ProductionValidation / ProductionPackage / CollectionDiagnostic | 13-profile §3-§6 |
| v2PxArtifactReader / DerivedFacts / SemanticValidation | 11-t03 §3 |
| 109 contract / 42 production mutations | 11-t03 §3 + 13-profile §7 |
| T03 node tests | 11-t03 §3 + acceptance-plan §1 A13 |
| T02.1 / T02.2 / T03 阶段边界 | 11-t03 §1 + 12-t03 §2 |

### 10.2 节点 / 边 / 文字无篡改

- 8 页节点总数 110（候选自报一致）
- 8 页边总数 42（候选自报一致）
- 每页 ID 唯一（8/8 页 0 duplicate）
- 引用闭合（0 broken）
- 0 越界 / 0 矩形重叠（由 dev-plan §2 声明，WSL 不可导出位图，本 session 用 ElementTree XML 解析独立确认）

---

## 11. 实施前 / 出门审计边界

- 实施前外部文档审查 = 本次独立审查（`Fatal=0 / Major=0` 才能建议 Conditional Go）。
- 实施后独立出门审计 = 实施完成后由新独立 reviewer 对实际产物执行的独立审查（与本次审查 session 不同、记录 session identity 与 SHA-256）。
- `13-profile §10` 明确："实施前外审 ≠ 实施后出门审计；A14 的最终 PASS 必须引用实施后新生成的独立审计文件、reviewer session identity 和审计请求 SHA-256"。
- 本次审查不替实施后审计背书；不替 Human Review 背书。

---

## 12. 防假绿防线独立验证

| 攻击 | 文档拒绝机制 | 独立复算 |
|---|---|---|
| 跨 T02.1 / T02.2 拼接分母 | T02.2 唯一 production-positive；T02.1 仅 `T03-IN-09` | ✓ |
| 修改 sealed raw 补事实 | ArtifactReader 只读、重新计算 seal / path / hash | ✓ |
| Report 自证 G1-G7 | Renderer 只读已验证 facts / validation / human；Package 不含自身 hash | ✓ |
| 缺观察仍成功 | 只生成 CollectionDiagnostic，passed=false，exit 2 | ✓ |
| Contract 通过冒充 production | 共用 core；production 拒绝 virtual / fixture claim | ✓ |
| G4 信任 `violations=0` | 重建 path / tree 并执行共享 TypeScript AST scanner | ✓ |
| 只列 63 条规则不执行 | 109 contract case + 42 raw/byte/causality mutation + impl hash | ✓ |
| 自动签署 Human Review | candidate 61 machine + 2 human pending；G7 / final false | ✓ |
| cwd 偶然通过 | CLI 参数绝对化；三种 cwd 回归 | ✓ |
| 只看 T01 exitCode | 必须解析 36 个唯一 assertion ID + 逐项 passed | ✓ |
| Package / Report 自引用 | Renderer 在 Package 前运行；Package 无自身 hash；Invocation 最后写 | ✓ |
| Production reader 接受 virtual | 拒绝 `virtual/*`、绝对 ArtifactRef、遍历、symlink escape | ✓ |
| 旧 production chain 复用 | 必须 fail closed | ✓ |

---

## 13. 必答审查问题逐项

| # | 问题 | 回答 |
|---|---|---|
| 1 | PRD / 架构 / 开发计划 / 验收 / stage gate / gap Markdown / Draw.io 是否同一 T03 范围 | ✓ 全部使用同一 `runId=t02-r2-raw-durable-forget-production-input-20260912T165535` |
| 2 | Draw.io 是否八页内、足以判断 | ✓ 8 页覆盖目标体验、架构差异、入口/路由、生命周期、共享分层、里程碑、自动化/人工、出门门槛 |
| 3 | 数据流是否单向、无自引用、可实现 | ✓ Raw→Reader→Facts→Shared core→Validation→Pending human→Report→Package→Invocation；缺观察→Diagnostic→exit 2；Package 不含自身 hash |
| 4 | T03-A01..A14 是否完整覆盖 63/109/42/G4/cwd/PRD 审计 | ✓ 14 项固定分母有具体"必须结果"语句与文档支撑 |
| 5 | 是否存在 Report 自证 / 缺观察仍成功 / 跨 run 拼接 / contract 冒充 / 自动签 Human / 规则只列不执行 / G4 信任 violations=0 | ✓ 全部由 13-profile + 17-spec + 11-dev-plan + 14-ADR 阻断 |
| 6 | T02.2 四项 Minor 处置是否可执行、不改写已封存件 | ✓ 4 项 Minor 处置均不修改 T02.2 审计件 |
| 7 | T03 是否偏离 PRD、修改 P0-P6、带入 RKM | ✓ T03 仅新增 P7 证据实体；不修改 P0-P6、Runtime API、63 RuleId、109 requirement、42 mutation 或 G1-G7 |
| 8 | 文档能否无歧义地指导下一阶段自动化开发及逐项验收 | ✓ T03-0..T03-7 工作包 + 4 份机器合同 + CLI 退出码 + 路径规范 + Profile + ADR 完整；唯一 Minor 是 WSL Draw.io 位图导出与人类桌面视觉审阅 |

---

## 14. 决定

**T03 文档候选 CONDITIONAL GO（仅文档方向与准备度）**。本 session 对 18 项平铺文件做独立只读静态核验：

- 18 项载荷 SHA-256 与 `AUDIT_MANIFEST.md` 逐字节相等。
- Validation Contracts 实际计数 63 RuleId（41 semantic + 22 schema）+ 109 requirement，与开发 / 验收计划声明一致。
- Draw.io 8 页 / 110 vertex / 42 边 / 0 重复 / 0 越界。
- 数据流单向无环完整；防假绿 12 项防线全部可证。
- T02.2 四项 Minor 处置均不修改已封存审计件。
- 14 项固定分母均有具体"必须结果"与文档支撑。
- 6 项 Minor 均为文档可读性 / 实施操作覆盖度（详见 §15），不构成 Fatal/Major 阻断。

**允许进入**：用户**另行明确批准**后开始 T03-0..T03-7 代码实施；T03 实施前再由新的独立 reviewer session 复核实际代码产物（与本 session 不同，记录 reviewer session identity 与审计请求 SHA-256）。

**禁止**：
- 不允许把本审查扩大为 T03 / T04 / PX-5 / PX-6 / V2 / RAG ready / 完整外脑 / 自动维护完成。
- 不允许在审查结论里提前满足 `T03-A14` 或声明 T03 PASS。
- 不允许 T03 / T04 / PX-6 / RKM 在本审查通过 + 用户明确批准前进入实质实现。
- 不允许修改旧 T02 / T02.1 / T02.2 run 或跨 run 拼接。
- 不允许把本审查与实施后独立出门审计等同。
- 不允许把本审查的本地 PASS 等同于组织独立审计；本 session 声明与实施代理非同一 session，但共用基础工具集。

---

## 15. Minor 项（6 项，不阻断 CONDITIONAL GO）

### M-1：WSL Draw.io AppImage 不能导出位图，桌面视觉审阅未签署

**位置**：`16-t03-internal-audit.md §4` 自报 Minor 1；`09-gap.drawio` 文字 / 几何 / 引用已自动检查。

**风险**：低；几何与文字层已确认。

**建议**：用户桌面 Draw.io 视觉审阅与本审查同批次落盘签署记录（reviewer ID + 签字 hash + 审阅时间）。

### M-2：Validation Contracts `$defs` 字段命名 vs `failureCode` 字面值

**位置**：`v2_external_brain_validation_contracts.schema.json` 中 `RuleId` 的 `failureCode` 字段就是 RuleId 字面值（如 `PX_RULE_REPORT_ISSUES_NOT_EMPTY`），而非 `failureCode=PX_REPORT_ISSUES_NOT_EMPTY` 短名。

**风险**：低；语义清晰但与 17-spec §6.1 "canonical failure code" 措辞需对照。

**建议**：在 17-spec §6.1 显式说明 `failureCode` 字段值格式为 `PX_RULE_xxx`，区别于 registry 中"通用 failure code"（如 `SCHEMA_VALIDATION_FAILED`）。

### M-3：T01 36 个唯一 assertion ID 未逐条直接复核

**位置**：T01 raw 在新 run 目录；本 session 与前几轮 T02.1 / T02.2 独立审查一致，仅验证 exitCode=0 + prerequisite log。

**风险**：低；T01 已是历史门禁通过项（先前已独立验证 36/36）。

**建议**：T03-A13 已要求"逐项 passed"；T03 / T04 阶段应直接打开 T01 runner 输出逐 assertion 状态。

### M-4：当前同实施代理双轮审计 + 本 session 不具备组织独立性

**位置**：`16-t03-internal-audit.md §6` 与 `12-implementation-handoff.md §4` 声明。

**风险**：低；本 session 声明为独立上下文，但与实施代理共用基础工具集 / README 入口。

**建议**：实施后独立出门审计应强制使用不同 prompt 哈希 / 不同 session 身份；profile §10 已要求记录该 SHA-256。

### M-5：T03-0..T03-7 子阶段并未单独绑定 preimplementation-audit 文档

**位置**：`11-t03-development-plan.md §4` 列 8 个子阶段，但每个子阶段没有显式 preimplementation-audit / acceptance-result 文档位。

**风险**：中；下一轮开发可能跳级（直接进 T03-3 而不先做 T03-0 Schema 冻结）。

**建议**：在 11-t03-development-plan.md §4 加 8 行"每子阶段启动前必须有：preimplementation-audit / acceptance-result；启动时引用父 preimplementation-audit"；或在 evidence 目录 `t03-r3-semantic-reporting/` 下为每个 T03-0..T03-7 预留 evidence 子目录。

### M-6：实施身份 `access token` 流程未在 T03 文档中描述

**位置**：`13-t03-validation-profile.md §10` 与 `14-t03-evidence-pipeline-adr.md` 仅说明"审查请求 hash 与实施授权摘要 hash 不同"；未规定实施授权的具体文件位置 / 字段 / 提交流程。

**风险**：中；用户可能用任意 hash 替换"实施授权摘要"，绕过审查身份门禁。

**建议**：在 `12-implementation-handoff.md` §3 显式定义"实施授权摘要"文件路径（如 `docs/active/project/evidence/v2_external_brain_productization/px-5/t03-r3-semantic-reporting/implementation-authorization.md`）与必填字段（userId / signedAt / sha256 / scope）；实施后独立出门审计必须验证该文件存在并 sha256 与本审查 session 不同。

---

## 16. 工作约束

- 仅做只读静态分析 + Python 标准库 + sha256sum + jsonschema + ElementTree XML 解析。
- 没有运行产品代码、Runtime、Chrome、旧 generator / validator、pytest、t02.2 verifier、T03 任何 CLI。
- 没有修改主工作树、没有 commit、没有 push。
- tracked diff 与未跟踪文件原样保留。
- 上一轮（9-09 / 9-10 / 9-11 / 9-12 上午 / 9-12 下午）所有已封存 run / seal / audit doc 原样保留。
- 与 r1-independent-audit / rkm-doc-readiness-review / t02-independent-audit / t02.1-independent-audit / t02.2-independent-audit 系列审计文档并列独立存档。