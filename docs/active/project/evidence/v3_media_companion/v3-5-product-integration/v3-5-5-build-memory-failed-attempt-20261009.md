# V3-5-5 Build 内存竞争作废尝试

日期：2026-10-09。

扩展 `typecheck` 通过；`wxt build` 与 Runtime 全量 pytest 并行时，Rolldown 写入 chunk 遇到 `Cannot allocate memory (os error 12)`。同一时段 Runtime `597 passed`。该失败属于宿主资源竞争，不是产品断言失败。

处置：不复用不完整 build；等待 pytest 释放内存后串行重新执行完整 build。串行 build 未通过前禁止启动真实 Chrome run。

