# T04 R4 实施前外部文档审查请求

日期：2026-09-14  
请求状态：`INDEPENDENT DOCUMENT REVIEW REQUIRED`

## 1. 决策请求

请判断本包能否无歧义指导 T04-0..T04-7 自动化实现，并严格限定结论：

```text
若 Fatal=0 且 Major=0：
T04 documentation: CONDITIONAL GO
T04 implementation: 仍需用户另行明确批准

否则：
T04 documentation: FAIL / REOPENED
T04 implementation: NO-GO
```

不得把文档通过扩大为 T04、PX-5、PX-6、V2、RAG 或 RKM 通过。

## 2. 必须审查

1. 先重算 `AUDIT_MANIFEST.md` 全部 payload hash，并核对 staged/source 一致。
2. 对照 PRD 与架构确认 T04 不新增产品能力、不修改 P0-P6、不前移 RKM。
3. 复核 T03 独立审查 5 项 Minor 是否有明确、不可追写旧证据的处置。
4. 检查 R4-P 确定性重放和 R4-E 全新真实 Chrome 是否职责分离、均必要且不可拼接。
5. 检查 product base、local acceptance commit、依赖闭包、lockfile、toolchain 和主工作树隔离是否可实现。
6. 检查十项 byte-equal、Invocation `/recordedAt` 单一归一化与 fresh-lane semantic comparison 是否无歧义。
7. 按 T04-A01..A14 逐项判断是否有 N/A、无法机器重算或只信输出自报的项目。
8. 按 T04-N-001..025 检查 requirement key、failure code 和实际原始输入 mutation 是否足以拒绝假绿，特别复核 comparison path identity、真实 tar member index 与授权/外审 hash 绑定。
9. 检查 SnapshotInputManifest、SnapshotRevalidation、ExitManifest 是否无自引用并能物化；Schema 编码是否可由当前规格直接完成。
10. 检查中文 HTML、Drawio、public tar、private/secret scan 和审计证据是否均进入 ExitManifest。
11. 检查 SnapshotInputManifest.governance 是否能强制绑定本次外审与外审后的用户实施授权，且不会把文档批准扩大为代码授权。
12. 检查 Human Review、G7、final 和 PX-6 是否始终 pending/false/blocked。
13. 给出 Fatal/Major/Minor、精确文件/段落、最小修复与最终门禁建议。

## 3. 当前事实

```text
T03 independent audit SHA-256:
1d6d5cbf82e90410497601c0e0eb30fc66e2c3e88624bbaf0b1911e241f7ad71

T02.5 source run:
t02-r2-t01-structured-production-input-20260914T125700
raw ce272df479499e10092bc5d6a24610ebcd91782c87d4be34dceb09f296a5f0c3
seal fed6155ace6c0132c70c86bd3daccef987bd7c441df8960811e734274ea1b70f
product base commit 430cddcb7ff618978851af1f3b9a3c48f2370d36

T03 baseline candidate:
t03-r3-production-exit-candidate-20260914T134804
machinePassed=true / G1-G6 passed / G7 pending / finalPassed=false

T03 stale negative candidate:
t03-r3-production-exit-candidate-20260914T132413
```

## 4. 输出位置

请将只读审查结果保存到：

```text
docs/active/project/evidence/v2_external_brain_productization/px-5/
t04-r4-snapshot-revalidation/independent-document-audit.md
```

审查 session 不运行 T04 代码、不修改主工作树、不签署 Human Review。
