# T04 R4 隔离快照复验开发计划

日期：2026-09-14  
状态：`FROZEN DOCUMENT CANDIDATE / EXTERNAL DOCUMENT AUDIT PENDING / IMPLEMENTATION NO-GO`

## 1. 前置条件

- T03 独立实现审查结论为 LIMITED PASS，审查 SHA-256 为 `1d6d5cbf82e90410497601c0e0eb30fc66e2c3e88624bbaf0b1911e241f7ad71`。
- T03 唯一 baseline candidate 为 `t03-r3-production-exit-candidate-20260914T134804`。
- T02.5 raw/seal/commit 分别为 `ce272d...5f0c3`、`fed615...1b70f`、`430cdd...0d36`。
- T04 文档外审必须 `Fatal=0 / Major=0`，且用户随后另行批准 T04 实现；当前用户授权只覆盖规划与审计。
- 外审通过及用户另行批准后，必须先落盘同目录 `implementation-authorization.json`，由 SnapshotInputManifest.governance 同时绑定固定路径的外审与授权摘要；缺任一项禁止启动 T04-0。

## 2. 开发范围

### T04-0 合同与依赖闭包冻结

- 复核并锁定文档阶段已落盘且元校验通过的 SnapshotInputManifest v1、SnapshotRevalidation v1、ExitManifest v1；实现期不得自行改字段。
- 固定 25 条 T04 mandatory negative requirement。
- 构建 T03/T04 ESM import graph、schema/spec/fixture/lockfile/toolchain closure。
- 对闭包每个文件记录 path、mode、SHA-256、byteLength、source audit hash；相对 import 必须全部解析。

完成条件：三份 Schema 元校验、根正例、每个 required 缺失负例、闭包 missingEdges=0、unexpectedFiles=0。若实现发现 Schema 不可满足，必须回文档门禁并发布明确版本，不得原地放宽。

### T04-1 隔离快照构建

- 从 `430cdd...` 创建 detached isolated worktree。
- 只复制闭包清单批准文件并创建 local-only acceptance commit。
- 使用精确 pnpm 版本执行 `pnpm install --frozen-lockfile`；Python 使用 T04-0 生成的带 hash lock 与 wheelhouse 执行 `pip --no-index --require-hashes`。禁止 `npm ci`、浮动 requirements 解析或复制主工作树 `node_modules`/site-packages。
- 生成可在空 bare repository 导入的 snapshot Git bundle，以及 product/source/build/dependency/environment indexes 和 SnapshotInputManifest。

完成条件：主工作树 HEAD/index 未变；快照 commit/tree/index 可重算；产品路径与 T02.5 byte-equal；实现闭包只来自显式 source。

### T04-2 R4-P 确定性重放

- 在隔离快照、新鲜空输出根中使用 T02.5 sealed input 实际执行 T03 四步。
- 使用与 baseline 相同的 validationRunId，但以独立 filesystem namespace 避免覆盖。
- exact set 逐字节比较；InvocationRecord 只允许删除 `/recordedAt` 后 canonical JSON 相等。

完成条件：四步实际 exitCode=0；exact mismatch=0；normalized mismatch=0；baseline/candidate 字节未改。

### T04-3 R4-E 真实 Chrome 全量复验

- 从同一 T04 snapshot 全新 build/profile/Runtime/database/run/output。
- 执行 T01 36 唯一 assertion、R2 全量采集、真实 Axe/Keyboard、四故障、四视口和 cleanup。
- 新 raw 独立 seal，不引用 T02.5 artifact；失败 run 不封存、不拼接。

完成条件：完整 T02-A01..A12、T02.1/T02.2/T02.5 输入分母通过；12 source=6 web+3 local+3 note；三入口、5x4 route、2 recovery、3x4 Forget、Axe 0/0、Keyboard 5/5、T01 36/36。

### T04-4 新鲜 production candidate

- 只以 T04-3 新 raw 运行完整 T03 pipeline。
- 执行 63 RuleId、109 contract fixtures、42 production mutations、G4 Git-blob AST scan。
- 生成 pending Human Review、Report v12、中文 HTML、Package、Invocation。

完成条件：G1-G6 passed；G7 pending；61 machine rules passed；2 human rules pending；0 failed/N/A；final=false。

### T04-5 比较器与负向矩阵

- 比较 R4-P 与 T03 baseline 的确定性；比较 R4-E 与 PRD/固定分母的语义等价，不要求动态 ID/时间/图片字节相等。
- 执行 T04-N-001..025，每例单一主要失败、无后续成功包。
- 特别拒绝 stale candidate 132413、缺依赖、实现 hash 漂移、输出覆盖、跨泳道拼接、缺 Chrome fresh lane、Human 自动签署和 G7/final 假绿。

完成条件：25/25 negative passed；任何 mutation 前 positive base 均先通过自身 profile。

### T04-6 ExitManifest 与审计产物

- 生成 SnapshotRevalidation、unsigned ExitManifest、中文 HTML 和 Drawio hash。
- ExitManifest 绑定两泳道、全部机器合同、命令日志、测试、PRD/架构/false-green 审计和外部审计请求。
- 先生成确定性 payload-only public tar，排除 ExitManifest 自身、private paths/token/profile/sqlite；再生成旁挂且引用该 tar 的 ExitManifest，避免 hash 自引用。

完成条件：全部 path/hash/length 可重算；public secret scan 0；Human/G7/final 仍 pending/false。

### T04-7 实现出门审计

- 完成 T04-A01..A14、PRD/架构/Drawio 检视和两轮内部独立复算。
- 重建 19 payload + 1 manifest 平铺外审包。
- 先生成 payload-only archive 和旁挂的 unsigned ExitManifest；再由不同 reviewer session 做只读实现出门审计。独立审查引用 ExitManifest SHA-256，但不回写候选、不进入该 archive，避免时间和 hash 自引用。

完成条件：`Fatal=0 / Major=0`。通过后只允许进入 PX-6 实施前规划与人工验收准备。

## 3. 目标文件

计划新增或修改：

```text
docs/active/project/contracts/v2_px_snapshot_input_manifest.schema.json
docs/active/project/contracts/v2_px_snapshot_revalidation.schema.json
docs/active/project/contracts/v2_px_exit_manifest.schema.json
apps/chrome-extension/e2e/lib/v2PxSnapshotReplay.mjs
apps/chrome-extension/e2e/lib/v2PxSnapshotComparison.mjs
apps/chrome-extension/e2e/lib/v2PxSnapshotReplay.node-test.mjs
apps/chrome-extension/e2e/run-v2-px-r4-snapshot-revalidation.mjs
apps/chrome-extension/e2e/run-v2-px-r4-snapshot-revalidation.node-test.mjs
docs/active/project/evidence/v2_external_brain_productization/px-5/t04-r4-snapshot-revalidation/**
```

T04 不修改 P0-P6 产品实现，也不修改 `apps/chrome-extension/package.json` 或 `pnpm-lock.yaml`。T03/T04 CLI 由 orchestrator 使用冻结的直接 `node <entrypoint> ...` argv 调用，不依赖新增 package script alias。若真实 Chrome 失败指向产品缺陷，必须停止、另建修复子阶段并由用户批准；不得在 T04 工具提交中夹带 CSS、React、Runtime 或 Adapter 修复。

## 4. 实现依赖闭包最低集合

当前静态 import 图至少包含 15 个 T03 文件：五个 CLI/orchestrator 与十个 `lib/v2Px*.mjs` 依赖。实现时以解析器结果为准，不以文档数量为准；新增 T04 文件后闭包必须重新计算。闭包还必须包括：

- 九份 T03/PX JSON Schema 原始字节及三份 T04 Schema；
- semantic validator 规格、validation registry、109 fixture、42 mutation registry；
- `package.json` 与锁文件；
- Runtime requirements/lock、Python/Node/npm/Chrome 版本；
- T01/R2 runner 及其全部相对 import；
- build/source index 使用的产品源码和测试入口。

NPM 包本体不作为自报闭包文件计数，但必须由锁文件在隔离目录恢复，并记录实际 package name/version/integrity。未锁依赖或 fallback 到主工作树模块均失败。

`package.json` 与 `pnpm-lock.yaml` 必须取自 T02.5 product base commit 并保持逐字节相等。主工作树中 T03 script alias 的差异不进入 acceptance commit；T03/T04 工具入口作为独立 dependency files 被直接调用。这一边界防止为了注册测试命令而改变产品构建输入。

## 5. 每阶段审计纪律

每个 T04-0..7 在实施前落盘 `preimplementation-audit.md`，实施后落盘 `acceptance-result.md` 与 `prd-architecture-review.md`。后一阶段只有前一阶段 `Fatal=0 / Major=0` 且固定分母全部通过后才能开始。发现产品缺陷、合同漂移、依赖闭包缺失、真实 Chrome 与 replay 不一致或证据假绿时立即停止并回到计划。

## 6. 禁止项

- 修改任何 sealed raw、T03 baseline candidate 或独立审计报告。
- 从主工作树执行 R4 后声明隔离复验。
- 只复制顶层 CLI 而遗漏 transitive import、Schema、fixture 或 lockfile。
- 用 R4-P 的旧 raw 补 R4-E 的新场景，或用 R4-E 新截图补 R4-P。
- 使用旧 production generator/validator、Report 布尔或 `violations=0` 自报作权威。
- 自动签署 Human Review、将 G7/final 改 true、提前宣布 PX-5/PX-6/V2 通过。
