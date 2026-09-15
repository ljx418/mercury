# PX-5 自动化验收

> 2026-09-09 撤回：本文件后续内容为旧记录，原 PASS / Major 0 / 仅待人工签署结论失效。当前 PX-5 FAIL / REOPENED，PX-6 BLOCKED_BY_PX5_MAJOR。参见 [中断恢复证据复核](resumption-evidence-audit-2026-09-09.md)。未补齐证据前不得签署或放行。

## 2026-09-08 历史记录（不作为当前放行依据）

日期：2026-09-08

```text
PX-5 automated evidence candidate: PASS
Final Report passed: false
Human Review: pending
PX-6: WAITING_FOR_HUMAN_REVIEW
```

- 真实 corpus：12 个不同原始字节和 SHA-256，分布为 6 个冻结网页 DOM snapshot、3 个显式本地文档、3 个用户型 Markdown/note。
- Headless Chrome：77/77 断言通过；39 个结构化场景、39 份 Execution Observation、39 份 Screenshot Metadata。
- 三个入口满足阈值；五类 route 均覆盖 direct-open、reload、Back、reopen。
- 8 个并发打开只创建 1 个 tab，0 次 ingest；3 次 Permission；3 次 Forget 均验证四面 absent 与四类同源重开 `SOURCE_NOT_FOUND`。
- 四类受控故障通过；360/420/768/1280 真实 PNG 通过；Axe serious/critical 为 0/0。
- 26 个当前源码文件 AST 边界扫描 0 violation。
- 前端 19 文件/153 测试、Runtime API 4、PX-0.2 109 负例、V2-7 24-source 均通过。

自动化证据不能代签 PX-6，故最终 Report 按合同保持未通过。
