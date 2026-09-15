# T03-2 T02.3 DerivedFacts 重放验收结果

日期：2026-09-14。状态：PASS。Fatal=0，Major=0。

验证命令与产物：

```text
pnpm test:v2-px-r3-derived: 2/2 PASS
validationRunId: t03-r3-production-candidate-20260914T083427
derived-facts.json sha256: 10f4d4d84bfca16bfe4a7b09455d1e2c8cc2b73206647555ce91965c6ae2c8ec
DerivedFacts Schema errors: 0
```

独立从 T02.3 raw 重算得到：87 scenario、1375 event、1158 artifact、12 source（6 web / 3 local / 3 note）、三入口 `2/3/2`、五 route x 四恢复全覆盖、两类普通错误恢复、557/557 Runtime 唯一终态、3 x 4 durable Forget trigger/recovery、Permission 3、四 fault、四视口、Axe 0/0、Keyboard 5/5。每个 scenario provenance eventId 均存在于同一 raw。

旧 T02.1 继续因 durable Forget 缺失产生 `T03-IN-09`；没有跨 run 补数。允许进入 T03-4 前共享核心回归与 ProductionValidation。
