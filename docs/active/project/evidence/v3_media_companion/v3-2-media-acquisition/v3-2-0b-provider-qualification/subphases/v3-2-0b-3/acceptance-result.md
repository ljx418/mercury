# V3-2-0b-3 SRT Normalizer 验收结果

日期：2026-09-22  
runId：`v3-2-0b-3-20260922T051816Z`

```text
B03-01..B03-12: 12/12 PASS
ASR regressions: 51 passed
Fatal=0 / Major=0 / Minor=0
V3-2-0b-3: PASS
```

标准、BOM/CRLF/多行 fixture 通过；空结果、坏时间、零长度、逆序、重叠、越界、重复 ID/范围、diagnostic/control character 和全部大小上限均按稳定 failure code 拒绝。首轮修复了“合法时间戳但空文本”错误分类，未自动修正任何 fault fixture。

证据：`runs/v3-2-0b-3-20260922T051816Z/pytest.xml`、`acceptance-result.json`。
