# T04 R4 实施前内部审计

日期：2026-09-14  
状态：`INTERNAL DOCUMENT REVIEW PASS / EXTERNAL REVIEW PENDING / IMPLEMENTATION NO-GO`

## 1. 审计对象

- `prd-architecture-scope.md`
- `development-plan.md`
- `acceptance-plan.md`
- `snapshot-revalidation-contract.md`
- `risk-adr.md`
- T03 独立实现审查及处置
- active PRD、Architecture、Stage Gate、PX Gap companion/Drawio

## 2. 第一轮：完整性审计

| 检查 | 结果 |
|---|---|
| R4-P 与 R4-E 两泳道输入、输出和禁止拼接 | PASS |
| T02.5、T03 134804、旧 132413 的身份与用途 | PASS |
| 完整实现依赖闭包与 isolated local commit | PASS |
| T04-0..7 顺序、目标文件和停止条件 | PASS |
| T04-A01..A14 固定分母，无 N/A | PASS |
| T04-N-001..025 registry、primary failure | PASS |
| SnapshotInput/Revalidation/Exit 三根合同 | PASS；三份 Draft 2020-12 Schema 已落盘并通过元校验 |
| Human/G7/final/PX-6 边界 | PASS |

第一轮：Fatal 0 / Major 0 / Minor 1。

Minor：实现依赖闭包的最终文件数必须由 T04-0 工具重算，不能冻结为当前手工观察的 15。

## 3. 第二轮：PRD、架构与 false-green 审计

| 风险问题 | 结果 |
|---|---|
| 是否新增 PRD 用户功能 | 否；只复验既有 PX 体验 |
| 是否把真实 data_service/RAG/RKM 前移 | 否，均明确排除 |
| 是否修改 P0-P6 或 public API | 否；产品缺陷触发 STOP/REPLAN |
| 是否只用旧 raw 重放冒充真实 Chrome | 否；R4-E 必跑全新真实 Chrome |
| 是否跨 run 拼接 | 否；最终 candidate 只引用 R4-E |
| 是否只信旧日志/Report/violations | 否；隔离实跑、原始字节、Git AST 重算 |
| 是否允许宽松 normalization | 否；仅 `/recordedAt` |
| 是否自动签署 Human/G7 | 否；合同层禁止 true/signed |
| 是否能从脏工作树读取未声明依赖 | 否；detached commit + undeclared read trap |

第二轮：Fatal 0 / Major 0 / Minor 1。

Minor：当前 WSL 环境能解析 Drawio XML但未完成桌面视觉签署；用户此前认可 PX Drawio 方向，本轮只同步状态和 T04 证据层，不改变布局方向。外部审查仍需检查图文一致性。

### 3.1 第二轮发现后的文档修订

内部第二轮曾发现并已在同一文档阶段关闭四项会阻断自动化实现的问题：

1. extension 只有 `pnpm-lock.yaml`，原 `npm ci` 表述不可执行：已改为固定 pnpm + `--frozen-lockfile`；
2. 根 `requirements.txt` 是浮动范围：已要求 exact-version/hash lock + 离线 wheelhouse index；
3. local acceptance commit 可能成为不可达对象：已要求可在空 bare repo 导入的 Git bundle；
4. ExitManifest 引用包含自身的 public archive 会 hash 自引用：已改为先生成排除 ExitManifest 的 payload-only archive，再生成旁挂 manifest。

另将“每个新 T04 文件必须已有独立审计 hash”的不可能字段改为 `sourceDisposition + sourceReferenceSha256`，并为 index/toolchain 原始字节增加 ArtifactRef。修订后重新执行三份 Schema 元校验通过；根正例和缺根 required 负例通过。

第二轮修订后结论：Fatal 0 / Major 0 / Minor 1（最终依赖闭包数量仍须由 T04-0 实测）。

## 3.2 第三轮：时间闭环与集合防假绿审计

第三轮发现并在文档阶段关闭 1 项 Major、4 项集合型假绿风险：

1. 原 T04-A14 要求“新的独立实现审查 Fatal 0/Major 0”，但该审查只能在 SnapshotRevalidation 与 ExitManifest 生成后发生，形成未来证据自引用。现已将 A14 收敛为候选生成时可验证的文档外审、PRD/架构/Drawio/false-green 检视和两轮内部审计；新的独立实现审查改为候选后的外层 Stage Gate，只引用 ExitManifest hash，不回写候选或 payload archive。
2. `stepResults` 原只约束数量，现由 Schema 固定 `derive/validate/report/package` 四步顺序。
3. replay 比较原只约束 10/1/8 个数量，现固定十个 deterministic artifact 集合、唯一 InvocationRecord `/recordedAt` 归一化及八个 stdout/stderr 路径集合，并要求 semantic runner 重算 `comparison.path == baseline.path == replay.path`。
4. T02、T03、T04 acceptance result 原可用重复 ID 满足数量，现固定 12、14、14 个精确 ID 集合。
5. negative result 原可重复 requirement，现逐项固定 25 个 requirementId、requirementKey、expected/observed failure 映射；新增 N-023 comparison path identity、N-024 tar membership policy 与 N-025 authorization/audit binding，真实 mutation 和 observed failure 仍由 semantic runner 从原始输入重算。

ExitManifest 同时增加常量 `publicArchivePolicy=payload_only_excludes_exit_manifest_and_independent_audit`；validator 还必须读取真实 tar member index，不得只信常量。

第三轮修订后结论：Fatal 0 / Major 0 / Minor 1。该 Minor 仍是实现期必须重算依赖闭包文件数，不是可预填数量。

## 3.3 第四轮：产品基线与工具叠加审计

复算 `430cdd...` 后确认 `pnpm-lock.yaml` 与当前字节相等，但当前 `package.json` 比产品基线多出 T03 script aliases。原计划若继续修改 package scripts，会同时声称“产品构建输入 byte-equal”和“package.json 已变化”，存在直接矛盾。现已关闭：

- T04 目标文件删除 `package.json`；
- acceptance commit 的 package/lock 均取 T02.5 product base 原始字节；
- T03/T04 全部入口以冻结 direct Node argv 执行；
- 只允许叠加不进入 WXT 产品 bundle 的已登记 `e2e/**`、三份 T04 Schema 与审计规格文件。

第四轮结论：Fatal 0 / Major 0 / Minor 1。若实现期发现任一工具必须修改 package dependency 或产品构建配置，则停止并返回文档阶段，不得静默扩大叠加边界。

## 4. 尚未满足的实施门禁

当前未满足：

1. Claude Code CLI 或其他独立 reviewer 对本轮文档包给出 Fatal 0/Major 0；
2. 用户在该外审之后明确批准 `T04-0..T04-7 implementation`；
3. T04-0 开始前创建独立的子阶段 preimplementation audit 和实施授权摘要。

因此当前决定：

```text
T03 LIMITED PASS: 保持
T04 document candidate: INTERNAL PASS
T04 implementation: NO-GO
PX-5: FAIL / REOPENED
PX-6: BLOCKED
```

## 5. 外审重点

- 双泳道是否是必要且无证据混合的最小方案；
- T04 acceptance commit 能否完整绑定 T03 未进入 product base 的工具；
- exact/normalized/semantic 三种比较边界是否无歧义；
- R4-E 全量 Chrome 分母是否足以继承 T02/T03；
- 三份合同是否存在自引用、无法物化或无法独立重算字段；
- T04-A01..A14 与 N-001..025 是否能拒绝部分执行假绿；
- Human Review 是否仍严格留给 PX-6。
