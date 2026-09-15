# T03 实施前 Claude Code CLI 独立审查请求

日期：2026-09-12  
状态：`HISTORICAL / SUPERSEDED BY IMPLEMENTATION RISK STOP`  
原决策：是否允许进入 T03/R3 共享语义、AST 校验和纯报告生成的实质实现。

> 本请求对应的独立审查曾返回 Conditional Go，但实施期发现 T02.1 durable Forget raw 与冻结 PRD/G3 冲突，该放行已经撤销。当前审查入口改为 `manual-independent-risk-audit-request.md`；不得继续按本文放行 T03。

## 1. 阅读顺序

先读外部审计包 `AUDIT_MANIFEST.md`，再读本文件。仅做只读审查；不得修改主工作树，不得运行旧 PX production generator/validator，不得生成 production PASS。

冻结输入：

```text
runId: t02-r2-raw-production-input-20260912T053500
snapshotCommit: 9205336cc8ae11024bd9a98e2896dfe37edbdb1e
rawSha256: 711d2f2c976658427148c5b717710d0a8ecf09b83b20aa43210e270d6523b0f2
sealSha256: acdc13434fe140daf5e3ea86abbe10c61ca1fb0509db9de17e10c44f3d4abcb0
T02.1 independent audit sha256: 06afe77ed83c557bd9f4a3725eb135547aa56b2b2e40a9a32f9a69baabd3b020
```

## 2. 必答问题

1. T02.1 限定 PASS、唯一 run 绑定及三个 Minor 的处置是否足以进入 T03，且没有扩大为 T03/PX-5 PASS？
2. 四份新 Schema 和 raw -> derived -> validation -> pending human -> report -> package -> invocation 的顺序是否无环、可重算？
3. Contract 与 production 共享 Schema/semantic/AST core，且旧 63 RuleId、41 semantic RuleId、109 fixtures 不缩小的方案是否可实现？
4. Candidate 的 61 machine + 2 human pending、G1-G6 passed/G7 pending、Report v12 G7=false/final=false 映射是否拒绝自动签署？
5. 固定 42 个 production raw/byte/causality mutation 是否能证明 validator 实际读取原始字节、事件因果和 Git blob，而不是读取报告自报字段？
6. Legacy production hard block、缺观察 diagnostic exit 2、determinism 和 package/report 防自引用是否完整？
7. T03-A01..A14 是否足以阻止跨 run 拼接、默认事实、旧结果复制、弱化 G4/G7 或缩小 PRD 分母？

## 3. 输出要求

逐项给出复现证据、Fatal/Major/Minor 和门禁结论。只有 `Fatal=0 / Major=0` 才允许：

```text
T03 implementation: CONDITIONAL GO
T04 / PX-6 / RKM: BLOCKED
PX-5: FAIL / REOPENED
```

审查结果保存到：

```text
docs/active/project/evidence/v2_external_brain_productization/px-5/
  t03-r3-semantic-reporting/independent-preimplementation-audit.md
```
