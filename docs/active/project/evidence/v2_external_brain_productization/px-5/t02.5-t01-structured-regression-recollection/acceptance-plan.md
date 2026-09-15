# T02.5 开发与验收计划

日期：2026-09-14。固定分母 14 项，无 N/A。

| ID | 必须结果 |
|---|---|
| T02.5-A01 | 旧五轮 raw/seal 字节不变，新 run 使用独立 run/build/profile/runtime/db/artifact/seal |
| T02.5-A02 | T01 原始结果真实存在，36 个 assertion ID 唯一且全部 passed |
| T02.5-A03 | `command_result` 的 T01 `structuredResult` 非空并被 artifactRefs 与 raw artifact index 覆盖 |
| T02.5-A04 | 结构化 T01 artifact 的 source SHA-256 等于本 run `.infra` 原始 T01 JSON；公开内容不含 detail/私有路径/token |
| T02.5-A05 | raw Schema、seal、artifact path/hash/length 与 snapshot/build index 全部重算通过 |
| T02.5-A06 | T02.4 既有三入口、12 source、两类普通恢复、12 durable Forget、四 fault、四视口、Axe/Keyboard 与 Runtime offline authority 分母全部保持 |
| T02.5-A07 | Runtime 每个 request 恰好一个 terminal；offline interval 只有 transport failure、无 response |
| T02.5-A08 | build/typecheck、collector、frontend、Runtime、T01 全量前置通过，不使用 skip 参数 |
| T02.5-A09 | T03 input readiness Fatal=0/Major=0；Status response 与 frontend offline inference 分权威计数 |
| T02.5-A10 | T03 DerivedFacts 从 structured artifact 派生 T01 36/36，不读取未引用 `.infra` 旁证 |
| T02.5-A11 | T03 ProductionValidation 正基线 61 passed/2 pending、G1-G6 passed/G7 pending；T02.4 因缺 T01 structured evidence fail closed |
| T02.5-A12 | 公开字节无 secret/private path；cleanup 4/4 |
| T02.5-A13 | 子阶段测试、完整 R2 与 T03-0..4 重放全部通过；失败 run 不 seal、不拼接 |
| T02.5-A14 | PRD/架构/false-green 复核 Fatal=0/Major=0；只允许恢复 T03-5 实施前审计 |

任一 failed/pending/deferred 阻止 T02.5 PASS。T02.5 通过不等于 T03、PX-5、PX-6 或 V2 通过。
