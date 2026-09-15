# PX-2 Side Panel Quick Surface 验收记录

日期：2026-09-08

## 结论

PASS。PX-2 的实现、真实 Runtime 验证和 Headless Chrome 产品面验证均通过；Fatal 0，Major 0。

## 自动化结果

- 前端全量测试：17 个文件、144 项通过。
- TypeScript、WXT production build：通过。
- Runtime V2 API：4 项通过。
- PX-0.2 semantic validator 回归：9 Schema、65 正例、109 负例通过，G1-G7 全绿。
- Headless Chrome：46 项断言通过；五 route x 四恢复模式为 20/20。
- 真实样本：读取当前 `docs/active/project/01-prd.md` 原始字节，Runtime source 为 `src_00000000000000000000000002`，状态 `trace_ready`，幂等 replay 通过。
- 视口：420x900 与 360x900 均 `scrollWidth == clientWidth`。
- 并发打开：8 个请求得到 1 次 `created_new`、7 次 `focused_existing`，共用一个 tabId；打开过程 0 次 source ingest。

## 证据

`quick-surface-e2e.json`、`screenshots/` 和 `logs/`。

第一次 PX-2 E2E 因测试错误地搜索免责声明中的单词 `located` 而失败。断言改为检查页面不存在 located 状态元素，同时要求 Runtime `sourceId` 与 `fallback_text` 可见；随后完整重跑通过。该失败不被隐藏，也未计为产品缺陷。
