# PX-3 架构核对

- P1 Background：`workspaceOpen.ts` 串行并发请求，并基于 sender/focused/lowest tabId 选择标签页。
- P2a/P2b：Side Panel 与 Workspace 只显示稳定 ID，均通过 P3 client 重读 Runtime。
- P3 Runtime Client：poller 单 in-flight、可取消，online 5 秒，offline 1/2/4/8 秒封顶。
- P4/P5/P6：未修改 Runtime API、Memory service 或 data_service。
- Service Worker restart：内存 queue 不承诺持久化；每次请求重新 `tabs.query`，符合 ADR。

目标架构达到。Fatal 0，Major 0。
