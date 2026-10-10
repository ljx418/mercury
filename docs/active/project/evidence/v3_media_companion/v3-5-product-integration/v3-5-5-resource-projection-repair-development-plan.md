# V3-5-5 资源投影修复开发计划

日期：2026-10-09。状态：实施前冻结。

## 问题

真实 run `v3-5-5-real-20261009T075713Z` 的产品流程、四视口、Ask、跳回与导出均通过，但正式 `v3-media-product-acceptance/v2` 语义校验拒绝 `temporaryDiskBytes=0`。根因是 `TranscriptTaskService` 已记录真实 `resources`，而 `MediaTranscriptProjectionService` 未将该只读字段投影给扩展。

## 范围

- 修改 `transcript_projection.py` 与既有 v1 JSON Schema：公共 projection 增加必有、可为 `null` 的 `resources`，值为转写任务资源副本；无转写任务时为 `null`。
- 修改 `test_v3_media_transcript_projection.py`：覆盖空值、真实资源映射、Schema 与安全会话 API。
- 不修改资源上限、ASR、临时文件生命周期、正式产品回执 Schema 或语义阈值；只同步此前已存在于 TypeScript 类型中的 projection 字段。

## 实施顺序

1. 增加失败回归断言并确认当前实现缺字段。
2. 实施最小投影映射，避免返回内部可变对象。
3. 运行目标 pytest、Runtime 全量回归、扩展 typecheck/build。
4. 删除作废 run，执行全新 V3-5-5 真实 Chrome run。
5. 仅在正式 v2 receipt Schema 与语义均通过后冻结证据。

