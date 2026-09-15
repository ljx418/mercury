# T03 R3 实现出门独立审计请求

日期：2026-09-14  
请求状态：`INDEPENDENT REVIEW REQUIRED`

## 1. 决策对象

```text
sourceRunId: t02-r2-t01-structured-production-input-20260914T125700
source raw sha256: ce272df479499e10092bc5d6a24610ebcd91782c87d4be34dceb09f296a5f0c3
source seal: fed6155ace6c0132c70c86bd3daccef987bd7c441df8960811e734274ea1b70f
validationRunId: t03-r3-production-exit-candidate-20260914T134804
snapshotCommit: 430cddcb7ff618978851af1f3b9a3c48f2370d36
```

审计前先读取 `AUDIT_MANIFEST.md`，逐项重算 19 个载荷 SHA-256，并确认平铺目录无子目录、总文件数为 20。

## 2. 必须独立复核

1. 五份 P7 machine contracts 和 Report/Human/Architecture 根 Schema 是否全部 meta/root valid。
2. 87 个 P7 ArtifactRef 与 31 个 Report path/hash 是否可从声明 root 重算，且不存在路径逃逸、绝对工作区泄漏或自引用。
3. T02.5 raw/seal 是否只读，DerivedFacts 是否真实满足 6+3+3 sources、三入口、五 route 四恢复、两类普通 recovery、12/12 durable Forget、四 fault、四视口、Axe 0/0、Keyboard 5/5、T01 36/36。
4. 63 RuleId 是否精确映射 G1-G7；production candidate 是否只有两条 Human 规则 pending，0 failed、0 N/A。
5. 109 requirement registry/cases、42 production mutations、204 status observations 是否由共享 core 重算，而非信任 report 布尔值。
6. G4 是否真实读取 snapshot commit 的 28 个 Git blob；公开 manifest 是否 `inlineSource=0`，内存 AST scan 与六类源码 mutation 是否仍实际执行。
7. Report、Package、Invocation 是否严格单向，Human/G7/final 是否保持 pending/false。
8. T02.4 负路径是否只产生 `T03-IN-11` diagnostic 并 exit 2，不产生 validation/report/package/invocation。
9. 全量回归日志是否可支持 Contracts 3、Reader 3、Derived 3、Production 5、Report 1、Package 2、Orchestrator 1、Collector 17、frontend 169、Runtime 307 与 typecheck PASS。
10. 首个旧候选 `132413` 的 Architecture Manifest Major 是否真实关闭，且未通过放宽 Schema、减少 tracked paths、跳过 AST 或修改 T02.5 达成。

## 3. 固定门禁

按 active `acceptance-plan.md` 的 T03-A01..A14 全部审查，不得标记 N/A。组织独立审计自身必须给出 reviewer session identity、审计请求 SHA-256、逐项复现命令与 Fatal/Major/Minor。

只有 `Fatal=0 / Major=0` 才允许：

```text
T03: limited PASS for R3 production-candidate evidence pipeline
T04: may enter preimplementation planning/audit only
```

无论审计结果如何，均禁止宣称 PX-5、PX-6、V2、RAG 或 RKM 完成；禁止签署 Human Review；禁止修改旧 T02/T03 run。

## 4. 审查输出

请将独立报告落盘到：

```text
docs/active/project/evidence/v2_external_brain_productization/px-5/
t03-r3-semantic-reporting/independent-implementation-exit-audit.md
```

本包包含一个确定性 tar 归档，供复核完整 candidate、公开 T02.5 source evidence、本地 verifier 输出和子阶段验收文档。tar 内目录结构不改变外部审计 staging 目录的平铺约束。
