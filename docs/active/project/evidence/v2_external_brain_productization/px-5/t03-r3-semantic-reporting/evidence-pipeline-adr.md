# ADR：T03 生产证据派生、共享校验与纯报告流水线

日期：2026-09-14  
状态：`ACCEPTED ARCHITECTURE / T02.5 INPUT QUALIFIED / T03-1..5 PASS`

## Context

PX-5 的旧生产链直接消费 report-shaped 数据，并存在默认补值、复制 contract 结果和信任报告自报字段的风险。T02.3 暴露 offline authority 问题，T02.4 修复该边界，T02.5 再将 T01 36 个唯一 assertion 绑定进 raw seal。后续正输入必须来自 T02.5；T03 继续复用同一 Schema、semantic 和 TypeScript AST 规则。

## Decision

采用单向、无环流水线：

```text
accepted T02.5 sealed raw + artifacts + Git snapshot
  -> v2PxArtifactReader
  -> v2PxDerivedFacts
  -> shared Schema / semanticRulePass / computeGateResults / architectureScan
  -> ProductionValidation
  -> HumanReview(pending)
  -> pure Report v12 JSON + HTML renderer
  -> ProductionPackage
  -> InvocationRecord
```

### 权威与依赖方向

- Raw、artifact 原始字节和 Git blob 是上游权威；DerivedFacts 只能派生，不能补写上游。
- 每个派生字段必须能回到同一 run 的 eventId、artifact path/hash 或 Git blob；禁止按数组位置、最近时间或输入布尔猜测。
- Contract fixture 与 production profile 调用同一 Schema/semantic/AST core；profile 只改变输入 reader 和 Human Review 状态，不改变规则实现。
- Renderer 只读取已验证的 DerivedFacts、ProductionValidation 和 HumanReview；不得读取浏览器、Runtime、Git 工作树、尚未生成的 Package 或旧 Report。
- Package 在 Report 之后生成且不包含自身 hash；父编排器最后写 InvocationRecord。

### 路径与进程合同

- CLI 接收的 `runRoot`、`snapshotRoot`、`outputRoot`、schema/spec/fixture 路径在父进程入口立即规范化为绝对路径。
- ArtifactRef 内仍保存相对 run/package root 的 POSIX 路径；拒绝绝对路径、`..`、NUL、symlink escape、缺文件和 hash/length 不符。
- 子进程只接收绝对工具路径和显式 cwd；仓库根、脚本目录和临时目录三种启动位置必须产生相同事实与退出码。
- 缺必需观察只生成 `CollectionDiagnostic(passed=false)` 并退出 2；完整性/合同失败退出 1；成功 candidate 退出 0，但 final 仍为 false。

## Rejected Options

| 方案 | 拒绝原因 |
|---|---|
| 继续使用旧 report-shaped production generator | 可在缺原始事实时补默认值，无法证明 G1-G7 来自真实观察 |
| Contract 与 production 各实现一套 validator | 规则会漂移，contract regression 无法证明 production 执行同一算法 |
| Report 先于 validation 生成并作为 validator 输入 | 形成自证和循环依赖，报告字段可冒充事实 |
| 跨 T02.1/T02.2/T02.3 拼接分母 | 破坏单 run 因果、seal 和用户场景顺序，不可审计 |

## Consequences

- 增加 DerivedFacts、ProductionValidation、ProductionPackage、CollectionDiagnostic、InvocationRecord 五份 P7 机器合同和固定编排步骤。
- 实现成本高于直接改报告，但可以逐字段重算 provenance、拒绝旧链假绿，并允许 R4 对同一输入做确定性复验。
- T03 只形成自动化 candidate；Human Review、PX-5/PX-6 和产品完成声明仍由后续门禁决定。
