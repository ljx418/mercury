# V3-4 v2 合同修订出门审计

日期：2026-10-08。范围：合同、fixture、semantic verifier 和权威计划修订；未实施 V3-4 产品代码。

## 决定

`INTERNAL CONTRACT PASS / EXTERNAL DOCUMENT REVIEW REQUIRED / PRODUCT IMPLEMENTATION NO-GO`

Fatal=0，Major=0，Minor=2。

## C01..C10

| ID | 结果 | 证据 |
|---|---|---|
| C01 | PASS | v1 SHA-256 固定；v2 Draft 2020-12 meta PASS |
| C02 | PASS | ready Schema + semantic |
| C03 | PASS | degraded Schema + semantic |
| C04 | PASS | blocked Schema + semantic，零投影 |
| C05 | PASS | ready/degraded 缺 evidence 或任一投影均拒绝 |
| C06 | PASS | blocked 携带任一投影均拒绝 |
| C07 | PASS | 跨 task、未知 evidence、时间逆序、projection drift 均拒绝 |
| C08 | PASS | 绝对路径和 `..` path escape 均拒绝 |
| C09 | PASS | ready/degraded/blocked 的 publish/failure receipt 错配均拒绝 |
| C10 | PASS | 权威计划固定 qualification seal 与 fresh-run content handoff 分离 |

执行：`pytest tests/test_v3_media_pipeline_contracts.py -q` -> `48 passed in 0.70s`。

Runtime 全量回归：`pytest -q` -> `633 passed, 1 existing deprecation warning in 82.14s`。

## 规格结论

- 固定 12 页分母保持：样本 01..10 `ready`，样本 11 restricted=`blocked`，样本 12 low-signal=`degraded`。
- 受限页不再被 Schema 迫使生成假大纲。
- Outline 冻结为本地确定性抽取，不新增 transcript/OCR 云上传。
- V3-4 必须新 run 重建真实正文；不得拼接 V3-3 已清理的 private artifact。

## Minor

- M-1：本地抽取的大纲表达质量留待 V3-5 人工验收，不得由合同测试宣称质量通过。
- M-2：同一 session 完成实现与内部审计，不具备组织独立性；外部文档复审仍是硬门禁。
