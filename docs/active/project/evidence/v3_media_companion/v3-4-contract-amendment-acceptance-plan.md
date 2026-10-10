# V3-4 合同修订验收计划

日期：2026-10-08。

| ID | 必须结果 |
|---|---|
| C01 | V1 字节不变；V2 Draft 2020-12 meta PASS |
| C02 | ready 正例 Schema/semantic PASS |
| C03 | degraded 正例 Schema/semantic PASS，三视图仍闭合 |
| C04 | blocked 正例 Schema/semantic PASS，evidence 允许空且三视图零发布 |
| C05 | ready 缺 evidence/outline/projection 必须拒绝 |
| C06 | blocked 携带 outline/timeline/mindmap 必须拒绝 |
| C07 | 跨 task、未知 evidence、时间逆序、projection drift 必须拒绝 |
| C08 | relativeArtifactRef 绝对路径或 `..` 必须拒绝 |
| C09 | transaction publish flags 与终态不一致必须拒绝 |
| C10 | 文档明确 qualification seal 与 content handoff 分离，禁止 fixture/旧 private 目录替代 |

C01..C10 全通过后只关闭合同 Major，不授权新的 8 帧上传或 V3-4 产品实施。
