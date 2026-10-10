# V3-2-0b-3 SRT / Segment Normalizer 验收计划

日期：2026-09-22。固定 `B03-01..B03-12`。

| ID | 操作 | 必须结果 |
|---|---|---|
| B03-01 | 解析标准 SRT | 字段映射准确，文本非空 |
| B03-02 | 解析 CRLF/BOM/多行文本 | 规范化成功但不改变语义 |
| B03-03 | 空 stdout/空段 | 拒绝 V3_ASR_TRANSCRIPT_EMPTY |
| B03-04 | 坏时间格式 | 拒绝稳定 failure code |
| B03-05 | start>=end | 拒绝 |
| B03-06 | 逆序段 | 拒绝 |
| B03-07 | 重叠段 | 拒绝 |
| B03-08 | end>audio duration | 拒绝 |
| B03-09 | 重复 source ID/时间段 | 拒绝 |
| B03-10 | diagnostics/控制字符混入 | 拒绝 |
| B03-11 | 输入/段数/文本超限 | 拒绝且内存有界 |
| B03-12 | PRD/回归 | 无文本改写、无门户耦合、ASR 全回归通过 |

任何 fault fixture 被自动修正为 PASS 均算 Major 假绿。
