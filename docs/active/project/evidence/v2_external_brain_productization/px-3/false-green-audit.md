# PX-3 False-Green Audit

- 从 `px-3-e2e.json` 重算 51/51 checks、20/20 route matrix、8 个并发结果单一 tabId。
- source fingerprint 来自当前 PRD 字节；sourceId/operationId 来自真实 Runtime 响应。
- reconnect 先通过 Playwright transport abort 产生真实 offline，再解除 fault，等待 Runtime online + Adapter ready，并验证真实 source 重新出现。
- PNG magic 和实际尺寸由 `file` 独立核查，不依赖文件名。
- 多窗口选择是纯 coordinator 单元测试；本阶段不把它描述为操作系统多窗口视觉证据。
- “restart-equivalent” 表示新调用重新 query Chrome tab；不冒充真实浏览器进程或 durable Runtime operation restart。

结论：Fatal 0，Major 0，Minor 0。
